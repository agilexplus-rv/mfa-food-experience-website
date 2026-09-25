'use client'

import { usePathname } from 'next/navigation'
import CreateFirstUserView from './CreateFirstUserView'

/**
 * Intercepts the /admin/create-first-user route at the admin layout level
 * (NestProviders) and renders the custom branded view instead of Payload's
 * built-in MinimalTemplate + form.
 *
 * The admin.components.views.createFirstUser override in payload.config.ts
 * is the documented hook, but it does not activate in Payload v3.85.x —
 * getRouteData.ts still resolves to the stock client page. A provider is
 * the only interception point that runs before template branching, so the
 * custom view replaces EVERYTHING inside the admin root (template included).
 * The component is self-contained: it does its own API calls, MFA enrollment,
 * and hard-navigates to /admin on completion.
 */
export default function CreateFirstUserProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  if (pathname === '/admin/create-first-user') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#F9F4EF',
          padding: '24px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            background: '#FFFFFF',
            borderRadius: '16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            padding: '40px 32px',
            boxSizing: 'border-box',
          }}
        >
          <CreateFirstUserView />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
