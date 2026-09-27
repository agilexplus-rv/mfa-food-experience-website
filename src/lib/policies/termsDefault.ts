/**
 * Default (drafted) Terms & Conditions for the Malta Food Experience.
 *
 * Kept free of Payload/Next imports so it can be used both by the
 * TermsAndConditions Global config (as the rich-text `defaultValue`) and by
 * getTermsAndConditions() (as the HTML fallback when the Global body is
 * empty). Importing '@payload-config' here would create a circular import
 * with the Global config.
 */

export interface TermsSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
  /** Paragraphs rendered after the bullet list. */
  closing?: string[]
}

export const DEFAULT_TERMS_SECTIONS: TermsSection[] = [
  {
    heading: '1. Introduction',
    paragraphs: [
      'These Terms and Conditions ("Terms") apply to all bookings for cooking classes, tastings and other experiences ("Experiences") offered under the Malta Food Experience by the Malta Food Agency ("the Agency", "we", "us" or "our"), Pitkali Road, Ta\' Qali, Attard, Malta.',
      'By making a booking or using this website, you ("the Participant" or "you") confirm that you have read, understood and accepted these Terms, together with our Cancellation Policy, Customer Policy, Privacy Policy and Cookie Policy, which form part of these Terms. Where a booking is made on behalf of other participants, the person making the booking confirms that they are authorised to accept these Terms on their behalf.',
    ],
  },
  {
    heading: '2. Bookings and Payments',
    paragraphs: [
      'All bookings are made through this website and are subject to availability. A booking is confirmed only once full payment has been received and a booking confirmation has been sent to the email address provided.',
      'Prices are shown in euro (EUR) and include VAT at the applicable rate unless stated otherwise. Payments are processed securely by our third-party payment provider; the Agency does not store your card details.',
      'Seats are held for a limited time while you complete your booking. If payment is not completed within that time, the seats are released and may be booked by others.',
      'Please check your booking confirmation carefully and contact us promptly if any details are incorrect. Discount or promotional codes are subject to their own conditions, cannot be exchanged for cash and may not be applied after a booking has been confirmed.',
    ],
  },
  {
    heading: '3. Cancellations and Refunds',
    paragraphs: [
      'Cancellations by the Participant are handled in accordance with our Cancellation Policy, published on this website, which sets out the notice periods and the refunds that apply. The version of the Cancellation Policy in force at the time of booking applies to that booking.',
      'The Agency may cancel or reschedule an Experience where this is necessary for reasons such as insufficient bookings, the unavailability of a chef, adverse weather, health and safety concerns or other circumstances beyond our reasonable control. In such cases, we will inform you as soon as reasonably possible and offer you a full refund or, where available, an alternative date at no additional cost.',
      'Refunds are issued to the original method of payment. Participants who do not attend, or who arrive after an Experience has started, are not entitled to a refund unless the Cancellation Policy states otherwise.',
    ],
  },
  {
    heading: '4. Right of Withdrawal',
    paragraphs: [
      'In accordance with Article 16(l) of Directive 2011/83/EU on consumer rights, as transposed into Maltese law, the 14-day right of withdrawal does not apply to contracts for leisure services provided on a specific date or within a specific period.',
      'Since each Experience takes place on a specific date and time, the statutory right of withdrawal does not apply to your booking. Any cancellation or refund is governed by our Cancellation Policy. This does not affect your other statutory rights as a consumer.',
    ],
  },
  {
    heading: '5. Participant Responsibilities',
    paragraphs: [
      'Experiences are hands-on and take place in a working kitchen. To keep everyone safe, Participants agree to:',
    ],
    bullets: [
      'arrive on time and follow the instructions of the chef and Agency staff at all times;',
      'take reasonable care when handling knives, hot surfaces, cooking equipment and food;',
      'wear suitable closed footwear and clothing, and tie back long hair;',
      'inform staff before the Experience of any medical condition, disability or other circumstance that may affect their participation or safety;',
      'treat other participants, chefs and staff with courtesy and respect.',
    ],
    closing: [
      'Children and young persons under the age of 16 must be accompanied and supervised by a participating adult, who remains responsible for them throughout the Experience. Minimum ages, where they apply, are stated in the description of the Experience.',
      'Alcoholic drinks are served only to Participants of legal drinking age and are always optional. We may ask for proof of age. We reserve the right to refuse service or to ask any person to leave an Experience, without refund, if their behaviour puts the safety or enjoyment of others at risk or if they appear to be under the influence of alcohol or drugs.',
    ],
  },
  {
    heading: '6. Dietary Requirements and Allergies',
    paragraphs: [
      'We will do our best to accommodate specific dietary requirements, food allergies, intolerances and nutritional preferences where feasible. Please contact us before booking so that our team can assess your requirements, and record them in your booking where requested.',
      'Our kitchen handles common allergens, including gluten, milk, eggs, fish, crustaceans, molluscs, nuts, peanuts, sesame, soya, celery, mustard, lupin and sulphites. While we take care to manage allergens, we cannot guarantee that any dish or ingredient is completely free from traces of allergens. Allergen information for each dish is available from the chef on request.',
      'Participants with severe allergies should carry any prescribed medication with them. Information about dietary requirements and health is processed only for the purpose of providing a safe Experience, in accordance with our Privacy Policy.',
    ],
  },
  {
    heading: '7. Photography and Media',
    paragraphs: [
      'The Agency may take photographs or video recordings during Experiences for promotional, educational and reporting purposes, including use on this website, on social media and in printed material. Staff will announce when photography or filming is taking place.',
      'If you do not wish to appear in such material, please let a member of staff know at the start of the Experience and we will respect your wishes. Images of children will only be published with the consent of their parent or guardian. You may withdraw your consent at any time by contacting us, after which we will not use the material in new publications.',
      'Participants are welcome to take photographs for personal use, provided this does not disturb the class or other participants.',
    ],
  },
  {
    heading: '8. User Content and Testimonials',
    paragraphs: [
      'Testimonials submitted through this website are sent by site visitors and are moderated for appropriateness before publication. They are not verified as originating from attendees of a specific experience. We reserve the right to edit or remove testimonials at our discretion.',
      'By submitting a testimonial or other content, you confirm that it is your own, honest opinion, that it does not contain unlawful, offensive or misleading material, and that you grant the Agency a non-exclusive, royalty-free licence to publish it on this website and in related promotional material, together with the name you provide.',
    ],
  },
  {
    heading: '9. Intellectual Property',
    paragraphs: [
      'All content on this website and all materials provided during Experiences, including recipes, text, images, logos and the Malta Food Experience name and branding, are owned by or licensed to the Agency and are protected by intellectual property laws.',
      'Recipes and materials provided to Participants may be used for personal, non-commercial purposes. They may not be reproduced, published or used commercially without our prior written consent.',
    ],
  },
  {
    heading: '10. Limitation of Liability',
    paragraphs: [
      'The Agency takes reasonable care to ensure that Experiences are delivered safely and as described. Participants take part in hands-on cooking activities at their own risk and must follow safety instructions at all times.',
      'To the extent permitted by law, the Agency is not liable for any loss of or damage to personal belongings, or for any indirect or consequential loss. Our total liability in connection with a booking is limited to the price paid for that booking.',
      'Nothing in these Terms excludes or limits our liability for death or personal injury caused by our negligence, for fraud, or for any other liability that cannot be excluded or limited under Maltese or European Union law. Nothing in these Terms affects your statutory rights as a consumer.',
    ],
  },
  {
    heading: '11. Changes to these Terms',
    paragraphs: [
      'We may update these Terms from time to time. The version published on this website at the time of your booking applies to that booking.',
    ],
  },
  {
    heading: '12. Governing Law and Disputes',
    paragraphs: [
      'These Terms are governed by the laws of Malta. Any dispute arising in connection with these Terms or a booking is subject to the jurisdiction of the courts of Malta, without prejudice to any mandatory rights you may have as a consumer under the law of your country of residence.',
      'We aim to resolve any complaint amicably. If you are not satisfied with our response, you may contact the Malta Competition and Consumer Affairs Authority (MCCAA) or, if you are resident in another EU Member State, the European Consumer Centre in your country.',
    ],
  },
  {
    heading: '13. Contact',
    paragraphs: [
      'For questions about these Terms, your booking or dietary requirements, please contact:',
    ],
    bullets: [
      'Malta Food Agency, Pitkali Road, Ta\' Qali, Attard, Malta',
      'Email: bookings@foodagency.mt',
      'Telephone: +356 2292 4000',
      'Data protection enquiries: dpo.mfa@gov.mt',
    ],
  },
]

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Render the drafted Terms to HTML (same element set the Lexical renderer emits). */
export function buildDefaultTermsHtml(sections: TermsSection[] = DEFAULT_TERMS_SECTIONS): string {
  const p = (t: string) => `<p>${escapeHtml(t)}</p>`
  return sections
    .map((s) =>
      [
        `<h2>${escapeHtml(s.heading)}</h2>`,
        ...s.paragraphs.map(p),
        s.bullets ? `<ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : '',
        ...(s.closing ?? []).map(p),
      ].join(''),
    )
    .join('')
}

// ── Lexical (Payload richText) representation ──

const textNode = (text: string) => ({
  type: 'text',
  text,
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

const blockBase = { direction: 'ltr' as const, format: '' as const, indent: 0, version: 1 }

const paragraphNode = (text: string) => ({
  ...blockBase,
  type: 'paragraph',
  textFormat: 0,
  textStyle: '',
  children: [textNode(text)],
})

/** Build the drafted Terms as a Lexical editor state (for the Global's `defaultValue`). */
export function buildDefaultTermsLexical(sections: TermsSection[] = DEFAULT_TERMS_SECTIONS) {
  const children = sections.flatMap((s) => [
    { ...blockBase, type: 'heading', tag: 'h2', children: [textNode(s.heading)] },
    ...s.paragraphs.map(paragraphNode),
    ...(s.bullets
      ? [
          {
            ...blockBase,
            type: 'list',
            listType: 'bullet',
            tag: 'ul',
            start: 1,
            children: s.bullets.map((b, i) => ({
              ...blockBase,
              type: 'listitem',
              value: i + 1,
              children: [textNode(b)],
            })),
          },
        ]
      : []),
    ...(s.closing ?? []).map(paragraphNode),
  ])
  return { root: { ...blockBase, type: 'root', children } }
}
