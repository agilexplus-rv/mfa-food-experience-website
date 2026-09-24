'use client'

import { useEffect } from 'react'

/**
 * Rudie 2026-07-12 (snag #3): the logo on /admin/forgot and
 * /admin/reset must live in the SAME div as the email field and
 * submit button -- i.e. inside Payload's `.template-minimal__wrap`,
 * exactly like the login page's own `.login__brand` block already
 * does (LoginView's Fragment renders brand + form as siblings inside
 * one wrap -- see node_modules/@payloadcms/next/dist/views/Login/
 * index.js). ForgotPasswordView/ResetPassword have NO such override
 * slot (they are hardcoded entries in getRouteData.js's
 * oneSegmentViews map, unlike account/dashboard which DO support
 * admin.components.views overrides) -- there is no config-level way
 * to inject a React child inside their JSX output.
 *
 * This component performs a one-time, idempotent DOM move: it takes
 * the .admin-brand-inject node (rendered as a sibling BEFORE the
 * page section by AdminGlobalStyles) and physically relocates it to
 * be the FIRST child of .template-minimal__wrap, but only when that
 * wrap is inside a .forgot-password or .reset-password section --
 * never touches the login page, which already has its own correct
 * brand placement and would otherwise get a duplicate.
 *
 * Why DOM manipulation instead of a "cleaner" React-only fix: no
 * override slot exists for these views' rendered content (see above),
 * so reaching into the DOM post-render is the only way to satisfy
 * "same div" literally rather than approximating it with adjacent
 * CSS box styling, which was the pre-existing (incorrect) approach.
 */
export default function AdminBrandReparent() {
  useEffect(() => {
    const wrap = document.querySelector<HTMLElement>(
      'section.forgot-password .template-minimal__wrap, section.reset-password .template-minimal__wrap',
    )
    const brand = document.querySelector<HTMLElement>('.admin-brand-inject')
    if (!wrap || !brand) return
    if (wrap.firstChild === brand) return // already moved (re-render safe)
    wrap.insertBefore(brand, wrap.firstChild)
  }, [])

  return null
}
