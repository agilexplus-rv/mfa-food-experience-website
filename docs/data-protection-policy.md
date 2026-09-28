<!--
  REFERENCE COPY -- not the canonical source.

  The live policy is edited in the console under Settings -> Data Protection
  Policy (/console/settings/data-protection-policy) and stored in the
  DataProtectionPolicy Payload global. This file is the original draft that
  the global's default content (src/lib/policies/dataProtectionDefault.ts)
  was converted from; editing it does not change the policy.
-->

<!--
  INTERNAL NOTES -- delete this comment before publishing.

  1. Fill in every [PLACEHOLDER] (search for "[").
  2. Confirm with the client's accountant / legal adviser:
     - the 6-year financial-record retention period (Section 7);
     - the hosting regions and data processing agreements (DPAs) of each
       provider in Section 8, and the transfer safeguards for providers
       outside the EEA (Resend, Cloudflare, Google, Stripe).
  3. Commitments in this policy that the system does NOT yet enforce
     automatically -- implement, or run them as a documented manual process:
     - Audit logs: 2-year retention. No automated purge exists today.
     - Staff accounts: employment + 1 year. Accounts are deactivated/deleted
       by hand in the console.
     - Waitlist: expiry after the retention period (Settings) only changes the
       entry's status to "expired"; the name, email and phone stay stored.
       To meet the storage-limitation wording in Sections 6 and 7, add
       anonymisation of expired entries (as the booking retention job does),
       or change the wording.
     - The data-subject access/erasure tool covers bookings only. Waitlist and
       testimonial requests are handled by hand in the admin panel.
-->

# Data Protection Policy

**Malta Food Experience** -- operated by [COMPANY LEGAL NAME] ("Malta Food Agency", "we", "us", "our")

Last updated: [DATE]

This policy explains what personal data we collect when you book an experience, join a waitlist, or otherwise deal with us; why we collect it; how long we keep it; who we share it with; and the rights you have. We process personal data in line with the EU General Data Protection Regulation (GDPR) and the Maltese Data Protection Act (Cap. 586).

---

## 1. Who we are (Data Controller)

The data controller responsible for your personal data is:

| | |
| --- | --- |
| **Company** | [COMPANY LEGAL NAME], trading as Malta Food Agency |
| **Registered address** | [REGISTERED ADDRESS] |
| **Company registration no.** | [COMPANY REGISTRATION NUMBER] |
| **Email** | [PRIVACY CONTACT EMAIL] |
| **Telephone** | [TELEPHONE NUMBER] |

**Data Protection Officer (DPO) / privacy contact:** [DPO NAME], [DPO EMAIL], [DPO POSTAL ADDRESS]

---

## 2. Whose data this policy covers

- **Customers and attendees** -- people who book an experience, and the lead attendee named on a booking.
- **Waitlist subscribers** -- people who ask to be told when seats become available for a fully booked experience.
- **Website visitors** -- including people who use our contact form or submit a testimonial.
- **Staff users** -- our administrators and door staff who use the booking system.

---

## 3. What personal data we collect

| Category | Data | Where it comes from |
| --- | --- | --- |
| **Identity and contact** | Name of the lead attendee, email address, phone number (optional) | You, when you book or join a waitlist |
| **Booking details** | Experience and date booked, number of persons, booking reference, language preference, any coupon code used, acceptance of our Terms & Conditions | You, when you book |
| **Dietary requirements** | Free-text dietary notes (optional) | You, only if you choose to give them and explicitly consent (see Section 5) |
| **Payment references** | Amount paid, payment status, refund status, and the payment provider's order and transaction references | Our payment provider |
| **Attendance** | Check-in time at the event, and which staff member checked you in | Our door staff, when you arrive |
| **Waitlist** | Name, email, phone (optional), number of persons, the experience you are waiting for, and the dates you joined, were notified, booked, or left the waitlist | You, when you join a waitlist |
| **Enquiries** | Name, email address and your message | You, via the contact form |
| **Testimonials** | Your name and testimonial text | You, if you submit a testimonial |
| **Staff accounts** | Name, email, role, password (stored only as a salted hash), two-factor authentication settings | Our staff |
| **Security and audit logs** | Records of actions taken by staff in the booking system, with the IP address and browser details of the device used | Generated automatically |

**We never see or store your card details.** Card payments are entered directly on our payment provider's secure page (see Section 8).

---

## 4. Why we use your data and our legal bases

| Purpose | Legal basis (GDPR) |
| --- | --- |
| Taking and managing your booking: confirming it, emailing your confirmation and QR check-in code, checking you in on the day, handling changes, cancellations and refunds | **Performance of a contract** (Art. 6(1)(b)) |
| Taking payment and preventing payment fraud | **Performance of a contract** (Art. 6(1)(b)) and our **legitimate interest** in preventing fraud (Art. 6(1)(f)) |
| Keeping financial records of transactions | **Legal obligation** under Maltese tax and accounting law (Art. 6(1)(c)) |
| Catering for your dietary requirements | Your **explicit consent** (Art. 9(2)(a)) -- see Section 5 |
| Telling you when seats become available for an experience you are waiting for | Our **legitimate interest** in filling cancelled seats with people who have asked to hear about them (Art. 6(1)(f)) -- see Section 6 |
| Sending you marketing communications, only if you have opted in | Your **consent** (Art. 6(1)(a)) |
| Replying to your enquiries | Our **legitimate interest** in answering the people who contact us (Art. 6(1)(f)), or steps you ask us to take before booking (Art. 6(1)(b)) |
| Publishing your testimonial | Your **consent** (Art. 6(1)(a)) |
| Keeping the booking system secure: staff access control, audit logs, rate limiting | Our **legitimate interest** in protecting your data and our systems (Art. 6(1)(f)) |
| Managing staff access to the booking system | **Performance of a contract** with our staff (Art. 6(1)(b)) and our **legitimate interest** (Art. 6(1)(f)) |

Where we rely on legitimate interest, we have weighed our interest against your rights and expectations. You can object at any time (see Section 10).

We do **not** use your personal data for automated decision-making or profiling that has legal or similarly significant effects on you.

---

## 5. Dietary requirements (special category data)

Dietary notes can reveal information about your health (for example, allergies or coeliac disease) or your religious beliefs. The GDPR treats this as **special category data**. We therefore:

- only collect dietary notes if you choose to give them **and** tick the explicit consent box when booking;
- only use them to cater for you at the experience you booked;
- only show them to the staff who need them to prepare and serve your meal;
- delete them together with the other personal details of your booking (see Section 7), or sooner if you withdraw your consent.

You can withdraw your consent at any time by contacting us (Section 14). Withdrawing consent does not affect the rest of your booking, although we may then be unable to cater for your requirements.

---

## 6. Waitlist

**Purpose.** If an experience is fully booked, you can join its waitlist. We use your details only to tell you when seats become available for that experience.

**Legal basis.** Our legitimate interest in offering freed-up seats to people who have asked to hear about them (Art. 6(1)(f)).

**What happens to your entry:**

- When a seat becomes available, we email the next person on the waitlist.
- If you then book the experience, your waitlist entry is closed automatically and you will not be notified again.
- Our staff may archive waitlist entries, for example once an experience has taken place. Archived entries are no longer used for notifications.
- **Retention.** Waitlist entries are kept for a limited period, which we set in our booking system (currently [6] months from the date you joined; it can be set between 1 and 36 months). After that period, your entry is automatically expired and taken off the waitlist.

**Opting out.** You can ask to be removed from a waitlist at any time through our [contact form](/contact) or by emailing [PRIVACY CONTACT EMAIL]. We will remove your entry and stop contacting you about it.

---

## 7. How long we keep your data

We keep personal data only for as long as we need it for the purposes above.

| Data | How long we keep it |
| --- | --- |
| **Booking records** (reference, experience, amount paid, payment references) | **6 years** after the transaction, to meet our tax and accounting obligations under Maltese law |
| **Personal details within bookings** (name, email, phone) | Removed automatically (anonymised) **24 months after the date of the experience**. Unpaid or abandoned bookings: after **90 days**. After this, the booking record kept for accounting no longer identifies you. |
| **Dietary notes** | Kept with the booking and removed at the same time as its personal details (24 months after the experience), or sooner if you withdraw your consent |
| **Waitlist entries** | Configurable in our booking system: **default 6 months** from the date you joined (minimum 1, maximum 36 months), after which the entry is automatically expired |
| **Audit and security logs** | **2 years** |
| **Staff accounts** | For the duration of employment or engagement, plus **1 year** |
| **Contact form enquiries** | Delivered to our team by email and not stored in the booking system. Kept in our mailbox for [RETENTION PERIOD FOR ENQUIRIES]. |
| **Testimonials** | Published testimonials: until you ask us to remove them. Testimonials we do not publish: your name is removed after **30 days**. |

When we delete or anonymise data, it is removed from our live systems. Backups are overwritten on a rolling schedule of [BACKUP RETENTION PERIOD].

---

## 8. Who we share your data with

We do not sell your personal data. We share it only with service providers (processors) who help us run our service. They act on our instructions under data processing agreements and must keep your data secure.

| Provider | What they do for us | Location of processing |
| --- | --- | --- |
| **Viva Wallet** (Viva Payments S.A.) | Processes card payments and refunds. Your card details go directly to Viva Wallet, never to us. | European Economic Area (EEA) |
| **Stripe** | Processed payments for bookings made before we moved to Viva Wallet. We keep only the payment references for those bookings. | [EEA / United States] |
| **Microsoft Azure** | Hosts our website, booking system and database | [AZURE REGION, e.g. EU (West Europe)] |
| **Cloudflare** | Domain name (DNS), content delivery and website security, including bot protection on the booking form where enabled | Global network; [TRANSFER SAFEGUARD] |
| **Resend** | Sends our transactional emails: booking confirmations, waitlist notifications, and contact form messages to our team | [REGION]; [TRANSFER SAFEGUARD] |
| **Payload CMS** | The application framework our booking system is built on. It is open-source software that we run on our own hosting; its developers do not receive or process your personal data. | Our own hosting (see Microsoft Azure) |

**Google Translate.** Our website offers an optional translation feature provided by Google. It only loads if you choose to translate a page and accept the relevant cookies. When active, Google receives the page content and your IP address. See our [Cookie Policy](/legal/cookie-policy) and Google's privacy policy.

**Transfers outside the EEA.** Where a provider processes data outside the EEA, we make sure your data is protected by appropriate safeguards, such as the European Commission's Standard Contractual Clauses or the EU-US Data Privacy Framework. You can ask us for details (Section 14).

We may also disclose personal data where the law requires it, for example to tax authorities, or to establish or defend legal claims.

---

## 9. How we protect your data

- **Encryption in transit:** all traffic to our website and booking system uses HTTPS.
- **Encryption at rest:** our database and file storage are encrypted at rest on Microsoft Azure.
- **Role-based access control:** staff only see what their role needs. Door staff can view and check in bookings; payments, refunds, settings and customer data management are restricted to administrators.
- **Secure sign-in:** staff sign in with a password (stored only as a salted hash) and a secure, HTTP-only session cookie. No login tokens are kept in browser storage.
- **Multi-factor authentication (MFA):** mandatory for all administrator accounts.
- **Audit logging:** actions taken by staff in the booking system are logged with who did what and when.
- **Rate limiting:** booking, coupon and check-in functions are protected against automated abuse.
- **Data minimisation:** we only ask for what we need. Dietary notes are optional and consent-based. Your QR check-in code is stored only in a one-way (hashed) form. Personal details are anonymised automatically at the end of their retention period.

---

## 10. Your rights

Under the GDPR you have the following rights:

| Right | What it means | How we handle it |
| --- | --- | --- |
| **Access** | Get a copy of the personal data we hold about you | We search our records by your email address and send you a copy of your booking and other data |
| **Rectification** | Have inaccurate or incomplete data corrected | We correct your booking details (for example, name, email or phone) |
| **Erasure** ("right to be forgotten") | Have your data deleted | We delete or anonymise your personal details (name, email, phone, dietary notes). We may keep the anonymised financial record where the law requires it (Section 7). |
| **Restriction** | Ask us to limit how we use your data | We mark your data so that it is kept but not otherwise used, for example by archiving a waitlist entry |
| **Portability** | Receive the data you gave us in a machine-readable format | We provide it as a CSV file |
| **Objection** | Object to processing based on our legitimate interests | For example, we remove you from a waitlist. You can unsubscribe from marketing at any time. |
| **Withdraw consent** | Withdraw consent you have given (dietary notes, marketing, testimonials) | We stop that processing from then on. This does not affect processing already carried out. |

**How to exercise your rights.** Contact us using the details in Section 14. We will respond within **one month**. For complex or numerous requests we may extend this by up to two further months, and we will tell you if we do. Exercising your rights is free of charge. We may ask you to confirm your identity before acting on a request, to protect your data.

---

## 11. Cookies

We use strictly necessary cookies to run the website and booking system (for example, to keep staff signed in). Optional cookies, such as those set by Google Translate, are only used with your consent, which you give or refuse through our cookie banner. See our [Cookie Policy](/legal/cookie-policy) for details.

---

## 12. Data breaches

If a personal data breach occurs, we will:

1. **Contain** the breach and limit its effects as quickly as possible.
2. **Assess** the risk it poses to the people affected.
3. **Notify the supervisory authority** (the Information and Data Protection Commissioner) **within 72 hours** of becoming aware of the breach, unless it is unlikely to result in a risk to your rights and freedoms.
4. **Notify you without undue delay** if the breach is likely to result in a high risk to your rights and freedoms, explaining what happened and what you can do to protect yourself.
5. **Record** every breach, including its effects and the action taken, in our internal breach register.

Our processors are contractually required to tell us about any breach affecting our data without undue delay.

---

## 13. Supervisory authority

If you are unhappy with how we handle your personal data, please contact us first so we can try to resolve the issue. You also have the right to lodge a complaint with the Maltese supervisory authority:

**Information and Data Protection Commissioner (IDPC)**
Website: [idpc.org.mt](https://idpc.org.mt)

If you live or work in another EU/EEA country, you can also complain to the supervisory authority there.

---

## 14. Contact us

For any question about this policy, or to exercise your rights:

- **Email:** [PRIVACY CONTACT EMAIL]
- **Post:** [COMPANY LEGAL NAME], [REGISTERED ADDRESS]
- **Data Protection Officer:** [DPO NAME], [DPO EMAIL]

---

## 15. Changes to this policy

We may update this policy from time to time, for example when we change how we process personal data or when the law changes. The "Last updated" date at the top shows when it was last revised. If we make significant changes, we will tell you by email or through a notice on our website.
