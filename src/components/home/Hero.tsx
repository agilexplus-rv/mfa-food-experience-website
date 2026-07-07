import { Logo } from "@/components/brand/Logo"

export function Hero() {
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
