/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/console/Button'
import Card from '@/components/console/Card'

interface MediaItem {
  id: string
  alt?: string
  filename?: string
  url?: string
}

interface SiteSettingsData {
  heroBackgroundImage?: string | MediaItem | null
  contactFormRecipients?: string | null
}

interface SiteSettingsForm {
  heroBackgroundImageId: string | null
  contactFormRecipients: string
}

export default function SiteSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState<SiteSettingsForm>({ heroBackgroundImageId: null, contactFormRecipients: '' })
  const [currentImage, setCurrentImage] = useState<MediaItem | null>(null)

  // Media picker state
  const [mediaList, setMediaList] = useState<MediaItem[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/console/api/site-settings')
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) throw new Error('Failed to load settings')
      const data = await res.json()
      const s = data.settings as SiteSettingsData
      const img = s.heroBackgroundImage
      const contactFormRecipients = s.contactFormRecipients || ''
      if (img && typeof img === 'object' && 'id' in img) {
        const m = img as MediaItem
        setCurrentImage(m)
        setForm({ heroBackgroundImageId: String(m.id), contactFormRecipients })
      } else if (img && typeof img === 'string') {
        setCurrentImage({ id: img })
        setForm({ heroBackgroundImageId: img, contactFormRecipients })
      } else {
        setCurrentImage(null)
        setForm({ heroBackgroundImageId: null, contactFormRecipients })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const fetchMedia = useCallback(async () => {
    setMediaLoading(true)
    try {
      const res = await fetch('/console/api/media?limit=50')
      if (!res.ok) throw new Error('Failed to load media')
      const data = await res.json()
      setMediaList(data.docs || [])
    } catch {
      // silent: picker just shows nothing
    } finally {
      setMediaLoading(false)
    }
  }, [])

  const openPicker = () => {
    setShowPicker(true)
    fetchMedia()
  }

  const handleSelectMedia = (item: MediaItem) => {
    setCurrentImage(item)
    setForm((f) => ({ ...f, heroBackgroundImageId: String(item.id) }))
    setShowPicker(false)
  }

  const handleClearImage = () => {
    setCurrentImage(null)
    setForm((f) => ({ ...f, heroBackgroundImageId: null }))
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('alt', file.name.replace(/\.[^/.]+$/, ''))
      const res = await fetch('/console/api/media', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      if (data.ok && data.id) {
        await fetchMedia()
        handleSelectMedia({ id: String(data.id), alt: file.name, url: data.url, filename: data.filename })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const validateRecipients = (raw: string): string | null => {
    const trimmed = raw.trim()
    if (!trimmed) return null // empty is valid -- falls back to env default
    const addresses = trimmed.split(';').map((a) => a.trim()).filter(Boolean)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const invalid = addresses.filter((a) => !emailPattern.test(a))
    if (invalid.length > 0) {
      return `Invalid email address${invalid.length > 1 ? 'es' : ''}: ${invalid.join(', ')}`
    }
    return null
  }

  const handleSave = async () => {
    const recipientsError = validateRecipients(form.contactFormRecipients)
    if (recipientsError) {
      setError(recipientsError)
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/console/api/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heroBackgroundImage: form.heroBackgroundImageId || null,
          contactFormRecipients: form.contactFormRecipients.trim() || null,
        }),
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
        Loading site settings...
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-8 text-2xl font-black text-lunar-green tracking-tight">Site Settings</h1>

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
          <h2 className="text-sm font-bold text-lunar-green mb-2">Homepage Hero Background Image</h2>
          <p className="text-xs text-text-light mb-4">
            Optional. When set, the homepage Hero section renders with this image as a darkened background (with an overlay gradient for text readability). When empty, Hero uses the default text-only Soft-Beige layout.
          </p>

          {currentImage && currentImage.url ? (
            <div className="mb-4">
              <div className="relative overflow-hidden rounded-lg border border-border" style={{ maxWidth: '400px' }}>
                <img
                  src={currentImage.url}
                  alt={currentImage.alt || 'Hero background'}
                  className="w-full h-auto"
                  style={{ display: 'block' }}
                />
              </div>
              <p className="mt-2 text-xs text-text-light">
                Current: {currentImage.filename || currentImage.id}
              </p>
            </div>
          ) : currentImage ? (
            <div className="mb-4 p-4 rounded-lg border border-border bg-soft-beige/30">
              <p className="text-sm text-text-light">
                Image selected (ID: {currentImage.id})
              </p>
            </div>
          ) : (
            <div className="mb-4 p-4 rounded-lg border border-dashed border-border bg-soft-beige/30">
              <p className="text-sm text-text-light">
                No hero background image set. Hero will use the default text-only layout.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" onClick={openPicker}>Select from Media</Button>
            <label
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-colors bg-lunar-green/10 text-lunar-green hover:bg-lunar-green/20"
            >
              {uploading ? 'Uploading...' : 'Upload New'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file)
                  e.target.value = ''
                }}
              />
            </label>
            {currentImage && (
              <Button variant="secondary" size="sm" onClick={handleClearImage}>Clear</Button>
            )}
          </div>
        </Card>

        <Card padding>
          <h2 className="text-sm font-bold text-lunar-green mb-2">Contact Form Recipients</h2>
          <p className="text-xs text-text-light mb-4">
            Email address(es) that receive messages sent via the public Contact page. Separate multiple addresses with a semicolon (e.g. info@foodagency.mt; bookings@foodagency.mt). Leave empty to use the server&apos;s default admin alert address.
          </p>
          <input
            type="text"
            value={form.contactFormRecipients}
            onChange={(e) => setForm((f) => ({ ...f, contactFormRecipients: e.target.value }))}
            placeholder="info@foodagency.mt; bookings@foodagency.mt"
            className="w-full rounded-lg border border-border bg-soft-beige/40 px-4 py-2.5 text-sm text-lunar-green placeholder:text-text-light/60 focus:border-lunar-green focus:outline-2 focus:outline-offset-1 focus:outline-lunar-green"
          />
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave} loading={saving}>Save Settings</Button>
        </div>
      </div>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPicker(false)}>
          <div
            className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-lunar-green">Select Media</h3>
              <button
                onClick={() => setShowPicker(false)}
                className="rounded-lg p-2 text-text-light hover:bg-soft-beige"
                aria-label="Close"
              >
                &#x2715;
              </button>
            </div>
            {mediaLoading ? (
              <div className="text-center py-8 text-text-light">Loading media...</div>
            ) : mediaList.length === 0 ? (
              <div className="text-center py-8 text-text-light">No media found. Upload an image first.</div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {mediaList.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectMedia(item)}
                    className="group rounded-lg border border-border p-3 text-left hover:border-lunar-green hover:shadow-md transition-all"
                  >
                    {item.url ? (
                      <div className="mb-2 overflow-hidden rounded" style={{ aspectRatio: '16/9' }}>
                        <img src={item.url} alt={item.alt || ''} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="mb-2 flex items-center justify-center rounded bg-soft-beige" style={{ aspectRatio: '16/9' }}>
                        <span className="text-xs text-text-light">No preview</span>
                      </div>
                    )}
                    <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-lunar-green">{item.filename || item.id}</p>
                    <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-light">{item.alt || 'No alt text'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
