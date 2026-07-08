/**
 * In-memory per-IP rate limiter (sliding-window variant: fixed window per key
 * with periodic stale-entry cleanup).
 *
 * Extracted from src/app/(frontend)/api/check-in/route.ts so that the other
 * public-facing API routes can reuse the exact same pattern without copy-
 * pasting the ~15 lines each time. The check-in route's behaviour (60 s
 * window, 30 req/min) is preserved unchanged.
 *
 * @compliance ADR-008 C9 (rate-limited), C11 (rate limits on booking + coupon
 *   endpoints).
 *
 * NOTE: This is an in-memory, per-instance limiter suitable for a single-node
 * deployment (the current deployment model). If the app is ever scaled to
 * multiple instances behind a load balancer without sticky sessions, each
 * instance will track its own window, effectively multiplying the limit by
 * the instance count -- a Redis-backed limiter should replace this at that
 * point.
 */

export interface RateLimiter {
  /** Returns true if the request is allowed, false if the limit is exceeded. */
  check(key: string): boolean
  /** Removes expired entries; call once per request (runs at most every 5 min). */
  maybeCleanup(): void
}

export interface RateLimiterOptions {
  /** Window size in milliseconds. */
  windowMs: number
  /** Maximum requests allowed per window per key. */
  max: number
}

/**
 * Create a rate limiter. Each call returns an independent map, so different
 * endpoints get their own counters (a request to /api/holds does not count
 * against /api/checkout's limit).
 */
export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const { windowMs, max } = opts
  const map = new Map<string, { count: number; resetAt: number }>()
  let lastCleanup = 0

  function check(key: string): boolean {
    const now = Date.now()
    const entry = map.get(key)
    if (!entry || now > entry.resetAt) {
      map.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }
    if (entry.count >= max) return false
    entry.count++
    return true
  }

  function maybeCleanup(): void {
    const now = Date.now()
    if (now - lastCleanup < 300_000) return
    lastCleanup = now
    for (const [k, v] of map) {
      if (now > v.resetAt) map.delete(k)
    }
  }

  return { check, maybeCleanup }
}

/**
 * Extract a client IP from a Next.js request, falling back to 127.0.0.1 when
 * no proxy headers are present (e.g. local dev without a reverse proxy).
 */
export function getClientIp(req: { headers: Headers | Map<string, string> }): string {
  const h = req.headers as Headers
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    '127.0.0.1'
  )
}
