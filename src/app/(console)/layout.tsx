import { montserrat } from '@/lib/fonts'
import '@/app/(frontend)/globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Operator Console — Malta Food Experience',
  robots: 'noindex, nofollow',
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${montserrat.variable}`}>
      <body className="min-h-full flex flex-col bg-soft-beige">{children}</body>
    </html>
  )
}
