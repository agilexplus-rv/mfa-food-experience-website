/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface ContentSection {
  title: string
  description: string
  href: string
  icon: string
}

const SECTIONS: ContentSection[] = [
  { title: 'Testimonials', description: 'Approve or reject customer testimonials', href: '/console/content/testimonials', icon: 'TS' },
  { title: 'News', description: 'Create and manage news articles', href: '/console/content/news', icon: 'NW' },
  { title: 'Policies', description: 'Edit legal and policy documents', href: '/console/content/policies', icon: 'PL' },
]

export default function ContentLandingPage() {
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tRes, nRes, pRes] = await Promise.all([
        fetch('/console/api/testimonials?limit=1'),
        fetch('/console/api/news?limit=1'),
        fetch('/console/api/policies?limit=1'),
      ])

      const s: Record<string, number> = {}
      if (tRes.ok) {
        const d = await tRes.json()
        s.testimonials = d.totalDocs ?? 0
        const tp = await fetch('/console/api/testimonials?status=pending&limit=1')
        if (tp.ok) {
          const dp = await tp.json()
          s.pendingTestimonials = dp.totalDocs ?? 0
        }
      }
      if (nRes.ok) {
        const d = await nRes.json()
        s.news = d.totalDocs ?? 0
      }
      if (pRes.ok) {
        const d = await pRes.json()
        s.policies = d.totalDocs ?? 0
      }

      setStats(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchStats() }, [fetchStats])

  if (error) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="text-2xl font-black text-lunar-green tracking-tight">Content Management</h1>
          <p className="mt-1 text-sm text-text-light">Manage testimonials, news, and policies</p>
        </header>
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{error}</div>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black text-lunar-green tracking-tight">Content Management</h1>
        <p className="mt-1 text-sm text-text-light">Manage testimonials, news, and policies</p>
      </header>

      {loading && (
        <div className="text-center py-16 text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading...
        </div>
      )}

      {!loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((section) => {
            const statKey = section.href.includes('testimonials') ? 'testimonials'
              : section.href.includes('news') ? 'news'
              : 'policies'
            const count = stats[statKey]
            const pending = stats.pendingTestimonials

            return (
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
                <p className="text-sm text-text-light mb-3">{section.description}</p>
                <div className="flex items-center gap-3">
                  {count !== undefined && (
                    <span className="text-xs font-semibold text-lunar-green">
                      {count} item{count !== 1 ? 's' : ''}
                    </span>
                  )}
                  {section.title === 'Testimonials' && pending !== undefined && pending > 0 && (
                    <span className="inline-block rounded-full bg-matte-gold/20 px-2 py-0.5 text-[10px] font-bold text-matte-gold">
                      {pending} pending
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
