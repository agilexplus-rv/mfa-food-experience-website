import type { Metadata } from "next"
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
