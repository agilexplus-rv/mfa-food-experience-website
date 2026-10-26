import { timingSafeEqual } from 'node:crypto'

/**
 * The seed endpoint's key check.
 *
 * infra/entrypoint.sh makes a random key at every container start, passes it
 * to the server as SEED_INTERNAL_TOKEN and sends it in the x-seed-token
 * header. Nothing else knows it, so nobody outside the container can run the
 * seed. With no key set (local dev, a misconfigured start) the endpoint is
 * closed, never open.
 */
export function seedTokenOk(
  sent: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || expected.length < 32 || !sent) return false
  const a = Buffer.from(sent)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
