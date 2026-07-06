// Seed script for the Malta Food Experience data model.
// NOTE: run inside the Next/Payload process via `npm run db:seed` which uses tsx.
// If the standalone tsx runner hits the @next/env CJS/ESM interop error,
// seed via the dev server instead (see docs/adr/ADR-001-cms-choice.md).

import config from '@payload-config'
import { getPayload } from 'payload'

async function seed() {
  const payload = await getPayload({ config })

  // ── Services ──────────────────────────────────────────────────
  const existing = await payload.find({ collection: 'services', limit: 1 })
  if (existing.totalDocs > 0) {
    console.log(`Seed: ${existing.totalDocs} service(s) already exist - skipping.`)
  } else {
    await payload.create({
      collection: 'services',
      data: { name: 'Classes', slug: 'classes', visible: true, order: 1 },
    })
    console.log('Seed: Created service "Classes" (visible=true)')

    await payload.create({
      collection: 'services',
      data: { name: 'Tastings', slug: 'tastings', visible: false, order: 2 },
    })
    console.log('Seed: Created service "Tastings" (visible=false, per FR-1.2)')
  }

  // ── First-admin bootstrap ─────────────────────────────────────
  // C6: first user (admin) is bootstrapped from environment variables.
  // No password in code — see .env.example for the required variables.
  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD

  const existingUsers = await payload.find({ collection: 'users', limit: 1 })

  if (existingUsers.totalDocs === 0) {
    if (adminEmail && adminPassword) {
      await payload.create({
        collection: 'users',
        data: {
          email: adminEmail,
          password: adminPassword,
          role: 'admin',
        },
      })
      console.log(`Seed: Created admin user: ${adminEmail}`)
    } else {
      console.log(
        'Seed: ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD not set — ' +
          'skipping admin creation. Create the first admin user via the Payload admin UI.'
      )
      console.log(
        'Seed: Visit http://localhost:3000/admin and use the "Create First User" form.'
      )
    }
  } else {
    console.log(`Seed: ${existingUsers.totalDocs} user(s) already exist - skipping admin bootstrap.`)
  }

  console.log('Seed: Done.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
