# Malta Food Experience -- E-Commerce and Consumer Protection Gap Analysis

**Date:** 7 July 2026
**Question addressed:** does EU/Malta e-commerce and consumer-protection law apply to Malta Food Experience, given it is described as an organisation rather than a strictly commercial business, and if so, what does it require?
**Method:** Direct research via Firecrawl against EUR-Lex (EU legislation), legislation.mt (Malta's official legislation portal), and secondary legal sources, cross-checked against the actual seed content and code already in the repository.

---

## Short answer: yes, it applies, and the applicable law already anticipates this exact situation

Malta's Consumer Affairs Act (Cap. 378) defines "trader" to explicitly include:

> "(ii) any public body, whether corporate or unincorporate, which provides goods or services to consumers for a fee"

This is not an edge case the law happens to cover incidentally -- it is a specific, deliberate limb of the definition written to catch exactly this scenario: a public or quasi-public organisation selling goods or services to individual consumers for money. Whether Malta Food Experience is structured as a business in the ordinary commercial sense is legally irrelevant to whether consumer-protection law applies to it -- the moment it charges individual consumers a fee for a service (a cooking class, a tasting), it is a "trader" and the counterparty booking that class is a "consumer," and the full apparatus of Maltese and EU consumer law applies.

---

## The specific frameworks that apply

### 1. Consumer Rights Regulations (S.L. 378.17, Legal Notice 439 of 2013)

Malta's direct transposition of EU Directive 2011/83/EU (Consumer Rights Directive). This is the ADR-008 EU Legal Memo's own reference point, and it is the single most important framework for this platform because it governs three things at once: pre-contractual information duties, the statutory withdrawal right, and the checkout-flow requirements already partially built.

**Pre-contractual information (Article 6 of the Directive, transposed identically into S.L. 378.17):** before a consumer is bound by a distance contract, the trader must clearly disclose (among other things):
- The main characteristics of the service
- The trader's identity, geographic address, phone, and email
- The total price inclusive of taxes
- Payment, delivery, and performance arrangements
- **Where a right of withdrawal is NOT provided for, an explicit statement that the consumer will not benefit from a right of withdrawal** (this is a distinct, affirmative disclosure duty -- not just "the withdrawal right doesn't apply so say nothing")
- The trader's complaint-handling policy
- Existence of an out-of-court dispute resolution mechanism, where applicable

**The right of withdrawal itself: Article 16(l), the "leisure activities" exemption.** Verified verbatim from the consolidated Directive text:

> "Member States shall not provide for the right of withdrawal ... as regards ... (l) the provision of accommodation other than for residential purpose, transport of goods, car rental services, catering or services related to leisure activities if the contract provides for a specific date or period of performance"

Malta Food Experience's bookings are exactly this: leisure services (culinary classes, tastings, tours) tied to a specific scheduled date. **This means the platform is NOT required to offer the statutory 14-day EU cooling-off/withdrawal right.** This is good news operationally -- a booking made 3 days before a class does not have to be refundable purely because a consumer changed their mind, the way a general e-commerce purchase would.

**But this exemption is not "no obligations" -- it shifts the obligation, it doesn't remove it.** Two things follow directly from the exemption applying:

1. **The trader must still explicitly disclose, before the consumer books, that no statutory withdrawal right applies** (Article 6(1)(k) as above). This must be stated clearly on the booking page/checkout flow itself, not just buried in a policy document nobody reads.
2. **Once the statutory right is exempted, the trader's OWN cancellation/refund policy becomes the operative contractual document governing what happens if a consumer wants to cancel.** This is precisely why ADR-008 requires a Cancellation Policy page, and precisely why the user's request (an admin-configurable table of "if cancelled X days before, refund Y%") is the correct compliance mechanism, not just a UX nicety -- it IS the substitute for the statutory right the platform doesn't have to offer.

**Verified evidence in the repo:** the seed script (`src/payload/seed.ts`) already contains a well-drafted cancellation policy with a correctly-cited Article 16(l) disclosure and a genuinely reasonable tiered structure (full refund minus 10% admin fee if >7 days out; 50% refund between 7 days and 48 hours; no refund under 48 hours). **The problem is that this is hardcoded text in a seed script that has never actually been run against the live demo database** (confirmed by direct query: the `policies` collection currently has zero rows), and even if it were seeded, it would remain static text -- not the admin-configurable, table-driven system the user has asked for.

### 2. Electronic Commerce Act (Cap. 426), transposing EU Directive 2000/31/EC

A separate, distinct framework from consumer rights specifically, governing "information society service providers" -- which a booking website unambiguously is. Verified via direct legal-text extraction, the mandatory general-information disclosure list is:

| Required disclosure | MFA site status |
|---|---|
| Name of the service provider | Present in email footer/branding, but not as a standalone "provider info" disclosure |
| Geographic address where established | Not found anywhere on the live site |
| Contact details including an email address for rapid contact | Contact page exists |
| Registration number in any relevant trade register (if applicable) | Not found -- needs a decision on whether/how Malta Food Agency is registered |
| VAT registration number (if applicable) | Not found anywhere |
| Professional title / regulatory body details (if applicable) | Likely not applicable to this business type, but should be confirmed rather than assumed |
| Commercial communications must be clearly identifiable as such | Not separately verified this session |
| Order acknowledgment by electronic means without undue delay | Satisfied by the existing Stripe Checkout + confirmation-email flow (Phase 2 work) |

This maps directly onto ADR-008's already-planned `provider-info` legal page -- the code path exists (`legal/[slug]`) but, per the same live-DB query above, has zero content behind it.

### 3. Unfair Commercial Practices (Cap. 378, Part VIII)

Confirmed present in the Consumer Affairs Act's structure (Part VIII, Title I). Broadly relevant to how availability/scarcity messaging is phrased ("3 seats left") -- this must reflect genuine, real-time availability and not be a manufactured urgency tactic, since fabricated scarcity claims are a recognised unfair commercial practice under both the Maltese Act and the underlying EU Unfair Commercial Practices Directive. **Good news: the existing implementation (`AvailabilityBadge` reading live database counts) is already compliant by construction here** -- it shows genuine capacity, not a fake countdown.

### 4. Consumer reviews / testimonials

The Consumer Affairs Act's e-commerce-adjacent provisions specifically flag, as a "material" disclosure, whether and how a trader verifies that published reviews come from consumers who actually purchased/used the product. This directly corroborates EU Legal Action #6 in ADR-008 (a "review-verification statement" for testimonials) -- confirmed via this research as a genuine, named legal expectation, not just an ADR author's own precaution.

---

## Gap Table

| Requirement | Legal source | Status | Evidence |
|---|---|---|---|
| Explicit "no withdrawal right" disclosure before booking | S.L. 378.17 / Directive Art. 6(1)(k) | Not implemented | No such statement found in the `BookingForm.tsx` checkout flow itself -- only exists as prose deep in a cancellation-policy document that (per the live-DB check) doesn't even have content yet. |
| Cancellation policy reflecting the trader's own refund terms (since statutory withdrawal doesn't apply) | S.L. 378.17 / Directive Art. 16(l), read together with ADR-008 EU Legal Action #3 | Drafted but not live, not admin-configurable | Good draft text exists in `seed.ts` (never seeded); needs to become a genuine admin-managed structured table per this session's requirements, not static prose. |
| Full pre-contractual information set (Art. 6) surfaced at/before checkout | S.L. 378.17 | Partial | Price, event details are shown; total-price-with-VAT labelling, complaint-handling policy statement, and ADR dispute-resolution info are not confirmed present. |
| Provider Info page with geographic address, VAT number, registration details | Cap. 426 (Electronic Commerce Act) | Not implemented | Code path exists, zero content. |
| Review-verification statement for testimonials | Cap. 378 (materiality of review-authenticity disclosure) | Not implemented | No such statement found anywhere near the testimonials feature. |
| Genuine (not manufactured) scarcity indicators | Cap. 378 Part VIII (Unfair Commercial Practices) | Already compliant | `AvailabilityBadge` reads live DB counts -- this is correct by construction. |

---

## What this means for the planned kanban work

This research directly confirms and sharpens three items already on the priority list from the ADR-008 audit:

1. **The cancellation-policy feature is not just a content/UX improvement -- it is the legally load-bearing substitute for the statutory withdrawal right the platform is exempt from.** The admin-configurable table (days-before-event -> refund percentage) the user has requested is precisely the correct shape for this: it needs to be genuinely enforceable (the software should reference the SAME data the public policy page displays, ideally driving actual refund calculations later), not just a display convenience.
2. **The Provider Info page needs concrete content**, not just working code -- name, geographic address, contact, VAT number (if registered), and any trade-register number.
3. **A "no cooling-off period applies" disclosure needs to be added directly into the booking/checkout flow**, not left buried in a policy page a consumer may never read before paying -- this is what Article 6(1)(k) actually requires (disclosure *before* the consumer is bound), and it is currently missing from `BookingForm.tsx`.
