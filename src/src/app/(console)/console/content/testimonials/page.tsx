/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/console/Button'
import Badge from '@/components/console/Badge'
import Card from '@/components/console/Card'
import { Pagination } from '@/components/console/DataTable'

interface TestimonialRow {
  id: string | number
  name: string
  text: string
  approved: boolean
  eventId: string | number | null
  eventTitle: string | null
  anonymisedAt: string | null
  createdAt: string
  updatedAt: string
}

interface SearchResult {
  docs: TestimonialRow[]
  totalDocs: number
  page: number
  totalPages: number
}

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString('en-MT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function TestimonialsModerationPage() {
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [actionId, setActionId] = useState<string | number | null>(null)

  const search = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(page))
      params.set('limit', '25')
      const res = await fetch(`/console/api/testimonials?${params.toString()}`)
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to load testimonials')
      }
      const data = await res.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load testimonials')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  useEffect(() => { void search() }, [search])

  const handleToggle = useCallback(async (id: string | number, approved: boolean) => {
    setActionId(id)
    try {
      const res = await fetch('/console/api/testimonials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, approved }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Update failed')
      void search()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionId(null)
    }
  }, [search])

  return (
    <div>
      <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-lunar-green tracking-tight">Testimonials Moderation</h1>
          <p className="mt-1 text-sm text-text-light">Approve or reject customer testimonials</p>
        </div>
      </header>

      {/* Filters */}
      <Card className="mb-6" padding>
        <div className="flex flex-wrap gap-3 items-end">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            style={{ boxSizing: 'border-box' }}
          >
            <option value="">All Testimonials</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
          <Button onClick={() => { setPage(1); void search() }} loading={loading}>
            Refresh
          </Button>
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{error}</div>
      )}

      {loading && !results && (
        <div className="text-center py-16 text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading testimonials...
        </div>
      )}

      {results && results.totalDocs === 0 && (
        <Card className="text-center" padding>
          <p className="text-text-light">No testimonials found.</p>
        </Card>
      )}

      {results && results.totalDocs > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-soft-beige/50 text-left">
                  <th className="px-4 py-3 font-semibold text-text-light">Status</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Name</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Testimonial</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Event</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Submitted</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.docs.map((t) => (
                  <tr key={String(t.id)} className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors">
                    <td className="px-4 py-3">
                      <Badge variant={t.approved ? 'confirmed' : 'pending'}>
                        {t.approved ? 'Approved' : 'Pending'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold text-lunar-green">{t.name}</td>
                    <td className="px-4 py-3 text-lunar-green max-w-xs">
                      <div className="line-clamp-2">{t.text}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-light">
                      {t.eventTitle || '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-light">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {t.approved ? (
                          <button
                            onClick={() => handleToggle(t.id, false)}
                            disabled={actionId === t.id}
                            className="rounded-md border border-terracotta px-2 py-0.5 text-[10px] font-semibold text-[#9C4E2F] hover:bg-terracotta hover:text-white disabled:opacity-40 transition-colors"
                          >
                            {actionId === t.id ? '...' : 'Reject'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggle(t.id, true)}
                            disabled={actionId === t.id}
                            className="rounded-md border border-lunar-green px-2 py-0.5 text-[10px] font-semibold text-lunar-green hover:bg-lunar-green hover:text-white disabled:opacity-40 transition-colors"
                          >
                            {actionId === t.id ? '...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={results.page}
            totalPages={results.totalPages}
            totalDocs={results.totalDocs}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
