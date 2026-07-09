/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/console/Button'
import Badge from '@/components/console/Badge'
import Card from '@/components/console/Card'
import Modal from '@/components/console/Modal'
import { Pagination } from '@/components/console/DataTable'

interface ServiceRow {
  id: string | number
  name: string
  slug: string
  visible: boolean
  order: number
  eventCount: number
  imageryId: string | number | null
  imageryUrl: string | null
  createdAt: string
}

interface MediaOption {
  id: string | number
  filename: string
  url: string
}

interface SearchResult {
  docs: ServiceRow[]
  totalDocs: number
  page: number
  totalPages: number
}

export default function ConsoleServicesPage() {
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Media list for imagery picker
  const [media, setMedia] = useState<MediaOption[]>([])

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', slug: '', visible: false, order: '0', imageryId: '',
  })

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/console/api/services?page=${page}&limit=25`)
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) throw new Error('Failed to load services')
      setResults(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    } finally { setLoading(false) }
  }, [page])

  const fetchMedia = useCallback(async () => {
    try {
      const res = await fetch('/api/media?limit=500')
      if (!res.ok) return
      const data = await res.json()
      if (data.docs) setMedia(data.docs.map((m: { id: string | number; filename: string; url?: string }) => ({
        id: m.id,
        filename: m.filename,
        url: m.url || '',
      })))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])
  useEffect(() => { void fetchMedia() }, [fetchMedia])

  const resetForm = () => {
    setForm({ name: '', slug: '', visible: false, order: '0', imageryId: '' })
    setEditingId(null)
    setFormError(null)
  }

  const openCreate = () => { resetForm(); setModalOpen(true) }

  const openEdit = (sv: ServiceRow) => {
    setEditingId(sv.id)
    setForm({
      name: sv.name,
      slug: sv.slug,
      visible: sv.visible,
      order: String(sv.order),
      imageryId: String(sv.imageryId || ''),
    })
    setFormError(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      setFormError('Name and slug are required.')
      return
    }
    setSaveLoading(true)
    setFormError(null)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        visible: form.visible,
        order: parseInt(form.order, 10) || 0,
      }
      if (form.imageryId) body.imagery = form.imageryId
      const url = editingId ? `/console/api/services/${editingId}` : '/console/api/services'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (data?.error === 'slug_taken') throw new Error(data.message || 'Slug already taken.')
        throw new Error(data?.error || 'Save failed')
      }
      setModalOpen(false)
      resetForm()
      void fetchData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    } finally { setSaveLoading(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/console/api/services/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (data?.error === 'has_events') {
          throw new Error(data.message || 'Cannot delete service with existing events.')
        }
        throw new Error(data?.error || 'Delete failed')
      }
      setDeleteTarget(null)
      void fetchData()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed')
    } finally { setDeleteLoading(false) }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-lunar-green tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-text-light">Manage service offerings and visibility</p>
        </div>
        <Button onClick={openCreate}>+ New Service</Button>
      </header>

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{error}</div>
      )}

      {loading && (
        <div className="text-center py-16 text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading services...
        </div>
      )}

      {results && results.totalDocs === 0 && (
        <Card className="text-center" padding>
          <p className="text-text-light">No services found. Create your first service above.</p>
        </Card>
      )}

      {results && results.totalDocs > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-soft-beige/50 text-left">
                  <th className="px-4 py-3 font-semibold text-text-light">Name</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Slug</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Order</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Events</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Visibility</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.docs.map((sv) => (
                  <tr key={String(sv.id)} className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors">
                    <td className="px-4 py-3 text-lunar-green font-semibold">{sv.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-light">{sv.slug}</td>
                    <td className="px-4 py-3 text-center text-lunar-green">{sv.order}</td>
                    <td className="px-4 py-3 text-center text-lunar-green">{sv.eventCount}</td>
                    <td className="px-4 py-3">
                      <Badge variant={sv.visible ? 'active' : 'deactivated'}>
                        {sv.visible ? 'Visible' : 'Hidden'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(sv)} className="rounded-md border border-lunar-green px-2 py-0.5 text-[10px] font-semibold text-lunar-green hover:bg-lunar-green hover:text-white transition-colors">
                          Edit
                        </button>
                        <button onClick={() => setDeleteTarget(sv)} className="rounded-md border border-terracotta px-2 py-0.5 text-[10px] font-semibold text-[#9C4E2F] hover:bg-terracotta hover:text-white transition-colors">
                          Delete
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
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); resetForm() }} title={editingId ? 'Edit Service' : 'New Service'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Slug *</label>
            <input type="text" value={form.slug}
              onChange={(e) => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\\s+/g, '-') }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-mono text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Order</label>
            <input type="number" value={form.order} onChange={(e) => setForm(p => ({ ...p, order: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Image</label>
            <select value={form.imageryId} onChange={(e) => setForm(p => ({ ...p, imageryId: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green bg-surface focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}>
              <option value="">None</option>
              {media.map(m => (
                <option key={String(m.id)} value={String(m.id)}>{m.filename}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-lunar-green">
            <input type="checkbox" checked={form.visible}
              onChange={(e) => setForm(p => ({ ...p, visible: e.target.checked }))}
              className="h-4 w-4 accent-lunar-green" />
            Visible on public site
          </label>
          {formError && (
            <div className="rounded-lg border border-terracotta bg-terracotta/5 p-3 text-sm text-[#9C4E2F]">{formError}</div>
          )}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} loading={saveLoading}>
              {editingId ? 'Save Changes' : 'Create Service'}
            </Button>
            <Button variant="secondary" onClick={() => { setModalOpen(false); resetForm() }}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Service">
        {deleteTarget && (
          <div>
            <p className="text-sm text-lunar-green mb-2">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>
            {deleteTarget.eventCount > 0 ? (
              <div className="rounded-lg border-2 border-terracotta bg-terracotta/5 p-3 text-sm text-[#9C4E2F] mb-4">
                {deleteTarget.eventCount} event(s) reference this service. Reassign or delete those events first.
              </div>
            ) : (
              <p className="text-xs text-text-light mb-4">This action cannot be undone.</p>
            )}
            {deleteError && (
              <div className="rounded-lg border border-terracotta bg-terracotta/5 p-3 text-sm text-[#9C4E2F] mb-4">{deleteError}</div>
            )}
            <div className="flex gap-3">
              {deleteTarget.eventCount === 0 && (
                <Button variant="danger" onClick={handleDelete} loading={deleteLoading}>Delete Service</Button>
              )}
              <Button variant="secondary" onClick={() => { setDeleteTarget(null); setDeleteError(null) }}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
