/** scripts/probe-v4-success.mjs — Test SUCCESS redirect path by mocking
 *  the login API response. This avoids needing real credentials.
 *  We intercept the login POST, return a valid 200 response with
 *  a fake token/user, and confirm the overlay resolves + redirect occurs.
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

  // Eavesdrop on observer callback + overlay DOM mutations
  await page.addInitScript(() => {
    window.__ev = []
    const Orig = window.MutationObserver
    window.MutationObserver = function (cb, opts) {
      const inst = new Orig((records, obs) => {
        const hasDFR = records.some(r => r.type === 'attributes' && r.attributeName === 'data-form-ready')
        if (hasDFR) {
          const changed = records.find(r => r.attributeName === 'data-form-ready')
          const nv = changed && changed.target.getAttribute ? changed.target.getAttribute('data-form-ready') : '?'
          const anyProcessing = Array.from(document.querySelectorAll('form.form'))
            .some(f => f.getAttribute('data-form-ready') === 'false')
          window.__ev.push({ kind: 'observer', t: Date.now(), nv, anyProcessing,
            hasMyOverlay: !!document.querySelector('[aria-label*="Logging"]'),
            url: location.href,
          })
        }
        return cb(records, obs)
      }, opts)
      return inst
    }
  })

  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message))

  // Intercept login success response
  await page.route('**/api/users/login', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Authentication Passed',
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QiLCJjb2xsZWN0aW9uIjoidXNlcnMiLCJlbWFpbCI6ImFkbWluQHVhaXBsZXgucGwiLCJpYXQiOjE3OTAzNzQ0MDAsImV4cCI6MTc5MDM3NDQ2MH0.mock',
          user: { id: 'test-user-1', email: 'admin@foodagency.mt', role: 'admin', collection: 'users' },
        }),
      })
    } else {
      await route.continue()
    }
  })

  console.log('[step] goto login')
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('form.form', { timeout: 20000 })

  await page.locator('input[name="email"]').first().fill('admin@foodagency.mt')
  await page.locator('input[name="password"], input[type="password"]').first().fill('anything123')
  await page.locator('button[type="submit"]').first().click()
  console.log('[step] submitted')

  const start = Date.now()
  const snapshots = []
  let lastKey = ''
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(300)
    const t = Date.now() - start
    const ready = await page.locator('form.form').first().getAttribute('data-form-ready').catch(() => 'N/A')
    const url = page.url()
    const myOverlay = await page.locator('[aria-label*="Logging"]').count()
    const key = `${ready}|${url}|${myOverlay}`
    if (key !== lastKey) {
      lastKey = key
      snapshots.push({ t, ready, url, myOverlay })
      console.log(`[snap] t=${t}ms ready=${ready} overlay=${myOverlay} url=${url.slice(-40)}`)
      await page.screenshot({ path: resolve(OUT, `s-${String(snapshots.length).padStart(2, '0')}.png`), fullPage: true })
    }
    if (url !== `${BASE_URL}/admin/login` && myOverlay === 0) break
  }

  const events = await page.evaluate(() => window.__ev || [])
  const final = snapshots[snapshots.length - 1]
  const report = { snapshots, observerEvents: events, errors, final }

  writeFileSync(resolve(OUT, 'report-v4.json'), JSON.stringify(report, null, 2))

  console.log('\n=== Observer events ===')
  console.log(JSON.stringify(events, null, 2))
  console.log('=== Final state ===')
  console.log(JSON.stringify(final, null, 2))
  console.log('=== Errors ===')
  console.log(JSON.stringify(errors, null, 2))

  if (final.myOverlay > 0) {
    console.error('OVERLAY STILL PRESENT — success path hang reproduced.')
    process.exit(2)
  }
  if (!final.url.includes('/admin')) {
    console.error('NO REDIRECT after successful login.')
    process.exit(3)
  }

  console.log('SUCCESS: overlay resolved, redirected to admin.')
  await browser.close()
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })