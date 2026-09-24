import { montserrat } from "@/lib/fonts"
import "@/app/(frontend)/globals.css"

/**
 * Check-in route group layout — separate from the public (frontend) layout.
 * No public site navigation, no footer.  Minimal, mobile-first layout for
 * door staff at the venue entrance.
 *
 * `notranslate` class on <body> excludes check-in pages (scan, dashboard)
 * from Google Translate per ADR-006 Sec 4 (C17 / DPIA P5) — these pages
 * handle PII (attendee names, emails, booking references) via QR scan
 * and manual lookup.
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
      <body className="notranslate min-h-full flex flex-col bg-background">
        {children}
      </body>
    </html>
  )
}
