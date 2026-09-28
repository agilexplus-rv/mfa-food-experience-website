/**
 * Default (drafted) Data Protection Policy for the Malta Food Experience.
 *
 * The canonical policy is the DataProtectionPolicy Global, edited in the
 * console under Settings → Data Protection Policy. This drafted text is only
 * the Global's rich-text `defaultValue`, served until the policy is first
 * saved. It was converted from docs/data-protection-policy.md, which is kept
 * as a reference copy along with internal drafting notes.
 *
 * Kept free of Payload/Next imports so the Global config can import it (see
 * termsDefault.ts).
 */

/**
 * Inline markup in the strings below: **bold**, [label](url), and "\n" for a
 * line break. The draft's tables are written out as bullet lists, as neither
 * the console editor nor Payload's default Lexical features support tables.
 */
type PolicyBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; listType: 'bullet' | 'number'; items: string[] }

const h2 = (text: string): PolicyBlock => ({ type: 'heading', text })
const p = (text: string): PolicyBlock => ({ type: 'paragraph', text })
const ul = (...items: string[]): PolicyBlock => ({ type: 'list', listType: 'bullet', items })
const ol = (...items: string[]): PolicyBlock => ({ type: 'list', listType: 'number', items })

const DEFAULT_DATA_PROTECTION_POLICY: PolicyBlock[] = [
  p('**Malta Food Experience** – operated by [COMPANY LEGAL NAME] ("Malta Food Agency", "we", "us", "our")'),
  p('Last updated: [DATE]'),
  p('This policy explains what personal data we collect when you book an experience, join a waitlist, or otherwise deal with us; why we collect it; how long we keep it; who we share it with; and the rights you have. We process personal data in line with the EU General Data Protection Regulation (GDPR) and the Maltese Data Protection Act (Cap. 586).'),

  h2('1. Who we are (Data Controller)'),
  p('The data controller responsible for your personal data is:'),
  ul(
    '**Company:** [COMPANY LEGAL NAME], trading as Malta Food Agency',
    '**Registered address:** [REGISTERED ADDRESS]',
    '**Company registration no.:** [COMPANY REGISTRATION NUMBER]',
    '**Email:** [PRIVACY CONTACT EMAIL]',
    '**Telephone:** [TELEPHONE NUMBER]',
  ),
  p('**Data Protection Officer (DPO) / privacy contact:** [DPO NAME], [DPO EMAIL], [DPO POSTAL ADDRESS]'),

  h2('2. Whose data this policy covers'),
  ul(
    '**Customers and attendees** – people who book an experience, and the lead attendee named on a booking.',
    '**Waitlist subscribers** – people who ask to be told when seats become available for a fully booked experience.',
    '**Website visitors** – including people who use our contact form or submit a testimonial.',
    '**Staff users** – our administrators and door staff who use the booking system.',
  ),

  h2('3. What personal data we collect'),
  ul(
    '**Identity and contact:** Name of the lead attendee, email address, phone number (optional). Source: You, when you book or join a waitlist.',
    '**Booking details:** Experience and date booked, number of persons, booking reference, language preference, any coupon code used, acceptance of our Terms & Conditions. Source: You, when you book.',
    '**Dietary requirements:** Free-text dietary notes (optional). Source: You, only if you choose to give them and explicitly consent (see Section 5).',
    "**Payment references:** Amount paid, payment status, refund status, and the payment provider's order and transaction references. Source: Our payment provider.",
    '**Attendance:** Check-in time at the event, and which staff member checked you in. Source: Our door staff, when you arrive.',
    '**Waitlist:** Name, email, phone (optional), number of persons, the experience you are waiting for, and the dates you joined, were notified, booked, or left the waitlist. Source: You, when you join a waitlist.',
    '**Enquiries:** Name, email address and your message. Source: You, via the contact form.',
    '**Testimonials:** Your name and testimonial text. Source: You, if you submit a testimonial.',
    '**Staff accounts:** Name, email, role, password (stored only as a salted hash), two-factor authentication settings. Source: Our staff.',
    '**Security and audit logs:** Records of actions taken by staff in the booking system, with the IP address and browser details of the device used. Source: Generated automatically.',
  ),
  p("**We never see or store your card details.** Card payments are entered directly on our payment provider's secure page (see Section 8)."),

  h2('4. Why we use your data and our legal bases'),
  ul(
    'Taking and managing your booking: confirming it, emailing your confirmation and QR check-in code, checking you in on the day, handling changes, cancellations and refunds. Legal basis: **Performance of a contract** (Art. 6(1)(b)).',
    'Taking payment and preventing payment fraud. Legal basis: **Performance of a contract** (Art. 6(1)(b)) and our **legitimate interest** in preventing fraud (Art. 6(1)(f)).',
    'Keeping financial records of transactions. Legal basis: **Legal obligation** under Maltese tax and accounting law (Art. 6(1)(c)).',
    'Catering for your dietary requirements. Legal basis: Your **explicit consent** (Art. 9(2)(a)) – see Section 5.',
    'Telling you when seats become available for an experience you are waiting for. Legal basis: Our **legitimate interest** in filling cancelled seats with people who have asked to hear about them (Art. 6(1)(f)) – see Section 6.',
    'Sending you marketing communications, only if you have opted in. Legal basis: Your **consent** (Art. 6(1)(a)).',
    'Replying to your enquiries. Legal basis: Our **legitimate interest** in answering the people who contact us (Art. 6(1)(f)), or steps you ask us to take before booking (Art. 6(1)(b)).',
    'Publishing your testimonial. Legal basis: Your **consent** (Art. 6(1)(a)).',
    'Keeping the booking system secure: staff access control, audit logs, rate limiting. Legal basis: Our **legitimate interest** in protecting your data and our systems (Art. 6(1)(f)).',
    'Managing staff access to the booking system. Legal basis: **Performance of a contract** with our staff (Art. 6(1)(b)) and our **legitimate interest** (Art. 6(1)(f)).',
  ),
  p('Where we rely on legitimate interest, we have weighed our interest against your rights and expectations. You can object at any time (see Section 10).'),
  p('We do **not** use your personal data for automated decision-making or profiling that has legal or similarly significant effects on you.'),

  h2('5. Dietary requirements (special category data)'),
  p('Dietary notes can reveal information about your health (for example, allergies or coeliac disease) or your religious beliefs. The GDPR treats this as **special category data**. We therefore:'),
  ul(
    'only collect dietary notes if you choose to give them **and** tick the explicit consent box when booking;',
    'only use them to cater for you at the experience you booked;',
    'only show them to the staff who need them to prepare and serve your meal;',
    'delete them together with the other personal details of your booking (see Section 7), or sooner if you withdraw your consent.',
  ),
  p('You can withdraw your consent at any time by contacting us (Section 14). Withdrawing consent does not affect the rest of your booking, although we may then be unable to cater for your requirements.'),

  h2('6. Waitlist'),
  p('**Purpose.** If an experience is fully booked, you can join its waitlist. We use your details only to tell you when seats become available for that experience.'),
  p('**Legal basis.** Our legitimate interest in offering freed-up seats to people who have asked to hear about them (Art. 6(1)(f)).'),
  p('**What happens to your entry:**'),
  ul(
    'When a seat becomes available, we email the next person on the waitlist.',
    'If you then book the experience, your waitlist entry is closed automatically and you will not be notified again.',
    'Our staff may archive waitlist entries, for example once an experience has taken place. Archived entries are no longer used for notifications.',
    '**Retention.** Waitlist entries are kept for a limited period, which we set in our booking system (currently [6] months from the date you joined; it can be set between 1 and 36 months). After that period, your entry is automatically expired and taken off the waitlist.',
  ),
  p('**Opting out.** You can ask to be removed from a waitlist at any time through our [contact form](/contact) or by emailing [PRIVACY CONTACT EMAIL]. We will remove your entry and stop contacting you about it.'),

  h2('7. How long we keep your data'),
  p('We keep personal data only for as long as we need it for the purposes above.'),
  ul(
    '**Booking records** (reference, experience, amount paid, payment references): **6 years** after the transaction, to meet our tax and accounting obligations under Maltese law.',
    '**Personal details within bookings** (name, email, phone): Removed automatically (anonymised) **24 months after the date of the experience**. Unpaid or abandoned bookings: after **90 days**. After this, the booking record kept for accounting no longer identifies you.',
    '**Dietary notes:** Kept with the booking and removed at the same time as its personal details (24 months after the experience), or sooner if you withdraw your consent.',
    '**Waitlist entries:** Configurable in our booking system: **default 6 months** from the date you joined (minimum 1, maximum 36 months), after which the entry is automatically expired.',
    '**Audit and security logs:** **2 years**.',
    '**Staff accounts:** For the duration of employment or engagement, plus **1 year**.',
    '**Contact form enquiries:** Delivered to our team by email and not stored in the booking system. Kept in our mailbox for [RETENTION PERIOD FOR ENQUIRIES].',
    '**Testimonials:** Published testimonials: until you ask us to remove them. Testimonials we do not publish: your name is removed after **30 days**.',
  ),
  p('When we delete or anonymise data, it is removed from our live systems. Backups are overwritten on a rolling schedule of [BACKUP RETENTION PERIOD].'),

  h2('8. Who we share your data with'),
  p('We do not sell your personal data. We share it only with service providers (processors) who help us run our service. They act on our instructions under data processing agreements and must keep your data secure.'),
  ul(
    '**Viva Wallet** (Viva Payments S.A.): Processes card payments and refunds. Your card details go directly to Viva Wallet, never to us. Location of processing: European Economic Area (EEA).',
    '**Stripe:** Processed payments for bookings made before we moved to Viva Wallet. We keep only the payment references for those bookings. Location of processing: [EEA / United States].',
    '**Microsoft Azure:** Hosts our website, booking system and database. Location of processing: [AZURE REGION, e.g. EU (West Europe)].',
    '**Cloudflare:** Domain name (DNS), content delivery and website security, including bot protection on the booking form where enabled. Location of processing: Global network; [TRANSFER SAFEGUARD].',
    '**Resend:** Sends our transactional emails: booking confirmations, waitlist notifications, and contact form messages to our team. Location of processing: [REGION]; [TRANSFER SAFEGUARD].',
    '**Payload CMS:** The application framework our booking system is built on. It is open-source software that we run on our own hosting; its developers do not receive or process your personal data. Location of processing: Our own hosting (see Microsoft Azure).',
  ),
  p("**Google Translate.** Our website offers an optional translation feature provided by Google. It only loads if you choose to translate a page and accept the relevant cookies. When active, Google receives the page content and your IP address. See our [Cookie Policy](/legal/cookie-policy) and Google's privacy policy."),
  p("**Transfers outside the EEA.** Where a provider processes data outside the EEA, we make sure your data is protected by appropriate safeguards, such as the European Commission's Standard Contractual Clauses or the EU-US Data Privacy Framework. You can ask us for details (Section 14)."),
  p('We may also disclose personal data where the law requires it, for example to tax authorities, or to establish or defend legal claims.'),

  h2('9. How we protect your data'),
  ul(
    '**Encryption in transit:** all traffic to our website and booking system uses HTTPS.',
    '**Encryption at rest:** our database and file storage are encrypted at rest on Microsoft Azure.',
    '**Role-based access control:** staff only see what their role needs. Door staff can view and check in bookings; payments, refunds, settings and customer data management are restricted to administrators.',
    '**Secure sign-in:** staff sign in with a password (stored only as a salted hash) and a secure, HTTP-only session cookie. No login tokens are kept in browser storage.',
    '**Multi-factor authentication (MFA):** mandatory for all administrator accounts.',
    '**Audit logging:** actions taken by staff in the booking system are logged with who did what and when.',
    '**Rate limiting:** booking, coupon and check-in functions are protected against automated abuse.',
    '**Data minimisation:** we only ask for what we need. Dietary notes are optional and consent-based. Your QR check-in code is stored only in a one-way (hashed) form. Personal details are anonymised automatically at the end of their retention period.',
  ),

  h2('10. Your rights'),
  p('Under the GDPR you have the following rights:'),
  ul(
    '**Access:** Get a copy of the personal data we hold about you. How we handle it: We search our records by your email address and send you a copy of your booking and other data.',
    '**Rectification:** Have inaccurate or incomplete data corrected. How we handle it: We correct your booking details (for example, name, email or phone).',
    '**Erasure** ("right to be forgotten"): Have your data deleted. How we handle it: We delete or anonymise your personal details (name, email, phone, dietary notes). We may keep the anonymised financial record where the law requires it (Section 7).',
    '**Restriction:** Ask us to limit how we use your data. How we handle it: We mark your data so that it is kept but not otherwise used, for example by archiving a waitlist entry.',
    '**Portability:** Receive the data you gave us in a machine-readable format. How we handle it: We provide it as a CSV file.',
    '**Objection:** Object to processing based on our legitimate interests. How we handle it: For example, we remove you from a waitlist. You can unsubscribe from marketing at any time.',
    '**Withdraw consent:** Withdraw consent you have given (dietary notes, marketing, testimonials). How we handle it: We stop that processing from then on. This does not affect processing already carried out.',
  ),
  p('**How to exercise your rights.** Contact us using the details in Section 14. We will respond within **one month**. For complex or numerous requests we may extend this by up to two further months, and we will tell you if we do. Exercising your rights is free of charge. We may ask you to confirm your identity before acting on a request, to protect your data.'),

  h2('11. Cookies'),
  p('We use strictly necessary cookies to run the website and booking system (for example, to keep staff signed in). Optional cookies, such as those set by Google Translate, are only used with your consent, which you give or refuse through our cookie banner. See our [Cookie Policy](/legal/cookie-policy) for details.'),

  h2('12. Data breaches'),
  p('If a personal data breach occurs, we will:'),
  ol(
    '**Contain** the breach and limit its effects as quickly as possible.',
    '**Assess** the risk it poses to the people affected.',
    '**Notify the supervisory authority** (the Information and Data Protection Commissioner) **within 72 hours** of becoming aware of the breach, unless it is unlikely to result in a risk to your rights and freedoms.',
    '**Notify you without undue delay** if the breach is likely to result in a high risk to your rights and freedoms, explaining what happened and what you can do to protect yourself.',
    '**Record** every breach, including its effects and the action taken, in our internal breach register.',
  ),
  p('Our processors are contractually required to tell us about any breach affecting our data without undue delay.'),

  h2('13. Supervisory authority'),
  p('If you are unhappy with how we handle your personal data, please contact us first so we can try to resolve the issue. You also have the right to lodge a complaint with the Maltese supervisory authority:'),
  p('**Information and Data Protection Commissioner (IDPC)**\nWebsite: [idpc.org.mt](https://idpc.org.mt)'),
  p('If you live or work in another EU/EEA country, you can also complain to the supervisory authority there.'),

  h2('14. Contact us'),
  p('For any question about this policy, or to exercise your rights:'),
  ul(
    '**Email:** [PRIVACY CONTACT EMAIL]',
    '**Post:** [COMPANY LEGAL NAME], [REGISTERED ADDRESS]',
    '**Data Protection Officer:** [DPO NAME], [DPO EMAIL]',
  ),

  h2('15. Changes to this policy'),
  p('We may update this policy from time to time, for example when we change how we process personal data or when the law changes. The "Last updated" date at the top shows when it was last revised. If we make significant changes, we will tell you by email or through a notice on our website.'),
]

// ── Lexical (Payload richText) representation ──

const IS_BOLD = 1

const textNode = (text: string, format = 0) => ({
  type: 'text',
  // Straight apostrophes become typographic ones: Payload's schema push copies
  // this default into an SQL DEFAULT '...' clause without escaping quotes, and
  // a straight apostrophe there breaks the push.
  text: text.replace(/'/g, '’'),
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  version: 1,
})

const blockBase = { direction: 'ltr' as const, format: '' as const, indent: 0, version: 1 }

const linkNode = (label: string, url: string) => ({
  ...blockBase,
  type: 'link',
  version: 3,
  fields: { linkType: 'custom', url, newTab: false },
  children: [textNode(label)],
})

/** Parse the inline markup into Lexical text, link and linebreak nodes. */
function inlineNodes(markup: string) {
  const nodes: object[] = []
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|\n/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(markup))) {
    if (match.index > last) nodes.push(textNode(markup.slice(last, match.index)))
    if (match[1] !== undefined) nodes.push(textNode(match[1], IS_BOLD))
    else if (match[2] !== undefined) nodes.push(linkNode(match[2], match[3]))
    else nodes.push({ type: 'linebreak', version: 1 })
    last = pattern.lastIndex
  }
  if (last < markup.length) nodes.push(textNode(markup.slice(last)))
  return nodes
}

/** Build the drafted policy as a Lexical editor state (for the Global's `defaultValue`). */
export function buildDefaultDataProtectionLexical() {
  const children = DEFAULT_DATA_PROTECTION_POLICY.map((block) => {
    switch (block.type) {
      case 'heading':
        return { ...blockBase, type: 'heading', tag: 'h2', children: inlineNodes(block.text) }
      case 'paragraph':
        return { ...blockBase, type: 'paragraph', textFormat: 0, textStyle: '', children: inlineNodes(block.text) }
      case 'list':
        return {
          ...blockBase,
          type: 'list',
          listType: block.listType,
          tag: block.listType === 'number' ? 'ol' : 'ul',
          start: 1,
          children: block.items.map((item, i) => ({
            ...blockBase,
            type: 'listitem',
            value: i + 1,
            children: inlineNodes(item),
          })),
        }
    }
  })
  return { root: { ...blockBase, type: 'root', children } }
}

// ── HTML fallback (for getDataProtectionPolicy() when the Lexical body is empty) ──

function htmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function inlineHtml(markup: string): string {
  return markup
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-terracotta-dark underline">$1</a>')
    .replace(/\n/g, '<br>')
}

/** Render the drafted policy to HTML (same element set the Lexical renderer emits). */
export function buildDefaultDataProtectionHtml(): string {
  return DEFAULT_DATA_PROTECTION_POLICY.map((block) => {
    switch (block.type) {
      case 'heading':
        return `<h2>${htmlEscape(block.text)}</h2>`
      case 'paragraph':
        return `<p>${inlineHtml(htmlEscape(block.text))}</p>`
      case 'list': {
        const tag = block.listType === 'number' ? 'ol' : 'ul'
        const items = block.items.map((item) => `<li>${inlineHtml(htmlEscape(item))}</li>`).join('')
        return `<${tag}>${items}</${tag}>`
      }
    }
  }).join('')
}
