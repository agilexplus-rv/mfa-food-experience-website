import { getPayload } from "payload"
import config from "@payload-config"
import type { Metadata } from "next"
import { NewsCard } from "@/components/news/NewsCard"

export const metadata: Metadata = {
  title: "News — Malta Food Experience",
  description:
    "Latest news and updates from the Malta Food Agency — events, culinary experiences, and announcements.",
}

interface NewsItemDoc {
  id: string | number
  title: string
  date: string
  slug: string
  image?: { url?: string; alt?: string } | string | null
  body?: unknown
}

/**
 * Extract plain-text excerpt from a Lexical rich-text root.
 * Lexical serialises body as { root: { children: [ { children: [ { text } ] } ] } }.
 * Returns "" when the structure is absent or unparseable.
 */
function excerptFromLexical(body: unknown, max = 200): string {
  if (!body || typeof body !== "object") return ""
  const root = (body as { root?: { children?: unknown[] } }).root
  if (!root || !Array.isArray(root.children)) return ""

  let text = ""
  for (const node of root.children) {
    if (typeof node !== "object" || node === null) continue
    const nodeText = collectText(node)
    if (nodeText) {
      text += (text ? " " : "") + nodeText
      if (text.length >= max) break
    }
  }
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text
}

function collectText(node: unknown): string {
  if (!node || typeof node !== "object") return ""
  const n = node as { text?: string; children?: unknown[] }
  if (typeof n.text === "string") return n.text
  if (Array.isArray(n.children)) {
    return n.children.map((c) => collectText(c)).join("")
  }
  return ""
}

/**
 * News listing page (FR-7.2).
 * Shows published news items, newest first, up to 10.
 * Cards link to /news/[slug] (detail page deferred — URD open question 6).
 */
export default async function NewsPage() {
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: "news_items",
    where: { published: { equals: true } },
    sort: "-date",
    limit: 10,
  })

  const items = docs as unknown as NewsItemDoc[]

  if (items.length === 0) {
    return (
      <section className="bg-soft-beige px-6 py-16">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="font-black text-3xl tracking-tight text-lunar-green sm:text-4xl">
            News
          </h1>
          <p className="mt-4 text-lg text-lunar-green/70">
            No news right now. Please check back soon for updates from the
            Malta Food Agency.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-soft-beige px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <h1 className="font-black text-3xl tracking-tight text-lunar-green sm:text-4xl">
            News
          </h1>
          <p className="mt-2 text-lg text-lunar-green/70">
            Latest updates and announcements from the Malta Food Agency.
          </p>
        </header>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <NewsCard
              key={String(item.id)}
              id={item.id}
              title={item.title}
              date={item.date}
              slug={item.slug}
              image={item.image}
              excerpt={excerptFromLexical(item.body)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
