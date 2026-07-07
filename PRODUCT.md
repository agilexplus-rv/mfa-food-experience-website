# Product

## Register

product

## Users

Two internal roles use this admin surface: **Admin** staff (office-based, managing bookings, coupons, content, and cancellations) and **Door Staff** (venue-based, using a mobile device at the event entrance to scan/check in guests). Both authenticate through the same Payload admin login gateway before reaching their respective tools. The public-facing side of the platform (visitors booking Maltese food experiences) is a separate, already-designed register.

## Product Purpose

Malta Food Experience is a booking platform for guided food/cultural experiences in Malta (classes, tastings, tours). This admin surface is the backend operators use to run the business day-to-day: manage events and bookings, process cancellations, moderate testimonials, administer coupons, and check guests in at the door via QR scan. Success looks like fast, error-free daily operations for a small staff team — not a marketing surface, a working tool.

## Brand Personality

Warm, precise, Mediterranean hospitality with operational trust. The public brand feels inviting and food-forward (Lunar Green, Terracotta, Matte Gold, Soft Beige, Montserrat) — this admin surface should carry that same warmth without compromising the clarity, density, and speed a working tool needs under real operational pressure (a queue of guests at the door, a phone ringing with a cancellation request).

## Anti-references

- Generic SaaS dashboard template look (the exact thing being replaced — Payload's stock admin theme)
- Cold, clinical enterprise-software blue/gray palette that erases the brand's warmth
- Anything that prioritizes decoration over the operational task at hand (a login/check-in tool is used under time pressure, not browsed leisurely)

## Design Principles

- **Brand continuity across the seam.** A staff member moving from the public site to the admin login should feel it's the same product, not a different vendor's tool bolted on.
- **Operational clarity over decoration.** Door staff use this on a phone at a physical entrance with a line forming — every screen must resolve fast, unambiguously, with obvious next actions.
- **Trustworthy, not playful.** This gateway protects real booking/payment data — the tone is warm but composed, never cutesy.
- **Respect the underlying platform's conventions.** Theme via Payload's documented CSS variable surface and component slots rather than fighting the framework's own layout engine.

## Accessibility & Inclusion

Body text and interactive elements must meet WCAG AA contrast (≥4.5:1 for body text, ≥3:1 for large text/UI components) against the brand's Soft Beige/white surfaces. Door staff frequently use this outdoors in bright daylight — contrast and legibility matter more here than on a typical desktop dashboard. No specific reduced-motion or colorblind accommodations have been raised yet, but any motion added should default to the standard `prefers-reduced-motion` fallback.
