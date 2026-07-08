/**
 * WCAG 2.1 AA automated audit — Puppeteer + @axe-core/puppeteer
 * Uses chrome-headless-shell for fast, headless scanning.
 *
 * Run: node scripts/wcag-audit-puppeteer.mjs
 */
import puppeteer from 'puppeteer';
import { AxePuppeteer } from '@axe-core/puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://mfa-food-experience-website.vercel.app';
const OUTPUT_DIR = path.join(__dirname, '..', 'a11y-results');
const SUMMARY_FILE = path.join(__dirname, '..', 'a11y-audit-results.json');

const CHROME_PATH = process.env.CHROME_PATH || '/tmp/puppeteer-chrome/chrome-headless-shell/linux-150.0.7871.24/chrome-headless-shell-linux64/chrome-headless-shell';

const PAGES = [
  { path: '/', label: 'Home' },
  { path: '/about', label: 'About' },
  { path: '/services', label: 'Services' },
  { path: '/services/classes', label: 'Services-Classes' },
  { path: '/news', label: 'News' },
  { path: '/testimonials', label: 'Testimonials' },
  { path: '/contact', label: 'Contact' },
  { path: '/book/4', label: 'Book-Event' },
  { path: '/legal/cancellation-policy', label: 'Legal-Cancellation' },
  { path: '/legal/customer-policy', label: 'Legal-Customer' },
  { path: '/legal/provider-info', label: 'Legal-Provider' },
  { path: '/legal/privacy-notice', label: 'Legal-Privacy' },
  { path: '/legal/cookie-policy', label: 'Legal-Cookie' },
  { path: '/legal/accessibility-statement', label: 'Legal-Accessibility' },
  { path: '/mfa-verify', label: 'MFA-Verify' },
  { path: '/mfa-setup', label: 'MFA-Setup' },
];

async function auditPage(page, browserPage, label, url) {
  process.stdout.write(`  ${label} ... `);

  try {
    await browserPage.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    // Small extra delay for any dynamic content
    await new Promise(r => setTimeout(r, 1000));
  } catch (err) {
    console.log(`NAV FAIL: ${err.message}`);
    return { label, url, error: `Navigation failed: ${err.message}`, totalViolations: 0, violations: [] };
  }

  const results = await new AxePuppeteer(browserPage)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violationCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };

  const violations = (results.violations || []).map(v => {
    const nodes = (v.nodes || []).map(n => {
      const impact = n.impact || v.impact || 'minor';
      if (violationCounts[impact] !== undefined) violationCounts[impact]++;
      return {
        html: (n.html || '').substring(0, 400),
        target: String((n.target || []).join(' ')),
        impact,
        failureSummary: (n.failureSummary || '').substring(0, 400),
      };
    });
    return {
      id: v.id,
      impact: v.impact || 'unknown',
      description: v.help,
      helpUrl: v.helpUrl,
      wcagCriteria: (v.tags || []).filter(t => t.startsWith('wcag')),
      nodeCount: nodes.length,
      nodes,
    };
  });

  const total = violations.reduce((s, v) => s + v.nodeCount, 0);
  console.log(`${total} violations (c=${violationCounts.critical} s=${violationCounts.serious} m=${violationCounts.moderate} mi=${violationCounts.minor})`);

  return { label, url, totalViolations: total, violationCounts, violations, timestamp: new Date().toISOString() };
}

async function main() {
  console.log(`\n=== WCAG 2.1 AA Audit — @axe-core/puppeteer + Puppeteer ===`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Browser: ${CHROME_PATH}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const allPages = [];
  const summary = { critical: 0, serious: 0, moderate: 0, minor: 0, totalViolations: 0 };

  try {
    const browserPage = await browser.newPage();
    await browserPage.setViewport({ width: 1280, height: 900 });

    for (const pg of PAGES) {
      const result = await auditPage(browserPage, browserPage, pg.label, `${BASE_URL}${pg.path}`);
      allPages.push(result);

      if (result.violationCounts) {
        summary.critical += result.violationCounts.critical;
        summary.serious += result.violationCounts.serious;
        summary.moderate += result.violationCounts.moderate;
        summary.minor += result.violationCounts.minor;
        summary.totalViolations += result.totalViolations;
      }

      // Save per-page JSON
      const safeLabel = pg.label.replace(/[:\/]/g, '_');
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `${safeLabel}.json`),
        JSON.stringify(result, null, 2)
      );
    }

    await browserPage.close();
  } finally {
    await browser.close();
  }

  const allResults = {
    baseUrl: BASE_URL,
    tool: 'axe-core 4.12.1 via @axe-core/puppeteer + Puppeteer (chrome-headless-shell)',
    generatedAt: new Date().toISOString(),
    pages: allPages,
    summary,
  };

  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(allResults, null, 2));

  console.log(`\n=== AUDIT COMPLETE ===`);
  console.log(`Total violations: ${summary.totalViolations}`);
  console.log(`  critical: ${summary.critical}`);
  console.log(`  serious:  ${summary.serious}`);
  console.log(`  moderate: ${summary.moderate}`);
  console.log(`  minor:    ${summary.minor}`);
  console.log(`\nPer-page summary:`);
  for (const p of allPages) {
    const vc = p.violationCounts || {};
    console.log(`  ${p.label.padEnd(30)} ${p.error ? 'ERR: '+p.error : `${p.totalViolations} (c=${vc.critical||0} s=${vc.serious||0} m=${vc.moderate||0} mi=${vc.minor||0})`}`);
  }
  console.log(`\nFull results: ${SUMMARY_FILE}`);
  console.log(`Per-page details: ${OUTPUT_DIR}/\n`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
