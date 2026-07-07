# Design System — Malta Food Experience

## Register
product (this file covers the admin/Payload surface; the public site has its own established system in `src/app/(frontend)/globals.css`)

## Color

Source of truth: `src/app/(frontend)/globals.css` (`@theme` block), mirrored into the admin panel via `src/components/admin/AdminThemeStyles.tsx` overriding Payload's `--theme-*` variables.

| Token | Hex | Role |
|---|---|---|
| Lunar Green | `#33483D` | Primary — text, primary buttons, headings |
| Lunar Green (light) | `#4A6B59` | Primary hover state |
| Terracotta | `#C9643D` | Secondary — links, required-field markers, warm accents |
| Matte Gold | `#B8974D` | Tertiary accent — warning-adjacent, elevation ramp |
| Soft Beige | `#F9F4EF` | Background |
| White | `#FFFFFF` | Surface (cards, inputs) |
| Border | `#D4C8B8` | Dividers, input borders |
| Text (light) | `#6B7F74` | Secondary/muted text |

Admin elevation ramp (light theme): `#F9F4EF` → `#F4EDE3` → `#EFE6D8` → `#E5D8C4` → `#DCCBB2` → `#C9B491` → `#B29B75`, all tinted toward the brand's warm hue rather than neutral gray.

Dark mode (admin panel only, not yet extended to public site): bg `#1E2A24`, surface `#26362E`, text `#F9F4EF`.

## Typography

Montserrat throughout (loaded via `next/font` as `--font-montserrat`, aliased to `--font-sans`). No secondary typeface — weight and size carry hierarchy rather than font pairing.

## Components (admin surface)

- **Login card** (`.template-minimal` / `.template-minimal__wrap`): centered flex container, white card, `border-radius: 12px`, soft shadow (`0 4px 24px rgba(51,72,61,0.08)`), max-width 420px.
- **Logo** (`src/components/admin/AdminLogo.tsx`): full MFA wordmark SVG (`public/brand/logos/Malta Food - Primary.svg`), 180px wide on the login card.
- **Icon** (`src/components/admin/AdminIcon.tsx`): same mark at 32px for the collapsed nav.
- **Primary button** (`.btn--style-primary`): Lunar Green fill, lighter green on hover.
- **Links** (`a`, `.btn--style-link`): Terracotta.

## Layout

Admin theming is applied via Payload's documented CSS variable + root-component override surface (`admin.components.beforeLogin` for the login-specific view, `admin.components.header` for panel-wide styles) — not a from-scratch rebuild of Payload's DOM/layout engine. `@layer payload-default` is used to keep specificity aligned with Payload's own layering.

## Known gaps / open items

- Dashboard nav sidebar has a pre-existing Payload rendering issue (collapsed/overlapping in at least one headless-browser test), reproduced with zero custom CSS applied — not addressed by the admin theming work, flagged separately.
- Admin dark-mode token overrides exist but haven't been visually verified against a real dark-mode toggle.
