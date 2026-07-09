/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Button from '@/components/console/Button'
import Card from '@/components/console/Card'
import Modal from '@/components/console/Modal'
import { Pagination } from '@/components/console/DataTable'

interface MediaRow {
  id: string | number
  alt: string
  filename: string | null
  filesize: number | null
  mimeType: string | null
  url: string | null
  createdAt: string
  updatedAt: string
}

interface SearchResult {
  docs: MediaRow[]
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

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '\u2014'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function MediaLibraryPage() {
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [actionId, setActionId] = useState<string | number | null>(null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadAlt, setUploadAlt] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [detailMedia, setDetailMedia] = useState<MediaRow | null>(null)

  const search = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '25')
      const res = await fetch('/console/api/media?' + params.toString())
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to load media')
      }
      const data = await res.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load media')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { void search() }, [search])

  const handleUpload = async () => {
    if (!uploadFile) {
      setUploadError('Please select a file.')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('alt', uploadAlt.trim() || uploadFile.name)

      const res = await fetch('/console/api/media', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Upload failed')

      setUploadOpen(false)
      setUploadFile(null)
      setUploadAlt('')
      void search()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (m: MediaRow) => {
    if (!confirm('Delete "' + (m.filename || m.alt) + '"? This cannot be undone.')) return
    setActionId(m.id)
    try {
      const res = await fetch('/console/api/media/' + m.id, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Delete failed')
      }
      void search()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setActionId(null)
    }
  }

  const clearUploadForm = () => {
    setUploadOpen(false)
    setUploadFile(null)
    setUploadAlt('')
    setUploadError(null)
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-lunar-green tracking-tight">Media Library</h1>
          <p className="mt-1 text-sm text-text-light">Upload and manage images for services, news, and events</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>+ Upload</Button>
      </header>

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F] mb-4">{error}</div>
      )}

      {loading && !results && (
        <div className="text-center py-16 text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading media...
        </div>
      )}

      {results && results.totalDocs === 0 && (
        <Card className="text-center" padding>
          <p className="text-text-light mb-3">No media uploaded yet. Upload images to use in services, news, and events.</p>
          <Button onClick={() => setUploadOpen(true)} variant="secondary" size="sm">Upload your first image</Button>
        </Card>
      )}

      {results && results.totalDocs > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 mb-6">
            {results.docs.map((m) => (
              <button
                key={String(m.id)}
                onClick={() => setDetailMedia(m)}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-surface hover:border-lunar-green/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lunar-green"
              >
                {m.url && (m.mimeType || '').startsWith('image/') ? (
                  <img
                    src={m.url}
                    alt={m.alt || ''}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-soft-beige text-text-light/40">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white font-semibold truncate">{m.filename || m.alt}</p>
                  <p className="text-[9px] text-white/70">{formatFileSize(m.filesize)}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-surface mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-soft-beige/50 text-left">
                  <th className="px-4 py-3 font-semibold text-text-light">Thumbnail</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Filename</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Alt Text</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Size</th>
                  <th className="px-4 py-3 font-semibold text-text-light">Uploaded</th>
                  <th className="px-4 py-3 font-semibold text-text-light text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.docs.map((m) => (
                  <tr key={String(m.id)} className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors">
                    <td className="px-4 py-2">
                      {m.url && (m.mimeType || '').startsWith('image/') ? (
                        <img
                          src={m.url}
                          alt={m.alt || ''}
                          className="h-10 w-10 rounded-md object-cover border border-border"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-soft-beige border border-border flex items-center justify-center text-text-light/40">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-lunar-green font-mono max-w-[160px] truncate" title={m.filename || ''}>
                      {m.filename || '\u2014'}
                    </td>
                    <td className="px-4 py-2 text-sm text-text-light max-w-[160px] truncate" title={m.alt}>
                      {m.alt || '\u2014'}
                    </td>
                    <td className="px-4 py-2 text-xs text-text-light">{formatFileSize(m.filesize)}</td>
                    <td className="px-4 py-2 text-xs text-text-light">{formatDate(m.createdAt)}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setDetailMedia(m)}
                          className="rounded-md border border-lunar-green px-2 py-0.5 text-[10px] font-semibold text-lunar-green hover:bg-lunar-green hover:text-white transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          disabled={actionId === m.id}
                          className="rounded-md border border-terracotta px-2 py-0.5 text-[10px] font-semibold text-[#9C4E2F] hover:bg-terracotta hover:text-white disabled:opacity-40 transition-colors"
                        >
                          {actionId === m.id ? '...' : 'Del'}
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

      <Modal open={uploadOpen} onClose={clearUploadForm} title="Upload Media">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">File *</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-lg border-2 border-dashed border-border hover:border-lunar-green/40 p-8 text-center transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              {uploadFile ? (
                <div>
                  <p className="text-sm font-semibold text-lunar-green">{uploadFile.name}</p>
                  <p className="text-xs text-text-light mt-1">{formatFileSize(uploadFile.size)}</p>
                  <p className="text-xs text-matte-gold mt-1">Click to change file</p>
                </div>
              ) : (
                <div>
                  <svg className="mx-auto h-10 w-10 text-text-light/40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-sm font-semibold text-text-light">Click to select an image</p>
                  <p className="text-xs text-text-light/60 mt-1">PNG, JPG, WebP up to 10MB</p>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-lunar-green mb-1">Alt Text</label>
            <input
              type="text"
              value={uploadAlt}
              onChange={(e) => setUploadAlt(e.target.value)}
              placeholder="Describe the image..."
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
              style={{ boxSizing: 'border-box' }}
            />
          </div>
          {uploadError && (
            <div className="rounded-lg border border-terracotta bg-terracotta/5 p-3 text-sm text-[#9C4E2F]">{uploadError}</div>
          )}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleUpload} loading={uploading}>Upload</Button>
            <Button variant="secondary" onClick={clearUploadForm}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <Modal open={detailMedia !== null} onClose={() => setDetailMedia(null)} title="Media Detail">
        {detailMedia && (
          <div className="space-y-4">
            {detailMedia.url && (detailMedia.mimeType || '').startsWith('image/') && (
              <div className="aspect-video overflow-hidden rounded-lg border border-border bg-soft-beige">
                <img
                  src={detailMedia.url}
                  alt={detailMedia.alt || ''}
                  className="h-full w-full object-contain"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-light">Filename</span>
                <p className="font-mono text-xs text-lunar-green mt-0.5 break-all">{detailMedia.filename || '\u2014'}</p>
              </div>
              <div>
                <span className="text-text-light">Type</span>
                <p className="text-xs text-lunar-green mt-0.5">{detailMedia.mimeType || '\u2014'}</p>
              </div>
              <div>
                <span className="text-text-light">Size</span>
                <p className="text-xs text-lunar-green mt-0.5">{formatFileSize(detailMedia.filesize)}</p>
              </div>
              <div>
                <span className="text-text-light">Uploaded</span>
                <p className="text-xs text-lunar-green mt-0.5">{formatDate(detailMedia.createdAt)}</p>
              </div>
            </div>
            <div>
              <span className="text-text-light text-sm">Alt Text</span>
              <p className="text-sm text-lunar-green mt-0.5">{detailMedia.alt || '\u2014'}</p>
            </div>
            {detailMedia.url && (
              <div>
                <span className="text-text-light text-sm">URL</span>
                <p className="font-mono text-xs text-lunar-green mt-0.5 break-all select-all">{detailMedia.url}</p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="danger" onClick={() => { setDetailMedia(null); handleDelete(detailMedia) }} disabled={actionId === detailMedia.id}>
                {actionId === detailMedia.id ? 'Deleting...' : 'Delete'}
              </Button>
              <Button variant="secondary" onClick={() => setDetailMedia(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
