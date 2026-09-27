'use client'

import { useState } from 'react'

import type { BookingEventSummary } from '@/lib/bookings/lookup'

/**
 * "Add to calendar" + "Invite friends" actions for the booking
 * confirmation page.
 *
 * Event times are stored as wall-clock Malta times in the UTC slot of the
 * ISO string (see lib/format-date.ts), so we emit floating local times
 * pinned to Europe/Malta rather than converting.
 *
 * Sharing deliberately links to the public event page, never to the
 * confirmation URL (which carries the VIVA OrderCode and shows PII).
 */

const TZID = 'Europe/Malta'

const MALTA_VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZID}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

/** Returns local start/end stamps as YYYYMMDDTHHMMSS, or null if the event times are unusable. */
function localStamps(event: BookingEventSummary): { start: string; end: string } | null {
  const day = event.date?.slice(0, 10)
  const s = new Date(event.startTime)
  const e = new Date(event.endTime)
  if (!day || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null

  const startTod = s.toISOString().slice(11, 16)
  const endTod = e.toISOString().slice(11, 16)
  const startDay = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(startDay.getTime())) return null
  // Same rule as formatTimeRange: an end time-of-day at or before the start means it ends the next day.
  const endDay = new Date(startDay.getTime() + (endTod <= startTod ? 86_400_000 : 0))

  const stamp = (d: Date, tod: string) => `${d.toISOString().slice(0, 10).replace(/-/g, '')}T${tod.replace(':', '')}00`
  return { start: stamp(startDay, startTod), end: stamp(endDay, endTod) }
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function buildIcs(event: BookingEventSummary, stamps: { start: string; end: string }, reference: string, persons: number): string {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Malta Food Experience//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...MALTA_VTIMEZONE,
    'BEGIN:VEVENT',
    `UID:booking-${reference}@maltafoodexperience`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${TZID}:${stamps.start}`,
    `DTEND;TZID=${TZID}:${stamps.end}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `LOCATION:${escapeIcs(event.locationRef ?? '')}`,
    `DESCRIPTION:${escapeIcs(`Booking reference ${reference}, ${persons} guest${persons === 1 ? '' : 's'}. Bring the QR code from your confirmation email.`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

const actionButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-lunar-green/30 px-6 py-3 text-sm font-bold text-lunar-green transition-colors hover:bg-lunar-green/10'

export function CalendarAndShare({
  event,
  reference,
  persons,
}: {
  event: BookingEventSummary
  reference: string
  persons: number
}) {
  const [copied, setCopied] = useState(false)

  const stamps = localStamps(event)

  const googleUrl = stamps
    ? `https://calendar.google.com/calendar/render?${new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title,
        dates: `${stamps.start}/${stamps.end}`,
        ctz: TZID,
        location: event.locationRef ?? '',
        details: `Booking reference ${reference}`,
      }).toString()}`
    : null

  function downloadIcs() {
    if (!stamps) return
    const blob = new Blob([buildIcs(event, stamps, reference, persons)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `malta-food-experience-${reference}.ics`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function share() {
    const url = `${window.location.origin}/events/${encodeURIComponent(String(event.id))}`
    const text = `I'm going to ${event.title} with Malta Food Experience. Join me!`
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: event.title, text, url })
      } catch {
        // User dismissed the share sheet; nothing to do.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copy this link to share the experience:', url)
    }
  }

  return (
    <div className="mt-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Don&apos;t miss it</p>
      <div className="mt-3 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        {stamps && (
          <>
            <button type="button" onClick={downloadIcs} className={actionButton}>
              <CalendarGlyph />
              Add to calendar
            </button>
            {googleUrl && (
              <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={actionButton}>
                <CalendarGlyph />
                Google Calendar
              </a>
            )}
          </>
        )}
        <button type="button" onClick={() => void share()} className={actionButton}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
          </svg>
          {copied ? 'Link copied' : 'Invite friends'}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {copied ? 'Event link copied to clipboard' : ''}
      </p>
    </div>
  )
}

function CalendarGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}
