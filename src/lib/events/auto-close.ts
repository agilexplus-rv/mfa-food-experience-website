import type { Payload } from 'payload'

/**
 * Transition finished events from 'scheduled' to 'completed'.
 *
 * Rule: only 'scheduled' events are touched, and only once their date
 * (Europe/Malta calendar day) has fully passed. 'cancelled' is a
 * terminal, user-set state and is never changed by automation.
 *
 * Note: `autoCloseHoursAfter` no longer affects completion timing -- it
 * now controls the booking cutoff (see `isEventBookable` below), not
 * when an event is marked "Completed".
 *
 * Idempotent: safe to run from multiple schedulers / replicas.
 */
export async function completeFinishedEvents(
  p: Payload,
  now: Date = new Date(),
): Promise<{ completed: number; cutoffDate: string }> {
  const todayMalta = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Malta' }).format(now)
  let completed = 0

  const stale = await p.find({
    collection: 'events',
    where: {
      and: [
        { status: { equals: 'scheduled' } },
        { date: { less_than: todayMalta } },
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  for (const ev of stale.docs) {
    await p.update({
      collection: 'events',
      id: (ev as { id: string | number }).id,
      data: { status: 'completed' },
      overrideAccess: true,
    })
    completed++
  }

  return { completed, cutoffDate: todayMalta }
}

const MALTA_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Malta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** The Europe/Malta wall clock of an instant, re-read as if it were UTC (ms). */
function maltaWallAsUtcMs(ms: number): number {
  const parts: Record<string, string> = {}
  for (const { type, value } of MALTA_PARTS.formatToParts(new Date(ms))) parts[type] = value
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
}

/**
 * True UTC instant (ms) of a Europe/Malta wall-clock time `${day}T${hhmm}`.
 *
 * Two-pass offset correction with Intl (no timezone library): start from
 * the wall clock read as UTC, see what Malta wall clock that instant has,
 * and shift by the difference; a second pass settles DST boundaries.
 * Ambiguous autumn-fallback times (02:00-03:00 twice) resolve to one of
 * the two instants; a non-existent spring-forward time (02:00-03:00 on the
 * last Sunday of March) lands an hour off -- both are pathological for a
 * dinner event and never throw.
 */
function maltaWallClockToUtcMs(day: string, hhmm: string): number {
  const target = Date.parse(`${day}T${hhmm}:00Z`)
  if (Number.isNaN(target)) return NaN
  let ms = target
  for (let i = 0; i < 2; i++) {
    const diff = target - maltaWallAsUtcMs(ms)
    if (diff === 0) break
    ms += diff
  }
  return ms
}

/**
 * Time-of-day (HH:MM) of a stored event time. Event times are stored as
 * the admin's Malta wall-clock time written as literal UTC
 * ("19:00" -> "…T19:00:00.000Z"), so the UTC slice IS the wall clock.
 */
function wallTimeOf(v: string): string | null {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(11, 16)
}

/**
 * Absolute end timestamp of an event (true UTC instant). `endTime` is a
 * time-only field; the console stores it on the event's own date, but
 * Payload's time picker stores whatever date it was edited on -- so take
 * the calendar day from `date` and only the time-of-day from `endTime`,
 * and interpret `${day}T${HH:MM}` as Europe/Malta wall clock (the stored
 * value is wall-clock-as-UTC, not a real instant). An end time-of-day
 * earlier than (or equal to) the start (e.g. 22:00-01:00) means the event
 * ends the next day.
 */
export function eventEndMs(date: string | undefined, endTime: string | undefined, startTime?: string): number | null {
  if (!date) return null
  const day = date.slice(0, 10)
  if (!endTime) {
    // No end time: treat the end of the event's day (Malta) as the end.
    const t = maltaWallClockToUtcMs(day, '23:59') + 59_999
    return Number.isNaN(t) ? null : t
  }
  const endT = wallTimeOf(endTime)
  if (!endT) return null
  let endMs = maltaWallClockToUtcMs(day, endT)
  if (Number.isNaN(endMs)) return new Date(endTime).getTime()
  const startT = startTime ? wallTimeOf(startTime) : null
  if (startT) {
    const startMs = maltaWallClockToUtcMs(day, startT)
    if (!Number.isNaN(startMs) && endMs <= startMs) {
      // Crosses midnight: same wall-clock time on the next day (re-converted
      // so a DST change overnight is handled).
      const next = new Date(`${day}T00:00:00Z`)
      next.setUTCDate(next.getUTCDate() + 1)
      endMs = maltaWallClockToUtcMs(next.toISOString().slice(0, 10), endT)
    }
  }
  return endMs
}

/**
 * Absolute start timestamp of an event (true UTC instant), same
 * calendar-day and Malta wall-clock handling as `eventEndMs` (the time
 * picker stores `startTime`'s time-of-day against whatever date it happened
 * to be edited on, so the day always comes from `date`). A "19:00" event
 * starts at 17:00Z in summer (CEST) and 18:00Z in winter (CET).
 */
export function eventStartMs(date: string | undefined, startTime: string | undefined): number | null {
  if (!date || !startTime) return null
  const day = date.slice(0, 10)
  const startT = wallTimeOf(startTime)
  if (!startT) return null
  const startMs = maltaWallClockToUtcMs(day, startT)
  return Number.isNaN(startMs) ? null : startMs
}

/**
 * Whether an event can still accept new bookings right now.
 *
 * `autoCloseHoursAfter` is a booking cutoff: bookings close this many
 * hours *before* the event starts (e.g. 2 = last-minute bookings stop
 * 2 hours before start). An event whose start time has already passed
 * is never bookable regardless of the cutoff setting.
 */
export function isEventBookable(
  event: { date?: string; startTime?: string; autoCloseHoursAfter?: number | null },
  now: Date = new Date(),
): boolean {
  const startMs = eventStartMs(event.date, event.startTime)
  if (startMs === null) return true
  const nowMs = now.getTime()
  if (nowMs >= startMs) return false
  const hours = event.autoCloseHoursAfter
  if (hours != null && hours > 0) {
    const cutoffMs = startMs - hours * 3_600_000
    if (nowMs >= cutoffMs) return false
  }
  return true
}
