import type { Payload } from 'payload'

/**
 * Transition finished events from 'scheduled' to 'completed'.
 *
 * Rules:
 *   - Only 'scheduled' events are touched. 'cancelled' is a terminal,
 *     user-set state and is never changed by automation.
 *   - Events with `autoCloseHoursAfter` set close once
 *     `end time + autoCloseHoursAfter hours` has passed -- whatever day
 *     that falls on (so an evening class with a 6h window closes after
 *     midnight, not at the next day's sweep).
 *   - Events without it close once their date (Europe/Malta calendar
 *     day) has fully passed, as before.
 *
 * Idempotent: safe to run from multiple schedulers / replicas.
 */
export async function completeFinishedEvents(
  p: Payload,
  now: Date = new Date(),
): Promise<{ completed: number; cutoffDate: string }> {
  const todayMalta = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Malta' }).format(now)
  const nowMs = now.getTime()
  let completed = 0

  const complete = async (id: string | number) => {
    await p.update({
      collection: 'events',
      id,
      data: { status: 'completed' },
      overrideAccess: true,
    })
    completed++
  }

  // 1. Auto-close window configured: check every scheduled event up to today.
  const withWindow = await p.find({
    collection: 'events',
    where: {
      and: [
        { status: { equals: 'scheduled' } },
        { autoCloseHoursAfter: { greater_than: 0 } },
        { date: { less_than_equal: `${todayMalta}T23:59:59.999Z` } },
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  for (const ev of withWindow.docs) {
    const doc = ev as unknown as { id: string | number; date: string; startTime?: string; endTime?: string; autoCloseHoursAfter?: number | null }
    const endMs = eventEndMs(doc.date, doc.endTime, doc.startTime)
    if (endMs === null) continue
    if (nowMs >= endMs + Number(doc.autoCloseHoursAfter) * 3_600_000) {
      await complete(doc.id)
    }
  }

  // 2. No window: close once the event's calendar day has passed.
  const stale = await p.find({
    collection: 'events',
    where: {
      and: [
        { status: { equals: 'scheduled' } },
        { date: { less_than: todayMalta } },
        {
          or: [
            { autoCloseHoursAfter: { exists: false } },
            { autoCloseHoursAfter: { equals: null } },
            { autoCloseHoursAfter: { less_than_equal: 0 } },
          ],
        },
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  for (const ev of stale.docs) {
    await complete((ev as { id: string | number }).id)
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
