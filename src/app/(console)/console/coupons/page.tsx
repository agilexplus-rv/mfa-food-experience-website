/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Badge from '@/components/console/Badge'
import Button from '@/components/console/Button'
import Card from '@/components/console/Card'
import Modal from '@/components/console/Modal'

interface CouponRow {
  id: string | number
  code: string
  type: string
  value: number
  useCount: number
  maxTotalUses: number | null
  active: boolean
  validFrom: string | null
  validUntil: string
  applicableServices: (string | number)[] | null
  maxUsesPerBooking: number
  totalDiscountRedeemed: number
  redemptionsCount: number
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  const until = new Date(dateStr)
  return Math.ceil((until.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

interface CouponStatus {
  label: string
  variant: string
}

function getStatus(c: CouponRow): CouponStatus {
  if (!c.active) return { label: 'Disabled', variant: 'disabled' }
  if (c.maxTotalUses != null && c.useCount >= c.maxTotalUses) return { label: 'Exhausted', variant: 'exhausted' }
  const days = daysUntil(c.validUntil)
  if (days < 0) return { label: 'Expired', variant: 'expired' }
  if (days <= 7) return { label: days + ' days left', variant: 'expiring' }
  return { label: 'Active', variant: 'active' }
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<CouponRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | number | null>(null)

  // Create form state
  const [createForm, setCreateForm] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 10,
    validFrom: '',
    validUntil: '',
    maxTotalUses: '',
    maxUsesPerBooking: 1,
    active: true,
  })
  const [createError, setCreateError] = useState<string | null>(null)

  const fetchCoupons = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/console/api/coupons')
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to load coupons')
      }
      const data = await res.json()
      setCoupons(data.coupons)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCoupons() }, [fetchCoupons])

  const handleCreate = async () => {
    if (!createForm.validFrom || !createForm.validUntil) {
      setCreateError('Valid from and valid until dates are required')
      return
    }
    setSaving(true)
    setCreateError(null)
    try {
      const body: Record<string, unknown> = {
        type: createForm.type,
        value: createForm.value,
        validFrom: createForm.validFrom,
        validUntil: createForm.validUntil,
        maxUsesPerBooking: createForm.maxUsesPerBooking,
        active: createForm.active,
      }
      if (createForm.code.trim()) body.code = createForm.code.trim().toUpperCase()
      if (createForm.maxTotalUses.trim()) body.maxTotalUses = Number(createForm.maxTotalUses)

      const res = await fetch('/console/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to create coupon')
      }
      setShowCreate(false)
      setCreateForm({
        code: '', type: 'percentage', value: 10, validFrom: '', validUntil: '',
        maxTotalUses: '', maxUsesPerBooking: 1, active: true,
      })
      fetchCoupons()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (c: CouponRow) => {
    setTogglingId(c.id)
    try {
      const res = await fetch('/console/api/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, active: !c.active }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Toggle failed')
      }
      fetchCoupons()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Toggle failed')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-lunar-green tracking-tight">Coupons</h1>
          <p className="mt-1 text-sm text-text-light">Create, manage, and track coupon usage and redemption</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Create Coupon</Button>
      </header>

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{error}</div>
      )}

      {loading && !coupons.length && (
        <div className="text-center py-16 text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading coupons...
        </div>
      )}

      {!loading && !error && coupons.length === 0 && (
        <Card className="text-center" padding>
          <p className="text-text-light">No coupons found. Create one to start tracking.</p>
        </Card>
      )}

      {coupons.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-soft-beige/50 text-left">
                <th className="px-4 py-3 font-semibold text-text-light">Code</th>
                <th className="px-4 py-3 font-semibold text-text-light">Type</th>
                <th className="px-4 py-3 font-semibold text-text-light text-right">Value</th>
                <th className="px-4 py-3 font-semibold text-text-light text-right">Uses</th>
                <th className="px-4 py-3 font-semibold text-text-light text-right">Discount Redeemed</th>
                <th className="px-4 py-3 font-semibold text-text-light">Status</th>
                <th className="px-4 py-3 font-semibold text-text-light text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const status = getStatus(c)
                const code = c.code || '\u2014'
                return (
                  <tr key={String(c.id)} className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-lunar-green font-bold">{code}</td>
                    <td className="px-4 py-3 text-xs capitalize">{c.type}</td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums">
                      {c.type === 'percentage' ? c.value + '%' : '\u20ac' + c.value.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums">
                      {c.useCount}{c.maxTotalUses != null ? ' / ' + c.maxTotalUses : ''}
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums">
                      {'\u20ac' + c.totalDiscountRedeemed.toFixed(2)}
                      <span className="text-text-light ml-1">({c.redemptionsCount})</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(c)}
                        disabled={togglingId === c.id}
                        className={'rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-40 transition-colors ' + (
                          c.active
                            ? 'border-terracotta text-[#9C4E2F] hover:bg-terracotta hover:text-white'
                            : 'border-lunar-green text-lunar-green hover:bg-lunar-green hover:text-white'
                        )}
                      >
                        {togglingId === c.id ? '...' : c.active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setCreateError(null) }} title="Create Coupon">
        <div className="space-y-4">
          {createError && (
            <div className="rounded-lg border border-terracotta bg-terracotta/5 p-3 text-xs text-[#9C4E2F]">{createError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-text-light mb-1">Coupon Code (optional, auto-generated)</label>
            <input
              type="text"
              value={createForm.code}
              onChange={(e) => setCreateForm(prev => ({ ...prev, code: e.target.value }))}
              placeholder="e.g. SUMMER25"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-light mb-1">Type</label>
              <select
                value={createForm.type}
                onChange={(e) => setCreateForm(prev => ({ ...prev, type: e.target.value as 'percentage' | 'fixed' }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                style={{ boxSizing: 'border-box' }}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed (EUR)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-light mb-1">
                Value{createForm.type === 'percentage' ? ' (%)' : ' (EUR)'}
              </label>
              <input
                type="number"
                min="0"
                max={createForm.type === 'percentage' ? '100' : undefined}
                value={createForm.value}
                onChange={(e) => setCreateForm(prev => ({ ...prev, value: Number(e.target.value) }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                style={{ boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-light mb-1">Valid From *</label>
              <input
                type="date"
                value={createForm.validFrom}
                onChange={(e) => setCreateForm(prev => ({ ...prev, validFrom: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                style={{ boxSizing: 'border-box' }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-light mb-1">Valid Until *</label>
              <input
                type="date"
                value={createForm.validUntil}
                onChange={(e) => setCreateForm(prev => ({ ...prev, validUntil: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                style={{ boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-light mb-1">Max Total Uses (optional)</label>
              <input
                type="number"
                min="0"
                value={createForm.maxTotalUses}
                onChange={(e) => setCreateForm(prev => ({ ...prev, maxTotalUses: e.target.value }))}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                style={{ boxSizing: 'border-box' }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-light mb-1">Max Uses Per Booking</label>
              <input
                type="number"
                min="1"
                value={createForm.maxUsesPerBooking}
                onChange={(e) => setCreateForm(prev => ({ ...prev, maxUsesPerBooking: Number(e.target.value) }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                style={{ boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createForm.active}
              onChange={(e) => setCreateForm(prev => ({ ...prev, active: e.target.checked }))}
              className="rounded"
            />
            <span className="text-lunar-green font-semibold">Active immediately</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setShowCreate(false); setCreateError(null) }}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}>Create Coupon</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
