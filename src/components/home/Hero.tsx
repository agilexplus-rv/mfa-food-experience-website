import { getPayload } from 'payload'
import { MtText } from '@/components/i18n/MtText'
import config from '@payload-config'
import Link from "next/link"
import { Logo } from "@/components/brand/Logo"

/**
 * Hero — homepage hero section.
 *
 * By default renders text + CTA (left) and a large logo (right) on a
 * Soft-Beige background, sized so header + hero fit in one viewport.
 * When the `site-settings` Payload Global has a `heroBackgroundImage`
 * set (a Media upload), the section renders with that image as a
 * darkened background (overlay gradient ensures WCAG-compliant
 * text contrast). When unset, falls back to the default layout.
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

  // Layout constraints shared by both variants:
  //  - the section is exactly (100svh - header) tall, so header + hero
  //    never exceed one viewport; `min-h-fit` lets it grow rather than
  //    clip on unusually short screens.
  //  - the logo drops the Logo component's 18% clear-space padding here
  //    (the hero's own spacing provides it) and scales to the space
  //    available, bounded by the hero height.
  const sectionBase =
    'relative flex h-[calc(100svh-var(--site-header-h))] min-h-fit items-center overflow-hidden px-6 py-8 md:py-10'

  const cta = (
    <Link
      href="/services"
      className="mt-8 inline-flex items-center gap-2 rounded-lg bg-terracotta-dark px-8 py-4 text-base font-bold text-white transition-colors hover:bg-terracotta/85 focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
    >
      <MtText en="Book an Experience" mt="Ibbukkja Esperjenza" />
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
          <Logo
            variant="primary"
            size="xxl"
            className="!p-0 h-auto w-[min(88vw,640px)] max-h-[36svh] object-contain"
          />

          <h1 className="mt-4 max-w-2xl text-4xl font-black tracking-[-0.02em] text-soft-beige sm:text-5xl lg:text-6xl">
            Authentic Maltese Culinary Experiences
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-soft-beige/90">
            Discover the flavours of Malta with hands-on classes, guided
            tastings, and cultural experiences hosted by the Malta Food Agency.
          </p>

          {cta}
        </div>
      </section>
    )
  }

  // Default: Soft Beige — text + CTA on the left, large logo on the right
  // (stacked text-then-logo on mobile).
  return (
    <section className={`${sectionBase} bg-soft-beige`}>
      <div className="mx-auto flex h-full w-full max-w-screen-2xl flex-col items-center justify-center gap-6 md:flex-row md:justify-between md:gap-12">
        {/* Text + CTA — left side on desktop */}
        <div className="flex shrink-0 flex-col items-center text-center md:w-5/12 md:items-start md:text-left">
          <h1 className="max-w-2xl text-4xl font-black tracking-[-0.02em] text-lunar-green sm:text-5xl lg:text-6xl">
            Authentic Maltese Culinary Experiences
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-text-light">
            Discover the flavours of Malta with hands-on classes, guided
            tastings, and cultural experiences hosted by the Malta Food Agency.
          </p>

          {cta}

          {/* Subtle decorative divider */}
          <div className="mt-10 hidden h-px w-32 bg-matte-gold/40 md:block" />
        </div>

        {/* Logo — right side on desktop, below the text on mobile */}
        <div className="flex min-h-0 w-full flex-1 items-center justify-center md:w-7/12 md:justify-end">
          <Logo
            variant="primary"
            size="xxl"
            className="!p-0 h-auto w-[min(100%,820px)] max-h-[30svh] object-contain md:max-h-[calc(100svh-var(--site-header-h)-5rem)]"
          />
        </div>
      </div>
    </section>
  )
}
