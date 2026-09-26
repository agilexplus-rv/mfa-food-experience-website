/** scripts/probe-v5-network.mjs
 *  Capture ALL network requests/responses during login to find the
 *  root cause of "TypeError: Load failed" + "401 /api/users/me".
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = process.env.BASE_URL || 'https://foodexperience.agilexplus.dev'
const OUT = resolve(process.cwd(), 'investigate-login')

async function main() {
  mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  const networkLog = []
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      networkLog.push({ kind: 'request', t: Date.now(), url: req.url(), method: req.method(), headers: req.headers() })
    }
  })
  page.on('response', async res => {
    if (res.url().includes('/api/')) {
      let body = null
      try { body = await res.text() } catch (_) {}
      networkLog.push({ kind: 'response', t: Date.now(), url: res.url(), status: res.status(), headers: res.headers(), body: body?.slice(0, 500) })
    }
  })
  page.on('requestfailed', req => {
    const f = req.failure()
    if (f) networkLog.push({ kind: 'failure', t: Date.now(), url: req.url(), method: req.method(), errorText: f.errorText })
  })

  const errors = []
  const allConsole = []
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`[${m.type()}] ${m.text()}`)
    allConsole.push(`[${m.type()}] ${m.text().slice(0, 200)}`)
  })
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message))

  // Also eavesdrop data-form-ready transitions
  await page.addInitScript(() => {
    window.__ev = []
    const Orig = window.MutationObserver
    window.MutationObserver = function (cb, opts) {
      return new Orig((records, obs) => {
        const hasDFR = records.some(r => r.type === 'attributes' && r.attributeName === 'data-form-ready')
        if (hasDFR) {
          const changedEl = records.find(r => r.attributeName === 'data-form-ready')
          const nv = changedEl?.target?.getAttribute?.('data-form-ready') ?? '?'
          window.__ev.push({ t: Date.now(), nv, url: location.href, hasOverlay: !!document.querySelector('[aria-label*="Logging"]') })
        }
        return cb(records, obs)
      }, opts)
    }
  })

  console.log('[step] goto login page')
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('form.form', { timeout: 20000 })
  await page.waitForTimeout(500)

  // Fill with plausible creds
  await page.locator('input[name="email"]').first().fill('admin@foodagency.mt')
  await page.locator('input[name="password"], input[type="password"]').first().fill('TestPass123!@#')
  console.log('[step] submitting form…')
  await page.locator('button[type="submit"]').first().click()

  // Wait long enough for error to surface
  await page.waitForTimeout(6000)

  // Check current state
  const url = page.url()
  const overlayCount = await page.locator('[aria-label*="Logging"]').count()
  const formReady = await page.locator('form.form').first().getAttribute('data-form-ready').catch(() => 'N/A')
  const fieldsDisabled = await page.locator('form.form input').first().evaluate(el => el.disabled).catch(() => 'N/A')
  const events = await page.evaluate(() => window.__ev || [])

  const report = { networkLog, errors, allConsole, events, finalState: { url, overlayCount, formReady, fieldsDisabled } }
  writeFileSync(resolve(OUT, 'report-v5.json'), JSON.stringify(report, null, 2))
  await page.screenshot({ path: resolve(OUT, 'final.png'), fullPage: true })

  console.log('\n=== Network (API only) ===')
  for (const e of networkLog.slice(-20)) {
    console.log(`  ${e.kind} ${e.method} ${e.url} → ${e.status} ${e.errorText || ''}`)
  }
  console.log('\n=== Console errors ===')
  for (const e of errors) console.log(' ', e)
  console.log('\n=== Observer events ===')
  for (const e of events) console.log(`  t=${e.t} nv=${e.nv} overlay=${e.hasOverlay} url=${e.url ? e.url.slice(-30) : ''}`)
  console.log('\n=== Final page state ===')
  console.log(JSON.stringify(report.finalState, null, 2))

  if (errors.some(e => e.includes('Load failed'))) {
    console.error('REPRODUCED: TypeError: Load failed')
    process.exit(2)
  }
  if (report.finalState.overlayCount > 0) {
    console.error('OVERLAY STILL PRESENT')
    process.exit(3)
  }

  console.log('No Load failed error detected.')
  await browser.close()
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })