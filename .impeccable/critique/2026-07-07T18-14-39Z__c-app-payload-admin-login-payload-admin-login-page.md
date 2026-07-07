---
target: Payload admin login page
total_score: 21
p0_count: 1
p1_count: 2
timestamp: 2026-07-07T18-14-39Z
slug: c-app-payload-admin-login-payload-admin-login-page
---
Method: dual-agent (A: design-review subagent · B: detector+browser-evidence subagent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 0 | Failed login submit produces zero feedback |
| 2 | Match System / Real World | 3 | Plain, staff-appropriate terminology |
| 3 | User Control and Freedom | 3 | Forgot-password escape hatch present |
| 4 | Consistency and Standards | 2 | Button (420px) vs input (452px) width mismatch |
| 5 | Error Prevention | 2 | required attrs only, no Caps Lock warning |
| 6 | Recognition Rather Than Recall | 4 | Minimal, appropriate |
| 7 | Flexibility and Efficiency | 2 | No password-reveal toggle |
| 8 | Aesthetic and Minimalist Design | 3 | Calm, uncluttered |
| 9 | Error Recovery | 0 | Consequence of #1 |
| 10 | Help and Documentation | 2 | N/A-appropriate |
| Total | | 21/40 | Acceptable — significant improvements needed |

## Anti-Patterns Verdict
Not AI slop -- "decorated default" not "designed". Deterministic scan (detect.mjs vs src/components/admin): exit 0, zero findings. Browser overlay: 1 finding (layout-transition on Payload's stock Sonner notification container) -- false positive relative to this rebrand.

## Priority Issues
- [P0] Failed login produces zero user-facing feedback -- verified live, no toast/banner/field state change on wrong credentials.
- [P1] Terracotta fails WCAG AA contrast in its text application (3.91:1 on white, 3.58:1 on beige vs 4.5:1 required) -- "Forgot password?" link specifically.
- [P1] No password-reveal toggle -- door-staff mobile persona blind-types under pressure.
- [P2] Primary button width (420px) doesn't match input width (452px).
- [P2] Door-staff mobile viewport (360-390px) never tested.

## Persona Red Flags
Alex (power user): silent failure -> assumes app hung, re-submits repeatedly.
Sam (accessibility): terracotta link fails WCAG AA; weak focus-visible ring on inputs.
Casey (mobile door-staff): P0+P1 compound directly -- the persona this exercise was framed around is the most exposed.

## Minor Observations
- Full wordmark+tagline at 180px reads slightly "marketing" for a product-register screen.
- Dark-mode token overrides unverified.
- Input border contrast very subtle (~1.65:1), combined with weak focus ring.
