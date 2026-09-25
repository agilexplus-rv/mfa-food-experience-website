import CreateFirstUserView from '@/components/admin/CreateFirstUserView'

/**
 * Static page override for /admin/create-first-user.
 *
 * Payload's `admin.components.views` override mechanism for the built-in
 * 'createFirstUser' view key does not activate reliably in the current
 * Payload v3.85.x runtime -- the custom view config passes through
 * `buildConfig` correctly and `getCustomViewByKey` receives the right
 * viewKey, but the built-in `CreateFirstUserView` is rendered regardless
 * (likely a config serialization quirk inside `getRouteData`).
 *
 * Instead, this is a plain Next.js App Router route at a more specific
 * path than the Payload catch-all (`[[...segments]]`) and therefore
 * takes precedence at routing time.  It inherits the Payload admin
 * layout from `src/app/(payload)/layout.tsx`, which boots `RootLayout`
 * (providers, config, session, i18n, etc.) -- exactly the same
 * environment the catch-all would set up, minus the `RootPage`
 * route-resolution logic (which we are doing ourselves right here).
 *
 * The component below is `'use client'`; it manages its own API calls
 * (`/api/users/first-register`, `/api/mfa/enroll`) and does not depend
 * on Payload's client-side admin view machinery.
 */
export default function CreateFirstUserPage() {
  return <CreateFirstUserView />
}