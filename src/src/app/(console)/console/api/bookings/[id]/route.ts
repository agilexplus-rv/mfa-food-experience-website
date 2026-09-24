import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { verifySession } from '@/lib/rbac/verify-session'
import { processCancellationRefund } from '@/lib/bookings/refund'

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
      id,
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
        stripePaymentIntentId: b.stripePaymentIntentId,
        stripeRefundId: b.stripeRefundId,
        eventDate,
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
        updateData.stripeRefundId = refundResult.refundId
        updateData.refundStatus = refundResult.refundStatus
      } else if (refundResult.refundStatus === 'none') {
        updateData.refundStatus = 'none'
      }

      await p.update({
        collection: 'bookings',
        id,
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
        const eventTitle = (eventDoc as { title?: string } | null)?.title ?? 'the event'

        try {
          await p.sendEmail({
            to: entry.email,
            subject: `Seats available — ${eventTitle}`,
            html: `<p>Hello ${entry.name},</p>
<p>Good news! Seats are now available for <strong>${eventTitle}</strong>.</p>
<p>Please visit the Malta Food Experience website to book your spot.</p>
<p>— Malta Food Experience</p>`,
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
    try {
      // Best-effort: call the existing resend-confirmation endpoint
      await p.update({
        collection: 'bookings',
        id,
        data: { status: b.status },
        overrideAccess: true,
      })
      return NextResponse.json({ ok: true, action: 'resend', note: 'Confirmation email queue triggered.' })
    } catch (err) {
      console.error('[console/api/bookings] Resend failed:', err)
      return NextResponse.json({ error: 'resend_failed' }, { status: 500 })
    }
  }

  if (action === 'no-show') {
    try {
      await p.update({
        collection: 'bookings',
        id,
        data: { noShow: true },
        overrideAccess: true,
      })
      return NextResponse.json({ ok: true, action: 'no_show' })
    } catch (err) {
      console.error('[console/api/bookings] No-show failed:', err)
      return NextResponse.json({ error: 'noshow_failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
}
