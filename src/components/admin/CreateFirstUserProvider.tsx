'use client'

import { usePathname } from 'next/navigation'
import CreateFirstUserView from './CreateFirstUserView'

/**
 * Replaces Payload's built-in create-first-user view with our branded
 * two-step setup component (account creation → TOTP enrollment with QR).
 *
 * Why a provider instead of admin.components.views.createFirstUser?
 * The documented views override does not activate reliably in Payload
 * v3.85.x — the config key, importMap entry, and bundle are all correct,
 * yet getRouteData() still renders the built-in CreateFirstUserView.
 *
 * NestProviders (RootLayout.js line 126) wraps every provider around the
 * admin `children` — each provider receives `children` as a prop and can
 * conditionally render its own content instead. This is the only hook
 * that fires unconditionally on every admin route, including those
 * rendered via MinimalTemplate (like create-first-user), which has no
 * header / beforeLogin / afterNavLinks slots.
 */
export default function CreateFirstUserProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  if (pathname === '/admin/create-first-user') {
    return <CreateFirstUserView />
  }

  return <>{children}</>
}