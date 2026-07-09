'use client'

import { useState } from 'react'

interface WaitlistFormProps {
  eventId: string | number
}

export function WaitlistForm({ eventId }: WaitlistFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [persons, setPersons] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: String(eventId),
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          persons,
        }),
      })
      const data = await res.json()
      setResult({ ok: res.ok, message: data.message || data.error || 'Something went wrong' })
      if (res.ok) {
        setName('')
        setEmail('')
        setPhone('')
        setPersons(1)
      }
    } catch {
      setResult({ ok: false, message: 'Could not reach the server. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (result?.ok) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-lunar-green bg-lunar-green/5 p-8 text-center">
        <p className="text-lg font-semibold text-lunar-green">You're on the waitlist</p>
        <p className="mt-2 text-sm text-text-light">{result.message}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-border bg-surface p-6">
      <h3 className="text-lg font-bold text-lunar-green mb-1">Join waitlist</h3>
      <p className="text-sm text-text-light mb-4">
        We'll email you if a seat becomes available.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-lunar-green mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your name"
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green placeholder:text-text-light/50 focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-lunar-green mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green placeholder:text-text-light/50 focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-lunar-green mb-1">Phone (optional)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+356 ..."
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green placeholder:text-text-light/50 focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-lunar-green mb-1">Persons</label>
            <select
              value={persons}
              onChange={(e) => setPersons(Number(e.target.value))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
        {result && !result.ok && (
          <p className="text-sm text-terracotta">{result.message}</p>
        )}
        <button
          type="submit"
          disabled={submitting || !name.trim() || !email.trim()}
          className="rounded-lg bg-lunar-green px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-light disabled:opacity-40 transition-colors"
        >
          {submitting ? 'Joining...' : 'Join waitlist'}
        </button>
      </form>
    </div>
  )
}
