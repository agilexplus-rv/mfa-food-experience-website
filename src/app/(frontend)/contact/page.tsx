import type { Metadata } from 'next'
import { Logo } from '@/components/brand/Logo'

export const metadata: Metadata = {
  title: 'Contact — Malta Food Experience',
  description:
    'Get in touch with the Malta Food Agency. Find us at Pitkali Road, Ta\u2019 Qali, Attard, or send us a message using the contact form.',
}

/**
 * OpenStreetMap embed for the Malta Food Agency facility.
 *
 * No API key required — this uses the free openstreetmap.org export embed
 * endpoint. Coordinates: Pitkali Road, Ta' Qali, Attard (approx. 35.8917, 14.4022).
 * The bbox is a tight box around the facility so the marker is centred.
 */
const OSM_EMBED_URL =
  'https://www.openstreetmap.org/export/embed.html?bbox=14.396%2C35.888%2C14.408%2C35.895&layer=mapnik&marker=35.8917%2C14.4022'
const OSM_LINK_URL =
  'https://www.openstreetmap.org/?mlat=35.8917&mlon=14.4022#map=16/35.8917/14.4022'

/**
 * Contact page.
 *
 * Two-column layout (desktop) collapsing to stacked (mobile):
 *  - Left: accessible contact form (name, email, message) with required fields.
 *  - Right: address block + embedded OpenStreetMap iframe.
 *
 * The form is a styled static form for now (Phase 1.4). Submission wiring is
 * Phase 2 — the POST handler stub in src/app/contact/actions.ts receives the
 * data and logs it; real delivery (email/Payload) comes later.
 */
export default function ContactPage() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <header className="mx-auto max-w-2xl text-center">
        <Logo variant="primary" size="sm" className="!p-0 mx-auto" />
        <h1 className="mt-4 text-4xl font-black tracking-[-0.02em] text-lunar-green sm:text-5xl">
          Contact Us
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-text-light">
          We&apos;d love to hear from you. Send us a message or visit us at our
          Ta&apos; Qali facility.
        </p>
      </header>

      <div className="mt-14 grid gap-10 lg:grid-cols-2">
        {/* Contact form */}
        <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight text-lunar-green">
            Send a message
          </h2>
          <p className="mt-2 text-sm text-text-light">
            Fields marked with <span aria-hidden="true" className="text-terracotta">*</span> are required.
          </p>

          {/*
            Static form posts to the current URL. The server action stub
            (src/app/contact/actions.ts) is the intended target once submission
            is wired in Phase 2. For now this renders an accessible,
            brand-styled form with a note about the pending wiring.
          */}
          <form action="/contact" method="post" className="mt-6 space-y-5">
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-terracotta px-6 py-3.5 text-base font-bold text-soft-beige transition-colors hover:bg-terracotta/85 focus:outline-2 focus:outline-offset-2 focus:outline-terracotta sm:w-auto"
            >
              Send message
              <span aria-hidden="true">&rarr;</span>
            </button>
          </form>

          <p className="mt-6 rounded-md border-l-4 border-matte-gold bg-soft-beige/60 px-4 py-3 text-sm font-semibold italic text-text-light">
            Contact content — to be supplied by client. Form submission is
            wired in Phase 2.
          </p>
        </div>

        {/* Address + map */}
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
            <h2 className="text-2xl font-bold tracking-tight text-lunar-green">
              Find us
            </h2>
            <address className="mt-4 text-lg leading-relaxed text-text-light not-italic">
              Malta Food Agency<br />
              Pitkali Road, Ta&apos; Qali<br />
              Attard, Malta
            </address>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <iframe
              title="Map showing the Malta Food Agency facility at Pitkali Road, Ta' Qali, Attard"
              src={OSM_EMBED_URL}
              loading="lazy"
              className="h-80 w-full border-0"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="px-4 py-3 text-center">
              <a
                href={OSM_LINK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-terracotta underline-offset-2 hover:underline focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
              >
                View larger map
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
