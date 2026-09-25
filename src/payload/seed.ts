// Seed script for the Malta Food Experience data model.
// This is now run as a Payload onInit hook so it shares the Payload CLI's
// runtime (import resolution, DB connection, etc.).  The standalone tsx runner
// is kept for local dev (`npm run db:seed`) but is not used in production.
//
// When called from onInit, the caller passes a Payload instance so we don't
// need our own getPayload() call.

import type { Payload } from 'payload'

export async function seed(p?: Payload) {
  // When called from onInit, the caller passes a Payload instance.
  // In standalone mode (npm run db:seed), create our own.
  let payload: Payload
  if (p) {
    payload = p
  } else {
    const mod = await import('@payload-config')
    const { getPayload } = await import('payload')
    payload = await getPayload({ config: mod.default })
  }

  // ── Services ──────────────────────────────────────────────────
  const existing = await payload.find({ collection: 'services', limit: 1 })
  if (existing.totalDocs > 0) {
    console.log(`Seed: ${existing.totalDocs} service(s) already exist - skipping.`)
  } else {
    await payload.create({
      collection: 'services',
      data: { name: 'Classes', slug: 'classes', visible: true, order: 1 },
      overrideAccess: true,
    })
    console.log('Seed: Created service "Classes" (visible=true)')

    await payload.create({
      collection: 'services',
      data: { name: 'Tastings', slug: 'tastings', visible: false, order: 2 },
      overrideAccess: true,
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
        overrideAccess: true,
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
  // Check per-slug so new policies are seedable on redeploy.

  /**
   * Normalize a Lexical rich-text body so it passes Payload's validation.
   *
   * Text nodes need `detail`, `format`, `mode`, and `style` fields.
   * Element nodes (paragraph, heading, list, listitem) need `textFormat`
   * and `textStyle`.  These are always set to zero/empty defaults because
   * our seed content uses no inline formatting.
   */
  function normalizeLexicalBody(body: unknown): unknown {
    if (typeof body !== 'object' || body === null) return body
    const obj = body as Record<string, unknown>
    if (obj.type === 'text') {
      obj.detail ??= 0
      obj.format ??= 0
      obj.mode ??= 'normal'
      obj.style ??= ''
    }
    if (
      obj.type === 'paragraph' ||
      obj.type === 'heading' ||
      obj.type === 'list' ||
      obj.type === 'listitem' ||
      obj.type === 'root'
    ) {
      obj.textFormat ??= 0
      obj.textStyle ??= ''
    }
    // Recurse into children
    if (Array.isArray(obj.children)) {
      obj.children = obj.children.map(normalizeLexicalBody)
    }
    return obj
  }

  async function ensurePolicy(slug: string, title: string, body: unknown) {
    const existing = await payload.find({
      collection: 'policies',
      where: { slug: { equals: slug } },
      limit: 1,
    })
    if (existing.totalDocs > 0) {
      console.log(`Seed: Policy "${title}" (${slug}) already exists - skipping.`)
      return
    }
    const data = { slug, title, body: normalizeLexicalBody(body) }
    try {
      await payload.create({
        collection: 'policies',
        data,
        overrideAccess: true,
      })
      console.log(`Seed: Created policy "${title}" (${slug})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to create policy "${title}" (${slug}): ${msg}`, { cause: err })
    }
  }

  await ensurePolicy('cancellation-policy', 'Cancellation Policy', {
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
  })

    await ensurePolicy('customer-policy', 'Customer Policy', {
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
  })

    await ensurePolicy('provider-info', 'Provider Information', {
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
  })

    // ── Cookie Policy ──────────────────────────────────────
    await ensurePolicy('cookie-policy', 'Cookie Policy', {
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
            children: [{ type: 'text', text: 'What Are Cookies' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Cookies are small text files placed on your device when you visit a website. They are widely used to make websites work, improve usability, and provide information to the site owners.' },
            ],
          },
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'How We Use Cookies' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'This website uses only essential cookies necessary for its operation:' },
            ],
          },
          {
            type: 'list',
            listType: 'unordered',
            children: [
              {
                type: 'listitem',
                children: [
                  { type: 'text', text: 'Session cookie: maintains your booking session while you complete a reservation. This cookie expires when you close your browser.', format: 'bold' },
                ],
              },
              {
                type: 'listitem',
                children: [
                  { type: 'text', text: 'Language cookie: remembers your language preference to display content in Maltese or English. This cookie persists for 30 days.', format: 'bold' },
                ],
              },
              {
                type: 'listitem',
                children: [
                  { type: 'text', text: 'Consent cookie: stores your cookie consent preference. This cookie persists for 12 months.', format: 'bold' },
                ],
              },
            ],
          },
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'Third-Party Cookies' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'We do not use advertising, analytics, or social media cookies. No third-party tracking cookies are set by this site.' },
            ],
          },
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'Managing Cookies' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Most browsers allow you to refuse or delete cookies through their settings. Blocking essential cookies may prevent the booking system from functioning correctly. For guidance, visit ' },
              { type: 'link', url: 'https://www.aboutcookies.org/', children: [{ type: 'text', text: 'aboutcookies.org' }] },
              { type: 'text', text: '.' },
            ],
          },
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'Updates' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'This policy was last reviewed on 1 September 2026. We may update it from time to time. Changes will be posted on this page.' },
            ],
          },
        ],
      },
    })

    // ── Privacy Notice ─────────────────────────────────────
    await ensurePolicy('privacy-notice', 'Privacy Notice', {
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
            children: [{ type: 'text', text: 'Who We Are' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'The Malta Food Agency ("the Agency," "we," "us") is the data controller for personal data collected through the Malta Food Experience website (foodexperience.agilexplus.dev). We are committed to protecting your privacy in accordance with the General Data Protection Regulation (EU) 2016/679 and the Data Protection Act (Chapter 586 of the Laws of Malta).' },
            ],
          },
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'What Personal Data We Collect' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'When you make a booking, we collect:' },
            ],
          },
          {
            type: 'list',
            listType: 'unordered',
            children: [
              { type: 'listitem', children: [{ type: 'text', text: 'Your name and email address' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'The name(s) of additional attendees' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Dietary requirements and allergy information (where provided)' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Transaction identifiers (not full card details)' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Your IP address, for fraud prevention and rate-limiting' }] },
            ],
          },
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'Why We Process Your Data' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'We process your data on the following lawful bases:' },
            ],
          },
          {
            type: 'list',
            listType: 'unordered',
            children: [
              { type: 'listitem', children: [{ type: 'text', text: 'Contractual necessity: to process your booking, send your confirmation and QR code, and communicate essential event information.', format: 'bold' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Legitimate interest: to prevent fraud and misuse of the booking system.', format: 'bold' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Consent: for any optional communications you have agreed to receive.', format: 'bold' }] },
            ],
          },
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'Data Retention' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Booking records are retained for two years after the event date, after which personal data is anonymised. Financial transaction records are retained for six years as required by Maltese tax law.' },
            ],
          },
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'Data Sharing' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'We share your data with:' },
            ],
          },
          {
            type: 'list',
            listType: 'unordered',
            children: [
              { type: 'listitem', children: [{ type: 'text', text: 'Viva Wallet: to process payments. Viva acts as a data processor. Their privacy policy is available at vivapayments.com.', format: 'bold' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Azure (Microsoft): for website hosting. Data is stored within the EU (West Europe region).', format: 'bold' }] },
            ],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'We do not sell, rent, or share your data with any other third parties.' },
            ],
          },
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'Your Rights' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Under the GDPR, you have the right to access, rectify, erase, restrict, or port your personal data, and to object to processing. To exercise any of these rights, contact us at ' },
              { type: 'text', text: 'denise.grima-connell@gov.mt', format: 'bold' },
              { type: 'text', text: '. We will respond within one month. You also have the right to lodge a complaint with the Office of the Information and Data Protection Commissioner (idpc.org.mt).' },
            ],
          },
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'Contact' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Data Protection Officer: Malta Food Agency. Email: denise.grima-connell@gov.mt.', format: 'bold' },
            ],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'This privacy notice was last updated on 1 September 2026.' },
            ],
          },
        ],
      },
    })

    // ── Accessibility Statement ──────────────────────────────
    await ensurePolicy('accessibility-statement', 'Accessibility Statement', {
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
            children: [{ type: 'text', text: 'Our Commitment' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'The Malta Food Agency is committed to making the Malta Food Experience website accessible to everyone, including people with disabilities. We aim to conform to Level AA of the Web Content Accessibility Guidelines (WCAG) 2.2.' },
            ],
          },
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'How We Deliver Accessibility' }],
          },
          {
            type: 'list',
            listType: 'unordered',
            children: [
              { type: 'listitem', children: [{ type: 'text', text: 'Skip link: a "Skip to main content" link is the first focusable element on every page, allowing keyboard and screen-reader users to bypass repetitive navigation.' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Semantic HTML: we use standard HTML5 landmark elements (header, main, footer, nav) so assistive technology can navigate the page structure.' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Keyboard navigation: all interactive elements (links, buttons, form fields) are operable by keyboard alone, with visible focus indicators.' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Colour contrast: text meets or exceeds WCAG 2.2 AA contrast ratios (4.5:1 for normal text, 3:1 for large text).' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Lablelled forms: every form input has an associated label element.' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Langage: the page language is declared as English, with Maltese available via the language switcher.' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Alt text: images include descriptive alternative text.' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'Resize and reflow: content remains readable when zoomed to 200% or when viewed on small screens.' }] },
            ],
          },
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'Known Limitations' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'We are working to address the following known issues:' },
            ],
          },
          {
            type: 'list',
            listType: 'unordered',
            children: [
              { type: 'listitem', children: [{ type: 'text', text: 'The Google Translate widget may affect screen-reader behaviour. We offer information in both English and Maltese as an alternative.' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'The interactive calendar on the "Book Now" page relies on date-picker controls that may present challenges for some assistive technology combinations.' }] },
            ],
          },
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'Feedback and Contact' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'We welcome feedback on the accessibility of this site. If you encounter a barrier, please contact us at ' },
              { type: 'text', text: 'denise.grima-connell@gov.mt', format: 'bold' },
              { type: 'text', text: '. We aim to respond within five working days.' },
            ],
          },
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'Enforcement' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'The Malta Communications Authority (MCA) is responsible for enforcing the EU Web Accessibility Directive in Malta. If you are not satisfied with our response, you may contact the MCA.' },
            ],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'This statement was prepared on 1 September 2026. It will be reviewed annually.' },
            ],
          },
        ],
      },
    })

  console.log('Seed: Done.')
}

// Standalone invocation (npm run db:seed)
const isStandalone = process.argv[1]?.endsWith('src/payload/seed.ts') || process.argv[1]?.endsWith('seed.ts')
if (isStandalone) {
  seed().catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
}