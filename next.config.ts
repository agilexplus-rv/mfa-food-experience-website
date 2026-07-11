import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'nodemailer',
    '@payloadcms/email-nodemailer',
    'payload',
    '@payloadcms/db-sqlite',
    '@payloadcms/db-postgres',
  ],

  // Output encoding + security headers per ADR-008 C2.
  // CSP added in Phase 4.4 to close the C2 gap (previously HSTS /
  // X-Content-Type-Options / Referrer-Policy were set but CSP was absent).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // EIGHTH root cause (2026-07-12): translate-pa.googleapis.com
            // blocked in script-src. The widget's supportedLanguages call
            // is loaded as a JSONP <script src="...&callback=callback">
            // tag (confirmed via the browser console error: "Refused to
            // load https://translate-pa.googleapis.com/v1/supportedLanguages
            // ...&callback=callback because it does not appear in the
            // script-src directive"), NOT an XHR/fetch -- so connect-src's
            // existing translate-pa.googleapis.com entry (added for fix #6)
            // never covered this call at all; script-src and connect-src
            // are evaluated independently per request type, each governing
            // a different resource-loading mechanism. Adding the domain to
            // script-src alongside connect-src is the minimal fix for this
            // specific mechanism.
            // Content-Security-Policy -- ADR-008 C2.
            //
            // Directives were chosen by tracing what THIS app actually loads
            // (grep for <script>, <iframe>, document.createElement('script'),
            // fetch('https...'), next/font, data: URIs) rather than copy-
            // pasting generic boilerplate:
            //
            //   * Google Translate widget (src/components/i18n/LanguageSwitcher.tsx)
            //     loads https://translate.google.com/translate_a/element.js,
            //     which in turn pulls scripts + XHR from translate.googleapis.com
            //     and opens a translation iframe from translate-pa.googleapis.com.
            //   * OpenStreetMap embed iframe on the contact page
            //     (src/app/(frontend)/contact/page.tsx) -- frame-src www.openstreetmap.org.
            //   * Stripe -- the checkout route returns a hosted-Checkout URL and
            //     the browser does a full-page redirect; no client-side Stripe.js
            //     is loaded today (no @stripe/stripe-js / loadStripe in the repo).
            //     js.stripe.com / api.stripe.com / checkout.stripe.com are listed
            //     anyway so a future client-side Stripe.js upgrade does not silently
            //     break, and the redirect back from checkout.stripe.com is covered.
            //   * Montserrat is loaded via next/font/google, which self-hosts the
            //     font files at build time (served from /_next/static, same origin) --
            //     no runtime fetch to fonts.googleapis.com / fonts.gstatic.com, so
            //     font-src only needs 'self'.
            //   * QR codes are rendered as data: URI PNGs (src/lib/qr/render.ts) and
            //     embedded in emails; img-src allows data: for any inline QR display.
            //   * 'unsafe-inline' + 'unsafe-eval' in script-src are required by
            //     Next.js (it injects inline scripts and uses eval for HMR/module
            //     loading). style-src 'unsafe-inline' covers Tailwind's injected
            //     styles + Google Translate's inline style injections.
            //   * The Google Translate widget loads its stylesheet from
            //     www.gstatic.com via _loadCss (creating a <link rel=stylesheet>).
            //     gstatic.com is in style-src for this reason — removing it
            //   * SIXTH root cause (2026-07-10): translate-pa.googleapis.com — the
            //   *     widget's internal XHR fetches its supported-language list from
            //   *     https://translate-pa.googleapis.com/v1/supportedLanguages. This
            //   *     domain was only in frame-src (for iframes the widget creates)
            //   *     but was MISSING from connect-src, so the XHR was silently
            //   *     blocked by CSP. Without this, TranslateElement constructs
            //   *     successfully (no JS errors) but goog-te-combo.options.length
            //   *     stays 0 forever — exact same symptom constellation as the
            //   *     gstatic.com style-src block, but a different mechanism and a
            //   *     different blocked domain. The domain is now in BOTH frame-src
            //   *     (for iframes) AND connect-src (for the supported-languages
            //   *     XHR). Adding it to connect-src is the MINIMAL fix.
            //     silently breaks the widget (goog-te-combo stays empty, no
            //     JS errors, cookies/lang-attr all correct — a CSP-blocked CSS
            //     subresource is the root cause, found 2026-07-10).
            //   * SEVENTH root cause (2026-07-10): data: URI sandbox iframe blocked
            //     by frame-src. The Google Translate widget creates a data: URI iframe
            //     (<iframe src="data:text/html;base64,...">) as a sandboxed execution
            //     context where its internal init, supportedLanguages fetch, and combo
            //     population all run. frame-src listed explicit https:// domains but
            //     omitted data:, so the widget's sandbox iframe was silently blocked by
            //     CSP (confirmed via securitypolicyviolation event: violatedDirective
            //     frame-src, blockedURI empty = data: URI). The empty iframe meant the
            //     widget's internal init never executed at all — NOT that any specific
            //     API call failed, but that the entire inner lifecycle was prevented
            //     from starting. This is invisible from the parent frame: CSP violations
            //     in null-origin iframes don't bubble, and the violated-directive event
            //     fires on the iframe element with no sourceFile/lineNumber. Adding
            //     data: to frame-src is the MINIMAL fix. Verified: on a no-CSP page
            //     the widget works perfectly (combo populates with "Maltais" option,
            //     TranslateElement constructs, translation applies). On the production
            //     page WITH CSP but WITHOUT frame-src data:, the data: iframe exists
            //     in the DOM but is empty/cross-origin-blocked and the combo stays at
            //     options.length === 0 forever. With data: added to frame-src, the
            //     widget's inner init can execute normally.
            //   * object-src 'none', base-uri 'self', frame-ancestors 'none' harden
            //     against plugin/embedding/clickjacking vectors the app does not use.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://translate.google.com https://translate.googleapis.com https://translate-pa.googleapis.com https://js.stripe.com https://checkout.stripe.com",
              "frame-src 'self' data: https://translate.google.com https://translate-pa.googleapis.com https://www.openstreetmap.org https://checkout.stripe.com",
              "connect-src 'self' https://api.stripe.com https://translate.googleapis.com https://translate-pa.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://www.gstatic.com",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default withPayload(nextConfig)
