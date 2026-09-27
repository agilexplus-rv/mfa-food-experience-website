import { getPayload } from 'payload'
import config from '@payload-config'

import { richTextToHtml } from '@/lib/richtext'
import { buildDefaultTermsHtml } from '@/lib/policies/termsDefault'

export interface TermsAndConditionsContent {
  title: string
  /** Full T&Cs rendered to HTML (the drafted default when the Global body is empty). */
  html: string
  checkboxLabel: string
  emailSummary: string
}

/**
 * Fetch the TermsAndConditions Global, rendered for display (server-side).
 * Falls back to the drafted default Terms when the Global body is empty or
 * the Global cannot be read.
 */
export async function getTermsAndConditions(): Promise<TermsAndConditionsContent> {
  let doc: {
    title?: string | null
    body?: unknown
    bookingCheckboxLabel?: string | null
    emailSummary?: string | null
  } = {}
  try {
    const payload = await getPayload({ config })
    doc = (await payload.findGlobal({ slug: 'terms-and-conditions' })) as unknown as typeof doc
  } catch {
    // Global unavailable (e.g. before migration): serve the drafted default.
  }
  return {
    title: doc.title?.trim() || 'Terms & Conditions',
    html: richTextToHtml(doc.body) || buildDefaultTermsHtml(),
    checkboxLabel: doc.bookingCheckboxLabel?.trim() || 'I have read and accept the Terms & Conditions',
    emailSummary: doc.emailSummary?.trim() || '',
  }
}
