import { getPayload } from 'payload'
import config from '@payload-config'
import { Logo } from "@/components/brand/Logo"
import type { ReactElement } from "react"
import Link from "next/link"

/**
 * SiteFooter — Lunar Green background, Soft Beige text.
 *
 * Three-column layout (desktop) collapsing to stacked (mobile):
 * 1. Brand mark — inverted logo + short agency description.
 * 2. Navigation — the same nav items as the header.
 * 3. Legal — Cancellation Policy, Customer Policy, Provider Info.
 *
 * Social media links are now admin-configurable via the
 * `social-media-settings` Payload Global. Only platforms with
 * `published: true` and a non-empty URL are rendered. If the Global
 * is unavailable (e.g. before migration), no social icons render
 * (graceful degradation — the footer still works, just without
 * social links, rather than crashing the page).
 *
 * Brand compliance: 4-colour palette only, Montserrat via the font variable.
 */

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Experiences", href: "/services" },
  { label: "Classes", href: "/services/classes" },
  { label: "Testimonials", href: "/testimonials" },
  { label: "Contact Us", href: "/contact" },
  { label: "Book Now", href: "/services" },
]

const LEGAL_LINKS = [
  { label: "Cancellation Policy", href: "/legal/cancellation-policy" },
  { label: "Customer Policy", href: "/legal/customer-policy" },
  { label: "Provider Info", href: "/legal/provider-info" },
]

function InstagramIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4l16 16M20 4L4 20" />
    </svg>
  )
}

const ICON_MAP: Record<string, () => ReactElement> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  x: XIcon,
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
}

interface SocialLink {
  platform: string
  url: string
  published: boolean
}

async function getSocialLinks(): Promise<SocialLink[]> {
  try {
    const payload = await getPayload({ config })
    const settings = await payload.findGlobal({
      slug: 'social-media-settings',
      overrideAccess: true,
    })
    const platforms = (settings.platforms || []) as SocialLink[]
    return platforms.filter(
      (p) => p.published && p.url && p.platform,
    )
  } catch {
    // Global not yet migrated or unavailable — render no social links.
    return []
  }
}

export async function SiteFooter() {
  const socialLinks = await getSocialLinks()

  return (
    <footer className="bg-lunar-green text-soft-beige">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Brand column */}
          <div className="flex flex-col gap-4">
            <Logo variant="inverted" size="sm" className="!p-0" />
            <p className="max-w-xs text-sm leading-relaxed text-soft-beige/80">
              Authentic Maltese culinary and cultural experiences, hosted by
              the Malta Food Agency.
            </p>
            {socialLinks.length > 0 && (
              <div className="flex items-center gap-4 text-matte-gold">
                {socialLinks.map((link) => {
                  const Icon = ICON_MAP[link.platform]
                  if (!Icon) return null
                  const label = PLATFORM_LABELS[link.platform] || link.platform
                  return (
                    <a
                      key={link.platform}
                      href={link.url}
                      aria-label={label}
                      className="transition-colors hover:text-terracotta focus:outline-2 focus:outline-offset-2 focus:outline-matte-gold"
                    >
                      <Icon />
                    </a>
                  )
                })}
              </div>
            )}
          </div>

          {/* Nav column */}
          <nav aria-label="Footer navigation" className="flex flex-col gap-2">
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-matte-gold">
              Explore
            </h2>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-semibold text-soft-beige transition-colors hover:text-matte-gold focus:outline-2 focus:outline-offset-1 focus:outline-matte-gold"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Legal column */}
          <nav aria-label="Legal" className="flex flex-col gap-2">
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-matte-gold">
              Legal
            </h2>
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-semibold text-soft-beige transition-colors hover:text-matte-gold focus:outline-2 focus:outline-offset-1 focus:outline-matte-gold"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-soft-beige/20 pt-6">
          <p className="text-xs text-soft-beige/60">
            &copy; {new Date().getFullYear()} Malta Food Agency. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
