'use client'

/**
 * MonthFilter — client-side month picker for the event grid.
 *
 * Renders a horizontal row of pill buttons: "All months" plus one
 * pill per month that has events. Selecting a month filters the grid
 * (the parent EventGrid holds the active value and re-renders cards).
 *
 * Brand-styled: lunar-green text on soft-beige, active pill in
 * lunar-green with beige text. Keyboard accessible (real <button>s),
 * focus-visible outline in terracotta.
 */
export interface MonthOption {
  /** "YYYY-MM" key, or "all" for the All-months option. */
  value: string
  /** Human label, e.g. "Sep 2026" or "All months". */
  label: string
}

export interface MonthFilterProps {
  options: MonthOption[]
  value: string
  onChange: (value: string) => void
}

export function MonthFilter({ options, value, onChange }: MonthFilterProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter events by month"
      className="flex flex-wrap items-center gap-2"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={[
              'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              'focus:outline-2 focus:outline-offset-2 focus:outline-terracotta',
              active
                ? 'bg-lunar-green text-soft-beige'
                : 'bg-surface text-lunar-green border border-border hover:border-lunar-green/40 hover:bg-lunar-green/5',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
