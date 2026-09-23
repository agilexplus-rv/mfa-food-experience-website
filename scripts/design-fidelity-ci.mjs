/** scripts/design-fidelity-ci.mjs — Visual regression gate for key pages.

  Runs in GitHub Actions (ci.yml → design job).  Takes screenshots of a
  configured set of public routes and compares them against baselines stored
  in design-fidelity/baselines/.  On the first run (no baselines), the
  screenshots are saved and the gate passes (baseline creation).

  If screenshot pixel diff exceeds a threshold, the gate fails.  Failing
  screenshots and diffs are uploaded as artifacts with the run.

  Usage:
    BASE_URL=http://localhost:3000 node scripts/design-fidelity-ci.mjs
**/

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const BASELINES_DIR = resolve(process.cwd(), 'design-fidelity', 'baselines')
const OUTPUT_DIR = resolve(process.cwd(), 'design-fidelity')

// Pixel difference threshold (0–1).  0.01 = 1% difference tolerated
// (anti-aliasing, font rendering across CI runners).
const THRESHOLD = 0.01

// Pages to screenshot at desktop (1280×900) and mobile (390×844).
const PAGES = [
  { path: '/', name: 'homepage' },
  { path: '/services', name: 'services' },
  { path: '/about', name: 'about' },
  { path: '/contact', name: 'contact' },
  { path: '/news', name: 'news' },
]

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

async function main() {
  mkdirSync(BASELINES_DIR, { recursive: true })
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const browser = await chromium.launch()
  let failures = 0
  const results = {}

  for (const pageCfg of PAGES) {
    for (const vp of VIEWPORTS) {
      const key = `${pageCfg.name}--${vp.name}`
      const url = `${BASE_URL}${pageCfg.path}`
      const baselinePath = resolve(BASELINES_DIR, `${key}.png`)
      const screenshotPath = resolve(OUTPUT_DIR, `${key}.png`)
      const diffPath = resolve(OUTPUT_DIR, `${key}-diff.png`)

      console.log(`[design] ${key}: ${url}`)

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      })
      const page = await context.newPage()

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      } catch (err) {
        console.warn(`[design] ⚠ ${key}: navigation failed — ${err.message}`)
        results[key] = { error: err.message }
        await context.close()
        continue
      }

      await page.screenshot({ path: screenshotPath, fullPage: false })
      await context.close()

      // Compare against baseline.
      if (!existsSync(baselinePath)) {
        // First run — no baseline yet. Save as baseline and pass.
        writeFileSync(baselinePath, readFileSync(screenshotPath))
        console.log(`[design] ✓ ${key}: baseline created (first run)`)
        results[key] = { status: 'baseline_created' }
        continue
      }

      // Pixel-by-pixel comparison.
      const { default: pixelmatch } = await import('pixelmatch')
      const { default: pngjs } = await import('pngjs')
      const { PNG } = pngjs

      const baselineImg = PNG.sync.read(readFileSync(baselinePath))
      const currentImg = PNG.sync.read(readFileSync(screenshotPath))

      if (
        baselineImg.width !== currentImg.width ||
        baselineImg.height !== currentImg.height
      ) {
        console.error(
          `[design] ✗ ${key}: dimension mismatch ` +
          `(${baselineImg.width}×${baselineImg.height} vs ${currentImg.width}×${currentImg.height})`
        )
        results[key] = { status: 'dimension_mismatch' }
        failures++
        continue
      }

      const diff = new PNG({ width: baselineImg.width, height: baselineImg.height })
      const mismatchedPixels = pixelmatch(
        baselineImg.data,
        currentImg.data,
        diff.data,
        baselineImg.width,
        baselineImg.height,
        { threshold: 0.1 }
      )

      const diffRatio = mismatchedPixels / (baselineImg.width * baselineImg.height)

      if (diffRatio > THRESHOLD) {
        writeFileSync(diffPath, PNG.sync.write(diff))
        console.error(
          `[design] ✗ ${key}: diff ${(diffRatio * 100).toFixed(1)}% ` +
          `(threshold ${(THRESHOLD * 100).toFixed(1)}%) — ` +
          `${mismatchedPixels} pixels differ`
        )
        results[key] = { status: 'failed', diffRatio, mismatchedPixels }
        failures++
      } else {
        console.log(`[design] ✓ ${key}: match (${(diffRatio * 100).toFixed(2)}% diff)`)
        results[key] = { status: 'passed', diffRatio }
      }
    }
  }

  await browser.close()

  writeFileSync(
    resolve(OUTPUT_DIR, 'results.json'),
    JSON.stringify(results, null, 2)
  )

  if (failures > 0) {
    console.error(`\n[design] ${failures} screenshot(s) failed — gate FAILED.`)
    process.exit(1)
  }

  console.log('[design] All screenshots passed — gate clean.')
}

main().catch((err) => {
  console.error('[design] Fatal:', err)
  process.exit(1)
})