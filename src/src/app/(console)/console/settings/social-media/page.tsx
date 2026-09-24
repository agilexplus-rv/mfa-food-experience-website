/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/console/Button'
import Card from '@/components/console/Card'

interface PlatformEntry {
  id?: string
  platform: string
  url: string
  published: boolean
}

export default function SocialMediaSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [platforms, setPlatforms] = useState<PlatformEntry[]>([])

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/console/api/social-media-settings')
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) throw new Error('Failed to load settings')
      const data = await res.json()
      const s = data.settings
      const list: PlatformEntry[] = (s.platforms || []).map((p: Record<string, unknown>) => ({
        id: String(p.id || ''),
        platform: (p.platform as string) || '',
        url: (p.url as string) || '',
        published: Boolean(p.published),
      }))
      setPlatforms(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const updatePlatform = (index: number, field: keyof PlatformEntry, value: string | boolean) => {
    setPlatforms(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/console/api/social-media-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Save failed')
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-text-light">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
        Loading social media settings...
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-8 text-2xl font-black text-lunar-green tracking-tight">Social Media Settings</h1>

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{error}</div>
      )}

      {success && (
        <div className="rounded-xl border-2 border-lunar-green bg-lunar-green/5 p-4 text-sm text-lunar-green mb-4">
          Settings saved successfully.
        </div>
      )}

      <div className="space-y-6">
        <Card padding>
          <p className="text-xs text-text-light mb-4">
            Configure the social media links displayed in the site footer. When a platform&apos;s
            toggle is off, its icon is hidden from the footer entirely. When on, the footer links
            to the URL specified here.
          </p>

          {platforms.length === 0 && (
            <p className="text-sm text-text-light">No platforms configured.</p>
          )}

          {platforms.map((entry, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 mb-3 p-3 rounded-lg border border-border bg-soft-beige/30">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-semibold text-text-light mb-1">Platform</label>
                <select
                  value={entry.platform}
                  onChange={(e) => updatePlatform(i, 'platform', e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                  style={{ boxSizing: 'border-box' }}
                >
                  <option value="">Select...</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="x">X</option>
                </select>
              </div>
              <div className="flex-[2] min-w-[200px]">
                <label className="block text-xs font-semibold text-text-light mb-1">Profile URL</label>
                <input
                  type="text"
                  value={entry.url}
                  onChange={(e) => updatePlatform(i, 'url', e.target.value)}
                  placeholder="https://instagram.com/yourpage"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                  style={{ boxSizing: 'border-box' }}
                />
              </div>
              <div className="min-w-[120px]">
                <label className="flex items-center gap-2 text-xs font-semibold text-lunar-green whitespace-nowrap pt-6">
                  <input
                    type="checkbox"
                    checked={entry.published}
                    onChange={(e) => updatePlatform(i, 'published', e.target.checked)}
                    className="rounded"
                  />
                  Published
                </label>
              </div>
            </div>
          ))}
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave} loading={saving}>Save Settings</Button>
        </div>
      </div>
    </div>
  )
}
