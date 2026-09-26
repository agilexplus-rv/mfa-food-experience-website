/**
 * Turn a Payload Local API error into a message safe to show staff in the
 * console. Payload ValidationErrors carry per-field details (e.g. "Body is
 * required") that are far more useful than a bare "create_failed".
 * Returns null for unexpected/internal errors (log those server-side).
 */
export function payloadErrorMessage(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null
  const e = err as { name?: string; message?: string; data?: { errors?: { message?: string; label?: string; path?: string }[] } }
  if (e.name === 'ValidationError') {
    const fields = (e.data?.errors || [])
      .map((f) => (f.label || f.path ? `${f.label || f.path}: ${f.message || 'invalid'}` : f.message))
      .filter(Boolean)
    return fields.length ? `Please check: ${fields.join('; ')}` : e.message || 'Validation failed.'
  }
  return null
}
