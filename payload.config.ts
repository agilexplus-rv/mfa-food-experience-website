import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Users } from './src/payload/collections/Users'
import { Media } from './src/payload/collections/Media'
import { Services } from './src/payload/collections/Services'
import { Events } from './src/payload/collections/Events'
import { Bookings } from './src/payload/collections/Bookings'
import { SeatHolds } from './src/payload/collections/SeatHolds'
import { Coupons } from './src/payload/collections/Coupons'
import { CouponRedemptions } from './src/payload/collections/CouponRedemptions'
import { Testimonials } from './src/payload/collections/Testimonials'
import { NewsItems } from './src/payload/collections/NewsItems'
import { Policies } from './src/payload/collections/Policies'
import { AuditLog } from './src/payload/collections/AuditLog'

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
    },
    components: {
      // Brand theming (ADR-008 NFR-1: brand palette + Montserrat) --
      // applied via a <style> tag rendered above the Payload header on
      // every admin route (including the login view), overriding
      // Payload's documented --theme-* CSS variables. See
      // src/components/admin/AdminThemeStyles.tsx for the full mapping.
      beforeLogin: [
        '@/components/admin/AdminThemeStyles#default',
        '@/components/admin/AdminPasswordReveal#default',
      ],
      header: [
        '@/components/admin/AdminThemeStyles#default',
        '@/components/admin/MfaSetupBanner#default',
      ],
      graphics: {
        Logo: '@/components/admin/AdminLogo#default',
        Icon: '@/components/admin/AdminIcon#default',
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
