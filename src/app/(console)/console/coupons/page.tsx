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

function todayMalta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Malta' }).format(new Date())
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

interface CouponStatus {
  label: string
  variant: string
}

function getStatus(c: CouponRow): CouponStatus {
  if (!c.active) return { label: 'Disabled', variant: 'disabled' }
  if (c.maxTotalUses != null && c.useCount >= c.maxTotalUses) return { label: 'Exhausted', variant: 'exhausted' }

  const today = todayMalta()
  const from = c.validFrom ? c.validFrom.slice(0, 10) : ''
  if (from && from > today) {
    const day = new Date(`${from}T00:00:00Z`).toLocaleDateString('en-MT', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    })
    return { label: 'Starts ' + day, variant: 'coupon_scheduled' }
  }

  const days = dayDiff(today, c.validUntil.slice(0, 10))
  if (days < 0) return { label: 'Expired', variant: 'expired' }
  if (days <= 7) return { label: days === 0 ? 'Last day' : days + ' days left', variant: 'expiring' }
  return { label: 'Active', variant: 'active' }
}

const EMPTY_FORM = {
  code: '',
  type: 'percentage' as 'percentage' | 'fixed',
  value: 10,
  validFrom: '',
  validUntil: '',
  maxTotalUses: '',
  maxUsesPerBooking: 1,
  active: true,
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<CouponRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | number | null>(null)
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [originalCode, setOriginalCode] = useState('')

  // Create/edit form state
  const [createForm, setCreateForm] = useState({ ...EMPTY_FORM })
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

  const openCreate = () => {
    setCreateForm({ ...EMPTY_FORM })
    setEditingId(null)
    setCreateError(null)
    setShowCreate(true)
  }

  const openEdit = (c: CouponRow) => {
    setCreateForm({
      code: c.code,
      type: c.type as 'percentage' | 'fixed',
      value: c.value,
      validFrom: c.validFrom ? c.validFrom.slice(0, 10) : '',
      validUntil: c.validUntil.slice(0, 10),
      maxTotalUses: c.maxTotalUses != null ? String(c.maxTotalUses) : '',
      maxUsesPerBooking: c.maxUsesPerBooking ?? 1,
      active: c.active,
    })
    setOriginalCode(c.code)
    setEditingId(c.id)
    setCreateError(null)
    setShowCreate(true)
  }

  const handleSave = async () => {
    if (!createForm.validFrom || !createForm.validUntil) {
      setCreateError('Valid from and valid until dates are required')
      return
    }
    if (!Number.isFinite(createForm.value) || createForm.value <= 0) {
      setCreateError('Value must be a number greater than 0')
      return
    }
    if (createForm.validUntil < createForm.validFrom) {
      setCreateError('Valid until cannot be before valid from')
      return
    }
    if (createForm.type === 'percentage' && createForm.value > 100) {
      setCreateError('Percentage value cannot exceed 100')
      return
    }
    if (!Number.isInteger(createForm.maxUsesPerBooking) || createForm.maxUsesPerBooking < 1) {
      setCreateError('Max uses per booking must be a whole number of 1 or more')
      return
    }
    setSaving(true)
    setCreateError(null)
    try {
      if (editingId) {
        const body: Record<string, unknown> = {
          id: editingId,
          type: createForm.type,
          value: createForm.value,
          validFrom: createForm.validFrom,
          validUntil: createForm.validUntil,
          maxUsesPerBooking: createForm.maxUsesPerBooking,
          active: createForm.active,
          maxTotalUses: createForm.maxTotalUses.trim() ? Number(createForm.maxTotalUses) : null,
        }
        if (createForm.code.trim() !== originalCode) body.code = createForm.code.trim().toUpperCase()

        const res = await fetch('/console/api/coupons', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || 'Failed to save coupon')
        }
      } else {
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
      }
      setShowCreate(false)
      setEditingId(null)
      setCreateForm({ ...EMPTY_FORM })
      fetchCoupons()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Save failed')
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
        <Button onClick={openCreate}>+ Create Coupon</Button>
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
                const code = c.code || '-'
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
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="rounded-md border border-lunar-green px-2.5 py-1 text-xs font-semibold text-lunar-green hover:bg-lunar-green hover:text-white transition-colors"
                        >
                          Edit
                        </button>
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
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setEditingId(null); setCreateError(null) }}
        title={editingId ? 'Edit Coupon' : 'Create Coupon'}
      >
        <div className="space-y-4">
          {createError && (
            <div className="rounded-lg border border-terracotta bg-terracotta/5 p-3 text-xs text-[#9C4E2F]">{createError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-text-light mb-1">
              {editingId ? 'Coupon Code *' : 'Coupon Code (optional, auto-generated)'}
            </label>
            <input
              type="text"
              value={createForm.code}
              onChange={(e) => setCreateForm(prev => ({ ...prev, code: e.target.value }))}
              placeholder="e.g. SUMMER25"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
            {editingId && (
              <p className="mt-1 text-xs text-text-light">Changing the code invalidates the old one.</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-light mb-1">Type *</label>
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
                Value{createForm.type === 'percentage' ? ' (%)' : ' (EUR)'} *
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

          <div className="flex flex-col sm:flex-row gap-3">
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

          <div className="flex flex-col sm:flex-row gap-3">
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
            <span className="text-lunar-green font-semibold">{editingId ? 'Active' : 'Active immediately'}</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setShowCreate(false); setEditingId(null); setCreateError(null) }}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editingId ? 'Save Changes' : 'Create Coupon'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
