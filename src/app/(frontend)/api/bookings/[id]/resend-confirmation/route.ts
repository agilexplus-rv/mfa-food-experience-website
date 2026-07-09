import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { sendConfirmationEmail } from '@/lib/email/send-confirmation'
import { generateQrToken, hashQrToken } from '@/lib/qr/token'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

/**
 * POST /api/bookings/[id]/resend-confirmation
 *
 * Admin-only. Regenerates QR token and resends the confirmation email.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const p = await payload()

  const user = await verifySession(req, p)
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const booking = await p
    .findByID({ collection: 'bookings', id, overrideAccess: true, depth: 1 })
    .catch(() => null)

  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const b = booking as {
    id: string | number
    reference: string
    status: string
    email: string
    leadAttendeeName: string
    persons: number
    totalAmount: number
    language: 'en' | 'mt'
    event: { id: string | number; title: string; date: string; startTime: string; endTime: string; locationRef: string } | string | number
  }

  if (b.status !== 'confirmed') {
    return NextResponse.json(
      { error: 'only_confirmed_bookings', message: 'Can only resend confirmation for confirmed bookings.' },
      { status: 409 },
    )
  }

  // Look up event info
  let eventInfo: { title: string; date: string; startTime: string; endTime: string; locationRef: string } | null = null
  if (typeof b.event === 'object' && b.event.title) {
    eventInfo = b.event
  } else {
    const ev = await p.findByID({
      collection: 'events',
      id: typeof b.event === 'object' ? b.event.id : b.event,
      overrideAccess: true,
    }).catch(() => null)
    if (ev) {
      const e = ev as unknown as { title: string; date: string; startTime: string; endTime: string; locationRef: string }
      eventInfo = e
    }
  }

  if (!eventInfo) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 500 })
  }

  // Generate new QR token
  const rawQrToken = generateQrToken()
  const qrTokenHash = hashQrToken(rawQrToken)

  // Update booking with new QR hash
  await p.update({
    collection: 'bookings',
    id,
    data: { qrTokenHash },
    overrideAccess: true,
  })

  // Build and send email
  const dateStr = new Date(eventInfo.date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-MT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const fmt = new Intl.DateTimeFormat('en-MT', { hour: 'numeric', minute: '2-digit', hour12: false })
  const timeRange = `${fmt.format(new Date(eventInfo.startTime))} - ${fmt.format(new Date(eventInfo.endTime))}`

  await sendConfirmationEmail({
    toEmail: b.email,
    reference: b.reference,
    eventTitle: eventInfo.title,
    eventDate: dateStr,
    eventTimeRange: timeRange,
    locationRef: eventInfo.locationRef,
    persons: b.persons,
    totalAmount: b.totalAmount,
    language: b.language ?? 'en',
    rawQrToken,
  })

  // Audit log
  await p.create({
    collection: 'audit_logs',
    data: {
      action: 'update',
      actor: user.id as string,
      collection: 'bookings',
      documentId: String(id),
      detail: `Resent confirmation email for ${b.reference}`,
    },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true, reference: b.reference })
}
