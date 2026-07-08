import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPayload } from "payload"
import config from "@payload-config"
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html"
import { montserrat } from "@/lib/fonts"
import {
  getCancellationPolicy,
  formatTierLabel,
  formatDaysBeforeLabel,
} from "@/lib/policies/cancellation"

export const revalidate = 60
export const dynamic = "force-dynamic"

const KNOWN_SLUGS = [
  "cancellation-policy",
  "customer-policy",
  "provider-info",
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
  if (slug === "cancellation-policy") {
    return {
      title: "Cancellation Policy — Malta Food Experience",
      description:
        "Our cancellation and refund terms for scheduled food experiences.",
    }
  }
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

  // ── Cancellation-policy: render from the Global, not the collection ──
  if (slug === "cancellation-policy") {
    const policy = await getCancellationPolicy()
    return <CancellationPolicyPage policy={policy} />
  }

  // ── Other known slugs: render from the Policies collection ──
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

/**
 * Cancellation policy rendered from the Payload Global.
 *
 * Brand-styled table: lunar-green #33483D, terracotta #C9643D,
 * matte-gold #B8974D, soft-beige #F9F4EF, Montserrat.
 *
 * @at-compliance EU-Legal-3 (Cancellation Policy page)
 * @at-compliance Art. 16(l) / 6(1)(k) withdrawal disclosure
 */
async function CancellationPolicyPage({
  policy,
}: {
  policy: Awaited<ReturnType<typeof getCancellationPolicy>>
}) {
  return (
    <main className={`${montserrat.variable} bg-soft-beige`}>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <header className="border-b border-lunar-green/20 pb-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-matte-gold">
            Legal
          </span>
          <h1 className="mt-2 font-black text-3xl tracking-tight text-lunar-green sm:text-4xl">
            Cancellation Policy
          </h1>
        </header>

        {/* Intro text — admin-editable free-text */}
        {policy.introText && (
          <p className="mt-10 text-lunar-green/80 leading-relaxed whitespace-pre-line">
            {policy.introText}
          </p>
        )}

        {!policy.enabled ? (
          /* Cancellations disabled — clear message, no table */
          <div className="mt-10 rounded-xl border border-dashed border-terracotta/30 bg-terracotta/5 px-6 py-8">
            <p className="text-center text-lg font-semibold text-terracotta">
              Cancellations are not currently accepted for this experience.
            </p>
            <p className="mt-2 text-center text-sm text-lunar-green/60">
              Please contact us directly if you have questions about your booking.
            </p>
          </div>
        ) : policy.tiers && policy.tiers.length > 0 ? (
          /* Cancellation tiers table */
          <div className="mt-10 overflow-hidden rounded-xl border border-lunar-green/15">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-lunar-green text-soft-beige">
                  <th className="px-5 py-3.5 text-left font-semibold">
                    Cancel at least
                  </th>
                  <th className="px-5 py-3.5 text-left font-semibold">
                    Refund
                  </th>
                </tr>
              </thead>
              <tbody>
                {policy.tiers.map((tier, i) => (
                  <tr
                    key={i}
                    className={
                      i % 2 === 0
                        ? "bg-white"
                        : "bg-soft-beige"
                    }
                  >
                    <td className="px-5 py-3.5 text-lunar-green font-medium">
                      {formatDaysBeforeLabel(tier.minDaysBeforeEvent)}
                    </td>
                    <td className="px-5 py-3.5 text-lunar-green font-semibold">
                      {formatTierLabel(tier)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Enabled but no tiers configured */
          <p className="mt-10 text-lunar-green/60">
            Cancellation terms are being finalised. Please check back soon.
          </p>
        )}

        {/* Organiser cancellation */}
        {policy.organiserCancellationText && (
          <div className="mt-12 rounded-xl border border-matte-gold/30 bg-matte-gold/5 px-6 py-6">
            <h2 className="text-lg font-bold text-lunar-green">
              If we cancel the event
            </h2>
            <p className="mt-2 text-lunar-green/80 leading-relaxed whitespace-pre-line">
              {policy.organiserCancellationText}
            </p>
          </div>
        )}

        {/* Withdrawal right disclosure — legally required */}
        {policy.withdrawalRightDisclosure && (
          <div className="mt-12 border-t border-lunar-green/15 pt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-matte-gold">
              Your right of withdrawal
            </h2>
            <p className="mt-3 text-sm text-lunar-green/70 leading-relaxed whitespace-pre-line">
              {policy.withdrawalRightDisclosure}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
