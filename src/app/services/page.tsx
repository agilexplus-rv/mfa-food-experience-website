import type { Metadata } from 'next'
import Link from 'next/link'

import { listVisibleServices } from '@/lib/services/queries'
import { Logo } from '@/components/brand/Logo'

export const metadata: Metadata = {
  title: 'Experiences — Malta Food Experience',
  description:
    'Browse all current Malta Food Experience offerings — hands-on classes and guided tastings hosted by the Malta Food Agency.',
}

export const revalidate = 60
// Always render fresh so newly published services appear.
export const dynamic = 'force-dynamic'

export default async function ServicesIndexPage() {
  const services = await listVisibleServices()

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <header className="mx-auto max-w-2xl text-center">
        <Logo variant="primary" size="sm" className="!p-0 mx-auto" />
        <h1 className="mt-4 text-4xl font-black tracking-[-0.02em] text-lunar-green sm:text-5xl">
          Our Experiences
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-text-light">
          Hands-on classes and guided tastings celebrating Maltese cuisine and
          culture. Pick an experience to see upcoming dates and book your seat.
        </p>
      </header>

      {services.length === 0 ? (
        <div className="mx-auto mt-16 max-w-xl rounded-xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center">
          <p className="text-lg font-semibold text-lunar-green">
            Experiences coming soon
          </p>
          <p className="mt-2 text-sm text-text-light">
            We&apos;re preparing our calendar. Please check back shortly.
          </p>
        </div>
      ) : (
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Link
              key={s.id}
              href={`/services/${s.slug}`}
              className="group flex flex-col items-start rounded-xl border border-border bg-surface p-8 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-matte-gold">
                Experience
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-lunar-green group-hover:text-terracotta">
                {s.name}
              </h2>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-bold text-terracotta">
                View upcoming dates
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                  &rarr;
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
