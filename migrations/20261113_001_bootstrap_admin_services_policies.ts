import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * 20261113 — Make a fresh production database usable.
 *
 * The runtime seed (entrypoint -> /seed-internal) does not populate a fresh
 * Postgres database, and the first user created through /admin is assigned the
 * collection default role `door_staff`, which the Users beforeChange hook
 * refuses to let them change. A fresh prod instance therefore has no admin and
 * no content.
 *
 * This migration does the three things a fresh instance needs, in raw SQL so it
 * cannot be affected by the Payload transaction/hook problems:
 *   1. promote the bootstrap account to admin,
 *   2. insert the two services the booking flow requires,
 *   3. insert the five policies that have no code-level default and would 404.
 *
 * Every statement is guarded, so it is safe to re-run on an instance that
 * already has content. Policy text is the Agency's text as held in
 * src/payload/seed.ts; attorneys should review it before launch.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "users"
    SET "role" = 'admin'
    WHERE "email" = 'admin@foodexperience.mt' AND "role" <> 'admin';
  `)

  await db.execute(sql`
    INSERT INTO "services" ("name", "slug", "visible", "order")
    SELECT 'Classes', 'classes', true, 1
    WHERE NOT EXISTS (SELECT 1 FROM "services" WHERE "slug" = 'classes');
  `)
  await db.execute(sql`
    INSERT INTO "services" ("name", "slug", "visible", "order")
    SELECT 'Tastings', 'tastings', false, 2
    WHERE NOT EXISTS (SELECT 1 FROM "services" WHERE "slug" = 'tastings');
  `)

  await db.execute(sql`
    INSERT INTO "policies" ("slug", "title", "body")
    SELECT 'privacy-notice', 'Privacy Notice', $p1$
      {
      "root": {
        "type": "root", "format": "", "indent": 0, "version": 1, "direction": "ltr",
        "children": [
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Who We Are","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"The Malta Food Agency (\\"the Agency\\", \\"we\\", \\"us\\") is the data controller for personal data collected through the Malta Food Experience website (foodexperience.mt). We are committed to protecting your privacy in accordance with the General Data Protection Regulation (EU) 2016/679 and the Data Protection Act (Chapter 586 of the Laws of Malta).","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"What Personal Data We Collect","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"When you make a booking we collect your name and email address, the names of additional attendees, dietary requirements and allergy information where provided, transaction identifiers (not full card details), and your IP address for fraud prevention and rate-limiting.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Why We Process Your Data","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"Contractual necessity: to process your booking, send your confirmation and QR code, and communicate essential event information. Legitimate interest: to prevent fraud and misuse of the booking system. Consent: for any optional communications you have agreed to receive.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Data Retention","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"Booking records are retained for two years after the event date, after which personal data is anonymised. Financial transaction records are retained for six years as required by Maltese tax law.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Data Sharing","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"We share your data with Viva Wallet, to process payments, and with Microsoft Azure, for website hosting within the EU (West Europe region). We do not sell, rent, or share your data with any other third parties.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Your Rights","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"Under the GDPR you have the right to access, rectify, erase, restrict, or port your personal data, and to object to processing. Contact us at dpo.mfa@gov.mt. You also have the right to lodge a complaint with the Office of the Information and Data Protection Commissioner (idpc.org.mt).","detail":0,"format":0,"mode":"normal","style":""}]}
        ]
      }
    }$p1$::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM "policies" WHERE "slug" = 'privacy-notice');
  `)

  await db.execute(sql`
    INSERT INTO "policies" ("slug", "title", "body")
    SELECT 'cookie-policy', 'Cookie Policy', $p2$
      {
      "root": {
        "type": "root", "format": "", "indent": 0, "version": 1, "direction": "ltr",
        "children": [
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"What Are Cookies","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"Cookies are small text files placed on your device when you visit a website. They are widely used to make websites work and to improve usability.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"How We Use Cookies","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"This website uses only essential cookies necessary for its operation: a session cookie that maintains your booking session and expires when you close your browser; a language cookie that remembers your language preference for 30 days; and a consent cookie that stores your cookie consent preference for 12 months.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Third-Party Cookies","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"We do not use advertising, analytics, or social media cookies. No third-party tracking cookies are set by this site.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Managing Cookies","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"Most browsers allow you to refuse or delete cookies through their settings. Blocking essential cookies may prevent the booking system from functioning correctly.","detail":0,"format":0,"mode":"normal","style":""}]}
        ]
      }
    }$p2$::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM "policies" WHERE "slug" = 'cookie-policy');
  `)

  await db.execute(sql`
    INSERT INTO "policies" ("slug", "title", "body")
    SELECT 'accessibility-statement', 'Accessibility Statement', $p3$
      {
      "root": {
        "type": "root", "format": "", "indent": 0, "version": 1, "direction": "ltr",
        "children": [
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Our Commitment","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"The Malta Food Agency is committed to making the Malta Food Experience website accessible to everyone, including people with disabilities. We aim to conform to Level AA of the Web Content Accessibility Guidelines (WCAG) 2.2.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"How We Deliver Accessibility","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"A skip link is the first focusable element on every page. We use semantic HTML5 landmarks, full keyboard navigation with visible focus indicators, colour contrast meeting or exceeding WCAG 2.2 AA, labelled form inputs, a declared page language with a Maltese alternative, descriptive alternative text for images, and layouts that remain readable at 200% zoom and on small screens.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Known Limitations","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"The Google Translate widget may affect screen-reader behaviour; information is also offered in both English and Maltese as an alternative. The interactive calendar on the booking page relies on date-picker controls that may present challenges for some assistive technology combinations.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Feedback and Contact","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"If you encounter a barrier, please contact us at foodexperience.mfa@gov.mt. We aim to respond within five working days. The Malta Communications Authority (MCA) enforces the EU Web Accessibility Directive in Malta.","detail":0,"format":0,"mode":"normal","style":""}]}
        ]
      }
    }$p3$::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM "policies" WHERE "slug" = 'accessibility-statement');
  `)

  await db.execute(sql`
    INSERT INTO "policies" ("slug", "title", "body")
    SELECT 'customer-policy', 'Customer Policy', $p4$
      {
      "root": {
        "type": "root", "format": "", "indent": 0, "version": 1, "direction": "ltr",
        "children": [
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Introduction","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"These terms govern the relationship between the Malta Food Agency and individuals participating in Malta Food Experience events, classes and tastings. By making a booking you agree to be bound by these terms.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Eligibility","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"Participants must be at least 16 years of age. Children under 16 may attend when accompanied by a responsible adult. Some events may have specific age or dietary requirements, which will be clearly stated on the event page.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Dietary Requirements and Allergies","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"Customers are responsible for informing the Agency of any food allergies, intolerances or dietary requirements at the time of booking. While we take reasonable precautions, we cannot guarantee an allergen-free environment. Participation is at your own risk.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Conduct","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"Customers are expected to behave respectfully toward staff, hosts and fellow participants. The Agency reserves the right to remove any participant whose behaviour is disruptive or endangers others, without refund.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Liability","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"The Malta Food Agency maintains public liability insurance. Participation in culinary activities involves inherent risks. To the fullest extent permitted by law, the Agency excludes liability for personal injury, loss or damage to property except where caused by our negligence.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Photography and Media","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"Photographs and video may be taken during events for promotional purposes. By attending, you consent to your image being used in Agency marketing materials unless you notify us otherwise in writing before the event.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Governing Law","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"These terms are governed by the laws of Malta. Any disputes shall be subject to the exclusive jurisdiction of the Maltese courts.","detail":0,"format":0,"mode":"normal","style":""}]}
        ]
      }
    }$p4$::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM "policies" WHERE "slug" = 'customer-policy');
  `)

  await db.execute(sql`
    INSERT INTO "policies" ("slug", "title", "body")
    SELECT 'provider-info', 'Provider Information', $p5$
      {
      "root": {
        "type": "root", "format": "", "indent": 0, "version": 1, "direction": "ltr",
        "children": [
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Malta Food Agency","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"The Malta Food Agency is the national body responsible for promoting Maltese culinary heritage, food quality and gastronomic tourism. Through the Malta Food Experience, the Agency offers authentic culinary and cultural events hosted by local producers, artisans and chefs.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Registered Address","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"Malta Food Agency, Pitkali Road, Ta' Qali, Attard, Malta.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"Contact","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"Email: foodexperience.mfa@gov.mt. Phone: +356 2292 4000.","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"heading","tag":"h2","version":1,"children":[{"type":"text","text":"VAT Number","detail":0,"format":0,"mode":"normal","style":""}]},
          {"type":"paragraph","version":1,"children":[{"type":"text","text":"MT 2651 5131","detail":0,"format":0,"mode":"normal","style":""}]}
        ]
      }
    }$p5$::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM "policies" WHERE "slug" = 'provider-info');
  `)
}

export async function down(): Promise<void> {
  // No-op: this bootstraps a live instance; reverting would remove the admin
  // role and the content the public pages depend on.
}
