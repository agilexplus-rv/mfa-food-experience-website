import { Logo } from "@/components/brand/Logo"
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher"
import { MobileNav } from "@/components/layout/MobileNav"
import Link from "next/link"

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Experiences", href: "/services" },
  { label: "Classes", href: "/services/classes" },
  { label: "Testimonials", href: "/testimonials" },
  // "Tastings" intentionally omitted from nav — Tastings.visible=false
  // per FR-1.2; its route returns the "not available" state (FR-1.3).
  { label: "Book Now", href: "/services" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-lunar-green text-soft-beige">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Larger logo — client requirement NFR-1 */}
        <Link href="/" className="flex-shrink-0">
          <Logo variant="inverted" size="lg" className="!p-0" />
        </Link>

        {/* Navigation — desktop only, hidden below md (<960px) */}
        <nav className="hidden items-center gap-1 md:flex">
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

        <div className="flex items-center gap-2">
          {/* EN | MT language switcher — functional per ADR-006 */}
          <LanguageSwitcher />

          {/* Hamburger menu — mobile only, hidden at md and above */}
          <MobileNav />
        </div>
      </div>
    </header>
  )
}
