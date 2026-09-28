import type { CollectionAfterChangeHook, CollectionConfig, Payload, Where } from 'payload'
import { auditLog, diffChanges, requestMeta } from '@/lib/audit/helper'

type CancelledEvent = { id: string | number; title?: string; date?: string | null; status?: string }

/**
 * Event cancellation cascade: when an event moves TO 'cancelled', cancel
 * every live booking for it and refund each one in full -- the organiser
 * cancelled, so the cancellation-policy tiers don't apply.
 *
 * An afterChange hook rather than beforeChange: Payload runs collection
 * beforeChange hooks before field validation, so an update rejected there
 * would already have issued (irreversible) VIVA refunds.
 *
 * The cascade is fire-and-forget, like auditLog(): it runs outside the
 * event update's DB transaction instead of holding it open across one
 * payment-API call per booking (see the Azure Postgres note in Users.ts).
 * So the save returns first and the bookings flip a moment later.
 */
const cascadeEventCancellation: CollectionAfterChangeHook = ({ operation, doc, previousDoc, req }) => {
  if (operation !== 'update') return doc
  const ev = doc as CancelledEvent
  const previousStatus = (previousDoc as { status?: string } | undefined)?.status
  if (ev.status !== 'cancelled' || previousStatus === 'cancelled') return doc

  const actor = (req.user as { id?: string | number } | null)?.id
  void cancelEventBookings(req.payload, { id: ev.id, title: ev.title, date: ev.date }, actor, requestMeta(req))
  return doc
}

/**
 * Best-effort per booking; never rejects. A booking whose refund fails is
 * still cancelled, with refundStatus 'failed', so staff can refund it by hand.
 */
async function cancelEventBookings(
  p: Payload,
  ev: CancelledEvent,
  actor: string | number | undefined,
  meta: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const liveBookings: Where = { and: [{ event: { equals: ev.id } }, { status: { not_equals: 'cancelled' } }] }
  let cancelled = 0
  let refunded = 0
  const refundFailed: string[] = []
  const writeFailed: string[] = []

  try {
    // Imported on use: refund.ts imports @payload-config, and a static
    // import here would make the config import itself (config -> Events -> refund -> config).
    const { processCancellationRefund } = await import('@/lib/bookings/refund')

    const bookings = await p.find({ collection: 'bookings', where: liveBookings, limit: 0, depth: 0, overrideAccess: true })

    for (const raw of bookings.docs) {
      const b = raw as {
        id: string | number
        reference: string
        status: string
        totalAmount?: number | null
        vivaTransactionId?: string | null
        vivaRefundId?: string | null
        createdAt?: string | null
      }
      const update: Record<string, unknown> = { status: 'cancelled' }
      let refundNote: string
      try {
        const refund = await processCancellationRefund({
          bookingId: b.id,
          reference: b.reference,
          status: b.status,
          totalAmount: b.totalAmount || 0,
          vivaTransactionId: b.vivaTransactionId,
          vivaRefundId: b.vivaRefundId,
          eventDate: ev.date ?? null,
          bookedAt: b.createdAt ?? null,
          overrideTier: true,
        })
        if (refund.refundId) {
          update.vivaRefundId = refund.refundId
          update.refundStatus = refund.refundStatus
          refunded++
          refundNote = `refund: ${refund.refundId}, status: ${refund.refundStatus}`
        } else {
          update.refundStatus = 'none'
          refundNote = 'no refund issued'
        }
      } catch (err) {
        console.error('[events/cancel-cascade] Refund failed for booking', b.reference, err)
        update.refundStatus = 'failed'
        refundFailed.push(b.reference)
        refundNote = 'refund FAILED, refund manually'
      }

      try {
        await p.update({ collection: 'bookings', id: b.id, data: update, overrideAccess: true })
        cancelled++
        auditLog(p, {
          action: 'update',
          actor,
          collection: 'bookings',
          documentId: b.id,
          detail: `Cancelled ${b.reference}: experience "${ev.title}" was cancelled (full refund; ${refundNote})`,
          ...meta,
        })
      } catch (err) {
        console.error('[events/cancel-cascade] Failed to cancel booking', b.reference, `(${refundNote})`, err)
        writeFailed.push(b.reference)
      }
    }

    // Safety net: bookings the loop could not write, or created mid-cascade.
    const rest = await p.update({ collection: 'bookings', where: liveBookings, data: { status: 'cancelled' }, overrideAccess: true })
    cancelled += rest.docs.length
  } catch (err) {
    console.error('[events/cancel-cascade] Cascade failed for event', ev.id, err)
  }

  const summary = [
    `Experience "${ev.title}" cancelled: ${cancelled} booking${cancelled === 1 ? '' : 's'} cancelled, ${refunded} refunded`,
    refundFailed.length ? `refund FAILED for ${refundFailed.join(', ')}` : '',
    writeFailed.length ? `could not update ${writeFailed.join(', ')}` : '',
  ].filter(Boolean).join('; ')
  console.info('[events/cancel-cascade]', summary)
  auditLog(p, { action: 'update', actor, collection: 'events', documentId: ev.id, detail: summary, ...meta })
}

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    create: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    // Admin/door_staff: read all (door_staff needs event context for check-in)
    // Public: read only scheduled events
    read: ({ req: { user } }) => {
      if (user) return true
      return { status: { equals: 'scheduled' } }
    },
    update: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
    delete: ({ req: { user } }) => (user as { role?: string } | null)?.role === 'admin',
  },
  hooks: {
    afterChange: [
      async ({ operation, doc, previousDoc, req }) => {
        try {
          const actor = req.user as { id?: string | number } | null
          if (!actor?.id) return

          const d = doc as { id: string | number; title: string }

          if (operation === 'create') {
            auditLog(req.payload, {
              action: 'create',
              actor: actor.id,
              collection: 'events',
              documentId: d.id,
              detail: `Created experience "${d.title}"`,
              ...requestMeta(req),
            })
          } else if (operation === 'update') {
            const changes = diffChanges(
              (previousDoc as Record<string, unknown>) || {},
              (doc as Record<string, unknown>) || {},
            )
            auditLog(req.payload, {
              action: 'update',
              actor: actor.id,
              collection: 'events',
              documentId: d.id,
              detail: `Updated experience "${d.title}"`,
              ...requestMeta(req),
              changes,
            })
          }
        } catch {
          // audit failure must not block the primary operation
        }
      },
      cascadeEventCancellation,
    ],
    afterDelete: [
      async ({ doc, req }) => {
        try {
          const actor = req.user as { id?: string | number } | null
          if (!actor?.id || !doc) return

          const d = doc as { id: string | number; title: string }
          auditLog(req.payload, {
            action: 'delete',
            actor: actor.id,
            collection: 'events',
            documentId: d.id,
            detail: `Deleted experience "${d.title}"`,
            ...requestMeta(req),
          })
        } catch {
          // audit failure must not block the primary operation
        }
      },
    ],
  },
  fields: [
    {
      name: 'service',
      type: 'relationship',
      relationTo: 'services',
      required: true,
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'dayOnly' },
      },
    },
    {
      name: 'startTime',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'timeOnly' },
      },
    },
    {
      name: 'endTime',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'timeOnly' },
      },
    },
    {
      name: 'capacity',
      type: 'number',
      required: true,
      min: 1,
    },
    {
      name: 'pricePerPerson',
      type: 'number',
      label: 'Price per person (EUR)',
      required: true,
      min: 0,
      admin: {
        description: 'Price in euros (e.g. 45.50), not cents.',
        step: 0.01,
      },
    },
    {
      name: 'locationRef',
      type: 'text',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Completed', value: 'completed' },
      ],
      defaultValue: 'scheduled',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      // Recurring events (Rudie 2026-07-12): occurrences generated from
      // one "repeat" form submission share a seriesId (UUID). Each
      // occurrence is an independent row -- independently editable,
      // cancellable, bookable -- the series link exists only for
      // "edit this and future events" scoped updates. No RRULE
      // materialisation at read time; the console generates concrete
      // rows up front (bounded, max 52 occurrences per series).
      name: 'seriesId',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Present when this event was created as part of a recurring series.',
      },
    },
    {
      name: 'autoCloseHoursAfter',
      type: 'number',
      min: 0,
      admin: {
        position: 'sidebar',
        description: 'Optional. Stop accepting new bookings this many hours before the experience starts. Leave empty for no cutoff.',
      },
    },
    {
      name: 'fullyBookedOverride',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'FR-2.5: Manually mark as fully booked (overrides capacity calculation).',
      },
    },
  ],
}
