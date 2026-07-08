import type { Metadata } from "next"
import { montserrat } from "@/lib/fonts"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { CookieBanner } from "@/components/compliance/CookieBanner"
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
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <CookieBanner />
      </body>
    </html>
  )
}
