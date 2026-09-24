import type { Metadata } from 'next'
import { Logo } from '@/components/brand/Logo'

export const metadata: Metadata = {
  title: 'About — Malta Food Experience',
  description:
    'Learn about the Malta Food Agency and the Maltese Food Experience — our mission, our team, and our commitment to authentic Maltese culinary and cultural experiences.',
}

/**
 * About page.
 *
 * Rich-text content area styled in the MFA brand. Per URD FR-7.3, copy is
 * placeholder-tolerant: every section is clearly marked so the client can
 * replace it without touching layout.
 *
 * Submission wiring / CMS connection is Phase 2 — for now this is a static,
 * brand-styled page that renders as a Server Component.
 */
export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <header className="text-center">
        <Logo variant="primary" size="sm" className="!p-0 mx-auto" />
        <h1 className="mt-4 text-4xl font-black tracking-[-0.02em] text-lunar-green sm:text-5xl">
          About Us
        </h1>
        <div className="mx-auto mt-6 h-px w-24 bg-matte-gold/50" aria-hidden="true" />
      </header>

      <div className="mt-12 space-y-10 text-lunar-green">
        {/* NOTE: All copy below is placeholder per URD FR-7.3 — to be supplied by client. */}
        <p className="rounded-md border-l-4 border-matte-gold bg-soft-beige/60 px-4 py-3 text-sm font-semibold italic text-text-light">
          About content — to be supplied by client.
        </p>

        {/* Mission */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight text-lunar-green">
            Our Mission
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-text-light">
            The Malta Food Agency exists to celebrate and share the authentic
            flavours of Malta. Through hands-on classes, guided tastings, and
            cultural experiences, we connect residents and visitors with the
            island&apos;s rich culinary heritage — from traditional recipes
            passed down through generations to the producers who keep them
            alive today.
          </p>
        </section>

        {/* Who we are */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight text-lunar-green">
            Who We are
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-text-light">
            The Malta Food Experience is operated by the Malta Food Agency from
            our facility at Pitkali Road, Ta&apos; Qali, in the heart of Malta.
            Our team brings together chefs, producers, and cultural guides
            passionate about Maltese food and hospitality.
          </p>
        </section>

        {/* What we offer */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight text-lunar-green">
            What we offer
          </h2>
          <ul className="mt-4 space-y-3 text-lg leading-relaxed text-text-light">
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-terracotta" />
              <span>
                Hands-on cooking classes led by local chefs, covering
                traditional Maltese dishes and techniques.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-terracotta" />
              <span>
                Guided tastings of Maltese wines, olive oils, cheeses, and
                other regional specialities.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-terracotta" />
              <span>
                Cultural experiences that pair food with the stories, places,
                and people behind it.
              </span>
            </li>
          </ul>
        </section>

        {/* Visit us */}
        <section className="rounded-xl border border-border bg-surface px-6 py-8">
          <h2 className="text-2xl font-bold tracking-tight text-lunar-green">
            Visit us
          </h2>
          <address className="mt-4 text-lg leading-relaxed text-text-light not-italic">
            Malta Food Agency<br />
            Pitkali Road, Ta&apos; Qali<br />
            Attard, Malta
          </address>
          <p className="mt-4 text-sm text-text-light">
            See the <a href="/contact" className="font-semibold text-terracotta underline-offset-2 hover:underline focus:outline-2 focus:outline-offset-2 focus:outline-terracotta">Contact page</a> for a map and enquiry form.
          </p>
        </section>
      </div>
    </article>
  )
}
