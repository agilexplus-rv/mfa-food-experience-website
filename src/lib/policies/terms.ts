import { getPayload } from 'payload'
import config from '@payload-config'

import { richTextToHtml } from '@/lib/richtext'

export interface TermsAndConditionsContent {
  title: string
  /** Full T&Cs rendered to HTML ('' when not yet written). */
  html: string
  checkboxLabel: string
  emailSummary: string
}

/** Fetch the TermsAndConditions Global, rendered for display (server-side). */
export async function getTermsAndConditions(): Promise<TermsAndConditionsContent> {
  const payload = await getPayload({ config })
  const doc = (await payload.findGlobal({ slug: 'terms-and-conditions' })) as unknown as {
    title?: string | null
    body?: unknown
    bookingCheckboxLabel?: string | null
    emailSummary?: string | null
  }
  return {
    title: doc.title?.trim() || 'Terms & Conditions',
    html: richTextToHtml(doc.body),
    checkboxLabel: doc.bookingCheckboxLabel?.trim() || 'I have read and accept the Terms & Conditions',
    emailSummary: doc.emailSummary?.trim() || '',
  }
}
