import { Logo } from "@/components/brand/Logo"
import Link from "next/link"

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Classes", href: "#" },
  { label: "Tastings", href: "#" },
  { label: "Book Now", href: "#" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-lunar-green text-soft-beige">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Larger logo — client requirement NFR-1 */}
        <Link href="/" className="flex-shrink-0">
          <Logo variant="inverted" size="lg" className="!p-0" />
        </Link>

        {/* Navigation — placeholder; real links come in Phase 1 */}
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

        {/* EN | MT language switcher placeholder — Phase 1.1 */}
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-soft-beige px-3 py-1 text-xs font-bold text-lunar-green">
            EN
          </span>
          <span className="rounded-full border border-soft-beige/30 px-3 py-1 text-xs font-semibold text-soft-beige/60">
            MT
          </span>
        </div>
      </div>
    </header>
  )
}
