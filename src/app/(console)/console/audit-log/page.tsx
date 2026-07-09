/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Card from '@/components/console/Card'
import { Pagination } from '@/components/console/DataTable'

interface AuditLogEntry {
  id: string | number
  action: string
  actorEmail: string | null
  actorId: string | number | null
  collection: string | null
  documentId: string | number | null
  detail: string | null
  createdAt: string
}

interface SearchResult {
  docs: AuditLogEntry[]
  totalDocs: number
  page: number
  totalPages: number
}

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'mfa_enabled', label: 'MFA Enabled' },
  { value: 'mfa_disabled', label: 'MFA Disabled' },
]

export default function AuditLogPage() {
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (actionFilter) params.set('action', actionFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      params.set('page', String(page))
      params.set('limit', '25')
      const res = await fetch('/console/api/audit-log?' + params.toString())
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to load audit log')
      }
      const data = await res.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [actionFilter, dateFrom, dateTo, page])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black text-lunar-green tracking-tight">Audit Log</h1>
        <p className="mt-1 text-sm text-text-light">Track all administrative actions across the platform</p>
      </header>

      {/* Filters */}
      <Card className="mb-6" padding>
        <div className="flex flex-wrap gap-3 items-end">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            style={{ boxSizing: 'border-box' }}
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-text-light">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="rounded-lg border border-border px-3 py-2 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-text-light">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="rounded-lg border border-border px-3 py-2 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
          </div>
          {(actionFilter || dateFrom || dateTo) && (
            <button
              onClick={() => { setActionFilter(''); setDateFrom(''); setDateTo(''); setPage(1) }}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-light hover:text-lunar-green transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{error}</div>
      )}

      {loading && !results && (
        <div className="text-center py-16 text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading audit log...
        </div>
      )}

      {results && results.totalDocs === 0 && (
        <Card className="text-center" padding>
          <p className="text-text-light">No audit log entries found.</p>
        </Card>
      )}

      {results && results.totalDocs > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-soft-beige/50 text-left">
                  <th className="px-4 py-3 font-semibold text-text-light whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Actor</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Action</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Collection</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Document ID</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Detail</th>
                </tr>
              </thead>
              <tbody>
                {results.docs.map((entry) => (
                  <tr key={String(entry.id)} className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-text-light font-mono whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString('en-MT', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs text-lunar-green font-mono">
                      {entry.actorEmail || String(entry.actorId || '\u2014')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-lunar-green/10 px-2 py-0.5 text-xs font-mono text-lunar-green">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-light capitalize">
                      {entry.collection ? String(entry.collection).replace(/_/g, ' ') : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-light font-mono">
                      {entry.documentId != null ? String(entry.documentId) : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-light max-w-[200px] truncate" title={entry.detail || undefined}>
                      {entry.detail || '\u2014'}
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
