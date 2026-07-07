import { montserrat } from "@/lib/fonts"
import "@/app/(frontend)/globals.css"

/**
 * Check-in route group layout — separate from the public (frontend) layout.
 * No public site navigation, no footer.  Minimal, mobile-first layout for
 * door staff at the venue entrance.
 *
 * @compliance ADR-008 C5 (admin panel not linked from public site),
 *   C18 (no local storage, session-based auth only).
 */
export default function CheckinLayout({
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
