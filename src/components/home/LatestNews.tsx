import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'

interface NewsItemDoc {
  id: string | number
  title: string
  date: string
  slug: string
  image?: { url?: string; alt?: string } | string | null
}

/**
 * Latest News section (FR-7.1, FR-7.2).
 * Most recent published news items, limit 3.
 */
export async function LatestNews() {
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'news_items',
    where: { published: { equals: true } },
    sort: '-date',
    limit: 3,
  })

  const items = docs as unknown as NewsItemDoc[]

  if (items.length === 0) {
    return null
  }

  return (
    <section className="bg-lunar-green px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-black text-3xl tracking-tight text-soft-beige sm:text-4xl">
          Latest News
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const imageUrl = typeof item.image === 'object' ? item.image?.url : null
            return (
              <article
                key={String(item.id)}
                className="flex flex-col overflow-hidden rounded-lg bg-soft-beige"
              >
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={item.title} className="h-48 w-full object-cover" />
                ) : null}
                <div className="p-6">
                  <p className="text-sm font-semibold text-matte-gold">{item.date}</p>
                  <h3 className="mt-1 font-bold text-xl text-lunar-green">{item.title}</h3>
                </div>
              </article>
            )
          })}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/news"
            className="inline-flex items-center rounded-lg border border-soft-beige/40 px-6 py-3 text-sm font-bold text-soft-beige transition-colors hover:bg-soft-beige/10"
          >
            All news
          </Link>
        </div>
      </div>
    </section>
  )
}
