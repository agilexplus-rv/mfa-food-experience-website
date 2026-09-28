import type { Payload } from 'payload'

/**
 * Mark the booker's open waitlist entries for this event as converted: they
 * have a seat now, so they must not be notified about free seats again.
 *
 * Both 'waiting' and 'notified' entries count -- the usual path is
 * notified (a seat freed up) -> books. The email is matched
 * case-insensitively: the waitlist form lowercases it, checkout keeps it
 * as typed.
 *
 * Best-effort: never throws, so it can't fail the booking it follows.
 * Returns the number of entries converted.
 */
export async function convertWaitlistEntries(
  p: Payload,
  eventId: string | number,
  email: string,
): Promise<number> {
  try {
    const open = await p.find({
      collection: 'waitlist',
      where: { and: [{ event: { equals: eventId } }, { status: { in: ['waiting', 'notified'] } }] },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    const target = email.trim().toLowerCase()
    const matches = (open.docs as { id: string | number; email?: string }[]).filter(
      (w) => (w.email || '').trim().toLowerCase() === target,
    )
    const convertedAt = new Date().toISOString()
    for (const w of matches) {
      await p.update({
        collection: 'waitlist',
        id: w.id,
        data: { status: 'converted', convertedAt },
        overrideAccess: true,
      })
    }
    return matches.length
  } catch (err) {
    console.error('[waitlist] Failed to convert waitlist entries for event', eventId, err)
    return 0
  }
}
