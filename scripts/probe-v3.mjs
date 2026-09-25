/** scripts/probe-v3.mjs — decisive probe.
 *  - Patches MutationObserver (via addInitScript) to log every callback whose
 *    records include a data-form-ready attribute change, plus the re-computed
 *    anyProcessing + whether an [role=status] overlay exists at that instant.
 *  - After submit, dumps outerHTML of EVERY [role=status] element so we know
 *    exactly which component is stuck (mine has aria-label "Logging in… please wait").
 */

import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = process.env.BASE_URL || 'https://foodexperience.agilexplus.dev'
const EMAIL = process.env.ADMIN_EMAIL || 'probe-no-such-user@foodexperience.agilexplus.dev'
const PASSWORD = process.env.ADMIN_PASSWORD || 'Probe-Wrong-123!'
const OUT = resolve(process.cwd(), 'investigate-login')

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  // Runs before ANY page script on every navigation.
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
          const statusEls = Array.from(document.querySelectorAll('[role="status"]')).map(x => x.getAttribute('aria-label'))
          window.__ev.push({ kind: 'observer', t: Date.now(), nv, anyProcessing, statusEls })
        }
        return cb(records, obs)
      }, opts)
      return inst
    }
  })

  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message))

  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('form.form', { timeout: 20000 })

  await page.locator('input[name="email"]').first().fill(EMAIL)
  await page.locator('input[name="password"], input[type="password"]').first().fill(PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  console.log('[step] submitted')

  const start = Date.now()
  const samples = []
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(250)
    const t = Date.now() - start
    const ready = await page.locator('form.form').first().getAttribute('data-form-ready').catch(() => 'NO-FORM')
    const statuses = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="status"]')).map(x => ({
        ariaLabel: x.getAttribute('aria-label'),
        cls: x.getAttribute('class'),
        hasKeyframe: !!document.querySelector('style') && /admin-submit-spin/.test(document.body.innerHTML),
        outerStart: x.outerHTML.slice(0, 200),
      }))
    )
    samples.push({ t, ready, statusCount: statuses.length, statuses })
    // stop early if it resolves
    if (statuses.length === 0 && ready === 'true' && t > 3000) break
  }

  const events = await page.evaluate(() => window.__ev || [])
  const report = { samples, observerEvents: events, errors }
  writeFileSync(resolve(OUT, 'report-v3.json'), JSON.stringify(report, null, 2))

  console.log('=== OBSERVER EVENTS ===')
  console.log(JSON.stringify(events, null, 2))
  console.log('=== SAMPLES (status element identity) ===')
  for (const s of samples) {
    console.log(`t=${s.t}ms ready=${s.ready} statusCount=${s.statusCount}`)
    for (const st of s.statuses) {
      console.log(`   ariaLabel=${JSON.stringify(st.ariaLabel)} cls=${JSON.stringify(st.cls)}`)
      console.log(`   outer=${st.outerStart.replace(/\n/g, ' ')}`)
    }
  }
  console.log('=== ERRORS ===')
  console.log(JSON.stringify(errors, null, 2))

  const stillUp = samples[samples.length - 1].statusCount > 0
  await browser.close()
  if (stillUp) { console.error('STILL UP'); process.exit(2) }
}

main().catch(e => { console.error('Fatal', e); process.exit(1) })