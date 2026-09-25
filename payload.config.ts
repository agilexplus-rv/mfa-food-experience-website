import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Users } from './src/payload/collections/Users.ts'
import { Media } from './src/payload/collections/Media.ts'
import { Services } from './src/payload/collections/Services.ts'
import { Events } from './src/payload/collections/Events.ts'
import { Bookings } from './src/payload/collections/Bookings.ts'
import { SeatHolds } from './src/payload/collections/SeatHolds.ts'
import { Coupons } from './src/payload/collections/Coupons.ts'
import { CouponRedemptions } from './src/payload/collections/CouponRedemptions.ts'
import { Testimonials } from './src/payload/collections/Testimonials.ts'
import { NewsItems } from './src/payload/collections/NewsItems.ts'
import { Policies } from './src/payload/collections/Policies.ts'
import { AuditLog } from './src/payload/collections/AuditLog.ts'
import { Waitlist } from './src/payload/collections/Waitlist.ts'
import { CancellationPolicy } from './src/payload/globals/CancellationPolicy.ts'
import { SiteSettings } from './src/payload/globals/SiteSettings.ts'
import { SocialMediaSettings } from './src/payload/globals/SocialMediaSettings.ts'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// DB selection is driven entirely by DATABASE_URL's scheme:
//   postgres(ql)://...                   -> Postgres (production)
//   libsql://... | https://...-turso.io  -> hosted libSQL (demo/preview, persists across deploys)
//   file:./payload.db (default)          -> local SQLite file (local dev only; NOT safe on Vercel,
//                                           whose filesystem is ephemeral/read-only at runtime)
const dbAdapter = process.env.DATABASE_URL?.startsWith('postgres')
  ? postgresAdapter({
      pool: {
        connectionString: process.env.DATABASE_URL,
      },
    })
  : sqliteAdapter({
      client: {
        url: process.env.DATABASE_URL || 'file:./payload.db',
        // Only needed for hosted libSQL (Turso); local file:// URLs ignore it.
        authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
      },
    })

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '- Malta Food Experience',
      icons: [
        { rel: 'icon', url: '/brand/logos/Malta%20Food%20-%20Primary.svg', type: 'image/svg+xml' },
      ],
    },
    // Snag #6 (2026-07-12): all admin errors/notifications (including
    // login and forgot-password failures) should surface as a
    // floating banner from the TOP of the screen, stay visible for
    // 30s, and be dismissible via a built-in close button. Payload's
    // toast system (Sonner under the hood) already renders a close
    // button by default (see @payloadcms/ui's ToastContainer) -- the
    // only two things needed are position and duration, both
    // first-class documented config options (no CSS hacking needed
    // for placement/timing; see AdminThemeStyles.tsx for the
    // banner-style visual polish layered on top of Sonner's own
    // markup/close-button).
    toast: {
      position: 'top-center',
      duration: 30000,
    },
    components: {
      // Brand theming (ADR-008 NFR-1: brand palette + Montserrat) --
      // applied via admin.components.providers, which wraps EVERY
      // admin route (login, forgot-password, reset-password,
      // create-first-user, and the full dashboard) at the RootLayout
      // level, before template-type branching. This replaces a
      // previous beforeLogin + header wiring that left /admin/forgot
      // and /admin/reset completely unstyled -- those routes render
      // via MinimalTemplate, which has no `header` slot at all (only
      // the Default/dashboard template does), and beforeLogin is a
      // LoginView-only slot. See src/components/admin/
      // AdminGlobalStyles.tsx for the full root-cause writeup.
      providers: [
        '@/components/admin/AdminGlobalStyles#default',
        '@/components/admin/CreateFirstUserProvider#default',
      ],
      beforeLogin: [
        '@/components/admin/AdminPasswordReveal#default',
      ],
      header: [
        '@/components/admin/MfaSetupBanner#default',
      ],
      graphics: {
        Logo: '@/components/admin/AdminLogo#default',
        Icon: '@/components/admin/AdminIcon#default',
      },
      // Replaces Payload's built-in create-first-user view with a branded
      // two-step flow (account -> TOTP enrollment with QR code). The key
      // MUST be `createFirstUser` -- getRouteData.js resolves overrides by
      // the config.admin.routes key, not the PascalCase component name.
      views: {
        createFirstUser: {
          Component: '@/components/admin/CreateFirstUserView#default',
        },
      },
    },
  },
  editor: lexicalEditor(),
  collections: [
    Users,
    Media,
    Services,
    Events,
    Bookings,
    SeatHolds,
    Coupons,
    CouponRedemptions,
    Testimonials,
    NewsItems,
    Policies,
    AuditLog,
    Waitlist,
  ],
  globals: [
    CancellationPolicy,
    SiteSettings,
    SocialMediaSettings,
  ],
  db: dbAdapter,
  email: nodemailerAdapter({
    defaultFromAddress: process.env.FROM_EMAIL || 'noreply@foodagency.mt',
    defaultFromName: process.env.FROM_NAME || 'Malta Food Experience',
    // Demo environment has no real SMTP credentials; skip the transport
    // verification handshake so it doesn't spam Vercel logs with
    // "Invalid login: 535" warnings on every boot. This is purely cosmetic --
    // verifyTransport() failures are already caught internally by
    // @payloadcms/email-nodemailer and never crash the app.
    skipVerify: true,
    transportOptions: {
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT) || 1025,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    },
  }),
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-in-production',
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload-types.ts'),
  },
})
