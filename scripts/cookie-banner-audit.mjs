/**
 * CookieBanner keyboard/focus audit.
 * Navigates to homepage, opens cookie banner, and runs axe-core + manual checks.
 */
import puppeteer from 'puppeteer';
import { AxePuppeteer } from '@axe-core/puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://mfa-food-experience-website.vercel.app';
const CHROME_PATH = process.env.CHROME_PATH || '/tmp/puppeteer-chrome/chrome-headless-shell/linux-150.0.7871.24/chrome-headless-shell-linux64/chrome-headless-shell';

async function main() {
  console.log('=== CookieBanner Keyboard + Focus Audit ===\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1500));

    // 1. Check if cookie banner is in the DOM
    const bannerPresent = await page.evaluate(() => {
      const banner = document.querySelector('[role="dialog"][aria-label="Cookie consent"]');
      return !!banner;
    });
    console.log(`1. Cookie banner present in DOM: ${bannerPresent}`);

    if (!bannerPresent) {
      console.log('   (Banner may be absent because consent was already given in this browser context)');
    }

    // 2. Run axe-core on the full page (includes banner if present)
    const axeResults = await new AxePuppeteer(page)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const bannerViolations = axeResults.violations.filter(v => {
      return v.nodes.some(n => n.html?.toLowerCase().includes('cookie') || n.target?.some(t => t.includes('dialog')));
    });

    console.log(`\n2. Banner-specific axe violations: ${bannerViolations.length}`);
    for (const v of bannerViolations) {
      console.log(`   ${v.id} (${v.impact}): ${v.help}`);
      for (const n of v.nodes) {
        console.log(`     Node: ${(n.target||[]).join(' ')} ${n.html?.substring(0,120)}`);
      }
    }

    // 3. Keyboard operability checks
    console.log('\n3. Keyboard operability:');

    // Tab to the banner buttons
    const focusable = await page.evaluate(() => {
      const buttons = document.querySelectorAll('[role="dialog"] button');
      return Array.from(buttons).map(b => ({
        text: b.textContent?.trim(),
        tabIndex: b.tabIndex,
        disabled: b.disabled,
        hasFocusStyle: window.getComputedStyle(b).outline !== 'none',
        tag: b.tagName,
      }));
    });
    console.log(`   Focusable elements in banner: ${JSON.stringify(focusable, null, 2)}`);

    // Check focus trap: after dismissing, is focus returned?
    // We can't fully automate without browser interaction, but let's check dialog attributes
    const dialogAttrs = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return null;
      return {
        role: dialog.getAttribute('role'),
        ariaLabel: dialog.getAttribute('aria-label'),
        ariaModal: dialog.getAttribute('aria-modal'),
        tabIndex: dialog.tabIndex,
      };
    });
    console.log(`\n4. Dialog ARIA attributes: ${JSON.stringify(dialogAttrs, null, 2)}`);

    // 5. Check for focus trap by checking if aria-modal is explicitly set
    if (dialogAttrs && !dialogAttrs.ariaModal) {
      console.log('\n   ⚠  DISCOVERY: Dialog does not have aria-modal="true" — focus may not be trapped.');
      console.log('   Fix: Add aria-modal="true" to the banner dialog element.');
    }

    // 6. Check if there's a skip link mechanism
    const skipLink = await page.evaluate(() => {
      const skip = document.querySelector('[href="#main-content"], [href="#content"], [href="#skip"], .skip-link, .skip-to-content');
      return skip ? skip.outerHTML.substring(0, 200) : null;
    });
    console.log(`\n5. Skip-to-content link: ${skipLink ? 'FOUND' : 'NOT FOUND'}`);
    if (!skipLink) {
      console.log('   ⚠  No skip-to-content / bypass-block mechanism detected.');
    }

    // 7. Check html lang attribute
    const lang = await page.evaluate(() => document.documentElement.lang);
    console.log(`\n6. <html lang> attribute: "${lang}"`);

    // 8. Check for missing alt text on images (not caught by contrast, but by separate rules)
    const allAxeRules = new Set(axeResults.violations.map(v => v.id));
    console.log(`\n7. All axe rule IDs found across the page: [${[...allAxeRules].join(', ')}]`);

    // 9. Check page title
    const pageTitle = await page.title();
    console.log(`\n8. Page title: "${pageTitle}"`);

    // 10. Check heading hierarchy
    const headings = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
        tag: h.tagName,
        text: h.textContent?.trim().substring(0, 80),
      }));
    });
    console.log(`\n9. Heading structure (${headings.length} headings):`);
    for (const h of headings.slice(0, 20)) {
      console.log(`   ${h.tag}: ${h.text}`);
    }

    // 11. Check for landmarks
    const landmarks = await page.evaluate(() => {
      const roles = [];
      document.querySelectorAll('[role]').forEach(el => {
        const role = el.getAttribute('role');
        if (['banner','navigation','main','complementary','contentinfo','search','form'].includes(role)) {
          roles.push(role);
        }
      });
      return [...new Set(roles)];
    });
    console.log(`\n10. ARIA landmarks: [${landmarks.join(', ')}]`);

  } finally {
    await browser.close();
  }

  console.log('\n=== COOKIE BANNER AUDIT COMPLETE ===');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
