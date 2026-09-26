import Link from 'next/link'
import { ChangePasswordForm } from '@/components/account/ChangePasswordForm'

/** Door-staff account page (admins use /console/account inside the console shell). */
export default function StaffAccountPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <nav className="mb-6 flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/dashboard" className="text-accent-text hover:text-lunar-green">&larr; Back to dashboard</Link>
        <Link href="/" className="text-accent-text hover:text-lunar-green">Homepage</Link>
      </nav>
      <h1 className="text-2xl font-black text-lunar-green tracking-tight">My Account</h1>
      <p className="mt-1 mb-6 text-sm text-text-light">Change the password you use to sign in</p>
      <div className="rounded-xl border border-border bg-surface p-6">
        <ChangePasswordForm />
      </div>
    </main>
  )
}
