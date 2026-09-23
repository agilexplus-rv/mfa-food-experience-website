/** scripts/csp-audit-ci.mjs — Validate CSP header integrity.

  Runs in GitHub Actions (ci.yml → csp job).  Fetches the homepage and
  checks that the Content-Security-Policy response header contains the
  expected directives.  New external domains (e.g. VIVA payments) must be
  reflected here when integrated; missing directives fail the gate.

  Usage:
    BASE_URL=http://localhost:3000 node scripts/csp-audit-ci.mjs
**/

import { strict as assert } from 'node:assert'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// Expected CSP directives — subset that must be present.
// Full CSP is in next.config.ts; this is a minimum-check to catch regressions.
const EXPECTED_DIRECTIVES = [
  "script-src 'self'",
  "connect-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]

// Domains that MUST be allowed in script-src (Google Translate widget).
const REQUIRED_SCRIPT_DOMAINS = [
  'https://translate.google.com',
  'https://translate.googleapis.com',
  'https://translate-pa.googleapis.com',
]

// Domains that MUST be allowed in connect-src.
const REQUIRED_CONNECT_DOMAINS = [
  'https://translate.googleapis.com',
  'https://translate-pa.googleapis.com',
]

async function main() {
  const res = await fetch(BASE_URL)
  const csp = res.headers.get('content-security-policy')

  if (!csp) {
    console.error('FAIL: No Content-Security-Policy header found on response.')
    process.exit(1)
  }

  console.log(`[csp] Header found (${csp.length} chars)`)

  const failures = []

  // Check required directives are present.
  for (const directive of EXPECTED_DIRECTIVES) {
    if (!csp.includes(directive)) {
      failures.push(`Missing directive: ${directive}`)
    }
  }

  // Check required script domains.
  for (const domain of REQUIRED_SCRIPT_DOMAINS) {
    if (!csp.includes(domain) || !csp.includes('script-src')) {
      // Only fail if script-src doesn't include this domain.
      // Extract script-src content and check.
      const m = csp.match(/script-src\s+([^;]+)/i)
      if (!m || !m[1].includes(domain)) {
        failures.push(`script-src missing required domain: ${domain}`)
      }
    }
  }

  // Check required connect domains.
  for (const domain of REQUIRED_CONNECT_DOMAINS) {
    const m = csp.match(/connect-src\s+([^;]+)/i)
    if (!m || !m[1].includes(domain)) {
      failures.push(`connect-src missing required domain: ${domain}`)
    }
  }

  if (failures.length > 0) {
    console.error(`[csp] ${failures.length} failure(s):`)
    for (const f of failures) console.error(`  - ${f}`)
    console.error('[csp] Gate FAILED.')
    process.exit(1)
  }

  console.log('[csp] All directives present — gate clean.')
}

main().catch((err) => {
  console.error('[csp] Fatal:', err)
  process.exit(1)
})