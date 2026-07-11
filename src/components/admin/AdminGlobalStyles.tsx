import type { ReactNode } from 'react'
import AdminThemeStyles from './AdminThemeStyles'
import AdminLogo from './AdminLogo'

/**
 * Wraps EVERY admin route (login, forgot-password, reset-password,
 * create-first-user, and the full authenticated dashboard) with the
 * brand <style> injection, by registering as admin.components.providers
 * in payload.config.ts.
 *
 * ROOT CAUSE this fixes (2026-07-11): AdminThemeStyles was previously
 * wired via admin.components.beforeLogin (LoginView-only slot) and
 * admin.components.header (rendered only inside the Default template
 * -- i.e. only the authenticated dashboard, per
 * node_modules/@payloadcms/next/dist/templates/Default/index.js's
 * `header: CustomHeader` vs Minimal/index.js, which has no header slot
 * at all). /admin/forgot and /admin/reset render via MinimalTemplate
 * (see node_modules/@payloadcms/next/dist/views/Root/index.js's
 * `templateType === 'minimal'` branch) and were NEVER passed either
 * component -- so they rendered with zero brand styling (Times New
 * Roman, no card, no logo). admin.components.providers is injected at
 * the RootLayout level (node_modules/@payloadcms/next/dist/layouts/
 * Root/index.js), BEFORE the template-type branch, so it wraps every
 * admin route uniformly regardless of which template that route uses.
 *
 * Rudie 2026-07-12: also injects the brand logo (AdminLogo, wrapped in
 * a link home) above the forgot-password/reset-password forms, which
 * -- confirmed via node_modules/@payloadcms/next/dist/views/
 * ForgotPassword/index.js and ResetPassword/index.js -- NEVER render a
 * Logo at all (only LoginView does, via its own `${loginBaseClass}
 * __brand` wrapper -- see Login/index.js). CSS alone can't add a
 * missing element, so this component renders the logo directly,
 * gated to .forgot-password/.reset-password pages via a wrapper class
 * so it doesn't duplicate on the login page (which already has its
 * own brand block) or the dashboard.
 */
export default function AdminGlobalStyles({ children }: { children?: ReactNode }) {
  return (
    <>
      <AdminThemeStyles />
      <div className="admin-brand-inject">
        <AdminLogo />
      </div>
      {children}
    </>
  )
}
