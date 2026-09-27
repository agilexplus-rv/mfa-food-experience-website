import { getPayload } from 'payload'
import { MtText } from '@/components/i18n/MtText'
import config from '@payload-config'
import Link from "next/link"

/**
 * Hero: homepage hero section.
 *
 * By default renders centered text + CTA on a Soft-Beige background,
 * sized so header + hero fit in one viewport. When the `site-settings`
 * Payload Global has a `heroBackgroundImage` set (a Media upload), the
 * section renders with that image as a darkened background (overlay
 * gradient ensures WCAG-compliant text contrast). When unset, falls
 * back to the default layout. The brand logo lives in the site header
 * only; it is not repeated in the hero.
 */
export async function Hero() {
  // Fetch site settings to check for a hero background image.
  let bgImage: { url?: string; alt?: string } | null = null
  try {
    const payload = await getPayload({ config })
    const settings = await payload.findGlobal({
      slug: 'site-settings',
      overrideAccess: true,
      depth: 1,
    })
    const img = settings.heroBackgroundImage as { url?: string; alt?: string } | string | null | undefined
    if (img && typeof img === 'object' && img.url) {
      bgImage = { url: img.url, alt: img.alt }
    }
  } catch {
    // If the global doesn't exist yet (e.g. before migration), render default.
  }

  // The section is exactly (100svh - header) tall, so header + hero never
  // exceed one viewport; `min-h-fit` lets it grow rather than clip on
  // unusually short screens.
  const sectionBase =
    'relative flex h-[calc(100svh-var(--site-header-h))] min-h-fit items-center overflow-hidden px-6 py-8 md:py-10'

  const cta = (
    <Link
      href="/services"
      className="mt-8 inline-flex items-center gap-2 rounded-lg bg-terracotta px-8 py-4 text-xl font-bold text-white transition-colors hover:bg-terracotta/85 focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
    >
      <MtText en="Explore Our Experiences" mt="Esplora l-Esperjenzi Tagħna" />
      <span aria-hidden="true">&rarr;</span>
    </Link>
  )

  if (bgImage && bgImage.url) {
    return (
      <section
        className={`${sectionBase} justify-center text-center`}
        style={{
          backgroundImage: `url(${bgImage.url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark overlay gradient for WCAG-compliant text contrast */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/70"
          aria-hidden="true"
        />

        {/* Content layer */}
        <div className="relative z-10 flex max-h-full flex-col items-center">
          <h1 className="max-w-3xl text-4xl font-black tracking-[-0.02em] text-soft-beige sm:text-5xl">
            Experience the authentic flavours of Malta, from field, farm and sea.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-soft-beige/90">
            The Malta Food Experience, brought to you by the Malta Food Agency,
            is a celebration of the flavours, traditions and stories that make
            Maltese cuisine unique. Through hands-on cooking classes and
            tasting experiences, discover authentic local ingredients, learn
            from chefs and food artisans, and explore the connection between
            Malta&apos;s land, sea and culinary heritage.
          </p>

          <p className="mt-4 text-lg font-semibold text-soft-beige">
            Cook, taste, learn and experience Malta through its food.
          </p>

          {cta}
        </div>
      </section>
    )
  }

  // Default: Soft Beige, centered text + CTA (no logo repeated here;
  // the site header already carries the brand mark).
  return (
    <section className={`${sectionBase} justify-center bg-soft-beige text-center`}>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
        <h1 className="max-w-3xl text-4xl font-black tracking-[-0.02em] text-lunar-green sm:text-5xl">
          Experience the authentic flavours of Malta, from field, farm and sea.
        </h1>

        <p className="max-w-2xl text-lg leading-relaxed text-text-light">
          The Malta Food Experience, brought to you by the Malta Food Agency,
          is a celebration of the flavours, traditions and stories that make
          Maltese cuisine unique. Through hands-on cooking classes and
          tasting experiences, discover authentic local ingredients, learn
          from chefs and food artisans, and explore the connection between
          Malta&apos;s land, sea and culinary heritage.
        </p>

        <p className="text-lg font-semibold text-lunar-green">
          Cook, taste, learn and experience Malta through its food.
        </p>

        {cta}

        {/* Subtle decorative divider */}
        <div aria-hidden="true" className="mt-4 h-px w-32 bg-matte-gold/40" />
      </div>
    </section>
  )
}
