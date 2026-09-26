/** scripts/probe-v6-body.mjs
 *  Intercept FormData creation and the actual fetch call to see the
 *  exact body format the browser sends to /api/users/login.
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

  // Intercept fetch to log login POST details
  await page.addInitScript(() => {
    const origFetch = window.fetch
    window.__fetchLog = []
    window.fetch = function (url, init) {
      if (typeof url === 'string' && url.includes('/login')) {
        const log = { url, method: init?.method, headers: init?.headers ? { ...init.headers } : undefined, bodyType: init?.body?.constructor?.name }
        // Try to read FormData
        if (init?.body && typeof init.body.entries === 'function') {
          const entries = []
          for (const [k, v] of init.body.entries()) {
            entries.push({ key: k, value: typeof v === 'string' ? v.slice(0, 200) : `[${v.constructor.name} len=${v.length || v.size || '?'}]` })
          }
          log.formDataEntries = entries
        }
        window.__fetchLog.push(log)
      }
      return origFetch.call(this, url, init)
    }
  })

  const errors = []
  const allConsole = []
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`[${m.type()}] ${m.text()}`)
    allConsole.push(`[${m.type()}] ${m.text().slice(0, 200)}`)
  })
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message))

  console.log('[step] goto login page')
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('form.form', { timeout: 20000 })
  await page.waitForTimeout(1000)

  await page.locator('input[name="email"]').first().fill('admin@foodagency.mt')
  await page.locator('input[name="password"], input[type="password"]').first().fill('TestPass123!@#')
  console.log('[step] submitting form...')
  await page.locator('button[type="submit"]').first().click()

  await page.waitForTimeout(5000)

  const fetchLog = await page.evaluate(() => window.__fetchLog || [])

  const report = { fetchLog, errors, allConsole: allConsole.slice(-20) }
  writeFileSync(resolve(OUT, 'report-v6.json'), JSON.stringify(report, null, 2))
  await page.screenshot({ path: resolve(OUT, 'final.png'), fullPage: true })

  console.log('\n=== Fetch log for /login ===')
  for (const e of fetchLog) {
    console.log(JSON.stringify(e, null, 2))
  }
  console.log('\n=== Console errors ===')
  for (const e of errors) console.log(' ', e)

  if (errors.some(e => e.includes('Load failed'))) {
    console.error('REPRODUCED: Load failed')
    process.exit(2)
  }
  console.log('No Load failed reproduced')

  await browser.close()
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })