'use client'

import { type ReactNode, type CSSProperties, type ChangeEvent, type KeyboardEvent } from 'react'

/**
 * Shared console filter-toolbar controls (Rudie 2026-07-12).
 *
 * Design feedback: the console's filter toolbars were assembled from
 * ad-hoc inputs/selects/buttons with mismatched heights (native date
 * inputs render shorter than px-4/py-2.5 selects; the Search button's
 * py-2.5 + font-bold metrics differ again; the CSV export select used
 * px-3/py-2.5/text-xs -- a third size), default browser select chrome
 * (native spinner arrows), and inconsistent label alignment.
 *
 * These primitives enforce ONE contract:
 *   - Every control is EXACTLY h-10 (40px) tall -- inputs, selects,
 *     date fields, and buttons all align on the same baseline.
 *   - Selects are appearance-none with a shared brand chevron so every
 *     dropdown renders identically across browsers/OSes.
 *   - One border/radius/focus treatment everywhere:
 *     border-border, rounded-lg, focus ring lunar-green/30.
 *   - Optional field labels render as small uppercase captions ABOVE
 *     the control (never inline beside it), so control heights stay
 *     uniform and the toolbar reads as a single clean row.
 *
 * Use these for every console list-page toolbar instead of raw
 * <input>/<select> elements.
 */

const CONTROL_BASE =
  'h-10 rounded-lg border border-border bg-surface text-sm text-lunar-green ' +
  'focus:outline-none focus:ring-2 focus:ring-lunar-green/30 focus:border-lunar-green/40 ' +
  'transition-colors box-border'

/** Brand chevron for selects, encoded inline so no extra asset request. */
const CHEVRON_BG: CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%2333483D' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.75rem center',
  backgroundSize: '12px 12px',
}

function FieldWrap({
  label,
  className = '',
  children,
}: {
  label?: string
  className?: string
  children: ReactNode
}) {
  if (!label) return <div className={className}>{children}</div>
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-light">
        {label}
      </span>
      {children}
    </div>
  )
}

export function FilterSelect({
  value,
  onChange,
  options,
  label,
  ariaLabel,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  label?: string
  ariaLabel?: string
  className?: string
}) {
  return (
    <FieldWrap label={label} className={className}>
      <select
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        aria-label={ariaLabel ?? label}
        className={`${CONTROL_BASE} w-full appearance-none cursor-pointer pl-3.5 pr-9`}
        style={CHEVRON_BG}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  )
}

export function FilterInput({
  value,
  onChange,
  placeholder,
  label,
  ariaLabel,
  onEnter,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  ariaLabel?: string
  onEnter?: () => void
  className?: string
}) {
  return (
    <FieldWrap label={label} className={className}>
      <input
        type="text"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter' && onEnter) onEnter()
        }}
        placeholder={placeholder}
        aria-label={ariaLabel ?? label ?? placeholder}
        className={`${CONTROL_BASE} w-full px-3.5 placeholder:text-text-light/50`}
      />
    </FieldWrap>
  )
}

export function FilterDate({
  value,
  onChange,
  label,
  ariaLabel,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  label?: string
  ariaLabel?: string
  className?: string
}) {
  return (
    <FieldWrap label={label} className={className}>
      <input
        type="date"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        aria-label={ariaLabel ?? label}
        className={`${CONTROL_BASE} px-3.5 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
      />
    </FieldWrap>
  )
}

/**
 * Toolbar row wrapper: consistent spacing, wraps cleanly on narrow
 * screens, bottom-aligns controls so labelled fields (caption above)
 * and unlabelled fields share one baseline.
 */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>
}
