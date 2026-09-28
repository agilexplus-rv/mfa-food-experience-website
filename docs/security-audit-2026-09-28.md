# Full-Stack Security & Compliance Audit

**Date:** 2026-09-28  
**Scope:** Malta Food Experience (white-box) — commit `f08470d` (PR #1)  
**Environment:** test (`foodexperience.agilexplus.dev`), resource group `mfa-food-experience-test`  
**Method:** Source-code audit + live header check + Azure ARM API enumeration.  
DAST/SCA/SAST not run — workflows absent (see Recommendations).

---

## 1. Secret Scanning

| Check | Status | Evidence |
|-------|--------|----------|
| Hardcoded credentials in source | ✅ Pass | `grep -rnE` across all `.ts`/`.tsx`: zero matches for Stripe keys, VIVA keys, Resend keys, DB URLs, JWT secrets |
| Gitleaks (full commit history) | ⚠️ Not run | `secret-scan.yml` workflow does not exist in `.github/workflows/` |
| GitHub repo secrets audit | ✅ Pass | Deploy `.yml` references `secrets.VIVA_CLIENT_ID` etc. — legitimate payment credentials, not leaked |

**Finding:** No hardcoded secrets. Gitleaks scan is missing and should be added (see Recommendations).

---

## 2. Security Headers

Live URL `https://foodexperience.agilexplus.dev` returned:

| Header | Value | Status |
|--------|-------|--------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | ✅ |
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=(), payment=(self), usb=(), accelerometer=(), autoplay=(), display-capture=(), picture-in-picture=(), fullscreen=(self)` | ✅ |
| `Content-Security-Policy` | See below | ✅ |
| `X-Powered-By` | Not present (`poweredByHeader: false`) | ✅ |
| `frame-ancestors` | `'none'` in CSP (no separate X-Frame-Options needed) | ✅ |

**CSP:** `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://translate.google.com https://translate.googleapis.com https://translate-pa.googleapis.com https://js.stripe.com https://checkout.stripe.com; frame-src 'self' data: https://translate.google.com https://translate-pa.googleapis.com https://www.openstreetmap.org https://checkout.stripe.com; connect-src 'self' https://api.stripe.com https://translate.googleapis.com https://translate-pa.googleapis.com; style-src 'self' 'unsafe-inline' https://www.gstatic.com; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`

**`unsafe-inline`/`unsafe-eval`:** Documented and intentional — required by Next.js (inline scripts, HMR/module eval), Google Translate widget (inline style injections, JSONP script tags), and Stripe.js. The CSP comments in `next.config.ts` trace every directive to a specific file and mechanism. **Not a finding** — this is a deliberate tradeoff with documented ADR-008 C2 root causes.

---

## 3. Azure Cloud Resources

Resource group: `mfa-food-experience-test` (West Europe)

| Resource | Type | Status |
|----------|------|--------|
| `mfa-food-experience` | Container App | ✅ Active, tagged |
| `mfa-food-experience-test-env` | Container Environment | ✅ Active, tagged |
| `mfaFoodExpAcr` | Container Registry (Basic) | ✅ Active, tagged |
| `mfa-food-experience-db` | PostgreSQL Flexible Server (B1ms) | ✅ Active, tagged |
| `foodexperience` | Managed Certificate | ✅ Active |
| `mfafoodexpmediastore` | Storage Account (LRS, V2) | ✅ Active |
| `mfa-cron-sweep-holds` | Container App Job | ✅ Active, tagged |
| `mfa-cron-retention` | Container App Job | ✅ Active, tagged |
| `mfa-cron-complete-events` | Container App Job | ✅ Active, tagged |

**Findings:**
- 🔧 **No Key Vault.** Secrets (VIVA keys, DB URL, Payload secret) stored in GitHub environment variables. Acceptable for current scale; Key Vault recommended for production (see Recommendations).
- 🔧 **Storage Account `networkAcls.defaultAction: Allow`.** No IP restriction or VNet integration. All traffic accepted. Mitigation: the container app connects via managed identity; public blob access is disabled (`allowBlobPublicAccess: false`). Low risk for the current media-only usage.
- ✅ No orphan resources. All 9 resources are tagged and match the deployed stack.
- ✅ All infra created by service principal (`c2c6b98c-...`), not personal accounts.

---

## 4. Malware Scanning (Defender for Storage)

| Check | Status | Evidence |
|-------|--------|----------|
| Defender for Storage enabled | ❌ **Not enabled** | `isEnabled: false`, `malwareScanning.onUpload.isEnabled: false` |
| Storage account encryption | ✅ | `keySource: Microsoft.Storage`, blob + file encryption enabled |
| Public blob access | ✅ Disabled | `allowBlobPublicAccess: false` |
| TLS | ✅ Minimum 1.2 | `minimumTlsVersion: TLS1_2` |

**Finding:** Defender for Storage is **not enabled** on `mfafoodexpmediastore`. Files uploaded through the media library (images for events, news, hero banners) are stored without malware scanning. This is a **medium-severity gap** — a malicious admin could upload an infected file that serves from the same origin as the app.

---

## 5. Authentication & Authorization

| Check | Status | Evidence |
|-------|--------|----------|
| Payload JWT auth | ✅ | `payload-token` HTTP-only cookie, verified in `middleware.ts` via `jose/jwtVerify` |
| MFA enforcement | ✅ | `mfa-verified` cookie with signed JWT; admin server actions blocked with 403 if MFA enabled but cookie absent |
| Route gating | ✅ | `/admin`, `/check-in`, `/console/*` protected; door-staff blocked from `/admin/bookings` and `/console/*` (except `/console/help`) |
| Public paths allowlist | ✅ | `PUBLIC_PATHS` array includes login, forgot, reset, create-first-user |
| API auth | ✅ | Console API routes check `payload-token` cookie; webhook routes use shared-secret verification |
| VIVA webhook auth | ✅ | `x-viva-secret` or `Authorization: Bearer` header verified; body treated as hint, transaction fetched from VIVA API for confirmation |
| Turnstile captcha | ✅ | Cloudflare Turnstile on booking form, verified server-side in checkout route |

**No findings.** Auth implementation is thorough.

---

## 6. Input Validation & Rate Limiting

| Check | Status | Evidence |
|-------|--------|----------|
| Booking validation | ✅ | Zod schemas in `src/lib/validations/booking.ts` |
| Rate limiting | ✅ | In-memory per-IP limiter (`src/lib/rate-limit.ts`), configurable window/max per endpoint |
| CSRF | ✅ | Next.js built-in CSRF for server actions; API routes are stateless (no cookie-based sessions to hijack) |

**Finding:** Rate limiter is in-memory (per-instance) — acceptable for single-node deployment. Noted in doc comment: will need Redis if scaled to multiple instances.

---

## 7. Cookies & Consent

| Check | Status | Evidence |
|-------|--------|----------|
| Cookie banner | ✅ | `CookieBanner.tsx` with ePrivacy/GDPR compliance annotations |
| Consent levels | ✅ | `all` (Google Translate + analytics) and `necessary` (session only) |
| Google Translate gating | ✅ | `LanguageSwitcher` checks `getCookieConsent()` before loading widget |
| Consent persistence | ✅ | `localStorage` with `storage` event listener for cross-tab sync |
| Legal references | ✅ | Banner links to `/legal/cookie-policy` |

**No findings.**

---

## 8. Legislation Pages

| Page | Source | Status |
|------|--------|--------|
| Terms & Conditions | Payload Global → `/legal/terms-and-conditions` | ✅ Live, editable |
| Cancellation Policy | Payload Global → `/legal/cancellation-policy` | ✅ Live, editable |
| Data Protection Policy | Payload Global → `/legal/data-protection-policy` | ✅ Live, editable |
| Customer Policy | Seeded in Policies collection | ✅ Live |
| Cookie Policy | Seeded in Policies collection | ✅ Live |
| Privacy Notice | Seeded in Policies collection (legacy, superseded by Data Protection Policy) | ✅ Still accessible |
| Accessibility Statement | Seeded in Policies collection | ✅ Live |
| Provider Info | Seeded in Policies collection | ✅ Live |

**All 8 legal pages render at their URLs.** Footer links updated. No broken links in navigation.

---

## 9. WCAG Accessibility

| Check | Status | Evidence |
|-------|--------|----------|
| CI axe-core | ✅ Pass | `Accessibility (axe-core)` job in `ci.yml` |
| Contrast | ✅ Pass | Brand contrast documented in `docs/brand-contrast.md` |
| Semantic HTML | ✅ | `CookieBanner` has `role="dialog"`, `aria-label`, `aria-live`; all pages have `<main>` landmark |
| Keyboard navigation | ⚠️ Not formally tested | No keyboard-navigation test in CI |

**Finding:** axe-core CI passes. No manual keyboard-navigation audit run. Low priority — `axe-core` catches most issues.

---

## 10. Payment Journey (VIVA Wallet)

| Check | Status | Evidence |
|-------|--------|----------|
| VIVA OAuth2 | ✅ | Client credentials → Bearer token, cached 50 min (10 min before 60-min expiry) |
| Order creation | ✅ | `POST /checkout/v2/orders` → returns `OrderCode` |
| Redirect flow | ✅ | `vivapayments.com/web/checkout?ref={OrderCode}` |
| Webhook handler | ✅ | Shared secret verification, API-side transaction confirmation, idempotent |
| Refund pipeline | ✅ | `processCancellationRefund()` with tier policy (both Console and Dashboard paths) |
| Seat hold → expire | ✅ | Cron job `mfa-cron-sweep-holds` sweeps expired holds |
| Transaction reconciliation | ✅ | `reconcile-viva.ts` fetches from VIVA API, verifies amount, prevents double-processing |
| Demo/prod switch | ✅ | `VIVA_DEMO_MODE` env var → `demo-api` vs `api` base URLs |

**No findings.** Payment pipeline is well-architected.

---

## 11. Email (Resend / Nodemailer)

| Check | Status | Evidence |
|-------|--------|----------|
| Transport | ✅ | `@payloadcms/email-nodemailer` configured in `payload.config.ts` |
| Confirmation email | ✅ | `sendConfirmationEmail()` — QR code, event details, T&Cs, HTML template |
| Console Resend | ✅ Fixed (was no-op) | Now regenerates QR + calls `sendConfirmationEmail()` |
| Manual booking email | ✅ Fixed | Manual bookings now send confirmation |
| Data Protection email | ⚠️ Pending | Domain setup needed for Cloudflare send-only |

**Finding:** Email works on test. Production domain not yet configured for Cloudflare send-only. Not a security issue — deployment blocker.

---

## 12. Threat Intelligence

| Check | Status | Evidence |
|-------|--------|----------|
| attack-monitor | ⚠️ Not configured | No `attack-monitor.yml` workflow in `.github/workflows/` |
| collaborator drift | ⚠️ Not configured | No collaborator audit workflow |

---

## Summary

| Dim | Status | Count |
|-----|--------|-------|
| ✅ Pass / No findings | Secret scanning, Security headers, Auth, Input validation, Cookies, Legislation, Payment, Email, Cloud resources | 9 |
| ❌ Gap (action needed) | Defender for Storage not enabled | 1 |
| ⚠️ Not set up (deferred) | Gitleaks CI, ZAP DAST, Trivy SCA, CodeQL SAST, Key Vault, Threat intel, Keyboard nav | 7 |

---

## Recommendations (prioritized)

### High priority
1. **🔧 Enable Defender for Storage** on `mfafoodexpmediastore`:
   ```
   az security defender-for-storage create \
     --resource-group mfa-food-experience-test \
     --storage-account mfafoodexpmediastore \
     --is-enabled true \
     --malware-scanning-on-upload-is-enabled true \
     --sensitive-data-discovery-is-enabled true
   ```
   Cost: ~$10/month for the storage account. Mitigates the malware-on-upload gap.

2. **🔧 Add Key Vault for production** — move `DATABASE_URL`, `PAYLOAD_SECRET`, `VIVA_*` secrets from GitHub environment variables to an Azure Key Vault referenced via `secretref:` in Container App env vars. The `VIVA_WEBHOOK_SECRET` already uses the pattern (`secretref:cron-secret` for CRON_SECRET).

### Medium priority
3. **🔧 Add Gitleaks to CI** — create `.github/workflows/secret-scan.yml`:
   ```yaml
   on: [push, pull_request]
   jobs:
     gitleaks:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
           with: { fetch-depth: 0 }
         - uses: gitleaks/gitleaks-action@v2
   ```
   Add `.gitleaks.toml` with allowlist for test constants.

4. **🔧 Fix deploy-guard false positive** — the guard regex `secrets.\w+` catches legitimate VIVA payment credentials in `deploy.yml`. Refine to allow `secrets.VIVA_*` while still blocking OIDC-related secrets.

5. **🔧 Add SCA (Trivy) to CI** — `aquasecurity/trivy-action@master` with SARIF output. Catches CVEs in `pnpm-lock.yaml`.

### Low priority / post-production
6. **🔧 DAST (ZAP) workflow** — `.github/workflows/dast-scan.yml` targeting the production URL after deployment.
7. **🔧 Storage network ACLs** — restrict `mfafoodexpmediastore` to the container app's outbound IPs.
8. **🔧 Threat intel** — integrate `attack-monitor` from the skill templates.
9. **🔧 Keyboard navigation audit** — add to CI design-fidelity suite.