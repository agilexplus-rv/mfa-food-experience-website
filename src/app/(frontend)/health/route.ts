import { NextResponse } from 'next/server'

/**
 * GET /health — Lightweight liveness probe for container readiness checks.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}