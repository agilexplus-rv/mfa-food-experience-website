/**
 * Shared date/time formatting utilities.
 *
 * Payload's `date` field with `pickerAppearance: 'dayOnly'` still returns
 * a full ISO datetime string (e.g. "2026-08-07T00:00:00.000Z"), not a
 * plain YYYY-MM-DD string. These helpers slice to the date portion before
 * constructing a Date to avoid NaN on already-full ISO strings.
 */

/**
 * Format a Payload dayOnly date ISO string as a human-readable date.
 *
 * @param dateIso  Full ISO datetime string from Payload (e.g. "2026-08-07T00:00:00.000Z")
 * @param style    'short' (e.g. "Fri, 7 Aug 2026") or 'long' (e.g. "Friday, 7 August 2026")
 * @returns        Formatted date string, or the raw input on failure.
 */
export function formatDay(
  dateIso: string,
  style: 'short' | 'long' = 'short',
): string {
  const d = new Date(dateIso.slice(0, 10) + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateIso
  if (style === 'long') {
    return d.toLocaleDateString('en-MT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }
  return d.toLocaleDateString('en-MT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format a start/end time pair as a range (e.g. "14:00 – 16:30").
 *
 * @param startIso  ISO time string (e.g. "14:00:00" or "2026-08-07T14:00:00.000Z")
 * @param endIso    ISO time string
 * @returns         Formatted range string, or "" on failure.
 */
export function formatTimeRange(startIso: string, endIso: string): string {
  const s = new Date(startIso)
  const e = new Date(endIso)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return ''
  const fmt = new Intl.DateTimeFormat('en-MT', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  })
  return `${fmt.format(s)} – ${fmt.format(e)}`
}
