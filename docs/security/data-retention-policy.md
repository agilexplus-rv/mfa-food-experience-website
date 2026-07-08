# Data Retention and Anonymisation Policy

**Date:** 7 July 2026
**Status:** Accepted
**References:** ADR-008 DPIA Sec 6 measure 6, DPIA Sec 6 measure 10

---

## 1. Purpose

Defines retention periods and anonymisation procedures for PII in bookings
and testimonials per DPIA measures 6 and 10.

---

## 2. Retention Periods

- Bookings (confirmed, cancelled, checked_in): 24 months after event date
- Bookings (pending/abandoned): 90 days from createdAt
- Testimonials (rejected, unpublished): 30 days from updatedAt
- Testimonials (approved, published): retained as published content (editorial policy)

### 2.1 Rationale for 24 months

1. Malta tax law (Income Tax Act, Cap. 123) requires 6-year financial record
   retention, but PII anonymisation preserves non-PII fields (reference,
   persons, totalAmount, Stripe IDs) for the complete audit trail.
2. 24 months post-event covers the realistic customer-service window (receipt
   requests, charge disputes, re-bookings).
3. GDPR Art 5(1)(e) storage limitation: once 24 months have passed since the
   event, the original purpose (fulfilling the booking) has been served. The
   non-PII transaction record may still be needed, but the link to an
   identifiable person no longer is.
4. 24 months is a common post-contract retention period in hospitality and
   events-sector DPIA templates across the EEA.

The countdown begins from the event date (date field on the related events
document), not from booking creation. If the event has been deleted, fall
back to createdAt on the booking.

### 2.2 Rationale for 90 days (pending bookings)

Abandoned checkouts have no legal or commercial purpose once it is clear the
payment will never complete. 90 days from createdAt is generous enough to
cover rare payment-retry scenarios.

---

## 3. Anonymisation Procedure

Anonymisation does NOT delete booking rows. It overwrites PII fields:

| Field            | Anonymised value             |
| ---------------- | ---------------------------- |
| leadAttendeeName | Anonymised                   |
| email            | anonymised@deleted.invalid   |
| phone            | null                         |
| dietaryNotes     | null                         |
| anonymisedAt     | Current ISO-8601 timestamp   |

The .invalid TLD is reserved by IETF RFC 6761 and will never resolve.

Non-PII fields (reference, event, persons, totalAmount, status, dates,
Stripe IDs) are preserved unchanged for financial reconciliation, aggregate
reporting, and Stripe payment-trail integrity.

For rejected testimonials: name -> Anonymised, anonymisedAt -> now.

---

## 4. Automation

1. GET /api/cron/retention (Vercel Cron, daily 04:00 UTC, CRON_SECRET gated)
2. POST /api/data-subject (admin-only via verifySession, role=admin gate)

---

## 5. Idempotency

Rows where anonymisedAt is already set are skipped. Safe to re-run.

---

## 6. Exclusions

SeatHolds (no PII), Coupons/CouponRedemptions (no PII), Users (not customer
PII), AuditLog (system events), Approved Testimonials (published content).

---

## 7. Review

Annually or when processing purposes change. Next review: 7 July 2027.
