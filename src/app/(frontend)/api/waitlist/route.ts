import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { getAvailability } from '@/lib/availability'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * POST /api/waitlist
 *
 * Public: create a waitlist entry for a full event.
 * Validates that the event is actually full (rejects if seats available).
 */
export async function POST(req: NextRequest) {
  const p = await payload()

  let body: { eventId?: string; email?: string; name?: string; phone?: string; persons?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const eventId = body.eventId
  const email = body.email?.trim().toLowerCase()
  const name = body.name?.trim()
  const phone = body.phone?.trim() || undefined
  const persons = body.persons || 1

  if (!eventId || !email || !name) {
    return NextResponse.json(
      { error: 'eventId, email, and name are required' },
      { status: 400 },
    )
  }

  if (!email.includes('@')) {
    return NextResponse.json({ error: 'invalid email format' }, { status: 400 })
  }

  if (persons < 1 || !Number.isInteger(persons)) {
    return NextResponse.json({ error: 'persons must be a positive integer' }, { status: 400 })
  }

  // Verify the event exists and is actually full
  const eventDoc = await p.findByID({ collection: 'events', id: eventId, overrideAccess: true }).catch(() => null)
  if (!eventDoc) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }

  const availability = await getAvailability(eventId)
  if (availability.remaining > 0) {
    return NextResponse.json(
      { error: 'seats_available', remaining: availability.remaining },
      { status: 409 },
    )
  }

  // Check for duplicate (same email for same event already waiting)
  const existing = await p.find({
    collection: 'waitlist',
    where: {
      and: [
        { event: { equals: eventId } },
        { email: { equals: email } },
        { status: { equals: 'waiting' } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    return NextResponse.json(
      { error: 'already_on_waitlist', message: 'You are already on the waitlist for this event.' },
      { status: 409 },
    )
  }

  const entry = await p.create({
    collection: 'waitlist',
    data: {
      event: eventId,
      email,
      name,
      phone,
      persons,
      status: 'waiting',
    },
    overrideAccess: true,
  })

  return NextResponse.json({
    ok: true,
    id: (entry as { id: string | number }).id,
    message: 'You have been added to the waitlist. We will notify you if seats become available.',
  })
}
