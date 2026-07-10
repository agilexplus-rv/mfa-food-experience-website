import { getPayload } from 'payload'
import config from '@payload-config'
import { Logo } from "@/components/brand/Logo"

/**
 * Hero — homepage hero section.
 *
 * By default renders a text-only layout on a Soft-Beige background.
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

  if (bgImage && bgImage.url) {
    return (
      <section
        className="relative flex min-h-[70vh] flex-col items-center justify-center px-6 py-20 text-center"
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
        <div className="relative z-10 flex flex-col items-center">
          <Logo variant="primary" size="xl" />

          <h1 className="mt-4 max-w-2xl text-4xl font-black tracking-[-0.02em] text-soft-beige sm:text-5xl lg:text-6xl">
            Authentic Maltese Culinary Experiences
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-soft-beige/90">
            Discover the flavours of Malta with hands-on classes, guided
            tastings, and cultural experiences hosted by the Malta Food Agency.
          </p>

          <a
            href="/services"
            className="mt-10 inline-flex items-center gap-2 rounded-lg bg-terracotta px-8 py-4 text-base font-bold text-soft-beige transition-colors hover:bg-terracotta/85 focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
          >
            Book an Event
            <span aria-hidden="true">&rarr;</span>
          </a>

          <div className="mt-20 h-px w-32 bg-matte-gold/60" />
        </div>
      </section>
    )
  }

  // Default: text-only on Soft Beige
  return (
    <section className="relative flex min-h-[70vh] flex-col items-center justify-center bg-soft-beige px-6 py-20 text-center">
      {/* Larger brand mark — hero scale */}
      <Logo variant="primary" size="xl" />

      <h1 className="mt-4 max-w-2xl text-4xl font-black tracking-[-0.02em] text-lunar-green sm:text-5xl lg:text-6xl">
        Authentic Maltese Culinary Experiences
      </h1>

      <p className="mt-6 max-w-lg text-lg leading-relaxed text-lunar-green/70">
        Discover the flavours of Malta with hands-on classes, guided
        tastings, and cultural experiences hosted by the Malta Food Agency.
      </p>

      <a
        href="/services"
        className="mt-10 inline-flex items-center gap-2 rounded-lg bg-terracotta px-8 py-4 text-base font-bold text-soft-beige transition-colors hover:bg-terracotta/85 focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
      >
        Book an Event
        <span aria-hidden="true">&rarr;</span>
      </a>

      {/* Subtle decorative divider */}
      <div className="mt-20 h-px w-32 bg-matte-gold/40" />
    </section>
  )
}
