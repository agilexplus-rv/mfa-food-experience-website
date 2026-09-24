'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

export interface TestimonialSubmissionResult {
  ok: boolean
  message: string
}

/**
 * Submit a testimonial from the public form (FR-8).
 *
 * Server-side validation, then persistence via the Payload Local API
 * with `approved: false`. Moderation by admin in the Payload dashboard.
 */
export async function submitTestimonial(
  _prevState: TestimonialSubmissionResult | undefined,
  formData: FormData,
): Promise<TestimonialSubmissionResult> {
  const name = String(formData.get('name') ?? '').trim()
  const text = String(formData.get('text') ?? '').trim()
  const eventId = String(formData.get('event') ?? '').trim()

  if (!name) {
    return { ok: false, message: 'Please enter your name.' }
  }
  if (name.length > 100) {
    return { ok: false, message: 'Name must be 100 characters or fewer.' }
  }
  if (!text) {
    return { ok: false, message: 'Please enter your testimonial.' }
  }
  if (text.length > 1000) {
    return {
      ok: false,
      message: 'Testimonial must be 1 000 characters or fewer.',
    }
  }

  try {
    const payload = await getPayload({ config })

    await payload.create({
      collection: 'testimonials',
      data: {
        name,
        text,
        event: eventId || undefined,
        approved: false,
      },
      overrideAccess: true,
    })

    return {
      ok: true,
      message: `Thank you, ${name}! Your testimonial has been submitted for moderation.`,
    }
  } catch {
    return {
      ok: false,
      message:
        'Something went wrong while submitting your testimonial. Please try again.',
    }
  }
}
