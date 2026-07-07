import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPayload } from "payload"
import config from "@payload-config"
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html"
import { montserrat } from "@/lib/fonts"

export const revalidate = 60
export const dynamic = "force-dynamic"

const KNOWN_SLUGS = [
  "cancellation-policy",
  "customer-policy",
  "provider-info",
  "privacy-notice",
  "cookie-policy",
  "accessibility-statement",
] as const

export function generateStaticParams() {
  return KNOWN_SLUGS.map((slug) => ({ slug }))
}

interface PageProps {
  params: Promise<{ slug: string }>
}

interface PolicyDoc {
  id: string | number
  slug: string
  title: string
  body: unknown
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const policy = await getPolicyBySlug(slug)
  if (!policy) return { title: "Not found — Malta Food Experience" }
  return {
    title: `${policy.title} — Malta Food Experience`,
  }
}

async function getPolicyBySlug(slug: string): Promise<PolicyDoc | null> {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: "policies",
    where: { slug: { equals: slug } },
    limit: 1,
  })
  if (res.docs.length === 0) return null
  return res.docs[0] as unknown as PolicyDoc
}

function renderBody(body: unknown): string {
  if (!body || typeof body !== "object") return ""
  try {
    const html = convertLexicalToHTML({ data: body as never })
    return typeof html === "string" ? html : ""
  } catch {
    return extractPlainText(body)
  }
}

function extractPlainText(body: unknown): string {
  if (!body || typeof body !== "object") return ""
  const root = (body as { root?: { children?: unknown[] } }).root
  if (!root || !Array.isArray(root.children)) return ""

  const parts: string[] = []
  walkNodes(root.children, parts)
  return parts.map(escapeHtml).join("\n")
}

function walkNodes(nodes: unknown[], acc: string[]): void {
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue
    const n = node as { type?: string; text?: string; children?: unknown[] }
    if (typeof n.text === "string") {
      acc.push(n.text)
    }
    if (Array.isArray(n.children)) {
      if (n.type === "paragraph") acc.push("")
      walkNodes(n.children, acc)
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export default async function LegalPolicyPage({ params }: PageProps) {
  const { slug } = await params
  const policy = await getPolicyBySlug(slug)
  if (!policy) notFound()

  const bodyHtml = renderBody(policy.body)

  return (
    <main className={`${montserrat.variable} bg-soft-beige`}>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <header className="border-b border-lunar-green/20 pb-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-matte-gold">
            Legal
          </span>
          <h1 className="mt-2 font-black text-3xl tracking-tight text-lunar-green sm:text-4xl">
            {policy.title}
          </h1>
        </header>

        {bodyHtml ? (
          <div
            className="prose prose-lunar-green mt-10 max-w-none
              prose-headings:font-bold prose-headings:text-lunar-green
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
              prose-p:text-lunar-green/80 prose-p:leading-relaxed
              prose-li:text-lunar-green/80 prose-li:leading-relaxed
              prose-strong:text-lunar-green
              prose-a:text-terracotta prose-a:underline hover:prose-a:text-terracotta/80
              [&>p:empty]:hidden
            "
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <p className="mt-10 text-lunar-green/60">
            This policy document is being prepared. Please check back soon.
          </p>
        )}
      </section>
    </main>
  )
}