import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { renderConfirmationEmailHtml, renderConfirmationSubject } from './confirmation-template'
import { qrTokenToDataUri } from '@/lib/qr/render'
import { serverUrl } from '@/lib/env'
import { getTermsAndConditions } from '@/lib/policies/terms'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

export interface SendConfirmationEmailInput {
  toEmail: string
  reference: string
  eventTitle: string
  eventDate: string
  eventTimeRange: string
  locationRef: string
  persons: number
  totalAmount: number
  language: 'en' | 'mt'
  rawQrToken: string
}

/**
 * Send the booking confirmation email via Payload's configured
 * nodemailer transport (payload.config.ts). Uses Payload's Local API
 * `sendEmail` so we reuse the already-configured transport/from
 * address rather than instantiating a second nodemailer client.
 *
 * @compliance FR-4.5, FR-4.6, NFR-1/NFR-2 -- ADR-004
 */
export async function sendConfirmationEmail(input: SendConfirmationEmailInput): Promise<void> {
  const qrDataUri = await qrTokenToDataUri(input.rawQrToken)
  // Include the T&Cs in the email: the admin's short email summary when
  // set, otherwise the full text. Best-effort -- never block the email.
  const terms = await getTermsAndConditions().catch(() => null)
  const termsHtml = terms?.emailSummary
    ? `<p style="margin:0;white-space:pre-line;">${escapeHtml(terms.emailSummary)}</p>`
    : terms?.html || undefined
  const html = renderConfirmationEmailHtml({
    reference: input.reference,
    eventTitle: input.eventTitle,
    eventDate: input.eventDate,
    eventTimeRange: input.eventTimeRange,
    locationRef: input.locationRef,
    persons: input.persons,
    totalAmount: input.totalAmount,
    language: input.language,
    qrDataUri,
    cancellationPolicyUrl: `${serverUrl()}/legal/cancellation-policy`,
    termsAndConditionsUrl: `${serverUrl()}/legal/terms-and-conditions`,
    termsTitle: terms?.title,
    termsHtml,
  })
  const subject = renderConfirmationSubject(input.reference, input.language)

  const p = await payload()
  try {
    await p.sendEmail({
      to: input.toEmail,
      subject,
      html,
    })
  } catch (err) {
    // The demo environment has no real SMTP credentials (payload.config.ts
    // sets skipVerify: true for exactly this reason). We must not let a
    // failed email delivery break booking confirmation -- the booking is
    // already confirmed and paid; email is best-effort. Log loudly so
    // it's visible in Vercel logs / local console.
    console.error('[booking/email] Failed to send confirmation email:', err)
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
