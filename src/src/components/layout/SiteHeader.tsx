import { Logo } from "@/components/brand/Logo"
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher"
import { MobileNav } from "@/components/layout/MobileNav"
import { SiteSearch } from "@/components/search/SiteSearch"
import Link from "next/link"

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Experiences", href: "/services" },
  // "Tastings" intentionally omitted from nav — Tastings.visible=false
  // per FR-1.2; its route returns the "not available" state (FR-1.3).
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-lunar-green text-soft-beige">
      {/* True-centre layout (Rudie 2026-07-12): previously a
          justify-between flex row, which centres the nav between two
          UNEQUAL neighbours (210px logo vs the wider search+language
          group), so the nav sat visibly off the real screen centre.
          On md+ this is now a 3-column grid with equal flexible outer
          columns (1fr auto 1fr): the middle column is mathematically
          centred in the container no matter how wide either side is.
          Below md it stays a flex row (logo left, hamburger right --
          nothing to centre). */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 md:grid md:grid-cols-[1fr_auto_1fr]">
        {/* Logo sizing (Rudie 2026-07-12): "a bit smaller, but not so
            small" -- stepped down ~15-20% from the previous
            140/180/260px to 120/150/210px. Still prominent on desktop
            per the original NFR-1 larger-logo requirement, still
            responsive-capped on mobile so it doesn't crowd the
            hamburger/language-switcher group on narrow viewports. */}
        <Link href="/" className="min-w-0 flex-shrink md:justify-self-start">
          <Logo
            variant="inverted"
            size="lg"
            className="!w-[120px] !p-0 sm:!w-[150px] md:!w-[210px]"
          />
        </Link>

        {/* Navigation — desktop only, hidden below md (<960px) */}
        <nav className="hidden items-center gap-1 md:flex md:justify-self-center">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded px-4 py-2 text-sm font-semibold text-soft-beige transition-colors hover:text-matte-gold focus:outline-2 focus:outline-offset-1 focus:outline-matte-gold"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 md:justify-self-end">
          {/* Site search — desktop only, hidden below md.
              On mobile it lives inside the MobileNav drawer. */}
          <div className="hidden md:block">
            <SiteSearch />
          </div>

          {/* EN | MT language switcher — functional per ADR-006.
              Hidden below md: on mobile it lives inside the MobileNav
              drawer instead, so the header doesn't get crowded and the
              switcher sits alongside the rest of the nav in the menu. */}
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>

          {/* Hamburger menu — mobile only, hidden at md and above.
              Renders its own LanguageSwitcher inside the drawer. */}
          <MobileNav />
        </div>
      </div>
    </header>
  )
}
