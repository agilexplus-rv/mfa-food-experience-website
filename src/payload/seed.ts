// Seed script for the Malta Food Experience data model.
// NOTE: run inside the Next/Payload process via `npm run db:seed` which uses tsx.
// If the standalone tsx runner hits the @next/env CJS/ESM interop error,
// seed via the dev server instead (see docs/adr/ADR-001-cms-choice.md).

import config from '@payload-config'
import { getPayload } from 'payload'

async function seed() {
  const payload = await getPayload({ config })

  const existing = await payload.find({ collection: 'services', limit: 1 })
  if (existing.totalDocs > 0) {
    console.log(`Seed: ${existing.totalDocs} service(s) already exist - skipping.`)
    process.exit(0)
  }

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

  console.log('Seed: Done.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
