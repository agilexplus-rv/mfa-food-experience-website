import { montserrat } from '@/lib/fonts'
import '@/app/(frontend)/globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Operator Console — Malta Food Experience',
  robots: 'noindex, nofollow',
}

/**
 * Console route group layout — separate from the public (frontend) layout.
 * Operator-facing pages only; no public nav, no Google Translate widget.
 *
 * `notranslate` class on <body> excludes all console pages from Google
 * Translate per ADR-006 Sec 4 (C17 / DPIA P5) — PII-bearing operator
 * screens must never be machine-translated.
 */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${montserrat.variable}`}>
      <body className="notranslate min-h-full flex flex-col bg-soft-beige">{children}</body>
    </html>
  )
}
