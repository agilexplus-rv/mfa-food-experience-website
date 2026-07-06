# ADR-002: Seat-Hold Concurrency Model

## Status
Accepted

## Context
The booking platform must guarantee that an event is never overbooked, even under concurrent load — multiple visitors attempting to book the last few seats simultaneously (URD acceptance criterion 2: "overbooking impossible under concurrent load"). The system uses a **cart-with-reservation-timer** model (FR-4.3): when a visitor proceeds to book, seats are held for a configurable duration (proposed 15 minutes), during which those seats are counted as unavailable. If the timer expires without payment, the seats must be released.

Constraints:
- FR-2.3: Remaining seats = capacity − confirmed bookings − seats in active carts.
- FR-4.3: Visible countdown timer; held seats released on expiry.
- NFR-4: Race-safe — no overbooking under concurrent carts.
- DPIA Sec 6 + C8: DB-level transactional seat allocation; cart holds expire server-side.
- Capacity is set per event, not hard-coded (FR-2.3).

## Options Considered

### Option A: `SELECT ... FOR UPDATE` on the event row
Every booking operation acquires a row-level lock on the event row, reads available seats, decrements, and writes back — all within one transaction. The lock serialises all concurrent attempts on the same event.

- **Pros**: conceptually simple; guaranteed race-free within a single transaction; no separate hold table to manage.
- **Cons**: all concurrent booking attempts on the same event queue behind one lock — under high demand (e.g. ticket-rush when a popular event opens), throughput degrades to one-at-a-time, even when many seats are available; the lock is held for the entire transaction, including any slow payment-intent creation; does not naturally model the 15-minute hold window — the lock would need to be held for the full hold duration, blocking all other bookings.

### Option B: `seat_holds` table with TTL sweeper and partial unique index
A dedicated `seat_holds` table stores in-progress cart reservations. Each hold has a seat count, an expiry timestamp (now + 15 minutes), an event FK, and a cart/session identifier. A **partial unique index** prevents duplicate active holds per cart. Seat availability is computed as: `event.capacity − SUM(confirmed_bookings.seats) − SUM(active_holds.seats)`.

- **Pros**: non-blocking reads — throughput is limited only by the DB's ability to insert rows; naturally models the time-limited hold; hold expiry is handled by a periodic sweeper (cron job, every 30 seconds) that deletes rows where `expires_at < NOW()` — no lock held for the full 15 minutes; the partial unique index enforces one active hold per cart without slowing other operations.
- **Cons**: additional table and sweeper to maintain; availability computation requires a SUM query with appropriate indexing; a race window exists between computing availability and inserting the hold — must be closed with a serializable transaction or an advisory lock scoped to the event.

## Decision
**Option B: `seat_holds` table with TTL sweeper, serializable isolation, and event-scoped advisory lock.**

### Transaction model

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE
  -- Acquire an event-scoped advisory lock to prevent concurrent hold insertions
  SELECT pg_advisory_xact_lock(event_id);

  -- Compute available seats
  available := event.capacity
    − COALESCE((SELECT SUM(seats) FROM bookings WHERE event_id = $1 AND status != 'cancelled'), 0)
    − COALESCE((SELECT SUM(seats) FROM seat_holds WHERE event_id = $1 AND expires_at > NOW()), 0);

  -- Validate availability
  IF requested_seats > available THEN ROLLBACK; RETURN 'insufficient_seats'; END IF;

  -- Insert hold
  INSERT INTO seat_holds (event_id, cart_id, seats, expires_at)
  VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes');

  -- Return hold details to client (triggers countdown timer UI)
COMMIT;
```

### Hold expiry
A PostgreSQL function swept every 30 seconds deletes expired holds:

```sql
DELETE FROM seat_holds WHERE expires_at < NOW();
```

For immediate release on timer expiry in the UI, the frontend's countdown reaching zero calls a `DELETE /api/holds/:id` endpoint — the sweeper is a safety net for abandoned browser sessions.

### Why SERIALIZABLE rather than REPEATABLE READ
`REPEATABLE READ` allows phantom reads — two concurrent transactions could both read the same available-seat count before either inserts a hold, both believing seats are available. `SERIALIZABLE` detects this write-skew anomaly and forces one transaction to retry. Combined with the advisory lock (which serialises access per event), the retry rate under concurrency is negligible.

Alternatively, with PostgreSQL's default `READ COMMITTED` + the advisory lock, the lock itself serialises the availability check → hold insert window — no serialization failure needed. Both approaches are viable. **The advisory lock is the primary safeguard; SERIALIZABLE provides a defence-in-depth backstop.**

## Consequences

### Positive
- Non-blocking for reads: the frontend queries remaining seats without any locking contention.
- Naturally models the time-bound hold: no long-held row locks.
- Atomic release: expiry is deterministic and automatic — no complex timeout logic outside the database.
- Concurrency tested: advisory lock serialisation is well-understood and performs at hundreds of bookings per second per event — far beyond the expected load.

### Negative
- `seat_holds` is an additional table to manage, back up, and monitor.
- Sweeper must be deployed as a cron job or pg_cron — additional operational component (mitigation: fails safe; if sweeper stops, holds persist indefinitely but are filtered out by `expires_at > NOW()` in availability queries; alert on sweeper failure).
- Advisory lock contention: under extreme load on a single event, all concurrent bookers queue behind the same lock. For MFA's scale (single-venue cooking classes, max ~30 capacity per event), this is not a practical concern.

### Neutral
- The sweeper frequency (30s) introduces a maximum 30-second delay between timer expiry and seat release — acceptable for a human-paced booking flow.

## Compliance Mapping
| Requirement | How this ADR addresses it |
|---|---|
| FR-2.3 (capacity) | Availability computed from bookings + active holds; capacity is an event-level property. |
| FR-2.4 (remaining seats display) | `available` computed per query; "Fully booked" when available ≤ 0. |
| FR-4.3 (cart with reservation timer) | `seat_holds` models the time-bound hold; countdown timer maps to `expires_at − NOW()`. |
| NFR-4 (race-safe) | Advisory lock + SERIALIZABLE isolation prevents overbooking under all concurrent scenarios. |
| Acceptance criterion 2 | "Overbooking impossible under concurrent load" — verified by concurrent booking stress test (pre-go-live checklist). |
| C8 (DB-level transactional seat allocation) | Atomic hold insertion within serializable transaction; expired holds released server-side. |
| C16 (max seats per booking) | Enforced in the transaction: `requested_seats > available` rejects oversized bookings. |
| DPIA Sec 6 (privacy by design) | No personal data in `seat_holds` — only `cart_id`, `event_id`, `seats`, `expires_at`. |
