# ADR-006: Google Translate Integration

## Status
Accepted

## Context
The site must be available in English and Maltese (FR-10.1). The client has chosen **Google Translate** as the translation mechanism — specifically the Google Translate website integration (a client-side JavaScript widget), not the Cloud Translation API. This is a client directive; this ADR documents the chosen approach, its risks, and how those risks are mitigated.

Key requirements:
- FR-10.1: EN/MT via Google Translate with a styled, brand-consistent language switcher (EN | MT) in the header.
- FR-10.2: Authored content is in English; key fixed UI strings shall be reviewed for acceptable MT rendering; manual overrides provided where feasible.
- FR-10.3: Language choice persists across pages within a session.
- FR-10.4: Risk noted to client — machine translation of legal/policy text may be imprecise. Recommend human-reviewed MT for the two policy pages (Cancellation Policy, Customer Policy/ToR).
- NFR-1 (branding): the language switcher must use the brand palette and Montserrat typeface.

Compliance context:
- C17: Google Translate loaded only on user action; SRI where possible; no PII pages translated.
- DPIA Sec 2.2/P5: Google Translate widget transmits page content + visitor IP to Google when active — flagged as a privacy risk; user-activated only.
- DPIA Sec 6.8: User-activated translation; disclosure in privacy notice.
- EU Legal Memo Sec A (ePrivacy): cookie consent for non-essential cookies (Google Translate may set cookies) — strictly-necessary exemption does not apply.

## Options Considered

### Option A: Google Translate Website Widget (client directive)
The free Google Translate website integration (`translate.google.com/translate_a/element.js`) adds a dropdown to the page. When a visitor selects Maltese, the widget replaces page text with machine-translated versions in-place.

- **Pros**: zero cost; no API key or quota management; simple integration (one script + one `<div>`); client explicitly requested this approach.
- **Cons**: Google receives page content and visitor IP (privacy risk — P5); translation quality is inconsistent, especially for Maltese (a low-resource language for MT); no control over translation of legal/policy text; the default widget UI is unstyled — requires custom CSS to match brand (NFR-1); widget may set cookies (ePrivacy consent required).

### Option B: Google Cloud Translation API (Advanced)
Server-side translation via the Cloud Translation API, with cached translations stored in the database. The frontend renders pre-translated content from the database.

- **Pros**: no client-side data exposure to Google (server-to-server); cached translations are consistent and reviewable; legal/policy pages can be manually curated; no cookie consent issue.
- **Cons**: paid API (though low cost at MFA's content volume); requires API key management, quota monitoring, and cache invalidation strategy; significantly more complex to implement (translation pipeline, cache store, fallback logic); client did not choose this option.

## Decision
**Option A: Google Translate Website Widget — user-activated, with curated legal page overrides.**

The client directive is binding. This ADR specifies the safe implementation of the widget and the mitigations for its known risks.

### Implementation spec

1. **User-activated only** (C17, DPIA P5):
   - The widget script is NOT loaded on page load.
   - A custom-styled EN | MT switcher in the header is the only trigger.
   - On first click of "MT", a cookie-consent gate appears (ePrivacy): "This site uses Google Translate, which may set cookies and send page content to Google. [Accept / Decline]".
   - On Accept: the script loads, the page translates, and a `translate_consent=true` cookie is set (no prompt on subsequent pages within the session).
   - On Decline: the page remains in English; no script loads.

2. **Brand-styled switcher** (NFR-1):
   - Position: header, right-aligned.
   - Design: two pill-shaped buttons "EN" and "MT" in Montserrat SemiBold.
   - States: active language in Lunar Green (#33483D) fill with Soft Beige (#F9F4EF) text; inactive in Soft Beige fill with Lunar Green text; hover in Terracotta (#C9643D).
   - The widget's default dropdown is hidden via CSS (`display: none` on `#google_translate_element select`); the custom EN|MT buttons programmatically trigger the widget's language change.

3. **Legal/policy page override** (FR-10.4):
   - The Cancellation Policy and Customer Policy/ToR pages render in English by default.
   - Admin-editable "MT translation" fields exist for these two pages in the backend — admin can paste human-reviewed Maltese translations.
   - When the MT translation field is populated and the user has selected MT, the human-reviewed version is displayed instead of the machine-translated version.
   - When the field is empty, the Google Translate widget translation is shown with a disclaimer: "Machine-translated text. For legal purposes, refer to the English version."

4. **PII exclusion** (C17, DPIA P5):
   - Booking confirmation pages, admin pages, and any page containing personal data (attendee name, email, booking reference) are excluded from translation via the `class="notranslate"` attribute on their container elements.
   - The check-in page is excluded from translation.

5. **Session persistence** (FR-10.3):
   - The selected language is stored in a `lang` cookie (SameSite=Lax, Secure, HttpOnly=false — needed by client-side JS).
   - The custom switcher reads this cookie on page load and restores the selected language.

### Cookie banner integration
The Google Translate activation is gated behind the site's cookie consent mechanism (ePrivacy / SL 586.01). The consent flow is:
1. First visit: cookie banner displayed (all non-essential scripts blocked).
2. User clicks "MT" in the header → interstitial consent prompt specifically for Google Translate.
3. User accepts → `translate_consent=true` cookie set; widget loads.

This two-layer approach ensures Google Translate is never loaded without explicit consent, satisfying both ePrivacy and the DPIA Sec 6.8 requirement.

## Consequences

### Positive
- Zero cost; no quota management.
- Client's chosen approach — no divergence from directive.
- Simple implementation: one conditionally-loaded script, custom CSS for the switcher, and two translation-override fields in the admin.
- The brand-styled EN|MT switcher is a visual asset, not a commodity — contributes to the premium feel per NFR-1.

### Negative
- **Maltese MT quality**: Maltese is a low-resource language for neural machine translation. Expect imperfect translations — particularly for food/culinary terminology, which is culturally specific. This is a known risk communicated to the client (FR-10.4).
- **Privacy**: Google receives page content and visitor IP when translation is active. Mitigated by user activation + consent gate, but not eliminated.
- **Legal risk**: machine-translated policy pages may be legally imprecise. Mitigated by human-reviewed MT override fields, with the English version as the authoritative text.
- **No SRI for Google Translate script**: the widget URL (`translate.google.com/translate_a/element.js`) is dynamic and versioned by Google — Subresource Integrity (SRI) hashes are not practically maintainable. Mitigation: the script is loaded only on explicit user consent, reducing exposure window (C17).

### Neutral
- Google Translate does not translate text in images, PDFs, or dynamically injected content — these remain English-only. This is acceptable for MFA's content (primarily text + photos).

## Compliance Mapping
| Requirement | How this ADR addresses it |
|---|---|
| FR-10.1 (EN/MT via Google Translate, styled switcher) | Custom EN|MT pill buttons in brand palette + Montserrat; widget triggered programmatically. |
| FR-10.2 (English-authored content; key UI strings reviewed) | Content authored in English; critical UI strings (buttons, labels) verified for acceptable MT output. |
| FR-10.3 (language persists across pages) | `lang` cookie; custom switcher reads cookie on page load. |
| FR-10.4 (legal/policy MT imprecision risk) | Human-reviewed MT override fields for Cancellation Policy and Customer Policy; English authoritative. |
| NFR-1 (brand palette, Montserrat, NFR-2 emails) | Switcher styled in brand colours; emails not translated (sent in booking language per FR-4.6, which tracks the user's selected language). |
| C17 (user-activated, SRI, no PII pages) | Widget loaded on consent; `notranslate` class on PII pages; SRI impractical but consent gate reduces exposure. |
| DPIA Sec 6.8 (user-activated translation) | Two-layer consent: cookie banner → MT interstitial → widget loads. |
| DPIA P5 (Google Translate exfiltration risk) | Residual Low-Med: user-activated only; PII pages excluded; disclosed in privacy notice. |
| ePrivacy (cookie consent) | `translate_consent` cookie set only on explicit consent; gate integrated with site cookie banner. |
