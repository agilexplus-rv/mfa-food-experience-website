import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { processCancellationRefund } from '@/lib/bookings/refund'
import { actingAs, clientMeta } from '@/lib/audit/helper'
import { sendConfirmationEmail } from '@/lib/email/send-confirmation'
import { generateQrToken, hashQrToken } from '@/lib/qr/token'

let _payload: Payload | null = null
async function payload(): Promise<Payload> {
  if (!_payload) _payload = await getPayload({ config })
  return _payload
}

async function auth(req: NextRequest): Promise<{ id: string | number; email: string; role: string } | null> {
  const p = await payload()
  const user = await verifySession(req, p)
  if (!user || user.role !== 'admin') return null
  return user
}

/** POST /console/api/bookings/[id]?action=cancel|resend|no-show */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const currentUser = await auth(req)
  if (!currentUser) {
    const p = await payload()
    const user = await verifySession(req, p)
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const numericId = Number(id)
  const p = await payload()
  const action = req.nextUrl.searchParams.get('action')

  if (!action) {
    return NextResponse.json({ error: 'action param required (cancel, resend, no-show)' }, { status: 400 })
  }

  // Verify booking exists
  let booking
  try {
    booking = await p.findByID({
      collection: 'bookings',
      id: numericId,
      depth: 2,
      overrideAccess: true,
    })
  } catch {
    return NextResponse.json({ error: 'booking_not_found' }, { status: 404 })
  }
  if (!booking) return NextResponse.json({ error: 'booking_not_found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = booking as any

  if (action === 'cancel') {
    if (b.status === 'cancelled') {
      return NextResponse.json({ error: 'already_cancelled' }, { status: 400 })
    }

    // --- Parse request body for override flag ---
    let overrideTier = false
    let reason: string | undefined
    try {
      const body = await req.json()
      overrideTier = Boolean(
        (body as Record<string, unknown>)?.overrideTier,
      )
      reason =
        typeof (body as Record<string, unknown>)?.reason === 'string'
          ? (body as { reason: string }).reason
          : undefined
    } catch { /* no body */ }

    // --- Stripe refund with cancellation-policy tier logic ---
    let refundResult: { refundId?: string; refundStatus: string; tierLabel: string; overridden: boolean } = {
      refundStatus: 'none',
      tierLabel: 'No refund processed',
      overridden: false,
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = b.event as any
      const eventDate = event?.date || null

      const result = await processCancellationRefund({
        bookingId: id as string | number,
        reference: b.reference,
        status: b.status,
        totalAmount: b.totalAmount || 0,
        vivaTransactionId: b.vivaTransactionId,
        vivaRefundId: b.vivaRefundId,
        eventDate,
        bookedAt: b.createdAt ?? null,
        overrideTier,
      })

      refundResult = {
        refundId: result.refundId,
        refundStatus: result.refundStatus,
        tierLabel: result.tierLabel,
        overridden: result.overridden,
      }
    } catch (refundErr) {
      console.error('[console/api/bookings] Refund failed:', refundErr)
      return NextResponse.json(
        { error: 'refund_failed', message: 'Cancellation aborted: refund could not be processed.' },
        { status: 500 },
      )
    }

    // Mark booking as cancelled with refund details
    try {
      const updateData: Record<string, unknown> = { status: 'cancelled' }
      if (refundResult.refundId) {
        updateData.vivaRefundId = refundResult.refundId
        updateData.refundStatus = refundResult.refundStatus
      } else if (refundResult.refundStatus === 'none') {
        updateData.refundStatus = 'none'
      }

      await p.update({
        collection: 'bookings',
        id: numericId,
        data: updateData,
        overrideAccess: true,
      })
    } catch (err) {
      console.error('[console/api/bookings] Cancel save failed:', err)
      return NextResponse.json({ error: 'cancel_failed' }, { status: 500 })
    }

    // --- Free seat holds for this event+booking ---
    const eventId = typeof b.event === 'object' ? b.event.id : b.event
    try {
      const holds = await p.find({
        collection: 'seat_holds',
        where: { event: { equals: eventId } },
        limit: 50,
        overrideAccess: true,
      })
      for (const h of holds.docs as { id: string | number; seats: number }[]) {
        await p.delete({ collection: 'seat_holds', id: h.id, overrideAccess: true }).catch(() => undefined)
      }
    } catch (err) {
      console.warn('[console/cancel] Failed to clean up seat holds for event', eventId, err)
    }

    // --- Waitlist notification ---
    try {
      const waitlistEntry = await p.find({
        collection: 'waitlist',
        where: {
          and: [
            { event: { equals: eventId } },
            { status: { equals: 'waiting' } },
          ],
        },
        sort: 'createdAt',
        limit: 1,
        overrideAccess: true,
      })

      if (waitlistEntry.docs.length > 0) {
        const entry = waitlistEntry.docs[0] as unknown as {
          id: string | number
          email: string
          name: string
          event: string | number
        }
        const eventDoc = await p.findByID({
          collection: 'events',
          id: eventId,
          overrideAccess: true,
        }).catch(() => null)
        const eventTitle = (eventDoc as { title?: string } | null)?.title ?? 'the experience'

        try {
          await p.sendEmail({
            to: entry.email,
            subject: `Seats available: ${eventTitle}`,
            html: `<p>Hello ${entry.name},</p>
<p>Good news! Seats are now available for <strong>${eventTitle}</strong>.</p>
<p>Please visit the Malta Food Experience website to book your spot.</p>
<p>Malta Food Experience</p>`,
          })
        } catch (emailErr) {
          console.warn('[console/cancel/waitlist] Failed to send waitlist notification email:', emailErr)
        }

        await p.update({
          collection: 'waitlist',
          id: entry.id,
          data: { status: 'notified', notifiedAt: new Date().toISOString() },
          overrideAccess: true,
        })
      }
    } catch (err) {
      console.warn('[console/cancel/waitlist] Waitlist notification check failed:', err)
    }

    // --- Audit log ---
    await p.create({
      collection: 'audit_logs',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        action: 'update',
        actor: currentUser.id as string,
        collection: 'bookings',
        documentId: String(id),
        detail: [
          `Cancelled ${b.reference}`,
          reason ? `(reason: ${reason})` : '',
          `refund tier: ${refundResult.tierLabel}`,
          refundResult.overridden ? '(staff override)' : '',
          refundResult.refundId
            ? `(refund: ${refundResult.refundId}, status: ${refundResult.refundStatus})`
            : refundResult.refundStatus === 'none'
              ? '(no refund issued)'
              : '',
        ]
          .filter(Boolean)
          .join(' '),
        ...clientMeta(req),
      } as any,
      overrideAccess: true,
    })

    return NextResponse.json({
      ok: true,
      action: 'cancelled',
      reference: b.reference,
      refund: refundResult.refundId
        ? {
            id: refundResult.refundId,
            status: refundResult.refundStatus,
            tier: refundResult.tierLabel,
            overridden: refundResult.overridden,
          }
        : {
            tier: refundResult.tierLabel,
            overridden: refundResult.overridden,
            status: refundResult.refundStatus,
          },
    })
  }

  if (action === 'resend') {
    // Same flow as /api/bookings/[id]/resend-confirmation
    if (b.status !== 'confirmed') {
      return NextResponse.json(
        { error: 'only_confirmed_bookings', message: 'Can only resend confirmation for confirmed bookings.' },
        { status: 409 },
      )
    }

    try {
      // Look up event info
      let eventInfo: { title: string; date: string; startTime: string; endTime: string; locationRef: string } | null = null
      if (typeof b.event === 'object' && b.event?.title) {
        eventInfo = b.event
      } else {
        const ev = await p.findByID({
          collection: 'events',
          id: typeof b.event === 'object' ? b.event?.id : b.event,
          overrideAccess: true,
        }).catch(() => null)
        if (ev) {
          eventInfo = ev as unknown as { title: string; date: string; startTime: string; endTime: string; locationRef: string }
        }
      }

      if (!eventInfo) {
        return NextResponse.json({ error: 'event_not_found' }, { status: 500 })
      }

      // Generate new QR token (only the hash is stored, so the old QR stops working)
      const rawQrToken = generateQrToken()
      const qrTokenHash = hashQrToken(rawQrToken)

      await p.update({
        collection: 'bookings',
        id: numericId,
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

      // --- Audit log ---
      await p.create({
        collection: 'audit_logs',
        data: {
          action: 'update',
          actor: currentUser.id as string,
          collection: 'bookings',
          documentId: String(id),
          detail: `Resent confirmation email for ${b.reference}`,
          ...clientMeta(req),
        },
        overrideAccess: true,
      })

      return NextResponse.json({ ok: true, action: 'resend', reference: b.reference })
    } catch (err) {
      console.error('[console/api/bookings] Resend failed:', err)
      return NextResponse.json({ error: 'resend_failed' }, { status: 500 })
    }
  }

  if (action === 'no-show') {
    try {
      await p.update({
        collection: 'bookings',
        id: numericId,
        data: { noShow: true },
        overrideAccess: true,
        ...actingAs(currentUser, req),
      })
      return NextResponse.json({ ok: true, action: 'no_show' })
    } catch (err) {
      console.error('[console/api/bookings] No-show failed:', err)
      return NextResponse.json({ error: 'noshow_failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
}
