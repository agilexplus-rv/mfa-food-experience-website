'use client'

import { useActionState } from 'react'
import { submitContact, type ContactSubmissionResult } from './actions'

const initialState: ContactSubmissionResult | undefined = undefined

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, initialState)

  return (
    <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
      <h2 className="text-2xl font-bold tracking-tight text-lunar-green">
        Send a message
      </h2>
      <p className="mt-2 text-sm text-text-light">
        Fields marked with <span aria-hidden="true" className="text-terracotta">*</span> are required.
      </p>

      <form action={formAction} className="mt-6 space-y-5">
        {/* Name */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-semibold text-lunar-green"
          >
            Name <span aria-hidden="true" className="text-terracotta">*</span>
            <span className="sr-only">required</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            autoComplete="name"
            aria-required="true"
            className="mt-2 block w-full rounded-lg border border-border bg-soft-beige/40 px-4 py-3 text-base text-lunar-green placeholder:text-text-light/60 focus:border-terracotta focus:outline-2 focus:outline-offset-1 focus:outline-terracotta"
            placeholder="Your full name"
          />
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-semibold text-lunar-green"
          >
            Email <span aria-hidden="true" className="text-terracotta">*</span>
            <span className="sr-only">required</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            autoComplete="email"
            aria-required="true"
            className="mt-2 block w-full rounded-lg border border-border bg-soft-beige/40 px-4 py-3 text-base text-lunar-green placeholder:text-text-light/60 focus:border-terracotta focus:outline-2 focus:outline-offset-1 focus:outline-terracotta"
            placeholder="you@example.com"
          />
        </div>

        {/* Message */}
        <div>
          <label
            htmlFor="message"
            className="block text-sm font-semibold text-lunar-green"
          >
            Message <span aria-hidden="true" className="text-terracotta">*</span>
            <span className="sr-only">required</span>
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={5}
            aria-required="true"
            className="mt-2 block w-full resize-y rounded-lg border border-border bg-soft-beige/40 px-4 py-3 text-base text-lunar-green placeholder:text-text-light/60 focus:border-terracotta focus:outline-2 focus:outline-offset-1 focus:outline-terracotta"
            placeholder="How can we help?"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-terracotta px-6 py-3.5 text-base font-bold text-soft-beige transition-colors hover:bg-terracotta/85 focus:outline-2 focus:outline-offset-2 focus:outline-terracotta disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {pending ? 'Sending…' : 'Send message'}
          {!pending && <span aria-hidden="true">&rarr;</span>}
        </button>
      </form>

      {state && (
        <p
          role="status"
          aria-live="polite"
          className={
            'mt-6 rounded-md border-l-4 px-4 py-3 text-sm font-semibold ' +
            (state.ok
              ? 'border-lunar-green bg-lunar-green/10 text-lunar-green'
              : 'border-terracotta bg-terracotta/10 text-terracotta')
          }
        >
          {state.message}
        </p>
      )}
    </div>
  )
}
