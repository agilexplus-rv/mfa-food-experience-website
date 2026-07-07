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
            //   * object-src 'none', base-uri 'self', frame-ancestors 'none' harden
            //     against plugin/embedding/clickjacking vectors the app does not use.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://translate.google.com https://translate.googleapis.com https://js.stripe.com https://checkout.stripe.com",
              "frame-src 'self' https://translate.google.com https://translate-pa.googleapis.com https://www.openstreetmap.org https://checkout.stripe.com",
              "connect-src 'self' https://api.stripe.com https://translate.googleapis.com",
              "style-src 'self' 'unsafe-inline'",
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
