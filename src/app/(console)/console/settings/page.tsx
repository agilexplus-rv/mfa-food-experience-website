'use client'

import Link from 'next/link'

interface SettingsSection {
  title: string
  description: string
  href: string
  icon: string
}

const SECTIONS: SettingsSection[] = [
  {
    title: 'Site Settings',
    description: 'Homepage hero background image and other site-wide presentation options',
    href: '/console/settings/site-settings',
    icon: 'SS',
  },
  {
    title: 'Cancellation Policy',
    description: 'Edit refund tiers, organiser-cancellation text, and the withdrawal-right disclosure',
    href: '/console/settings/cancellation-policy',
    icon: 'CP',
  },
]

export default function SettingsLandingPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black text-lunar-green tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-text-light">Platform-wide configuration</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group block rounded-xl border border-border bg-surface p-6 hover:border-lunar-green/40 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lunar-green"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lunar-green/10 text-xs font-bold text-lunar-green">
                {section.icon}
              </span>
              <h2 className="text-lg font-black text-lunar-green group-hover:text-lunar-green/80 transition-colors">
                {section.title}
              </h2>
            </div>
            <p className="text-sm text-text-light">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
