import { NextResponse } from 'next/server'

/**
 * GET /api/health — Lightweight liveness endpoint.
 * Used by entrypoint.sh to determine when the server is ready.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}