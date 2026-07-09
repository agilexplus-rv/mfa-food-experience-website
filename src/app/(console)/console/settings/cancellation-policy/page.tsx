/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/console/Button'
import Card from '@/components/console/Card'

interface Tier {
  id?: string
  minDaysBeforeEvent: number
  refundPercentage: number
  label?: string
}

interface Policy {
  enabled: boolean
  introText?: string
  tiers?: Tier[]
  organiserCancellationText?: string
  withdrawalRightDisclosure?: string
}

export default function CancellationPolicyPage() {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState<Policy>({
    enabled: true,
    introText: '',
    tiers: [
      { minDaysBeforeEvent: 7, refundPercentage: 100, label: '' },
      { minDaysBeforeEvent: 0, refundPercentage: 0, label: 'No refund' },
    ],
    organiserCancellationText: '',
    withdrawalRightDisclosure: '',
  })

  const fetchPolicy = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/console/api/cancellation-policy')
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) throw new Error('Failed to load policy')
      const data = await res.json()
      const p = data.policy
      // Re-map _id to id for the tiers array
      const tiers = (p.tiers || []).map((t: Record<string, unknown>) => ({
        id: String(t.id || ''),
        minDaysBeforeEvent: Number(t.minDaysBeforeEvent) || 0,
        refundPercentage: Number(t.refundPercentage) || 0,
        label: (t.label as string) || '',
      }))
      const loaded = {
        enabled: p.enabled ?? true,
        introText: (p.introText as string) || '',
        tiers,
        organiserCancellationText: (p.organiserCancellationText as string) || '',
        withdrawalRightDisclosure: (p.withdrawalRightDisclosure as string) || '',
      }
      setPolicy(loaded)
      setForm(loaded)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPolicy() }, [fetchPolicy])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/console/api/cancellation-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Save failed')
      }
      const data = await res.json()
      const p = data.policy
      const tiers = (p.tiers || []).map((t: Record<string, unknown>) => ({
        id: String(t.id || ''),
        minDaysBeforeEvent: Number(t.minDaysBeforeEvent) || 0,
        refundPercentage: Number(t.refundPercentage) || 0,
        label: (t.label as string) || '',
      }))
      const saved = {
        enabled: p.enabled ?? true,
        introText: (p.introText as string) || '',
        tiers,
        organiserCancellationText: (p.organiserCancellationText as string) || '',
        withdrawalRightDisclosure: (p.withdrawalRightDisclosure as string) || '',
      }
      setPolicy(saved)
      setForm(saved)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const addTier = () => {
    setForm(prev => ({
      ...prev,
      tiers: [...(prev.tiers || []), { minDaysBeforeEvent: 0, refundPercentage: 0, label: '' }],
    }))
  }

  const removeTier = (index: number) => {
    setForm(prev => ({
      ...prev,
      tiers: (prev.tiers || []).filter((_, i) => i !== index),
    }))
  }

  const updateTier = (index: number, field: keyof Tier, value: string | number) => {
    setForm(prev => {
      const tiers = [...(prev.tiers || [])]
      tiers[index] = { ...tiers[index], [field]: value }
      return { ...prev, tiers }
    })
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-text-light">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
        Loading policy...
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-8 text-2xl font-black text-lunar-green tracking-tight">Cancellation Policy</h1>

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{error}</div>
      )}

      {success && (
        <div className="rounded-xl border-2 border-lunar-green bg-lunar-green/5 p-4 text-sm text-lunar-green mb-4">
          Policy saved successfully.
        </div>
      )}

      <div className="space-y-6">
        {/* Master switch */}
        <Card padding>
          <label className="flex items-center gap-3 text-sm font-semibold text-lunar-green mb-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm(prev => ({ ...prev, enabled: e.target.checked }))}
              className="rounded"
            />
            Cancellations enabled
          </label>
          <p className="text-xs text-text-light">
            Master on/off. When off, all cancellation tiers are hidden and the public page will state that cancellations are not permitted.
          </p>
        </Card>

        {/* Intro text */}
        <Card padding>
          <label className="block text-sm font-semibold text-lunar-green mb-2">Introductory Text</label>
          <textarea
            value={form.introText || ''}
            onChange={(e) => setForm(prev => ({ ...prev, introText: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            style={{ boxSizing: 'border-box' }}
          />
          <p className="mt-1 text-xs text-text-light">
            Optional free-text shown above the cancellation tiers table.
          </p>
        </Card>

        {/* Tiers */}
        <Card padding>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-lunar-green">Cancellation Tiers</h2>
            <Button variant="secondary" size="sm" onClick={addTier}>+ Add Tier</Button>
          </div>
          <p className="text-xs text-text-light mb-4">
            List tiers from MOST days-before to FEWEST (e.g. 14 days → 7 days → 0 days).
          </p>
          {(form.tiers || []).map((tier, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 mb-3 p-3 rounded-lg border border-border bg-soft-beige/30">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs font-semibold text-text-light mb-1">Min days before event</label>
                <input
                  type="number"
                  min="0"
                  value={tier.minDaysBeforeEvent}
                  onChange={(e) => updateTier(i, 'minDaysBeforeEvent', Number(e.target.value))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                  style={{ boxSizing: 'border-box' }}
                />
              </div>
              <div className="flex-1 min-w-[100px]">
                <label className="block text-xs font-semibold text-text-light mb-1">Refund %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={tier.refundPercentage}
                  onChange={(e) => updateTier(i, 'refundPercentage', Number(e.target.value))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                  style={{ boxSizing: 'border-box' }}
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs font-semibold text-text-light mb-1">Label (optional)</label>
                <input
                  type="text"
                  value={tier.label || ''}
                  onChange={(e) => updateTier(i, 'label', e.target.value)}
                  placeholder="e.g. Full refund"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                  style={{ boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={() => removeTier(i)}
                className="rounded-lg border border-[#9C4E2F] px-3 py-2 text-xs font-semibold text-[#9C4E2F] hover:bg-terracotta hover:text-white transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </Card>

        {/* Organiser cancellation text */}
        <Card padding>
          <label className="block text-sm font-semibold text-lunar-green mb-2">
            Organiser Cancellation Text
          </label>
          <textarea
            value={form.organiserCancellationText || ''}
            onChange={(e) => setForm(prev => ({ ...prev, organiserCancellationText: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            style={{ boxSizing: 'border-box' }}
          />
          <p className="mt-1 text-xs text-text-light">
            What happens if THE ORGANISER cancels the event (e.g. full refund or reschedule).
          </p>
        </Card>

        {/* Withdrawal right disclosure */}
        <Card padding>
          <label className="block text-sm font-semibold text-lunar-green mb-2">
            Withdrawal Right Disclosure (Art. 16(l) / Art. 6(1)(k))
          </label>
          <textarea
            value={form.withdrawalRightDisclosure || ''}
            onChange={(e) => setForm(prev => ({ ...prev, withdrawalRightDisclosure: e.target.value }))}
            rows={4}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            style={{ boxSizing: 'border-box' }}
          />
          <p className="mt-1 text-xs text-text-light">
            Legally required disclosure. Edit only if legal advice confirms a change is needed.
          </p>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave} loading={saving}>Save Policy</Button>
        </div>
      </div>
    </div>
  )
}
