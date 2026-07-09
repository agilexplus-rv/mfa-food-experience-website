/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface StaffUser {
  id: string | number
  email: string
  role: string
  mfaEnabled: boolean
  active: boolean
  createdAt: string
}

export default function StaffPage() {
  const [users, setUsers] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | number | null>(null)
  const mounted = useRef(true)

  const fetchUsers = useCallback(async () => {
    if (!mounted.current) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/admin-tools/api/users')
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to load users')
      }
      const data = await res.json()
      setUsers(data.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    return () => { mounted.current = false }
  }, [fetchUsers])

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviteSending(true)
    setInviteStatus(null)
    try {
      const res = await fetch('/admin-tools/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Invite failed')
      setInviteStatus('Invited ' + data.email + ' (temp password: ' + data.tempPassword + ') - ask user to change password on first login.')
      setInviteEmail('')
      fetchUsers()
    } catch (err) {
      setInviteStatus(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setInviteSending(false)
    }
  }

  const handleToggleActive = async (u: StaffUser) => {
    setTogglingId(u.id)
    try {
      const res = await fetch('/admin-tools/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, active: !u.active }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Toggle failed')
      }
      fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Toggle failed')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl w-full px-4 py-8">
      <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-lunar-green tracking-tight">Staff Management</h1>
          <p className="mt-1 text-sm text-text-light">Invite and manage staff accounts</p>
        </div>
        <div className="flex gap-3">
          <a href="/dashboard" className="rounded-lg border-2 border-lunar-green px-4 py-2 text-sm font-bold text-lunar-green hover:bg-lunar-green hover:text-white transition-colors">
            &larr; Dashboard
          </a>
        </div>
      </header>

      {/* Invite form */}
      <div className="rounded-xl border border-border bg-surface p-4 mb-6">
        <h2 className="text-sm font-bold text-lunar-green mb-3">Invite New Staff</h2>
        <div className="flex gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="staff@foodagency.mt"
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green placeholder:text-text-light/50 focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            onKeyDown={(e) => { if (e.key === 'Enter') handleInvite() }}
          />
          <button
            onClick={handleInvite}
            disabled={inviteSending || !inviteEmail.trim()}
            className="rounded-lg bg-lunar-green px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-light disabled:opacity-40 transition-colors"
          >
            {inviteSending ? 'Inviting...' : 'Invite'}
          </button>
        </div>
        {inviteStatus && (
          <p className={'mt-3 text-xs ' + (inviteStatus.includes('failed') || inviteStatus.includes('error') ? 'text-terracotta' : 'text-lunar-green')}>
            {inviteStatus}
          </p>
        )}
      </div>

      {loading && (
        <div className="text-center py-16 text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading users...
        </div>
      )}

      {error && (
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-terracotta">{error}</div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-soft-beige/50 text-left">
                <th className="px-4 py-3 font-semibold text-text-light">Email</th>
                <th className="px-4 py-3 font-semibold text-text-light">Role</th>
                <th className="px-4 py-3 font-semibold text-text-light text-center">MFA</th>
                <th className="px-4 py-3 font-semibold text-text-light">Status</th>
                <th className="px-4 py-3 font-semibold text-text-light">Created</th>
                <th className="px-4 py-3 font-semibold text-text-light text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={String(u.id)} className="border-b border-border/50 last:border-0 hover:bg-soft-beige/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-lunar-green">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ' + (u.role === 'admin' ? 'bg-terracotta/20 text-terracotta' : 'bg-lunar-green/20 text-lunar-green')}>
                      {u.role === 'admin' ? 'Admin' : 'Door Staff'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.mfaEnabled ? (
                      <span className="text-lunar-green font-bold">&#10003;</span>
                    ) : (
                      <span className="text-text-light">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ' + (u.active ? 'bg-lunar-green/20 text-lunar-green' : 'bg-terracotta/20 text-terracotta')}>
                      {u.active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-light">
                    {new Date(u.createdAt).toLocaleDateString('en-MT')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleActive(u)}
                      disabled={togglingId === u.id}
                      className={'rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-40 transition-colors ' + (
                        u.active
                          ? 'border-terracotta text-terracotta hover:bg-terracotta hover:text-white'
                          : 'border-lunar-green text-lunar-green hover:bg-lunar-green hover:text-white'
                      )}
                    >
                      {togglingId === u.id ? '...' : u.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
