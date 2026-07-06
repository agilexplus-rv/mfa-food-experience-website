import Link from "next/link"

export interface NewsCardProps {
  id: string | number
  title: string
  date: string
  slug: string
  image?: { url?: string; alt?: string } | string | null
  excerpt?: string
}

/**
 * Reusable news card (FR-7.2).
 * Links to /news/[slug] — detail page deferred per URD open question 6.
 */
export function NewsCard({ title, date, slug, image, excerpt }: NewsCardProps) {
  const imageUrl = typeof image === "object" ? image?.url : null
  const imageAlt = typeof image === "object" ? image?.alt ?? title : title

  return (
    <article className="flex flex-col overflow-hidden rounded-lg bg-white shadow-sm">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={imageAlt} className="h-48 w-full object-cover" />
      ) : null}
      <div className="flex flex-1 flex-col p-6">
        <time
          dateTime={date}
          className="text-sm font-semibold text-matte-gold"
        >
          {date}
        </time>
        <h2 className="mt-1 font-bold text-xl text-lunar-green">
          <Link href={`/news/${slug}`} className="hover:text-terracotta focus:outline-2 focus:outline-offset-2 focus:outline-terracotta">
            {title}
          </Link>
        </h2>
        {excerpt ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-lunar-green/70">
            {excerpt}
          </p>
        ) : null}
        <div className="mt-4 pt-2">
          <Link
            href={`/news/${slug}`}
            className="inline-flex items-center text-sm font-bold text-terracotta transition-colors hover:text-terracotta/80 focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
            aria-label={`Read more about ${title}`}
          >
            Read more
            <span aria-hidden="true" className="ml-1">&rarr;</span>
          </Link>
        </div>
      </div>
    </article>
  )
}
