# ADR-005: Coupon Atomicity

## Status
Accepted

## Context
The booking platform includes a coupon system (FR-3.2) as the only discount mechanism. Admin staff create coupon codes with: code, type (percentage or fixed amount), value, validity window, max total uses, max uses per booking, applicable services/events (all or selected), and an active toggle. Visitors apply a code in the cart; the system validates and shows an adjusted total.

The key integrity challenge: a coupon with "max total uses = 100" must never be applied more than 100 times, even under concurrent booking completions. The use-count increment must be atomic with the booking creation — a coupon's available uses cannot be consumed by a booking that later fails to complete, and a booking that succeeds must have consumed its coupon use durably (FR-3.2, C10).

Constraints:
- C10: "Coupon codes high-entropy; per-code and per-booking limits enforced server-side; usage audit."
- T7: Coupon abuse risk (guessing, replay, stacking) — residual Low after controls.
- Coupons may be percentage-based (e.g. 10% off) or fixed-amount (e.g. €5 off).

## Options Considered

### Option A: Application-level check with optimistic locking
Read the coupon's current use count, check it against max_total_uses in application code, then increment — all outside a single database transaction. Use a version column (`UPDATE ... SET use_count = use_count + 1, version = version + 1 WHERE id = $1 AND version = $2`) for optimistic concurrency control.

- **Pros**: no long-running transaction; familiar ORM pattern.
- **Cons**: optimistic locking can fail under genuine contention — requires retry logic in the application; the coupon consumption and booking creation are separate operations — a crash after consuming the coupon but before creating the booking leaves the coupon consumed without a booking (leaked use); or conversely, the booking is created but the coupon increment fails — the booking has a discount that wasn't counted.

### Option B: Single serializable transaction spanning coupon validation, use-count increment, and booking creation
The entire "validate coupon → increment use_count → create booking" flow runs inside one serializable transaction. If any step fails, the entire transaction rolls back — the coupon use count is never incremented for a failed booking, and a successful booking always consumes its coupon.

- **Pros**: atomicity guaranteed — coupon consumption and booking creation succeed or fail together; no partial state; no retry complexity in application code; DB-enforced constraints (max_total_uses, max_uses_per_booking, validity window) are checked within the same transaction as the increment.
- **Cons**: a serializable transaction that spans both coupon and booking operations — if the transaction includes payment intent creation (Stripe API call), it would be long-running and could cause serialization failures. Mitigation: the payment intent is created *before* this transaction; only the final "confirm booking + consume coupon" is inside the transaction.

## Decision
**Option B: Single serializable transaction with partial unique index on coupon_redemptions.**

### Transaction model

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE

  -- 1. Validate coupon
  SELECT * FROM coupons WHERE code = $1 FOR UPDATE;
  -- Check: active = true, NOW() BETWEEN valid_from AND valid_until
  -- Check: use_count < max_total_uses
  -- Check: applicable_services includes this service (or is 'all')
  IF any check fails: ROLLBACK; RETURN appropriate error;

  -- 2. Check per-booking limit
  SELECT COUNT(*) FROM coupon_redemptions
  WHERE coupon_id = $1 AND booking_id = $2;
  -- Note: this will be 0 for a new booking (booking.id generated before this tx)
  -- The partial unique index below enforces this at the DB level as a safety net

  -- 3. Compute discount
  IF coupon.type = 'percentage':
    discount = (event.price * requested_seats) * (coupon.value / 100)
  ELSE: -- fixed
    discount = coupon.value

  -- 4. Increment use count
  UPDATE coupons SET use_count = use_count + 1 WHERE id = $couponId;

  -- 5. Insert redemption record
  INSERT INTO coupon_redemptions (coupon_id, booking_id, discount_amount)
  VALUES ($couponId, $bookingId, $discount);

  -- 6. Finalise booking with discount
  UPDATE bookings SET
    status = 'confirmed',
    coupon_id = $couponId,
    discount_amount = $discount,
    total_amount = ($eventPrice * $seats) - $discount,
    paid_at = NOW()
  WHERE id = $bookingId AND status = 'pending';

COMMIT;
```

### DB constraints (defence-in-depth)

```sql
-- Per-booking: at most one redemption per coupon per booking
CREATE UNIQUE INDEX idx_coupon_redemption_once
  ON coupon_redemptions (coupon_id, booking_id);

-- Per-code: use_count cannot exceed max_total_uses (CHECK constraint)
ALTER TABLE coupons ADD CONSTRAINT chk_use_count
  CHECK (use_count <= max_total_uses);

-- max_uses_per_booking enforced at application level in the same transaction
-- with the UNIQUE index as a DB-level backstop
```

### High-entropy codes
Coupon codes shall be generated with sufficient entropy to prevent guessing (C10):
- Admin-created codes: minimum 8 characters, alphanumeric, case-insensitive.
- System-generated codes (if needed): `crypto.randomBytes(8).toString('base32')` → 13-character codes.
- Rate limiting on the coupon validation endpoint (C11) frustrates enumeration.

## Consequences

### Positive
- **Atomicity**: coupon consumption and booking creation are all-or-nothing — no leaked coupon uses, no unaccounted discounts.
- **DB-enforced constraints**: CHECK and UNIQUE constraints provide a second line of defence beyond application logic.
- **Audit trail**: `coupon_redemptions` table provides a full history of every coupon use — redeemable at booking level for financial reconciliation.
- **Concurrent safety**: `SELECT ... FOR UPDATE` on the coupon row serialises concurrent redemptions of the same coupon without affecting bookings on different coupons.

### Negative
- The transaction boundary must exclude the Stripe payment intent creation (which involves a network call). This means the booking is created in `pending` status before this transaction, and the transaction only finalises it. A Stripe payment could fail after the booking row is created — in that case, the booking remains `pending` and the seat hold expires (ADR-002), with no coupon consumed.
- `SELECT ... FOR UPDATE` on the coupon row is a point of contention for a popular coupon under high concurrency — for MFA's scale (single-venue, infrequent coupon campaigns), this is not a practical concern.

### Neutral
- Fixed-amount coupons that exceed the booking total produce a minimum charge of €0.00 (the discount is capped at the total). Stripe Checkout supports zero-amount payment intents for fully discounted bookings.

## Compliance Mapping
| Requirement | How this ADR addresses it |
|---|---|
| FR-3.2 (coupon system: code, type, value, validity, max uses, per-booking limit, active toggle) | All fields modeled in the `coupons` table; validity and limits enforced in the serializable transaction. |
| FR-3.2 (invalid/expired/exhausted → clear error) | Validation checks in the transaction produce user-friendly error codes before rollback. |
| Acceptance criterion 3 (coupon adjusts total, refused when exhausted) | Atomic increment + CHECK constraint; exhaustion detected at read time. |
| C10 (high-entropy codes, per-code/per-booking limits, usage audit) | 8+ char codes; per-code limit via CHECK; per-booking limit via UNIQUE index; `coupon_redemptions` = audit trail. |
| T7 (coupon abuse) | Residual Low: guessing frustrated by code entropy + rate limiting; replay blocked by UNIQUE index; stacking blocked by one-coupon-per-booking model. |
| C11 (rate limiting) | Rate-limited coupon validation endpoint — independent of this ADR's transaction model. |
