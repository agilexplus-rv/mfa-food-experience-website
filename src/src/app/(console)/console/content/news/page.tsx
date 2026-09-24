/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/console/Button'
import Badge from '@/components/console/Badge'
import Card from '@/components/console/Card'
import Modal from '@/components/console/Modal'
import { Pagination } from '@/components/console/DataTable'
import RichTextEditor from '@/components/console/editor/RichTextEditor'

interface NewsRow {
  id: string | number
  title: string
  date: string
  slug: string
  published: boolean
  body: unknown
  imageId: string | number | null
  imageUrl: string | null
  imageAlt: string | null
  createdAt: string
  updatedAt: string
}

interface SearchResult {
  docs: NewsRow[]
  totalDocs: number
  page: number
  totalPages: number
}

interface MediaOption {
  id: string | number
  filename: string | null
  url: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString('en-MT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  return iso.split('T')[0]
}

const defaultLexical = {
  root: {
    children: [{ children: [{ type: 'text', text: '', format: 0 }], direction: 'ltr', format: '', indent: 0, type: 'paragraph' }],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
  },
}

export default function NewsManagementPage() {
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | number | null>(null)
   
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<Record<string, any>>({
    title: '',
    slug: '',
    date: new Date().toISOString().split('T')[0],
    body: defaultLexical,
    published: false,
    imageId: '',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState<string | number | null>(null)

  // Media options for image picker
  const [mediaOpts, setMediaOpts] = useState<MediaOption[]>([])

  const search = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '25')
      const res = await fetch(`/console/api/news?${params.toString()}`)
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to load news')
      }
      const data = await res.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news')
    } finally {
      setLoading(false)
    }
  }, [page])

  const fetchMedia = async () => {
    try {
      const res = await fetch('/console/api/media?limit=200')
      if (!res.ok) return
      const data = await res.json()
      setMediaOpts(data.docs || [])
    } catch { /* ignore */ }
  }

  useEffect(() => { void search() }, [search])

  const openCreate = () => {
    setEditId(null)
    setForm({ title: '', slug: '', date: new Date().toISOString().split('T')[0], body: defaultLexical, published: false, imageId: '' })
    setFormError(null)
    void fetchMedia()
    setModalOpen(true)
  }

  const openEdit = (n: NewsRow) => {
    setEditId(n.id)
    setForm({
      title: n.title,
      slug: n.slug,
      date: toDateInput(n.date),
      body: n.body || defaultLexical,
      published: n.published,
      imageId: n.imageId ? String(n.imageId) : '',
    })
    setFormError(null)
    void fetchMedia()
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.slug.trim()) {
      setFormError('Title and slug are required.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        slug: form.slug.trim().toLowerCase(),
        date: form.date,
        body: form.body,
        published: form.published,
        imageId: form.imageId || undefined,
      }

      if (editId) {
        const res = await fetch(`/console/api/news/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || data?.message || 'Update failed')
      } else {
        const res = await fetch('/console/api/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || data?.message || 'Create failed')
      }
      setModalOpen(false)
      void search()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePublish = async (n: NewsRow) => {
    setActionId(n.id)
    try {
      const res = await fetch(`/console/api/news/${n.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !n.published }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Toggle failed')
      void search()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionId(null)
    }
  }

  const handleDelete = async (n: NewsRow) => {
    if (!confirm(`Delete "${n.title}"? This cannot be undone.`)) return
    setActionId(n.id)
    try {
      const res = await fetch(`/console/api/news/${n.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Delete failed')
      void search()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-lunar-green tracking-tight">News</h1>
          <p className="mt-1 text-sm text-text-light">Create and manage news items</p>
        </div>
        <Button onClick={openCreate}>+ New Article</Button>
      </header>

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{error}</div>
      )}

      {loading && !results && (
        <div className="text-center py-16 text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading news...
        </div>
      )}

      {results && results.totalDocs === 0 && (
        <Card className="text-center" padding>
          <p className="text-text-light">No news items found. Create one to get started.</p>
        </Card>
      )}

      {results && results.totalDocs > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-soft-beige/50 text-left">
                  <th className="px-4 py-3 font-semibold text-text-light">Status</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Title</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Slug</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Date</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Published</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.docs.map((n) => (
                  <tr key={String(n.id)} className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors">
                    <td className="px-4 py-3">
                      <Badge variant={n.published ? 'confirmed' : 'pending'}>
                        {n.published ? 'Published' : 'Draft'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold text-lunar-green">{n.title}</td>
                    <td className="px-4 py-3 text-xs text-text-light font-mono">{n.slug}</td>
                    <td className="px-4 py-3 text-sm text-text-light">{formatDate(n.date)}</td>
                    <td className="px-4 py-3 text-xs text-text-light">{n.published ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <button
                          onClick={() => openEdit(n)}
                          disabled={actionId === n.id}
                          className="rounded-md border border-lunar-green px-2 py-0.5 text-[10px] font-semibold text-lunar-green hover:bg-lunar-green hover:text-white disabled:opacity-40 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleTogglePublish(n)}
                          disabled={actionId === n.id}
                          className="rounded-md border border-matte-gold px-2 py-0.5 text-[10px] font-semibold text-matte-gold hover:bg-matte-gold hover:text-white disabled:opacity-40 transition-colors"
                        >
                          {actionId === n.id ? '...' : n.published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          onClick={() => handleDelete(n)}
                          disabled={actionId === n.id}
                          className="rounded-md border border-terracotta px-2 py-0.5 text-[10px] font-semibold text-[#9C4E2F] hover:bg-terracotta hover:text-white disabled:opacity-40 transition-colors"
                        >
                          {actionId === n.id ? '...' : 'Del'}
                        </button>
                      </div>
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

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setFormError(null) }} title={editId ? 'Edit Article' : 'New Article'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Slug *</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green font-mono focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Image (optional)</label>
            <select
              value={form.imageId}
              onChange={(e) => setForm((prev) => ({ ...prev, imageId: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            >
              <option value="">No image</option>
              {mediaOpts.map((m) => (
                <option key={String(m.id)} value={String(m.id)}>{m.filename || 'Untitled'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Body *</label>
            <RichTextEditor
              value={form.body}
              onChange={(v) => setForm((prev) => ({ ...prev, body: v as Record<string, unknown> }))}
              placeholder="Write your article content..."
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm((prev) => ({ ...prev, published: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-lunar-green focus:ring-lunar-green"
              />
              <span className="text-sm font-semibold text-lunar-green">Published</span>
            </label>
          </div>
          {formError && (
            <div className="rounded-lg border border-terracotta bg-terracotta/5 p-3 text-sm text-[#9C4E2F]">{formError}</div>
          )}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} loading={saving}>{editId ? 'Save Changes' : 'Create Article'}</Button>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setFormError(null) }}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
