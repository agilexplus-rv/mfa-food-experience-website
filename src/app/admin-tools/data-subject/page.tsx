'use client'

import { useState } from 'react'

interface Match {
  reference: string
  eventTitle: string | null
  status: string
  createdAt: string
  anonymised: boolean
}

export default function DataSubjectPage() {
  const [email, setEmail] = useState('')
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [eraseResult, setEraseResult] = useState<{ count: number; runAt: string } | null>(null)
  const [erasing, setErasing] = useState(false)

  const handleSearch = async () => {
    if (!email.trim() && !reference.trim()) return
    setLoading(true)
    setError(null)
    setMatches(null)
    setEraseResult(null)
    setConfirmed(false)
    try {
      const body: Record<string, string> = {}
      if (email.trim()) body.email = email.trim()
      if (reference.trim()) body.reference = reference.trim()
      const res = await fetch('/api/data-subject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Search failed')
      setMatches(data.matches || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleErase = async () => {
    if (!email.trim() && !reference.trim()) return
    setErasing(true)
    setError(null)
    try {
      const body: Record<string, string | boolean> = { confirm: true }
      if (email.trim()) body.email = email.trim()
      if (reference.trim()) body.reference = reference.trim()
      const res = await fetch('/api/data-subject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erasure failed')
      setEraseResult({ count: data.count, runAt: data.runAt })
      setMatches(null)
      setConfirmed(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erasure failed')
    } finally {
      setErasing(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl w-full px-4 py-8">
      <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-lunar-green tracking-tight">Data Subject Request</h1>
          <p className="mt-1 text-sm text-text-light">GDPR Art. 15 (access) and Art. 17 (erasure) requests</p>
        </div>
        <a href="/dashboard" className="rounded-lg border-2 border-lunar-green px-4 py-2 text-sm font-bold text-lunar-green hover:bg-lunar-green hover:text-white transition-colors">
          &larr; Dashboard
        </a>
      </header>

      {/* Search form */}
      <div className="rounded-xl border border-border bg-surface p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Search by email address..."
            className="flex-1 min-w-[200px] rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green placeholder:text-text-light/50 focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
          />
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Or booking reference..."
            className="w-[220px] rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green placeholder:text-text-light/50 focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
          />
          <button
            onClick={handleSearch}
            disabled={loading || (!email.trim() && !reference.trim())}
            className="rounded-lg bg-lunar-green px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-light disabled:opacity-40 transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-terracotta mb-6">{error}</div>
      )}

      {/* Erasure result */}
      {eraseResult && (
        <div className="rounded-xl border-2 border-lunar-green bg-lunar-green/5 p-4 text-sm text-lunar-green mb-6">
          <p className="font-bold">&#10003; Erasure complete</p>
          <p className="mt-1">{eraseResult.count} record(s) anonymised at {new Date(eraseResult.runAt).toLocaleString('en-MT')}</p>
        </div>
      )}

      {/* Matches */}
      {matches && matches.length > 0 && (
        <div className="mb-6">
          <div className="rounded-xl border border-border bg-surface p-4 mb-4">
            <h3 className="text-sm font-bold text-lunar-green mb-2">
              Found {matches.length} booking{matches.length !== 1 ? 's' : ''}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 font-semibold text-text-light">Reference</th>
                  <th className="py-2 font-semibold text-text-light">Event</th>
                  <th className="py-2 font-semibold text-text-light">Status</th>
                  <th className="py-2 font-semibold text-text-light">Created</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.reference} className="border-b border-border/30 last:border-0">
                    <td className="py-2 font-mono text-xs text-lunar-green">{m.reference}</td>
                    <td className="py-2 text-lunar-green">{m.eventTitle || '\u2014'}</td>
                    <td className="py-2 text-lunar-green">{m.status}</td>
                    <td className="py-2 text-xs text-text-light">
                      {new Date(m.createdAt).toLocaleDateString('en-MT')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!confirmed ? (
            <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4">
              <p className="text-sm font-bold text-terracotta mb-3">
                &#9888; This will permanently anonymise all matching records
              </p>
              <p className="text-xs text-text-light mb-4">
                All personal data (name, email, phone, dietary notes) will be replaced with anonymised values.
                This action is irreversible and will be recorded in the audit log.
              </p>
              <button
                onClick={() => setConfirmed(true)}
                className="rounded-lg bg-terracotta px-5 py-2.5 text-sm font-bold text-white hover:bg-terracotta/80 transition-colors"
              >
                Confirm — I understand & proceed
              </button>
            </div>
          ) : (
            <button
              onClick={handleErase}
              disabled={erasing}
              className="rounded-lg bg-terracotta px-5 py-2.5 text-sm font-bold text-white hover:bg-terracotta/80 disabled:opacity-40 transition-colors"
            >
              {erasing ? 'Anonymising...' : 'Execute Erasure'}
            </button>
          )}
        </div>
      )}

      {matches && matches.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-text-light">
          No matching bookings found. The data may have already been anonymised.
        </div>
      )}
    </div>
  )
}
