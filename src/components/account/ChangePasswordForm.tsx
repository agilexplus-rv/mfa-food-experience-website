'use client'

import { useState } from 'react'

/**
 * Self-service password change for signed-in staff (admins and door
 * staff). Posts to /api/account/password, which verifies the current
 * password and enforces the strength policy server-side.
 */
export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Password change failed.')
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-lunar-green focus:outline-none focus:ring-2 focus:ring-lunar-green/30'

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4" noValidate>
      <div>
        <label htmlFor="current-password" className="mb-1 block text-sm font-semibold text-lunar-green">
          Current password
        </label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="new-password" className="mb-1 block text-sm font-semibold text-lunar-green">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby="new-password-help"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
        <p id="new-password-help" className="mt-1 text-xs text-text-light">
          At least 12 characters, including an uppercase letter, a lowercase letter, a number and a symbol.
        </p>
      </div>
      <div>
        <label htmlFor="confirm-password" className="mb-1 block text-sm font-semibold text-lunar-green">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-terracotta bg-terracotta/5 p-3 text-sm text-[#9C4E2F]">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="rounded-lg border border-lunar-green bg-lunar-green/5 p-3 text-sm text-lunar-green">
          Your password has been changed.
        </div>
      )}

      <button
        type="submit"
        disabled={saving || !currentPassword || !newPassword || !confirmPassword}
        className="rounded-lg bg-lunar-green px-5 py-2.5 text-sm font-bold text-soft-beige transition-colors hover:bg-lunar-green/90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lunar-green focus-visible:ring-offset-2"
      >
        {saving ? 'Saving…' : 'Change password'}
      </button>
    </form>
  )
}
