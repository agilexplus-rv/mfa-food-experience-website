/**
 * Next.js instrumentation hook -- runs once when the server starts.
 *
 * Schedules the event auto-close sweep in-process: scheduled events
 * need to flip to "completed" once their calendar day has passed, and
 * the production host (Azure Container Apps) has no external cron
 * configured in this repo. The sweep is idempotent, so running it on
 * every replica (and alongside the /api/cron/complete-events endpoint)
 * is safe.
 *
 * Interval: AUTO_CLOSE_INTERVAL_MINUTES (default 15; set 0 to disable).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const minutes = Number(process.env.AUTO_CLOSE_INTERVAL_MINUTES ?? 15)
  if (!Number.isFinite(minutes) || minutes <= 0) return

  // Dev-mode reloads can call register() again; keep a single timer.
  const g = globalThis as typeof globalThis & { __autoCloseTimer?: ReturnType<typeof setInterval> }
  if (g.__autoCloseTimer) return

  const sweep = async () => {
    try {
      const [{ getPayload }, { default: config }, { completeFinishedEvents }] = await Promise.all([
        import('payload'),
        import('@payload-config'),
        import('@/lib/events/auto-close'),
      ])
      const payload = await getPayload({ config })
      const { completed } = await completeFinishedEvents(payload)
      if (completed > 0) console.info(`[auto-close] Marked ${completed} event(s) completed`)
    } catch (err) {
      console.error('[auto-close] Sweep failed:', err)
    }
  }

  g.__autoCloseTimer = setInterval(sweep, minutes * 60_000)
  g.__autoCloseTimer.unref?.()
  // First run shortly after boot (after migrations / warm-up).
  setTimeout(sweep, 60_000).unref?.()
}
