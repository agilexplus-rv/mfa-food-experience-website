# Contributing to Malta Food Experience

Every change — feature, fix, chore, or doc — follows the same pipeline.

## Standard procedure

1. **Branch** off `main`: `git checkout -b <prefix>/<short-description>`
   - `feat/` — new feature or enhancement
   - `fix/` — bugfix
   - `chore/` — maintenance (deps, config, cleanup)
   - `docs/` — documentation only

2. **Work** locally. Run `npx tsc --noEmit` before pushing.

3. **Push** and open a PR against `main`.

4. **CI/CD gates** run automatically on every PR (`.github/workflows/ci.yml`):

   | Gate | What it checks |
   |------|---------------|
   | **Build** (`next build`) | Production build succeeds |
   | **Typecheck** (`tsc`) | Zero type errors |
   | **Lint** (`eslint`) | No new warnings or errors |
   | **CSP audit** | Content Security Policy headers are valid |
   | **Accessibility** (`axe-core`) | WCAG violations caught |
   | **Design fidelity** (Playwright) | Visual regression tests pass |
   | **Help content guard** | Console/check-in code changes include help-content updates |
   | **Vercel Preview** | Preview deploy succeeds |

   All gates must be green. The **Help content guard** additionally fails if you touch console or check-in code without updating `src/app/(console)/console/help/help-content.ts` — unless you add `[skip-help]` to the PR body.

5. **Auto-merge** is enabled on every PR (`.github/workflows/auto-merge.yml`). When all required checks pass, GitHub squash-merges to `main` automatically. You can disable auto-merge on the PR page if you want manual control.

6. **Deploy to test** happens automatically on every push to `main` (`.github/workflows/deploy.yml`):
   - Target: `https://foodexperience.agilexplus.dev`
   - Authenticated via OIDC (no secrets stored)

7. **Deploy to production** is a manual step:
   ```bash
   gh workflow run Deploy -f environment=prod
   ```
   - Target: `https://foodexperience.mt`
   - Requires explicit approval in the GitHub Actions UI

## Commit style

Use [conventional commits](https://www.conventionalcommits.org/):

```
<type>: <short description>

<optional body with details>
```

Examples:
```
feat: add door-staff check-in button to dashboard
fix: coupon code matching is case-insensitive
chore: upgrade Payload to v3.2.0
docs: document PR → deploy procedure
```

## PR body

Include:
- What changed and why
- Which files are affected
- Any decisions or tradeoffs made
- "Closes #N" if there's an issue

If your changes are console-only or check-in-only and don't touch help-relevant paths, add `[skip-help]` to override the help guard.

## Help content

The staff help page (`/console/help`) is tied to the code through the CI guard. When you change behaviour in the console or check-in surfaces, update the corresponding procedure in `src/app/(console)/console/help/help-content.ts`. The guard tells you which files triggered the check if you forget.

## Security scanning

Security audits are run separately via the `full-stack-security-audit` skill (secret scanning, cloud resource audit, security headers, SAST, malware, cookies/legislation, WCAG, threat intelligence, payment-journey verification). These are not part of the per-PR CI gates but are run periodically and on request.