'use server'

import { getPayload } from 'payload'
import config from '@payload-config'

import { createRateLimiter } from '@/lib/rate-limit'
import { adminAlertEmail } from '@/lib/env'
import { headers } from 'next/headers'

/**
 * Contact form submission handler.
 *
 * Wired per Rudie's 2026-07-11 direction: email-only delivery, no
 * database storage / console inbox. A visitor's message is forwarded
 * via Payload's already-configured nodemailer transport
 * (payload.config.ts) to ADMIN_ALERT_EMAIL (falls back to FROM_EMAIL
 * if unset -- both already-established env vars, see src/lib/env.ts's
 * adminAlertEmail() and payload.config.ts's defaultFromAddress).
 * Replies happen from whichever inbox receives it, using the
 * visitor's own email as the Reply-To -- there is no in-app
 * reply/send feature and no stored record of the submission.
 */
export interface ContactSubmissionResult {
  ok: boolean
  message: string
}

// 60s window, 5 submissions/min per IP -- a real visitor submits once;
// generous enough for a legitimate retry after a validation error,
// tight enough to blunt a scripted flood of the contact inbox.
const rateLimiter = createRateLimiter({ windowMs: 60_000, max: 5 })

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Resolve the contact-form recipient list: admin-configurable via the
 * SiteSettings global's `contactFormRecipients` field (one or more
 * addresses, semicolon-separated), falling back to the
 * ADMIN_ALERT_EMAIL / FROM_EMAIL env-var convention (adminAlertEmail())
 * when unset or the global is unavailable (mirrors SiteFooter.tsx's
 * graceful-degradation pattern for the social-media-settings global).
 */
async function resolveContactRecipients(): Promise<string | string[]> {
  const fallback = adminAlertEmail() || process.env.FROM_EMAIL || 'noreply@foodagency.mt'
  try {
    const payload = await getPayload({ config })
    const settings = await payload.findGlobal({
      slug: 'site-settings',
      overrideAccess: true,
    })
    const raw = (settings as { contactFormRecipients?: string | null }).contactFormRecipients
    if (!raw || !raw.trim()) return fallback

    const addresses = raw
      .split(';')
      .map((a) => a.trim())
      .filter(Boolean)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const valid = addresses.filter((a) => emailPattern.test(a))

    if (valid.length === 0) return fallback
    return valid.length === 1 ? valid[0] : valid
  } catch {
    // Global unavailable (e.g. before migration) -- fall back silently.
    return fallback
  }
}

export async function submitContact(
  _prevState: ContactSubmissionResult | undefined,
  formData: FormData,
): Promise<ContactSubmissionResult> {
  rateLimiter.maybeCleanup()

  const hdrs = await headers()
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    hdrs.get('x-real-ip') ||
    'unknown'
  if (!rateLimiter.check(ip)) {
    return {
      ok: false,
      message: 'Too many messages sent recently. Please try again in a minute.',
    }
  }

  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const message = String(formData.get('message') ?? '').trim()

  if (!name || !email || !message) {
    return {
      ok: false,
      message: 'Please fill in all required fields.',
    }
  }

  // Basic email shape check -- the HTML input already has type="email"
  // client-side, but a Server Action must not trust that.
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailPattern.test(email)) {
    return {
      ok: false,
      message: 'Please enter a valid email address.',
    }
  }

  const toEmail = await resolveContactRecipients()

  const html =
    '<div style="font-family:Montserrat,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#F9F4EF;border-radius:12px">' +
    '<h1 style="color:#33483D;font-size:1.25rem;margin:0 0 16px">New contact form message</h1>' +
    '<p style="color:#33483D;line-height:1.6;margin:0 0 4px"><strong>Name:</strong> ' + escapeHtml(name) + '</p>' +
    '<p style="color:#33483D;line-height:1.6;margin:0 0 16px"><strong>Email:</strong> ' + escapeHtml(email) + '</p>' +
    '<div style="background:#FFFFFF;border-radius:8px;padding:16px;color:#33483D;line-height:1.6;white-space:pre-wrap">' + escapeHtml(message) + '</div>' +
    '<hr style="border:none;border-top:1px solid #D4C8B8;margin:24px 0">' +
    '<p style="color:#6B7F74;font-size:0.75rem">Sent via the Malta Food Experience website contact form.</p>' +
    '</div>'

  try {
    const payload = await getPayload({ config })
    await payload.sendEmail({
      to: toEmail,
      replyTo: email,
      subject: `Contact form: message from ${name}`,
      html,
    })
  } catch (err) {
    // Best-effort like the booking-confirmation email path (see
    // src/lib/email/send-confirmation.ts) -- the demo environment has
    // no real SMTP credentials (skipVerify: true in payload.config.ts
    // for exactly this reason). Do not tell the visitor their message
    // sent successfully if it did not.
    console.error('[contact] Failed to send contact form email:', err)
    return {
      ok: false,
      message:
        'Sorry, something went wrong sending your message. Please try again shortly, or email us directly.',
    }
  }

  return {
    ok: true,
    message: `Thank you, ${name}. Your message has been sent — we will reply to ${email} shortly.`,
  }
}
