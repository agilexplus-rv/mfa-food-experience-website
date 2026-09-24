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

  // ── Policies ──────────────────────────────────────────────────
  const existingPolicies = await payload.find({ collection: 'policies', limit: 1 })
  if (existingPolicies.totalDocs > 0) {
    console.log(`Seed: ${existingPolicies.totalDocs} polic${existingPolicies.totalDocs === 1 ? 'y' : 'ies'} already exist - skipping.`)
  } else {
    await payload.create({
      collection: 'policies',
      data: {
        slug: 'cancellation-policy',
        title: 'Cancellation Policy',
        body: {
          root: {
            type: 'root',
            format: '',
            indent: 0,
            version: 1,
            direction: 'ltr',
            children: [
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: '1. Bookings and Cancellations' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'All bookings are confirmed upon receipt of full payment. Spaces are limited and allocated on a first-come, first-served basis.' },
                ],
              },
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: '2. Cancellation by the Customer' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Cancellation requests must be submitted in writing to ' },
                  { type: 'text', text: 'bookings@foodagency.mt', format: 'bold' },
                  { type: 'text', text: ' and are subject to the following terms:' },
                ],
              },
              {
                type: 'list',
                tag: 'ul',
                children: [
                  {
                    type: 'listitem',
                    children: [
                      { type: 'text', text: 'More than 7 days before the scheduled date: full refund minus a 10% administrative fee.' },
                    ],
                  },
                  {
                    type: 'listitem',
                    children: [
                      { type: 'text', text: 'Between 7 days and 48 hours before the scheduled date: 50% refund.' },
                    ],
                  },
                  {
                    type: 'listitem',
                    children: [
                      { type: 'text', text: 'Less than 48 hours before the scheduled date: no refund.' },
                    ],
                  },
                ],
              },
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: '3. Right of Withdrawal — Important Notice' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: '\u26a0 [DRAFT \u2014 PLACEHOLDER LEGAL TEXT]', format: 'bold' },
                ],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Pursuant to Article 16(l) of Directive 2011/83/EU (Consumer Rights Directive), the supply of leisure services on a specific date or performance period is exempt from the 14-day right of withdrawal. By booking a Malta Food Experience event, you acknowledge that the 14-day cooling-off period does not apply and that the cancellation terms set out above govern any refund or rescheduling request.' },
                ],
              },
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: '4. Cancellation by the Malta Food Agency' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'In the event of cancellation by the Malta Food Agency (e.g., due to adverse weather, insufficient bookings, or other operational reasons), customers will be offered a full refund or the option to reschedule to an alternative date at no additional cost. The Agency will notify affected customers as soon as reasonably possible using the contact details provided at booking.' },
                ],
              },
            ],
          },
        },
      },
    })
    console.log('Seed: Created policy "Cancellation Policy" (cancellation-policy)')

    await payload.create({
      collection: 'policies',
      data: {
        slug: 'customer-policy',
        title: 'Customer Policy',
        body: {
          root: {
            type: 'root',
            format: '',
            indent: 0,
            version: 1,
            direction: 'ltr',
            children: [
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: '\u26a0 [DRAFT \u2014 PLACEHOLDER LEGAL TEXT]', format: 'bold' },
                ],
              },
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: '1. Introduction' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'These terms of reference ("Customer Policy") govern the relationship between the Malta Food Agency ("the Agency," "we," "our") and individuals ("customers," "you") participating in Malta Food Experience events, classes, and tastings. By making a booking, you agree to be bound by these terms.' },
                ],
              },
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: '2. Eligibility' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Participants must be at least 16 years of age. Children under 16 may attend when accompanied by a responsible adult. Some events may have specific age or dietary requirements; these will be clearly stated on the event page.' },
                ],
              },
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: '3. Dietary Requirements and Allergies' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Customers are responsible for informing the Agency of any food allergies, intolerances, or dietary requirements at the time of booking. While we take reasonable precautions, we cannot guarantee an allergen-free environment. Participation is at your own risk.' },
                ],
              },
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: '4. Conduct' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Customers are expected to behave respectfully toward staff, hosts, and fellow participants. The Agency reserves the right to remove any participant whose behaviour is disruptive or endangers others, without refund.' },
                ],
              },
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: '5. Liability' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'The Malta Food Agency maintains public liability insurance. However, participation in culinary activities involves inherent risks. To the fullest extent permitted by law, the Agency excludes liability for personal injury, loss, or damage to property except where caused by our negligence.' },
                ],
              },
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: '6. Photography and Media' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Photographs and video may be taken during events for promotional purposes. By attending, you consent to your image being used in Agency marketing materials unless you notify us otherwise in writing before the event.' },
                ],
              },
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: '7. Governing Law' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'These terms are governed by the laws of Malta. Any disputes shall be subject to the exclusive jurisdiction of the Maltese courts.' },
                ],
              },
            ],
          },
        },
      },
    })
    console.log('Seed: Created policy "Customer Policy" (customer-policy)')

    await payload.create({
      collection: 'policies',
      data: {
        slug: 'provider-info',
        title: 'Provider Information',
        body: {
          root: {
            type: 'root',
            format: '',
            indent: 0,
            version: 1,
            direction: 'ltr',
            children: [
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: 'Malta Food Agency' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'The Malta Food Agency is the national body responsible for promoting Maltese culinary heritage, food quality, and gastronomic tourism. Through the Malta Food Experience, the Agency offers authentic culinary and cultural events hosted by local producers, artisans, and chefs.' },
                ],
              },
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: 'Registered Address' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Malta Food Agency', format: 'bold' },
                ],
              },
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Pitkali Road' }],
              },
              {
                type: 'paragraph',
                children: [{ type: 'text', text: "Ta' Qali, Attard" }],
              },
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Malta' }],
              },
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: 'Contact' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Email: ' },
                  { type: 'text', text: 'info@foodagency.mt', format: 'bold' },
                ],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Phone: ' },
                  { type: 'text', text: '+356 2292 4000', format: 'bold' },
                ],
              },
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: 'VAT Number' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'MT 2651 5131' },
                ],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: '\u26a0 [DRAFT \u2014 PLACEHOLDER: verify VAT number with Agency administration before publication.]', format: 'bold' },
                ],
              },
            ],
          },
        },
      },
    })
    console.log('Seed: Created policy "Provider Information" (provider-info)')
  }

  console.log('Seed: Done.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})