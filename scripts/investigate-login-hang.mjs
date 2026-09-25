/** scripts/investigate-login-hang.mjs — Playwright probe for the stuck
 *  "Logging in…" spinner on the admin login page.
 *
 *  Reaches the LIVE deployment (BASE_URL) from GitHub Actions. Fills the
 *  login form, submits, and records everything that determines whether the
 *  overlay resolves or hangs:
 *    - the `<form data-form-ready>` attribute over time
 *    - the AdminSubmitOverlay ([role="status"]) appearance / dismissal
 *    - all /api/* network requests + status + latency
 *    - console errors + uncaught page errors
 *
 *  Because the admin password is not available to the agent, this first run
 *  exercises the FAILURE path (wrong credentials → Payload returns 401) which
 *  is deterministic and isolates whether the error-handling path resolves the
 *  spinner. If ADMIN_EMAIL/ADMIN_PASSWORD are provided it exercises the real
 *  success (redirect) path instead.
 *
 *  Usage:
 *    BASE_URL=https://foodexperience.agilexplus.dev \
 *    [ADMIN_EMAIL=... ADMIN_PASSWORD=...] \
 *    node scripts/investigate-login-hang.mjs
 */

import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = process.env.BASE_URL || 'https://foodexperience.agilexplus.dev'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'probe-no-such-user@foodexperience.agilexplus.dev'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Probe-Wrong-Password-123!'
const OUTPUT_DIR = resolve(process.cwd(), 'investigate-login')

const WATCH_MS = 40_000 // longer than the 30s failsafe, to see if it self-dismisses

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })

  const apiRequests = []
  const consoleErrors = []
  const formReadyMutations = []

  const page = await context.newPage()

  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      const entry = { url: req.url(), method: req.method(), start: Date.now(), status: null, duration: null }
      apiRequests.push(entry)
      // attach response handler to this specific request
      req
      .response()
      .then((resp) => {
        entry.status = resp.status()
        entry.duration = Date.now() - entry.start
      })
      .catch(() => {})
    }
  })

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push({ type: msg.type(), text: msg.text() })
      console.log(`[console.${msg.type()}] ${msg.text()}`)
    }
  })
  page.on('pageerror', (err) => {
    consoleErrors.push({ type: 'pageerror', text: err.message })
    console.log(`[pageerror] ${err.message}`)
  })

  // ── 1. Load login page ─────────────────────────────────────────
  console.log(`[step] goto ${BASE_URL}/admin/login`)
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('form.form', { timeout: 20000 })
  await page.screenshot({ path: resolve(OUTPUT_DIR, '01-login.png'), fullPage: true })

  const form = page.locator('form.form').first()
  const initialReady = await form.getAttribute('data-form-ready')
  console.log(`[info] initial data-form-ready = "${initialReady}"`)

  // Inject our own deterministic mutation capture on the form element.
  await page.evaluate(() => {
    window.__probeMutations = []
    const f = document.querySelector('form.form')
    if (f) {
      new MutationObserver((records) => {
        for (const r of records) {
          if (r.type === 'attributes' && r.attributeName === 'data-form-ready') {
            window.__probeMutations.push({
              t: Date.now(),
              old: r.oldValue,
              new: f.getAttribute('data-form-ready'),
              formPresent: !!document.querySelector('form.form'),
            })
          }
        }
      }).observe(f, { attributes: true, attributeFilter: ['data-form-ready'], attributeOldValue: true })
    }
  })

  // ── 2. Fill credentials ────────────────────────────────────────
  console.log(`[step] fill email="${ADMIN_EMAIL}" password=<len ${ADMIN_PASSWORD.length}>`)
  await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL)
  await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD)
  await page.screenshot({ path: resolve(OUTPUT_DIR, '02-filled.png'), fullPage: true })

  // ── 3. Submit ──────────────────────────────────────────────────
  const submit = page.locator('button[type="submit"]').first()
  console.log(`[step] clicking submit (${(await submit.textContent()).trim()})`)
  await submit.click()

  // ── 4. Watch ───────────────────────────────────────────────────
  let spinnerSeen = false
  let spinnerDismissed = false
  let spinnerSeenAt = null
  const overlay = page.locator('[role="status"]')

  const start = Date.now()
  while (Date.now() - start < WATCH_MS) {
    await page.waitForTimeout(500)

    const overlayCount = await overlay.count()
    if (overlayCount > 0 && !spinnerSeen) {
      spinnerSeen = true
      spinnerSeenAt = Date.now()
      console.log(`[spinner] overlay APPEARED (t=${spinnerSeenAt - start}ms)`)
      await page.screenshot({ path: resolve(OUTPUT_DIR, '03-spinner.png') })
    } else if (spinnerSeen && overlayCount === 0) {
      spinnerDismissed = true
      console.log(`[spinner] overlay DISMISSED (t=${Date.now() - start}ms)`)
      await page.screenshot({ path: resolve(OUTPUT_DIR, '04-dismissed.png') })
      break
    }

    // Watch for redirect (success path)
    if (page.url() !== `${BASE_URL}/admin/login`) {
      console.log(`[redirect] navigated to ${page.url()}`)
      break
    }
  }

  // ── 5. Final capture ───────────────────────────────────────────
  const finalUrl = page.url()
  const finalReady = await page.locator('form.form').first().getAttribute('data-form-ready').catch(() => 'NO-FORM')
  const probeMutations = await page.evaluate(() => window.__probeMutations || [])
  await page.screenshot({ path: resolve(OUTPUT_DIR, '05-final.png'), fullPage: true })

  const spannerStillUp = spinnerSeen && !spinnerDismissed && Date.now() - start >= WATCH_MS

  const report = {
    loginEmail: ADMIN_EMAIL,
    finalUrl,
    finalDataFormReady: finalReady,
    spinnerSeen,
    spinnerSeenAtMs: spinnerSeenAt ? spinnerSeenAt - start : null,
    spinnerDismissed,
    spinnerStillUpAfterWatchMs: spannerStillUp,
    apiRequests,
    consoleErrors,
    formReadyMutations: probeMutations,
  }

  writeFileSync(resolve(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2))

  console.log('\n================ REPORT ================')
  console.log(JSON.stringify(report, null, 2))
  console.log('========================================')

  await browser.close()

  // Non-zero exit only signals a real "spinner hung" finding OR a fatal error;
  // otherwise a cleaned run exits 0 so the workflow captures artifacts.
  if (spannerStillUp) {
    console.error('\n[findings] SPINNER STILL UP after 40s — hang reproduced on the failure path.')
    process.exit(2)
  }
  if (!spinnerSeen) {
    console.log('\n[findings] Spinner never appeared (form may have resolved instantly).')
  } else {
    console.log(`\n[findings] Spinner appeared and ${spinnerDismissed ? 'dismissed' : 'stayed up'} — failure path ${spinnerDismissed ? 'resolves cleanly' : 'hangs'}.`)
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})