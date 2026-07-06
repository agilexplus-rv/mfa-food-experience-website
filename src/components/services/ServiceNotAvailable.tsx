import Link from 'next/link'

/**
 * ServiceNotAvailable — rendered when a service's `visible` flag is
 * false (FR-1.3). Replaces the event grid with a calm, on-brand
 * "not available" state instead of a 404 or a blank page.
 *
 * Keeps the URL resolvable (no redirect) so operators can flip
 * `visible` back on without link breakage.
 */
export interface ServiceNotAvailableProps {
  /** Service display name, if known. */
  serviceName?: string
}

export function ServiceNotAvailable({ serviceName }: ServiceNotAvailableProps) {
  const title = serviceName ? `${serviceName} — not available` : 'Not available'
  return (
    <section className="mx-auto max-w-2xl px-6 py-24 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-lunar-green/5">
        <span className="text-3xl" aria-hidden="true">
          &middot;
        </span>
      </div>
      <h1 className="text-3xl font-black tracking-tight text-lunar-green sm:text-4xl">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-text-light">
        This experience isn&apos;t currently on our public schedule. New dates
        are added regularly — please explore our other experiences or check
        back soon.
      </p>
      <Link
        href="/services"
        className="mt-10 inline-flex items-center gap-2 rounded-lg border border-lunar-green/30 px-6 py-3 text-base font-bold text-lunar-green transition-colors hover:bg-lunar-green/5 focus:outline-2 focus:outline-offset-2 focus:outline-lunar-green"
      >
        <span aria-hidden="true">&larr;</span>
        See all experiences
      </Link>
    </section>
  )
}
