'use client'

import { useActionState } from 'react'

import type { TestimonialSubmissionResult } from '@/app/(frontend)/testimonials/actions'
import { submitTestimonial } from '@/app/(frontend)/testimonials/actions'

export interface EventOption {
  id: string
  title: string
}

export interface TestimonialFormProps {
  /** Visible events to show in the optional select dropdown. */
  events: EventOption[]
}

const initialState: TestimonialSubmissionResult = { ok: false, message: '' }

/**
 * Client-side testimonial submission form wired to the server action
 * via `useActionState` (FR-8).
 *
 * Fields: name (required), text (required), optional event select.
 * Accessible labels, required indicators, brand styling mirroring the
 * contact form. Shows success/error feedback and disables submit while
 * the action is pending.
 */
export function TestimonialForm({ events }: TestimonialFormProps) {
  const [result, formAction, pending] = useActionState(
    submitTestimonial,
    initialState,
  )

  const inputClass =
    'mt-2 block w-full rounded-lg border border-border bg-soft-beige/40 px-4 py-3 text-base text-lunar-green placeholder:text-text-light/60 focus:border-terracotta focus:outline-2 focus:outline-offset-1 focus:outline-terracotta'
  const labelClass = 'block text-sm font-semibold text-lunar-green'
  const requiredAsterisk = (
    <>
      {' '}
      <span aria-hidden="true" className="text-terracotta">
        *
      </span>
      <span className="sr-only">required</span>
    </>
  )

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {/* Name */}
      <div>
        <label htmlFor="testimonial-name" className={labelClass}>
          Name
          {requiredAsterisk}
        </label>
        <input
          type="text"
          id="testimonial-name"
          name="name"
          required
          maxLength={100}
          autoComplete="name"
          aria-required="true"
          className={inputClass}
          placeholder="Your name"
        />
      </div>

      {/* Testimonial text */}
      <div>
        <label htmlFor="testimonial-text" className={labelClass}>
          Your testimonial
          {requiredAsterisk}
        </label>
        <textarea
          id="testimonial-text"
          name="text"
          required
          rows={4}
          maxLength={1000}
          aria-required="true"
          className={`${inputClass} resize-y`}
          placeholder="Share your experience\u2026"
        />
        <p className="mt-1 text-right text-xs text-text-light/70">
          Max 1&thinsp;000 characters
        </p>
      </div>

      {/* Optional event */}
      <div>
        <label htmlFor="testimonial-event" className={labelClass}>
          Event (optional)
        </label>
        {events.length > 0 ? (
          <select
            id="testimonial-event"
            name="event"
            className={inputClass}
          >
            <option value="">Select an event&hellip;</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            id="testimonial-event"
            name="event"
            className={inputClass}
            placeholder="e.g. Seafood Festival 2025"
          />
        )}
      </div>

      {/* Feedback */}
      {result?.message && (
        <div
          role="alert"
          className={`rounded-md border-l-4 px-4 py-3 text-sm font-semibold ${
            result.ok
              ? 'border-lunar-green bg-soft-beige/60 text-lunar-green'
              : 'border-terracotta bg-soft-beige/60 text-terracotta'
          }`}
        >
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-terracotta px-6 py-3.5 text-base font-bold text-soft-beige transition-colors hover:bg-terracotta/85 focus:outline-2 focus:outline-offset-2 focus:outline-terracotta disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? 'Submitting\u2026' : 'Submit testimonial'}
        <span aria-hidden="true">&rarr;</span>
      </button>
    </form>
  )
}
