/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Badge from '@/components/console/Badge'
import Button from '@/components/console/Button'

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
  const [inviteRole, setInviteRole] = useState<'door_staff' | 'admin'>('door_staff')
  const [meId, setMeId] = useState<string | number | null>(null)
  const [roleChangingId, setRoleChangingId] = useState<string | number | null>(null)
  const [deletingId, setDeletingId] = useState<string | number | null>(null)
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | number | null>(null)
  const [resettingPwId, setResettingPwId] = useState<string | number | null>(null)
  const [resettingMfaId, setResettingMfaId] = useState<string | number | null>(null)
  const [mfaConfirmIds, setMfaConfirmIds] = useState<Set<string | number>>(new Set())
  const mounted = useRef(true)

  const fetchUsers = useCallback(async () => {
    if (!mounted.current) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/console/api/users')
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

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.user?.id != null) setMeId(d.user.id) })
      .catch(() => { /* ignore */ })
  }, [])

  const isMe = (u: StaffUser) => meId != null && String(u.id) === String(meId)

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviteSending(true)
    setInviteStatus(null)
    try {
      const res = await fetch('/console/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error === 'user_already_exists' ? 'A user with this email already exists.' : (data?.detail || data?.error || 'Invite failed'))
      setInviteStatus(
        data.tempPassword
          ? data.message + ' Temporary password: ' + data.tempPassword
          : data.message || 'Invited ' + data.email,
      )
      setInviteEmail('')
      setInviteRole('door_staff')
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
      const res = await fetch('/console/api/users', {
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

  const handleRoleChange = async (u: StaffUser, role: string) => {
    if (role === u.role) return
    if (!confirm(`Change ${u.email} to ${role === 'admin' ? 'Admin' : 'Door Staff'}?`)) return
    setRoleChangingId(u.id)
    try {
      const res = await fetch('/console/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, role }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Role change failed')
      }
      fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Role change failed')
    } finally {
      setRoleChangingId(null)
    }
  }

  const handleDelete = async (u: StaffUser) => {
    if (!confirm(`Permanently delete ${u.email}? This cannot be undone. (Consider deactivating instead.)`)) return
    setDeletingId(u.id)
    try {
      const res = await fetch('/console/api/users?action=delete&userId=' + encodeURIComponent(String(u.id)), {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Delete failed')
      fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  const handleResetPassword = async (u: StaffUser) => {
    setResettingPwId(u.id)
    try {
      const res = await fetch('/console/api/users?action=reset-password&userId=' + encodeURIComponent(String(u.id)), {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Password reset failed')
      alert(data.detail || 'Password reset email sent')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Password reset failed')
    } finally {
      setResettingPwId(null)
    }
  }

  const handleResetMfa = async (u: StaffUser) => {
    setResettingMfaId(u.id)
    try {
      const res = await fetch('/console/api/users?action=reset-mfa&userId=' + encodeURIComponent(String(u.id)), {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'MFA reset failed')
      setMfaConfirmIds(prev => { const next = new Set(prev); next.delete(u.id); return next })
      alert(data.detail || 'MFA reset complete')
      fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'MFA reset failed')
    } finally {
      setResettingMfaId(null)
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black text-lunar-green tracking-tight">Staff</h1>
        <p className="mt-1 text-sm text-text-light">Invite and manage staff accounts</p>
      </header>

      {/* Invite form */}
      <div className="rounded-xl border border-border bg-surface p-4 mb-6" style={{ boxSizing: 'border-box' }}>
        <h2 className="text-sm font-bold text-lunar-green mb-3">Invite New Staff</h2>
        <div className="flex gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="staff@foodagency.mt"
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-lunar-green placeholder:text-text-light/50 focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
            style={{ boxSizing: 'border-box' }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleInvite() }}
            aria-label="Email address"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'door_staff' | 'admin')}
            aria-label="Role"
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30"
          >
            <option value="door_staff">Door Staff</option>
            <option value="admin">Admin</option>
          </select>
          <Button
            onClick={handleInvite}
            disabled={inviteSending || !inviteEmail.trim()}
            loading={inviteSending}
          >
            {inviteSending ? 'Inviting...' : 'Invite'}
          </Button>
        </div>
        {inviteStatus && (
          <p className={'mt-3 text-xs ' + (inviteStatus.toLowerCase().includes('fail') || inviteStatus.toLowerCase().includes('error') ? 'text-[#9C4E2F]' : 'text-lunar-green')}>
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
        <div className="rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-sm text-[#9C4E2F]">{error}</div>
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
                    {isMe(u) ? (
                      <Badge variant={u.role === 'admin' ? 'admin' : 'door_staff'}>
                        {u.role === 'admin' ? 'Admin' : 'Door Staff'} (you)
                      </Badge>
                    ) : (
                      <select
                        value={u.role}
                        disabled={roleChangingId === u.id}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        aria-label={`Role for ${u.email}`}
                        className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-semibold text-lunar-green disabled:opacity-40"
                      >
                        <option value="door_staff">Door Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.mfaEnabled ? (
                      <span className="text-lunar-green font-bold">&#10003;</span>
                    ) : (
                      <span className="text-text-light">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.active ? 'active' : 'deactivated'}>
                      {u.active ? 'Active' : 'Deactivated'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-light">
                    {new Date(u.createdAt).toLocaleDateString('en-MT')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={togglingId === u.id || isMe(u)}
                        title={isMe(u) ? 'You cannot deactivate your own account' : undefined}
                        className={'rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-40 transition-colors ' + (
                          u.active
                            ? 'border-terracotta text-[#9C4E2F] hover:bg-terracotta hover:text-white'
                            : 'border-lunar-green text-lunar-green hover:bg-lunar-green hover:text-white'
                        )}
                      >
                        {togglingId === u.id ? '...' : u.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleResetPassword(u)}
                        disabled={resettingPwId === u.id}
                        className="rounded-md border border-accent-text text-accent-text px-2.5 py-1 text-xs font-semibold hover:bg-accent-text hover:text-white disabled:opacity-40 transition-colors"
                      >
                        {resettingPwId === u.id ? '...' : 'Reset PW'}
                      </button>
                      {!isMe(u) && (
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={deletingId === u.id}
                          className="rounded-md border border-terracotta px-2.5 py-1 text-xs font-semibold text-[#9C4E2F] hover:bg-terracotta hover:text-white disabled:opacity-40 transition-colors"
                        >
                          {deletingId === u.id ? '...' : 'Delete'}
                        </button>
                      )}
                      {u.mfaEnabled && (
                        mfaConfirmIds.has(u.id) ? (
                          <span className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleResetMfa(u)}
                              disabled={resettingMfaId === u.id}
                              className="rounded-md border border-terracotta bg-terracotta text-white px-2.5 py-1 text-xs font-semibold hover:opacity-85 disabled:opacity-40 transition-colors"
                            >
                              {resettingMfaId === u.id ? '...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setMfaConfirmIds(prev => { const next = new Set(prev); next.delete(u.id); return next })}
                              className="rounded-md border border-border text-text-light px-2 py-1 text-xs font-semibold hover:bg-surface transition-colors"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setMfaConfirmIds(prev => new Set(prev).add(u.id))}
                            className="rounded-md border border-terracotta text-[#9C4E2F] px-2.5 py-1 text-xs font-semibold hover:bg-terracotta hover:text-white transition-colors"
                          >
                            Reset MFA
                          </button>
                        )
                      )}
                    </div>
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
