'use client'

import { useCallback, useEffect, useState } from 'react'

interface CouponRow {
  id: string | number
  code: string
  type: string
  value: number
  useCount: number
  maxTotalUses: number | null
  active: boolean
  validUntil: string
  totalDiscountRedeemed: number
  redemptionsCount: number
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<CouponRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCoupons = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/admin-tools/api/coupons')
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
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

  useEffect(() => {
    void fetchCoupons()
  }, [fetchCoupons])

  const daysUntil = (dateStr: string) => {
    const now = new Date()
    const until = new Date(dateStr)
    const diff = Math.ceil((until.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const formatStatus = (c: CouponRow) => {
    if (!c.active) return { label: 'Disabled', color: 'bg-gray-200 text-gray-600' }
    if (c.maxTotalUses != null && c.useCount >= c.maxTotalUses) return { label: 'Exhausted', color: 'bg-terracotta/20 text-terracotta' }
    const days = daysUntil(c.validUntil)
    if (days < 0) return { label: 'Expired', color: 'bg-terracotta/20 text-terracotta' }
    if (days <= 7) return { label: `Expires in ${days}d`, color: 'bg-matte-gold/20 text-matte-gold' }
    return { label: 'Active', color: 'bg-lunar-green/20 text-lunar-green' }
  }

  return (
    <div className="mx-auto max-w-5xl w-full px-4 py-8">
      <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-lunar-green tracking-tight">Coupon Analytics</h1>
          <p className="mt-1 text-sm text-text-light">Performance overview of all coupons</p>
        </div>
        <a href="/dashboard" className="rounded-lg border-2 border-lunar-green px-4 py-2 text-sm font-bold text-lunar-green hover:bg-lunar-green hover:text-white transition-colors">
          &larr; Dashboard
        </a>
      </header>

      {loading && (
        <div className="text-center py-16 text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading coupons...
        </div>
      )}

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-terracotta">{error}</div>
      )}

      {!loading && !error && coupons.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center text-text-light">No coupons found.</div>
      )}

      {!loading && !error && coupons.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-soft-beige/50 text-left">
                <th className="px-4 py-3 font-semibold text-text-light">Code</th>
                <th className="px-4 py-3 font-semibold text-text-light">Discount</th>
                <th className="px-4 py-3 font-semibold text-text-light text-center">Used / Max</th>
                <th className="px-4 py-3 font-semibold text-text-light text-right">Total Redeemed</th>
                <th className="px-4 py-3 font-semibold text-text-light">Status</th>
                <th className="px-4 py-3 font-semibold text-text-light">Expires</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const st = formatStatus(c)
                const days = daysUntil(c.validUntil)
                return (
                  <tr key={String(c.id)} className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-lunar-green">{c.code}</td>
                    <td className="px-4 py-3 text-lunar-green">
                      {c.type === 'percentage' ? `${c.value}%` : `\u20AC${c.value.toFixed(2)}`}
                    </td>
                    <td className="px-4 py-3 text-center text-lunar-green">
                      {c.useCount}{c.maxTotalUses != null ? ` / ${c.maxTotalUses}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-lunar-green">
                      \u20AC{(c.totalDiscountRedeemed || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-light">
                      {new Date(c.validUntil).toLocaleDateString('en-MT')}
                      {days >= 0 && days <= 30 && <span className="ml-1 text-matte-gold">({days}d)</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
