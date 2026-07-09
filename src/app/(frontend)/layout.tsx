import type { Metadata } from "next"
import { montserrat } from "@/lib/fonts"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { CookieBanner } from "@/components/compliance/CookieBanner"
import { GoogleTranslateWidgetHost } from "@/components/i18n/GoogleTranslateWidgetHost"
import "./globals.css"

export const metadata: Metadata = {
  title: "Malta Food Experience",
  description: "Authentic Maltese culinary and cultural experiences hosted by the Malta Food Agency.",
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
      </body>
    </html>
  )
}
