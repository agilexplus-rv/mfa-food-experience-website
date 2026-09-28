import type { GlobalConfig } from 'payload'
import { globalAuditHook } from '@/lib/audit/helper'
import { buildDefaultDataProtectionLexical } from '@/lib/policies/dataProtectionDefault'

/**
 * DataProtectionPolicy — Payload Global (single-document, admin-editable).
 *
 * The canonical Data Protection Policy: what personal data we collect, why,
 * how long we keep it, who we share it with, and people's rights over it.
 * Edited in the console under Settings → Data Protection Policy
 * (/console/settings/data-protection-policy).
 */
export const DataProtectionPolicy: GlobalConfig = {
  slug: 'data-protection-policy',
  access: {
    read: () => true,
    update: ({ req: { user } }) =>
      (user as { role?: string } | null)?.role === 'admin',
  },
  hooks: {
    afterChange: [globalAuditHook('data-protection-policy', 'data protection policy')],
  },
  admin: {
    group: 'Content',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      defaultValue: 'Data Protection Policy',
    },
    {
      name: 'body',
      type: 'richText',
      label: 'Policy content',
      required: true,
      // Drafted policy (src/lib/policies/dataProtectionDefault.ts), served
      // until the policy is first saved.
      defaultValue: buildDefaultDataProtectionLexical(),
    },
  ],
}
