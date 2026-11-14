import type { MetadataRoute } from 'next'

/**
 * robots.txt
 *
 * The public experience pages are crawled; the operator surfaces are not.
 * Everything behind a login (`/admin`, `/console`, `/scan`, `/dashboard`,
 * `/account`), the MFA enrolment flow, the JSON API and per-booking pages are
 * excluded — booking confirmation and payment-return URLs carry references and
 * must never end up in an index.
 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SERVER_URL || 'https://foodexperience.mt').replace(/\/$/, '')
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api/',
          '/console',
          '/scan',
          '/dashboard',
          '/account',
          '/mfa-setup',
          '/mfa-verify',
          '/booking/',
          '/seed-internal',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
