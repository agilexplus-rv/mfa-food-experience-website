import type { GlobalConfig } from 'payload'

/**
 * TermsAndConditions — Payload Global (single-document, admin-editable).
 *
 * Serves as the canonical T&Cs document. Displayed:
 *  - On the /legal/terms-and-conditions page
 *  - As a mandatory acceptance checkbox on the booking form
 *  - Referenced in the booking confirmation email
 */
export const TermsAndConditions: GlobalConfig = {
  slug: 'terms-and-conditions',
  access: {
    read: () => true,
    update: ({ req: { user } }) =>
      (user as { role?: string } | null)?.role === 'admin',
  },
  admin: {
    group: 'Content',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      defaultValue: 'Terms & Conditions',
      admin: {
        description: 'Display title (shown on the public page and in the booking form).',
      },
    },
    {
      name: 'body',
      type: 'richText',
      label: 'Terms and conditions body',
      required: true,
    },
    {
      name: 'bookingCheckboxLabel',
      type: 'text',
      defaultValue: 'I have read and accept the Terms & Conditions',
      admin: {
        description: 'Label for the mandatory checkbox on the booking form.',
      },
    },
    {
      name: 'emailSummary',
      type: 'textarea',
      label: 'Short summary for confirmation email',
      admin: {
        description:
          'Brief text or link included in the booking confirmation email. If empty, a generic "View our Terms & Conditions" link will be used.',
      },
    },
  ],
}