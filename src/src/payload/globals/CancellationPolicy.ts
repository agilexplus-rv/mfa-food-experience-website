import type { GlobalConfig } from 'payload'

/**
 * CancellationPolicy — Payload Global (single-document, admin-editable).
 *
 * Drives BOTH the public /legal/cancellation-policy page AND the
 * Article 16(l) / 6(1)(k) withdrawal-right disclosure surfaced in
 * the booking checkout flow.
 *
 * Per EU Consumer Rights Directive 2011/83/EU (Malta S.L. 378.17):
 * leisure services tied to a specific date are exempt from the
 * 14-day cooling-off right. The trader's own policy is the operative
 * document — this Global IS that policy.
 *
 * @at-compliance EU-Legal-3 (Cancellation Policy page)
 * @at-compliance EU-Legal-5 (pre-contractual disclosure Art. 6(1)(k))
 */
export const CancellationPolicy: GlobalConfig = {
  slug: 'cancellation-policy',
  access: {
    // Public: anyone can read — the policy page + booking disclosure need this.
    read: () => true,
    // Admin only: only admins can update the policy.
    update: ({ req: { user } }) =>
      (user as { role?: string } | null)?.role === 'admin',
  },
  admin: {
    group: 'Content',
  },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Cancellations enabled',
      defaultValue: true,
      admin: {
        description:
          'Master on/off switch. When off, all cancellation tiers are hidden and the public page + booking form will state that cancellations are not permitted.',
      },
    },
    {
      name: 'introText',
      type: 'textarea',
      label: 'Introductory text',
      admin: {
        description:
          'Optional. Free-text intro paragraph shown above the cancellation tiers table (e.g. how to submit a cancellation request).',
      },
    },
    {
      name: 'tiers',
      type: 'array',
      label: 'Cancellation tiers',
      admin: {
        description:
          'Define refund tiers. IMPORTANT: list tiers from MOST days-before to FEWEST (e.g. 14 days → 7 days → 0 days). The system uses the first matching tier when looking up a cancellation date.',
      },
      defaultValue: [
        {
          minDaysBeforeEvent: 7,
          refundPercentage: 100,
          label: '',
        },
        {
          minDaysBeforeEvent: 0,
          refundPercentage: 0,
          label: 'No refund',
        },
      ],
      fields: [
        {
          name: 'minDaysBeforeEvent',
          type: 'number',
          required: true,
          min: 0,
          label: 'If cancelled at least this many days before the event',
          admin: {
            width: '33%',
          },
        },
        {
          name: 'refundPercentage',
          type: 'number',
          required: true,
          min: 0,
          max: 100,
          label: 'Refund percentage',
          admin: {
            width: '33%',
          },
        },
        {
          name: 'label',
          type: 'text',
          label: 'Optional custom wording for this tier',
          admin: {
            width: '34%',
            description:
              'Leave blank to auto-generate (e.g. "Full refund" or "50% refund"). Fill in for custom wording (e.g. "Full refund minus 10% admin fee").',
          },
        },
      ],
    },
    {
      name: 'organiserCancellationText',
      type: 'textarea',
      label: 'What happens if THE ORGANISER cancels the event',
      admin: {
        description:
          'Optional. Separate from customer-initiated cancellation. Explains what the customer is entitled to if MFA cancels (e.g. full refund or reschedule).',
      },
    },
    {
      name: 'withdrawalRightDisclosure',
      type: 'textarea',
      label: 'Withdrawal right disclosure (Art. 16(l) / Art. 6(1)(k))',
      defaultValue:
        'Pursuant to Article 16(l) of the EU Consumer Rights Directive (Directive 2011/83/EU, transposed in Malta as the Consumer Rights Regulations, S.L. 378.17), bookings for leisure services with a specific scheduled date are exempt from the standard 14-day right of withdrawal. By booking this event, you acknowledge that the 14-day cooling-off period does not apply, and that the cancellation terms set out above govern any refund or rescheduling request.',
      admin: {
        description:
          'Legally required disclosure that the 14-day cooling-off period does not apply to scheduled leisure-service bookings. Pre-filled with the correct legal wording; edit only if legal advice confirms a change is needed.',
      },
    },
  ],
}
