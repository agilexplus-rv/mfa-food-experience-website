import type { Metadata } from 'next'

import { listVisibleServices } from '@/lib/services/queries'
import { ExperienceRow } from '@/components/services/ExperienceRow'
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
        <div className="mt-14 flex flex-col gap-8">
          {services.map((s, i) => (
            <ExperienceRow
              key={s.id}
              name={s.name}
              slug={s.slug}
              description={s.description}
              imageryUrl={s.imageryUrl}
              imageryAlt={s.imageryAlt}
              index={i}
            />
          ))}
        </div>
      )}
    </section>
  )
}
