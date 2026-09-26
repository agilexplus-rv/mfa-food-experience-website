/**
 * Minimal CSV helpers for the console exports.
 *
 * - RFC 4180 quoting (commas, quotes, CR/LF).
 * - Formula-injection guard: cells starting with = + - @ (or tab/CR) are
 *   prefixed with an apostrophe so spreadsheet apps treat them as text --
 *   attendee names/notes are user-supplied.
 * - A UTF-8 BOM so Excel shows € and Maltese characters correctly.
 */
export function csvCell(val: unknown): string {
  if (val === null || val === undefined) return ''
  let str = typeof val === 'number' ? String(val) : String(val)
  if (typeof val !== 'number' && /^[=+\-@\t\r]/.test(str)) str = `'${str}`
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** Money as a plain decimal string with 2 places (euros), '' when absent. */
export function csvMoney(n: unknown): string {
  const v = Number(n)
  return n === null || n === undefined || Number.isNaN(v) ? '' : v.toFixed(2)
}

/** Calendar date (YYYY-MM-DD) in Malta time. */
export function csvDate(iso: unknown): string {
  if (!iso) return ''
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Malta' }).format(d)
}

/** Time of day (HH:MM, 24h) in Malta time. */
export function csvTime(iso: unknown): string {
  if (!iso) return ''
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Malta', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

/** Date + time (YYYY-MM-DD HH:MM) in Malta time. */
export function csvDateTime(iso: unknown): string {
  const date = csvDate(iso)
  return date ? `${date} ${csvTime(iso)}` : ''
}
