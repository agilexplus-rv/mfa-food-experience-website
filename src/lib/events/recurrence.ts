/**
 * Event date/time + recurrence helpers shared by the console event API
 * routes. Pure module (no Payload imports).
 *
 * Storage convention: event times are stored as the wall-clock time the
 * admin entered, written as literal UTC ("19:00" on 28 Sep ->
 * "2026-09-28T19:00:00.000Z"), and `date` as that day's UTC midnight.
 * Always compose explicit `Z` strings so the stored value never depends on
 * the DB session TimeZone.
 */

export type RepeatFrequency = 'weekly' | 'biweekly' | 'monthly'

/** Max events in one series (anchor + generated copies). */
export const MAX_SERIES_EVENTS = 52

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** A real calendar day in `YYYY-MM-DD` form. */
export function isDay(v: unknown): v is string {
  if (typeof v !== 'string' || !DAY_RE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  // Reject rollovers such as 2026-02-31 (Date.parse would accept them).
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** Today's calendar day in Malta (same rule as completeFinishedEvents). */
export function todayMalta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Malta' }).format(now)
}

/** HH:MM from 'HH:MM', 'HH:MM:SS' or '<day>T<HH:MM>…' (no timezone conversion). */
export function timeOfDay(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = (v.includes('T') ? v.slice(v.indexOf('T') + 1) : v).slice(0, 5)
  return HHMM_RE.test(t) ? t : null
}

/** Stored form: the admin's wall-clock time as literal UTC on the given day. */
export function composeOnDay(day: string, hhmm: string): string {
  return `${day}T${hhmm}:00.000Z`
}

/** Stored form of the `date` field: the day's UTC midnight. */
export function dayStart(day: string): string {
  return `${day}T00:00:00.000Z`
}

// --- UTC-date arithmetic on YYYY-MM-DD strings ---

function toUtc(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(day: string, n: number): string {
  const d = toUtc(day)
  d.setUTCDate(d.getUTCDate() + n)
  return fmt(d)
}

/** `day` + n months, clamped to the target month's last day (Jan 31 + 1 -> Feb 28/29). */
function addMonthsClamped(day: string, n: number): string {
  const [y, m, dd] = day.split('-').map(Number)
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate()
  return fmt(new Date(Date.UTC(y, m - 1 + n, Math.min(dd, last))))
}

function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000)
}

/**
 * Repeat dates AFTER `anchor` (the anchor itself is never included).
 *
 * - weekly / biweekly: anchor + n*7 / n*14 days; monthly: anchor + n
 *   months, clamped to month end (each date is computed from the anchor,
 *   so Jan 31 -> Feb 28 -> Mar 31, no cumulative drift).
 * - `until` is inclusive.
 * - `notBefore` (optional): skip dates earlier than this day. The first
 *   date is then the first cadence match >= notBefore (still never the
 *   anchor itself).
 * - At most `max` dates.
 */
export function occurrenceDates(opts: {
  anchor: string
  frequency: string
  until: string
  notBefore?: string
  max: number
}): { dates: string[] } | { error: 'invalid_frequency' | 'invalid_until_date' } {
  const { anchor, frequency, until, notBefore, max } = opts
  const step = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : frequency === 'monthly' ? 0 : -1
  if (step === -1) return { error: 'invalid_frequency' }
  if (!isDay(until)) return { error: 'invalid_until_date' }

  const at = (n: number): string => (step > 0 ? addDays(anchor, n * step) : addMonthsClamped(anchor, n))

  let n = 1
  if (notBefore && anchor < notBefore) {
    if (step > 0) {
      n = Math.max(1, Math.ceil(daysBetween(anchor, notBefore) / step))
    } else {
      while (at(n) < notBefore) n++
    }
  }

  const dates: string[] = []
  while (dates.length < max) {
    const d = at(n)
    if (d > until) break
    dates.push(d)
    n++
  }
  return { dates }
}
