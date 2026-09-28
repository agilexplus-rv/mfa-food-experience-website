'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Badge from '@/components/console/Badge'
import Card from '@/components/console/Card'
import { FilterBar, FilterInput, FilterSelect } from '@/components/console/FilterBar'
import { HELP_CATEGORIES, type HelpNote, type HelpProcedure } from './help-content'

type RoleFilter = 'all' | 'admin' | 'door_staff'

const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'All roles' },
  { value: 'admin', label: 'Admin only' },
  { value: 'door_staff', label: 'Door staff' },
]

const NOTE_STYLES: Record<HelpNote['kind'], { label: string; className: string }> = {
  tip: { label: 'Tip', className: 'border-lunar-green/30 bg-lunar-green/5 text-lunar-green' },
  warning: { label: 'Warning', className: 'border-terracotta bg-terracotta/5 text-[#9C4E2F]' },
  prereq: { label: 'Before you start', className: 'border-matte-gold/50 bg-accent-text/5 text-lunar-green' },
}

const TOTAL_PROCEDURES = HELP_CATEGORIES.reduce((n, c) => n + c.procedures.length, 0)

/** Strip the **label** / `ref` markup so search runs on what staff read. */
function plain(text: string): string {
  return text.replace(/\*\*|`/g, '')
}

// Search text per procedure, built once: category name, title, steps, notes.
const SEARCH_INDEX = new Map<string, string>(
  HELP_CATEGORIES.flatMap((c) =>
    c.procedures.map((p) => [
      p.id,
      [c.title, p.title, ...p.steps, ...(p.notes ?? []).map((n) => n.text)].map(plain).join('\n').toLowerCase(),
    ]),
  ),
)

function roleMatches(p: HelpProcedure, filter: RoleFilter): boolean {
  if (filter === 'all') return true
  const doorStaff = p.roles.includes('door_staff')
  return filter === 'door_staff' ? doorStaff : !doorStaff
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlight(text: string, pattern: RegExp | null): ReactNode {
  if (!pattern) return text
  // split() with one capture group puts the matches at the odd indexes
  return text.split(pattern).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-sm bg-matte-gold/30 px-0.5 text-inherit">{part}</mark>
    ) : (
      part
    ),
  )
}

/** Render **UI labels** in bold and `references` in monospace. */
function Inline({ text, pattern }: { text: string; pattern: RegExp | null }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
        if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-lunar-green">{highlight(part.slice(2, -2), pattern)}</strong>
        }
        if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="rounded bg-soft-beige px-1 py-0.5 font-mono text-[0.85em] text-lunar-green">
              {highlight(part.slice(1, -1), pattern)}
            </code>
          )
        }
        return <Fragment key={i}>{highlight(part, pattern)}</Fragment>
      })}
    </>
  )
}

function RoleBadge({ roles }: { roles: HelpProcedure['roles'] }) {
  return roles.includes('door_staff')
    ? <Badge variant="door_staff">admin + door staff</Badge>
    : <Badge variant="admin">admin only</Badge>
}

function ProcedureCard({ procedure, pattern }: { procedure: HelpProcedure; pattern: RegExp | null }) {
  const anchor = `help-proc-${procedure.id}`
  return (
    <article
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      className="scroll-mt-6 rounded-lg border border-border bg-background p-4 transition-shadow target:ring-2 target:ring-matte-gold lg:p-5"
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`${anchor}-title`} className="text-base font-bold text-lunar-green">
            {highlight(procedure.title, pattern)}
            <a
              href={`#${anchor}`}
              aria-label={`Link to "${procedure.title}"`}
              className="ml-2 text-sm font-normal text-text-light/60 hover:text-lunar-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lunar-green rounded"
            >
              #
            </a>
          </h3>
          <p className="mt-0.5 font-mono text-xs text-text-light">{procedure.path}</p>
        </div>
        <RoleBadge roles={procedure.roles} />
      </header>

      <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-text marker:font-semibold marker:text-text-light">
        {procedure.steps.map((step, i) => (
          <li key={i} className="pl-1">
            <Inline text={step} pattern={pattern} />
          </li>
        ))}
      </ol>

      {procedure.notes && procedure.notes.length > 0 && (
        <ul className="mt-4 space-y-2">
          {procedure.notes.map((note, i) => {
            const style = NOTE_STYLES[note.kind]
            return (
              <li key={i} className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${style.className}`}>
                <span className="font-bold uppercase tracking-wider">{style.label}: </span>
                <Inline text={note.text} pattern={pattern} />
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}

export default function HelpPage() {
  const [query, setQuery] = useState('')
  // null until the signed-in role is known, so door staff never see a
  // flash of the admin procedures before their default filter applies.
  const [roleFilter, setRoleFilter] = useState<RoleFilter | null>(null)
  const [isDoorStaff, setIsDoorStaff] = useState(false)
  // Categories the user opened while browsing, and those they closed
  // while searching (search auto-expands every matching category).
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [searchClosed, setSearchClosed] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const roleTouched = useRef(false)

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const role = (d?.user || d)?.role
        setIsDoorStaff(role === 'door_staff')
        if (!roleTouched.current) setRoleFilter(role === 'door_staff' ? 'door_staff' : 'all')
      })
      .catch(() => { if (!roleTouched.current) setRoleFilter('all') })
  }, [])

  const terms = useMemo(
    () => query.toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  )
  const pattern = useMemo(
    () => (terms.length ? new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi') : null),
    [terms],
  )
  const searching = terms.length > 0

  const visible = useMemo(() => {
    const filter = roleFilter ?? 'all'
    return HELP_CATEGORIES.map((c) => ({
      ...c,
      procedures: c.procedures.filter((p) => {
        if (!roleMatches(p, filter)) return false
        const hay = SEARCH_INDEX.get(p.id) ?? ''
        return terms.every((t) => hay.includes(t))
      }),
    })).filter((c) => c.procedures.length > 0)
  }, [roleFilter, terms])

  const shownCount = visible.reduce((n, c) => n + c.procedures.length, 0)
  const visibleKey = visible.map((c) => c.id).join(',')

  const isOpen = (id: string) => (searching ? !searchClosed.has(id) : open.has(id))

  const toggle = (id: string) => {
    const flip = (prev: Set<string>) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    }
    if (searching) setSearchClosed(flip)
    else setOpen(flip)
  }

  const setAll = (expanded: boolean) => {
    const ids = visible.map((c) => c.id)
    if (searching) setSearchClosed(expanded ? new Set() : new Set(ids))
    else setOpen(expanded ? new Set(ids) : new Set())
  }

  const expand = (id: string) => {
    if (searching) setSearchClosed((prev) => { const next = new Set(prev); next.delete(id); return next })
    else setOpen((prev) => new Set(prev).add(id))
  }

  // Deep links (#help-proc-<id> or #help-<category>): open the category
  // holding the target, then scroll to it once it has rendered.
  useEffect(() => {
    const openFromHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1))
      if (!hash.startsWith('help-')) return
      const cat = HELP_CATEGORIES.find((c) =>
        hash === `help-${c.id}` || c.procedures.some((p) => hash === `help-proc-${p.id}`),
      )
      if (!cat) return
      const proc = cat.procedures.find((p) => hash === `help-proc-${p.id}`)
      if (proc && !proc.roles.includes('door_staff')) {
        // Link to an admin procedure: make sure the role filter shows it.
        roleTouched.current = true
        setRoleFilter((f) => (f === 'admin' || f === 'all' ? f : 'all'))
      }
      setOpen((prev) => new Set(prev).add(cat.id))
      requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }))
    }
    openFromHash()
    window.addEventListener('hashchange', openFromHash)
    return () => window.removeEventListener('hashchange', openFromHash)
  }, [])

  // Highlight the category currently at the top of the viewport in the
  // side list. The console scrolls inside <main>, which IntersectionObserver
  // handles with the default (viewport) root.
  useEffect(() => {
    const sections = visibleKey
      .split(',')
      .map((id) => document.getElementById(`help-${id}`))
      .filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) return
    const inView = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) inView.set(e.target.id, e.isIntersecting)
        const first = sections.find((el) => inView.get(el.id))
        if (first) setActiveId(first.id.slice('help-'.length))
      },
      { rootMargin: '-10% 0px -60% 0px' },
    )
    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [visibleKey])

  const clearFilters = () => {
    setQuery('')
    setSearchClosed(new Set())
    roleTouched.current = true
    setRoleFilter('all')
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black text-lunar-green tracking-tight">Help</h1>
        <p className="mt-1 text-sm text-text-light">
          Step-by-step procedures for the operator console and the door-staff tools
        </p>
      </header>

      <Card className="mb-6" padding>
        <FilterBar>
          <FilterInput
            label="Search procedures"
            value={query}
            onChange={(v) => { setQuery(v); setSearchClosed(new Set()) }}
            placeholder="e.g. refund, offline, coupon..."
            className="flex-1 min-w-[220px]"
          />
          <FilterSelect
            label="Role"
            value={roleFilter ?? 'all'}
            onChange={(v) => { roleTouched.current = true; setRoleFilter(v as RoleFilter) }}
            options={ROLE_OPTIONS}
            className="w-44"
          />
          {(query || (roleFilter && roleFilter !== 'all')) && (
            <button
              onClick={clearFilters}
              className="h-10 rounded-lg border border-border px-3.5 text-xs font-semibold text-text-light transition-colors hover:border-lunar-green/40 hover:text-lunar-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lunar-green"
            >
              Clear Filters
            </button>
          )}
        </FilterBar>
        <p className="mt-3 text-xs text-text-light" role="status" aria-live="polite">
          {roleFilter === null
            ? 'Loading procedures...'
            : `Showing ${shownCount} of ${TOTAL_PROCEDURES} procedures${searching ? ` matching "${query.trim()}"` : ''}`}
        </p>
      </Card>

      {isDoorStaff && roleFilter !== 'door_staff' && roleFilter !== null && (
        <div className="mb-6 rounded-xl border border-matte-gold/50 bg-accent-text/5 p-4 text-sm text-lunar-green">
          You are viewing procedures that need an <strong>admin</strong> account. They are shown so you know
          what admins can do. Ask an admin if a guest needs one of them.
        </div>
      )}

      {roleFilter === null ? (
        <div className="py-16 text-center text-text-light">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
          Loading help...
        </div>
      ) : visible.length === 0 ? (
        <Card className="text-center" padding>
          <h2 className="text-lg font-bold text-lunar-green">No results</h2>
          <p className="mt-1 text-sm text-text-light">
            No procedures match{searching ? <> &ldquo;{query.trim()}&rdquo;</> : ''}
            {roleFilter !== 'all' ? ` for ${ROLE_OPTIONS.find((o) => o.value === roleFilter)?.label.toLowerCase()}` : ''}.
            Try fewer or different words{roleFilter !== 'all' ? ', or switch the role to All roles' : ''}.
          </p>
          <button
            onClick={clearFilters}
            className="mt-4 rounded-lg border border-lunar-green px-4 py-2 text-sm font-semibold text-lunar-green transition-colors hover:bg-lunar-green hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lunar-green"
          >
            Clear search and filters
          </button>
        </Card>
      ) : (
        <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6">
          {/* Category list -- sticky inside the console's scrolling <main> */}
          <nav aria-label="Help categories" className="mb-6 lg:mb-0">
            <div className="lg:sticky lg:top-0">
              <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-light">Categories</h2>
              <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
                {visible.map((c) => (
                  <li key={c.id}>
                    <a
                      href={`#help-${c.id}`}
                      onClick={() => expand(c.id)}
                      aria-current={activeId === c.id ? 'true' : undefined}
                      className={[
                        'flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors lg:border-transparent',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lunar-green',
                        activeId === c.id
                          ? 'border-lunar-green bg-lunar-green text-soft-beige'
                          : 'border-border text-lunar-green hover:bg-surface',
                      ].join(' ')}
                    >
                      <span>{c.title}</span>
                      <span className={['text-xs', activeId === c.id ? 'text-soft-beige/80' : 'text-text-light'].join(' ')}>
                        {c.procedures.length}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2 text-xs">
                <button
                  onClick={() => setAll(true)}
                  className="rounded-md border border-border px-2 py-1 font-semibold text-text-light hover:border-lunar-green hover:text-lunar-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lunar-green"
                >
                  Expand all
                </button>
                <button
                  onClick={() => setAll(false)}
                  className="rounded-md border border-border px-2 py-1 font-semibold text-text-light hover:border-lunar-green hover:text-lunar-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lunar-green"
                >
                  Collapse all
                </button>
              </div>
            </div>
          </nav>

          {/* Categories accordion */}
          <div className="space-y-3">
            {visible.map((c) => {
              const expanded = isOpen(c.id)
              const panelId = `help-panel-${c.id}`
              const buttonId = `help-button-${c.id}`
              return (
                <section
                  key={c.id}
                  id={`help-${c.id}`}
                  className={[
                    'scroll-mt-6 rounded-xl border bg-surface',
                    activeId === c.id ? 'border-lunar-green/40' : 'border-border',
                  ].join(' ')}
                >
                  <h2>
                    <button
                      id={buttonId}
                      onClick={() => toggle(c.id)}
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      className="flex w-full items-center justify-between gap-4 rounded-xl px-5 py-4 text-left transition-colors hover:bg-soft-beige/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lunar-green"
                    >
                      <span className="min-w-0">
                        <span className="block text-lg font-black text-lunar-green">{highlight(c.title, pattern)}</span>
                        <span className="block text-sm font-normal text-text-light">{c.summary}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="rounded-full bg-soft-beige px-2 py-0.5 text-xs font-semibold text-text-light">
                          {c.procedures.length} {c.procedures.length === 1 ? 'procedure' : 'procedures'}
                        </span>
                        <svg
                          className={['h-5 w-5 text-lunar-green transition-transform', expanded ? 'rotate-180' : ''].join(' ')}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </button>
                  </h2>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    hidden={!expanded}
                    className="space-y-3 border-t border-border px-4 py-4 lg:px-5"
                  >
                    {c.procedures.map((p) => (
                      <ProcedureCard key={p.id} procedure={p} pattern={pattern} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
