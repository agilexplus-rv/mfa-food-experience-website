import { getPayload } from 'payload'
import config from '@payload-config'

import { richTextToHtml } from '@/lib/richtext'
import { buildDefaultDataProtectionHtml } from '@/lib/policies/dataProtectionDefault'

export interface DataProtectionPolicyContent {
  title: string
  /** Full policy rendered to HTML (the drafted default when the Global body is empty). */
  html: string
}

/**
 * Fetch the DataProtectionPolicy Global, rendered for display (server-side).
 * Falls back to the drafted default when the Global body is empty or
 * the Global cannot be read.
 */
export async function getDataProtectionPolicy(): Promise<DataProtectionPolicyContent> {
  let doc: {
    title?: string | null
    body?: unknown
  } = {}
  try {
    const payload = await getPayload({ config })
    doc = (await payload.findGlobal({ slug: 'data-protection-policy' })) as unknown as typeof doc
  } catch {
    // Global unavailable (e.g. before migration): serve the drafted default.
  }
  return {
    title: doc.title?.trim() || 'Data Protection Policy',
    html: richTextToHtml(doc.body) || buildDefaultDataProtectionHtml(),
  }
}