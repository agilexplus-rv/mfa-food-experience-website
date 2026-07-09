import Link from 'next/link'

export interface ExperienceRowProps {
  name: string
  slug: string
  description?: string
  imageryUrl?: string
  imageryAlt?: string
  /** 0-based index used to alternate the image side. */
  index: number
}

/**
 * ExperienceRow — a single experience in the /services list.
 *
 * Desktop: image on one side, text+CTA on the other, alternating per row.
 * Mobile: single-column stack, alternating image-above vs image-below.
 *
 * Uses only the project's brand tokens: Lunar Green, Terracotta,
 * Matte Gold, Soft Beige, Montserrat.
 */
export function ExperienceRow({
  name,
  slug,
  description,
  imageryUrl,
  imageryAlt,
  index,
}: ExperienceRowProps) {
  const imageOnLeft = index % 2 === 0

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-all duration-200 hover:shadow-md md:flex-row"
    >
      {/* IMAGE SIDE */}
      <div
        className={`relative w-full shrink-0 md:w-2/5 ${
          imageOnLeft ? 'md:order-1' : 'md:order-2'
        } ${index % 2 === 0 ? 'order-1' : 'order-2 md:order-2'}`}
      >
        {imageryUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageryUrl}
            alt={imageryAlt || name}
            className="h-56 w-full object-cover md:h-full md:min-h-[280px]"
          />
        ) : (
          <div className="flex h-56 w-full items-center justify-center bg-lunar-green/10 md:h-full md:min-h-[280px]">
            <span className="text-sm font-semibold text-lunar-green/40">
              {name}
            </span>
          </div>
        )}
      </div>

      {/* TEXT + CTA SIDE */}
      <div
        className={`flex w-full flex-col justify-center px-6 py-8 md:w-3/5 md:px-10 md:py-10 ${
          imageOnLeft ? 'md:order-2' : 'md:order-1'
        } ${index % 2 === 0 ? 'order-2 md:order-2' : 'order-1 md:order-1'}`}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-matte-gold">
          Experience
        </span>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-lunar-green group-hover:text-terracotta transition-colors">
          {name}
        </h2>
        {description && (
          <p className="mt-3 text-sm leading-relaxed text-text-light line-clamp-3">
            {description}
          </p>
        )}
        <div className="mt-5">
          <Link
            href={`/services/${slug}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta px-5 py-2.5 text-sm font-bold text-soft-beige transition-colors hover:bg-terracotta/85 focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
          >
            View upcoming dates
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </article>
  )
}
