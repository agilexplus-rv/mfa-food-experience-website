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

/**
 * Absolute end timestamp of an event. `endTime` is a time-only field; the
 * console stores it on the event's own date, but Payload's time picker
 * stores whatever date it was edited on -- so take the calendar day from
 * `date` and only the time-of-day from `endTime`. An end time-of-day
 * earlier than the start (e.g. 22:00-01:00) means the event ends the
 * next day.
 */
export function eventEndMs(date: string | undefined, endTime: string | undefined, startTime?: string): number | null {
  if (!date) return null
  const day = date.slice(0, 10)
  if (!endTime) {
    // No end time: treat the end of the event's day as the end.
    const t = new Date(`${day}T23:59:59.999Z`).getTime()
    return Number.isNaN(t) ? null : t
  }
  const end = new Date(endTime)
  if (Number.isNaN(end.getTime())) return null
  const onDay = (t: Date) => new Date(`${day}${t.toISOString().slice(10)}`).getTime()
  let endMs = onDay(end)
  if (Number.isNaN(endMs)) return end.getTime()
  const start = startTime ? new Date(startTime) : null
  if (start && !Number.isNaN(start.getTime()) && endMs <= onDay(start)) endMs += 86_400_000
  return endMs
}

/**
 * Absolute start timestamp of an event, same calendar-day handling as
 * `eventEndMs` (the time picker stores `startTime`'s time-of-day against
 * whatever date it happened to be edited on, so the day always comes
 * from `date`).
 */
export function eventStartMs(date: string | undefined, startTime: string | undefined): number | null {
  if (!date || !startTime) return null
  const day = date.slice(0, 10)
  const start = new Date(startTime)
  if (Number.isNaN(start.getTime())) return null
  const onDay = (t: Date) => new Date(`${day}${t.toISOString().slice(10)}`).getTime()
  const startMs = onDay(start)
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
