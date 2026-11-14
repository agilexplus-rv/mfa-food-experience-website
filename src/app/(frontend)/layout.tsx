import type { Metadata } from "next"
import { montserrat } from "@/lib/fonts"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { CookieBanner } from "@/components/compliance/CookieBanner"
import { GoogleTranslateWidgetHost } from "@/components/i18n/GoogleTranslateWidgetHost"
import { I18nDebugPanel } from "@/components/i18n/I18nDebugPanel"
import "./globals.css"

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SERVER_URL || "https://foodexperience.mt"
const SITE_DESCRIPTION =
  "Authentic Maltese culinary and cultural experiences hosted by the Malta Food Agency. Hands-on cooking classes and tasting experiences in Malta, available in English and Maltese."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Malta Food Experience",
    template: "%s | Malta Food Experience",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Malta Food Experience",
  authors: [{ name: "Malta Food Agency" }],
  publisher: "Malta Food Agency",
  keywords: [
    "Malta food experience",
    "Maltese cooking class",
    "cooking class Malta",
    "food tasting Malta",
    "Malta food tour",
    "Malta Food Agency",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Malta Food Experience",
    title: "Malta Food Experience",
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_MT",
    images: [
      {
        url: "/brand/logos/Malta%20Food%20-%20Primary-01.png",
        alt: "Malta Food Experience",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Malta Food Experience",
    description: SITE_DESCRIPTION,
    images: ["/brand/logos/Malta%20Food%20-%20Primary-01.png"],
  },
  icons: {
    icon: [
      { url: '/brand/logos/Malta%20Food%20-%20Primary.svg', type: 'image/svg+xml' },
      { url: '/brand/logos/Malta%20Food%20-%20Primary-01.png', type: 'image/png' },
    ],
    apple: { url: '/brand/logos/Malta%20Food%20-%20Primary-01.png' },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${montserrat.variable}`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="skip-to-content"
        >
          Skip to main content
        </a>
        {/* Singleton Google Translate widget host -- exactly one instance
            for the whole app, regardless of how many LanguageSwitcher pill
            UIs are rendered (desktop header + mobile drawer both render
            LanguageSwitcher simultaneously; only this single host owns the
            actual widget div + script). See GoogleTranslateWidgetHost.tsx
            for the duplicate-id regression this fixes. */}
        <GoogleTranslateWidgetHost />
        <SiteHeader />
        <main id="main-content" className="flex-1">{children}</main>
        <SiteFooter />
        <CookieBanner />
        {/* Temporary, URL-gated diagnostic panel (?debug=i18n) -- see
            I18nDebugPanel.tsx doc comment. Remove once the translation
            issue reported 2026-07-09 is confirmed resolved. */}
        <I18nDebugPanel />
      </body>
    </html>
  )
}
