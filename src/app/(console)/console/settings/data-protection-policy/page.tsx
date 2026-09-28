/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Button from '@/components/console/Button'
import Card from '@/components/console/Card'
import RichTextEditor from '@/components/console/editor/RichTextEditor'
import { getExcerpt } from '@/lib/payload'

export default function DataProtectionPolicyPage() {
  const [body, setBody] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const fetchPolicy = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/console/api/data-protection-policy')
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) throw new Error('Failed to load policy')
      const data = await res.json()
      setBody(data.policy?.body ?? null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPolicy() }, [fetchPolicy])

  const handleSave = async () => {
    if (!getExcerpt(body, 1)) {
      setError('Please write the policy content.')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/console/api/data-protection-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
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
        Loading policy...
      </div>
    )
  }

  return (
    <div>
      <Link href="/console/settings" className="mb-4 inline-block text-sm font-semibold text-lunar-green hover:underline">
        &larr; Back to Settings
      </Link>
      <h1 className="mb-8 text-2xl font-black text-lunar-green tracking-tight">Data Protection Policy</h1>

      {loadError ? (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{loadError}</div>
      ) : (
        <div className="space-y-6">
          <Card padding>
            <h2 className="text-sm font-bold text-lunar-green mb-2">Policy content</h2>
            <p className="text-xs text-text-light mb-4">
              Replace the placeholders in square brackets, such as [COMPANY LEGAL NAME] and [DATE], with the real details.
              Links are kept when you save. To add a link or change where one points, save your changes here first, then use
              the{' '}
              <Link href="/admin/globals/data-protection-policy" className="font-semibold text-lunar-green underline">
                full admin editor
              </Link>
              .
            </p>
            <RichTextEditor value={body} onChange={setBody} placeholder="Write the Data Protection Policy..." />
          </Card>

          {/* Kept in view while scrolling: the policy is long, and a banner at
              the top of the page would be off-screen after saving. */}
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-border bg-soft-beige/95 py-4 backdrop-blur-sm">
            <Button onClick={handleSave} loading={saving}>Save Policy</Button>
            <p role="status" className={`text-sm font-semibold ${error ? 'text-[#9C4E2F]' : 'text-lunar-green'}`}>
              {error || (success ? 'Policy saved successfully.' : '')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
