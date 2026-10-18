'use client'

import type { ReactNode } from 'react'

/**
 * Icon-only row action button shared by every console table.
 *
 * One glyph + colour vocabulary, so the same action looks the same on every
 * console screen (and a row's actions stay on a single line).
 *
 * The tooltip is the native `title` attribute, deliberately: tables sit in
 * `overflow-x-auto` wrappers that would clip an absolutely-positioned CSS
 * tooltip. `aria-label` carries the accessible name and the SVG is
 * aria-hidden so the icon is not announced twice.
 */

export type RowActionIcon =
  | 'edit' | 'delete' | 'view' | 'attendees' | 'archive'
  | 'publish' | 'unpublish' | 'approve' | 'reject'
  | 'cancel' | 'resend' | 'noShow' | 'key' | 'shield'
  | 'checkIn' | 'power'

export type RowActionTone = 'positive' | 'danger' | 'accent' | 'neutral'

const TONE_CLASSES: Record<RowActionTone, string> = {
  positive: 'text-lunar-green hover:bg-lunar-green/10',
  danger: 'text-[#9C4E2F] hover:bg-terracotta/10',
  accent: 'text-accent-text hover:bg-accent-text/10',
  neutral: 'text-text-light hover:bg-lunar-green/10',
}

const round = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const ICONS: Record<RowActionIcon, ReactNode> = {
  edit: (
    <>
      <path {...round} d="M12 20h9" />
      <path {...round} d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  delete: (
    <>
      <path {...round} d="M3 6h18" />
      <path {...round} d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path {...round} d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path {...round} d="M10 11v6" />
      <path {...round} d="M14 11v6" />
    </>
  ),
  view: (
    <>
      <circle {...round} cx="11" cy="11" r="7" />
      <path {...round} d="M20 20l-3.5-3.5" />
    </>
  ),
  attendees: (
    <>
      <path {...round} d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle {...round} cx="9.5" cy="7" r="4" />
      <path {...round} d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path {...round} d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  archive: (
    <>
      <rect {...round} x="3" y="4" width="18" height="4" rx="1" />
      <path {...round} d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
      <path {...round} d="M10 12h4" />
    </>
  ),
  publish: (
    <>
      <path {...round} d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle {...round} cx="12" cy="12" r="3" />
    </>
  ),
  unpublish: (
    <>
      <path {...round} d="M3 3l18 18" />
      <path {...round} d="M10.6 6.2A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.4 4.2" />
      <path {...round} d="M6.2 7.4A17 17 0 0 0 2 12s3.5 7 10 7a9.9 9.9 0 0 0 4-.8" />
      <path {...round} d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  approve: <path {...round} d="M20 6L9 17l-5-5" />,
  reject: (
    <>
      <path {...round} d="M18 6L6 18" />
      <path {...round} d="M6 6l12 12" />
    </>
  ),
  cancel: (
    <>
      <circle {...round} cx="12" cy="12" r="9" />
      <path {...round} d="M5.64 5.64l12.72 12.72" />
    </>
  ),
  resend: (
    <>
      <path {...round} d="M22 2L11 13" />
      <path {...round} d="M22 2l-7 20-4-9-9-4 20-7z" />
    </>
  ),
  noShow: (
    <>
      <path {...round} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle {...round} cx="9" cy="7" r="4" />
      <path {...round} d="M17 8l5 5" />
      <path {...round} d="M22 8l-5 5" />
    </>
  ),
  key: (
    <>
      <circle {...round} cx="7.5" cy="15.5" r="3.5" />
      <path {...round} d="M10 13L20 3" />
      <path {...round} d="M17 6l3 3" />
    </>
  ),
  shield: <path {...round} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  checkIn: (
    <>
      <path {...round} d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect {...round} x="9" y="3" width="6" height="4" rx="1" />
      <path {...round} d="M9 14l2 2 4-4" />
    </>
  ),
  power: (
    <>
      <path {...round} d="M12 2v10" />
      <path {...round} d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    </>
  ),
}

export default function RowAction({
  icon,
  tone,
  label,
  onClick,
  disabled,
  busy,
}: {
  icon: RowActionIcon
  tone: RowActionTone
  label: string
  onClick: () => void
  disabled?: boolean
  busy?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={[
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
        'focus:outline-2 focus:outline-offset-2 focus:outline-lunar-green',
        'disabled:cursor-not-allowed disabled:opacity-40',
        TONE_CLASSES[tone],
      ].join(' ')}
    >
      {busy ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          {ICONS[icon]}
        </svg>
      )}
    </button>
  )
}
