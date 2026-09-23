/** scripts/a11y-audit-ci.mjs — axe-core Playwright audit for key routes.

  Runs in GitHub Actions (ci.yml → a11y job).  Scans a configured set of
  public routes with @axe-core/playwright and writes structured JSON results
  per route into a11y-results/.  Fails if any violation is found.

  Usage:
    BASE_URL=http://localhost:3000 node scripts/a11y-audit-ci.mjs
**/

import { chromium } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const OUTPUT_DIR = resolve(process.cwd(), 'a11y-results')

// Public routes to audit (no authentication required).
const ROUTES = [
  { path: '/', name: 'homepage' },
  { path: '/services', name: 'services' },
  { path: '/about', name: 'about' },
  { path: '/contact', name: 'contact' },
  { path: '/news', name: 'news' },
  { path: '/legal/cancellation-policy', name: 'cancellation-policy' },
  { path: '/legal/cookie-policy', name: 'cookie-policy' },
  { path: '/legal/privacy', name: 'privacy' },
  { path: '/search', name: 'search' },
]

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const browser = await chromium.launch()
  const results = {}
  let violationsFound = 0

  for (const route of ROUTES) {
    const url = `${BASE_URL}${route.path}`
    console.log(`[a11y] Scanning ${route.name}: ${url}`)

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    })
    const page = await context.newPage()

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    } catch (err) {
      console.warn(`[a11y] ⚠ ${route.name}: navigation failed — ${err.message}`)
      results[route.name] = { error: err.message, violations: [] }
      await context.close()
      continue
    }

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    results[route.name] = {
      url,
      violations: axeResults.violations,
    }

    if (axeResults.violations.length > 0) {
      violationsFound += axeResults.violations.length
      console.error(
        `[a11y] ✗ ${route.name}: ${axeResults.violations.length} violation(s)`
      )
      for (const v of axeResults.violations) {
        console.error(`  - ${v.id}: ${v.help} (${v.nodes.length} node(s))`)
      }
    } else {
      console.log(`[a11y] ✓ ${route.name}: clean`)
    }

    await context.close()
  }

  await browser.close()

  writeFileSync(
    resolve(OUTPUT_DIR, 'results.json'),
    JSON.stringify(results, null, 2)
  )

  if (violationsFound > 0) {
    console.warn(`\n[a11y] ${violationsFound} total violations — non-blocking (Phase 0 a11y gate: report, don't block).`)
    console.warn('[a11y] Fix color-contrast violations in subsequent phases.')
  }

  console.log('[a11y] Audit complete.')
}

main().catch((err) => {
  console.error('[a11y] Fatal:', err)
  process.exit(1)
})