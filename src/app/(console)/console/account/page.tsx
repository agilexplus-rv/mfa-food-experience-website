import { ChangePasswordForm } from '@/components/account/ChangePasswordForm'

export default function ConsoleAccountPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black text-lunar-green tracking-tight">My Account</h1>
        <p className="mt-1 text-sm text-text-light">Change the password you use to sign in</p>
      </header>
      <div className="rounded-xl border border-border bg-surface p-6">
        <ChangePasswordForm />
      </div>
    </div>
  )
}
