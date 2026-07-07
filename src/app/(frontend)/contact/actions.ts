'use server'

/**
 * Contact form submission handler (STUB — Phase 1.4).
 *
 * Per the task spec, the contact form is a styled static form for now;
 * submission wiring (email delivery / Payload CMS storage) is Phase 2.
 *
 * This stub exists so that when Phase 2 wires the form to a real handler,
 * it has a documented, typed entry point to replace. Until then the form
 * posts to /contact and this action is the intended target — import it from
 * the page once the form uses a Server Action:
 *
 *   import { submitContact } from '@/app/contact/actions'
 *   <form action={submitContact}>...
 *
 * Returns a lightweight acknowledgement object the future client UI can use.
 */
export interface ContactSubmissionResult {
  ok: boolean
  message: string
}

export async function submitContact(
  _prevState: ContactSubmissionResult | undefined,
  formData: FormData,
): Promise<ContactSubmissionResult> {
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const message = String(formData.get('message') ?? '').trim()

  // Basic server-side validation mirroring the required attributes.
  if (!name || !email || !message) {
    return {
      ok: false,
      message: 'Please fill in all required fields.',
    }
  }

  // Phase 2: store via Payload and/or send notification email here.
  // For now we simply acknowledge receipt.
  return {
    ok: true,
    message: `Thank you, ${name}. Your message has been received — we will reply to ${email} shortly.`,
  }
}
