# Brand Contrast Audit — WCAG 2.1 AA

Date: 6 July 2026
Context: Malta Food Experience Palette on Soft Beige (#F9F4EF) background
Standard: WCAG 2.1 AA

## Results

| Colour       | HEX       | On Soft Beige | Ratio  | Normal text (4.5:1+) | Large text (3:1+) | Verdict |
|--------------|-----------|---------------|--------|----------------------|--------------------|---------|
| Lunar Green  | #33483D   | #F9F4EF       | 8.93:1 | Pass                 | Pass               | Safe for all text (meets AAA 7:1) |
| Terracotta   | #C9643D   | #F9F4EF       | 3.50:1 | Fail                 | Pass               | Large text and UI only |
| Matte Gold   | #B8974D   | #F9F4EF       | 2.43:1 | Fail                 | Fail               | Non-text only |

## Guidance

- Lunar Green on Soft Beige (8.93:1): the primary body-text combination. Safe at any size.
- Terracotta on Soft Beige (3.50:1): passes AA for large text (18pt bold, 24pt regular). Use for headings and CTA buttons. Not for body text below 18pt.
- Matte Gold on Soft Beige (2.43:1): fails even large-text AA. Restricted to decorative/non-text uses: dividers, icons, borders, hover accents. Never as text colour.

## Methodology

Ratios computed via the WCAG relative-luminance formula (sRGB linearised, L = 0.2126R + 0.7152G + 0.0722B), verified against WebAIM Contrast Checker.
