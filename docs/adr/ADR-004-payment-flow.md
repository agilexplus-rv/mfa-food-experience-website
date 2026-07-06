# ADR-004: Payment Integration Flow

## Status
Accepted

## Context
The booking platform must collect payment online at the time of booking (FR-4.4). Card data must **never touch MFA infrastructure** (NFR-4, DPIA Sec 6.2, C7). The payment provider must support EUR and accommodate a Malta-registered merchant (FR-4.4, URD Sec 6.1).

Post-payment flow (FR-4.5):
1. Payment succeeds → on-screen confirmation displayed.
2. Confirmation email sent: booking reference, event details, location, persons, amount paid, cancellation policy summary, unique QR code.
3. Email styled per NFR-1/NFR-2 in the visitor's booking language (EN or MT, FR-4.6).

Stripe is the de-facto standard for this pattern: hosted payment pages, webhook-driven fulfilment, EUR support, Malta merchant eligibility, and PCI-DSS Level 1 compliance (SAQ-A scope for MFA).

## Options Considered

### Option A: Stripe Checkout (hosted redirect)
Visitor clicks "Pay now" → redirected to Stripe's hosted Checkout page → completes payment → Stripe redirects back to a success URL on the MFA site. Webhook events (`checkout.session.completed`) fire asynchronously from Stripe to MFA's backend.

- **Pros**: fully hosted payment page — zero card UI to build, style, or maintain; Stripe handles 3D Secure (SCA), Apple Pay/Google Pay, and saved-payment-method UX; smallest attack surface for MFA; PCI SAQ-A scope (simplest compliance questionnaire).
- **Cons**: redirect flow breaks the single-page-app feel; visitor leaves the MFA domain during payment; redirect-back URL must handle edge cases (visitor closes Stripe tab before redirect, network failure); success URL is not proof of payment — must wait for webhook.

### Option B: Stripe Payment Elements (embedded)
Stripe's Payment Element is embedded in an iframe on the MFA booking page. The visitor never leaves the MFA domain. The MFA frontend listens for the `payment_intent.succeeded` event client-side.

- **Pros**: seamless, single-page booking flow — no redirect; MFA controls the full visual experience around the payment form; brand continuity.
- **Cons**: more frontend code to maintain (Stripe.js SDK integration, error handling, loading states); iframe complexity — mobile responsiveness, CSP configuration (C2: `script-src` must include `js.stripe.com`; `frame-src` must include `js.stripe.com`); client-side success event is not proof of payment — still requires webhook verification server-side; marginally larger attack surface (iframe in MFA's DOM).

## Decision
**Option A: Stripe Checkout (hosted redirect).**

Rationale:
1. **Smallest attack surface**: no card UI code on MFA infrastructure — Stripe's hosted page is the only surface that handles card data (PCI SAQ-A, C7, DPIA Sec 6.2).
2. **Fewer moving parts**: no Stripe.js SDK integration, no iframe CSP rules, no client-side payment-intent state management.
3. **SCA/3DS2 handled transparently**: Stripe Checkout manages Strong Customer Authentication challenges without MFA code.
4. **Maintainability**: Stripe evolves Checkout's UX (Apple Pay, Link, saved cards) without MFA code changes.
5. **Redirect UX is acceptable**: the booking flow is already multi-step (choose service → choose date → booking page → payment); a brief redirect to a trusted payment page is consistent with user expectations for online purchases.

### Webhook-driven fulfilment (the critical path)

```
1. Frontend: POST /api/checkout { eventId, seats, attendee, coupon? }
   → Backend: creates booking (status: 'pending'), inserts seat_hold (per ADR-002),
     creates Stripe Checkout Session with:
       - client_reference_id = booking.id
       - metadata: { bookingId, eventId, seats, email }
       - success_url: /booking/confirmation?session_id={CHECKOUT_SESSION_ID}
       - cancel_url: /booking/cancel?session_id={CHECKOUT_SESSION_ID}
   → Returns: { url: stripeCheckoutUrl }

2. Visitor pays on Stripe's hosted page.

3. Stripe POST /api/webhooks/stripe { type: 'checkout.session.completed', ... }
   → Verify Stripe-Signature header (C7)
   → Extract bookingId from event.data.object.metadata
   → BEGIN TRANSACTION
       SELECT booking WHERE id = $1 AND status = 'pending' FOR UPDATE
       IF not found: RETURN 200 (idempotent — already processed)
       Verify event still has capacity (defence-in-depth)
       UPDATE booking SET status = 'confirmed', stripe_payment_intent_id = $2, paid_at = NOW()
       DELETE seat_hold WHERE booking_id = $1 (convert hold to confirmed)
       INSERT qr_token_hash (per ADR-003)
     COMMIT
   → Send confirmation email with QR
   → RETURN 200

4. Frontend success_url page:
   → Poll GET /api/bookings/:id/status every 2s until status = 'confirmed'
   → Show on-screen confirmation with booking details
```

### Idempotency
- **Booking idempotency**: the transaction checks `status = 'pending'` before updating. A second webhook delivery finds `status = 'confirmed'` and returns 200 without side effects.
- **Event idempotency table**: log processed `stripe_event_id` values in a `stripe_events` table with a UNIQUE constraint — catches edge cases where Stripe delivers duplicate events with different event IDs for the same booking.
- **Amount re-verification**: the webhook handler re-verifies the payment amount against the event price minus any applied coupon (C7).

## Consequences

### Positive
- Minimal frontend payment code — no Stripe.js SDK, no iframe styling, no SCA handling.
- PCI SAQ-A — the simplest compliance questionnaire; zero card data on MFA systems.
- Stripe manages the payment UX, including Apple Pay/Google Pay and saved cards.
- Idempotent webhook handler prevents double-processing.

### Negative
- Redirect flow: visitor leaves MFA domain. Mitigation: `success_url` is a polling page accessible later via a booking-reference link; pending-booking email provides a recovery path.
- Dependency on Stripe's availability and API latency — standard for all hosted-payment architectures.
- Stripe Checkout Sessions expire after 24 hours by default; MFA should configure session expiry at 15 minutes to match the seat hold (ADDR-002).

### Neutral
- Stripe Checkout's brand customisation is limited to logo, brand colour (Lunar Green #33483D), and accent colour (Terracotta #C9643D) per NFR-1.

## Compliance Mapping
| Requirement | How this ADR addresses it |
|---|---|
| FR-4.4 (payment online) | Stripe Checkout Session created server-side; visitor completes payment on Stripe. |
| FR-4.5 (confirmation + QR email) | Webhook triggers email on `checkout.session.completed`; QR generated per ADR-003. |
| FR-4.6 (brand-styled email in booking language) | Email template uses NFR-1 palette/Montserrat; locale passed from booking session. |
| NFR-4 (card data never on MFA infra) | Stripe-hosted page; zero card data on MFA servers — PCI SAQ-A scope. |
| C7 (webhook signature, idempotency, amount re-verification) | Stripe-Signature header verified; booking.id as idempotency key; amount re-verified server-side. |
| C2 (CSP) | No `js.stripe.com` needed in CSP — only Stripe's redirect domain. |
| DPIA Sec 6.2 (Stripe-hosted payments, PCI SAQ-A) | Fully hosted Checkout; SAQ-A compliance achievable. |
| DPIA Sec 2.4 (Stripe as processor) | Art 28 DPA to be executed with Stripe Payments Europe (Ireland). |
| EU Legal D.7 (SCA/PSD2) | SCA handled by Stripe's standard Checkout flow — no MFA action required. |
| EU Legal D.5 ('Pay now' wording) | Stripe Checkout button text set to "Pay now" — satisfies obligation-to-pay requirement (FR-11.1). |
