import { montserrat } from "@/lib/fonts"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Tools — Malta Food Experience",
  robots: "noindex, nofollow",
}

/**
 * Admin-tools route group layout — separate from the public (frontend) layout.
 * No public site navigation, no footer. Minimal layout for admin-only tools.
 *
 * @compliance ADR-008 C5 (admin panel not linked from public site).
 */
export default function AdminToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`h-full antialiased ${montserrat.variable}`}>
      <body className="min-h-full flex flex-col bg-background">
        {children}
      </body>
    </html>
  )
}
