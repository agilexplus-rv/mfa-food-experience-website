/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/console/Button'
import Card from '@/components/console/Card'
import Modal from '@/components/console/Modal'
import { Pagination } from '@/components/console/DataTable'
import RichTextEditor from '@/components/console/editor/RichTextEditor'

interface PolicyRow {
  id: string | number
  slug: string
  title: string
  body: unknown
  version: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

interface SearchResult {
  docs: PolicyRow[]
  totalDocs: number
  page: number
  totalPages: number
}

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString('en-MT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function PoliciesPage() {
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | number | null>(null)
  const [form, setForm] =  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useState<Record<string, any>>({
    slug: '',
    title: '',
    body: {} as unknown,
    version: '',
    reviewedAt: '',
  })
  const [originalBody, setOriginalBody] = useState<string>('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const search = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '25')
      const res = await fetch(`/console/api/policies?${params.toString()}`)
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to load policies')
      }
      const data = await res.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policies')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { void search() }, [search])

  const openEdit = (p: PolicyRow) => {
    setEditId(p.id)
    setForm({
      slug: p.slug,
      title: p.title,
      body: p.body || {},
      version: p.version || '',
      reviewedAt: p.reviewedAt ? p.reviewedAt.split('T')[0] : '',
    })
    setOriginalBody(JSON.stringify(p.body || {}))
    setFormError(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.slug.trim()) {
      setFormError('Title and slug are required.')
      return
    }

    // Check if body changed and auto-set reviewedAt
    const currentBodyStr = JSON.stringify(form.body)
    const bodyChanged = currentBodyStr !== originalBody

    if (bodyChanged && !form.reviewedAt) {
      // Auto-set to today
      setForm(prev => ({ ...prev, reviewedAt: new Date().toISOString().split('T')[0] }))
    }

    setSaving(true)
    setFormError(null)
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        slug: form.slug.trim().toLowerCase(),
        version: form.version,
        reviewedAt: bodyChanged ? (form.reviewedAt || new Date().toISOString().split('T')[0]) : form.reviewedAt || undefined,
      }
      if (bodyChanged) {
        payload.body = form.body
      }

      const res = await fetch(`/console/api/policies/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || data?.error || 'Update failed')

      setModalOpen(false)
      void search()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-lunar-green tracking-tight">Policies</h1>
          <p className="mt-1 text-sm text-text-light">Edit legal and policy documents</p>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{error}</div>
      )}

      {loading && !results && (
        <div className="text-center py-16 text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading policies...
        </div>
      )}

      {results && results.totalDocs === 0 && (
        <Card className="text-center" padding>
          <p className="text-text-light">No policies found. Seed the database to create policy documents.</p>
        </Card>
      )}

      {results && results.totalDocs > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-soft-beige/50 text-left">
                  <th className="px-4 py-3 font-semibold text-text-light">Title</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Slug</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Version</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Last Reviewed</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.docs.map((p) => (
                  <tr key={String(p.id)} className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-lunar-green">{p.title}</td>
                    <td className="px-4 py-3 text-xs text-text-light font-mono">{p.slug}</td>
                    <td className="px-4 py-3 text-sm text-text-light">{p.version || '\u2014'}</td>
                    <td className="px-4 py-3 text-sm text-text-light">{formatDate(p.reviewedAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded-md border border-lunar-green px-2 py-0.5 text-[10px] font-semibold text-lunar-green hover:bg-lunar-green hover:text-white transition-colors"
                      >
                        Edit
                      </button>
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

      {/* Edit Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setFormError(null) }} title={`Edit Policy: ${form.title}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Slug *</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green font-mono focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-lunar-green mb-1">Version</label>
              <input
                type="text"
                value={form.version}
                onChange={(e) => setForm(prev => ({ ...prev, version: e.target.value }))}
                placeholder="e.g. 1.0"
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                style={{ boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-lunar-green mb-1">
                Last Reviewed
                {JSON.stringify(form.body) !== originalBody && (
                  <span className="ml-1 text-xs text-matte-gold">(auto-updated on save)</span>
                )}
              </label>
              <input
                type="date"
                value={form.reviewedAt}
                onChange={(e) => setForm(prev => ({ ...prev, reviewedAt: e.target.value }))}
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
                style={{ boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Body *</label>
            <RichTextEditor
              value={form.body}
              onChange={(v) => setForm(prev => ({ ...prev, body: v }))}
              placeholder="Write policy content..."
            />
          </div>
          {formError && (
            <div className="rounded-lg border border-terracotta bg-terracotta/5 p-3 text-sm text-[#9C4E2F]">{formError}</div>
          )}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} loading={saving}>Save Changes</Button>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setFormError(null) }}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
