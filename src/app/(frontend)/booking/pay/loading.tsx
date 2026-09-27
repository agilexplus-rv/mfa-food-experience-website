/** Skeleton for /booking/pay while the event, availability and policies load. */
export default function BookingPayLoading() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-16" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading checkout…</span>
      <div className="mx-auto max-w-2xl animate-pulse" aria-hidden="true">
        <div className="h-4 w-36 rounded bg-lunar-green/10" />
        <div className="mt-8 flex gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-lunar-green/10" />
              <div className="h-3 flex-1 rounded bg-lunar-green/10" />
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 h-3 w-20 rounded bg-matte-gold/20" />
        <div className="mx-auto mt-4 h-9 w-3/4 rounded bg-lunar-green/10" />
        <div className="mt-8 grid grid-cols-3 gap-6 rounded-xl border border-border bg-surface p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 rounded bg-lunar-green/10" />
              <div className="h-4 w-full rounded bg-lunar-green/10" />
            </div>
          ))}
        </div>
        <div className="mt-10 h-14 rounded-xl bg-matte-gold/10" />
        <div className="mt-8 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-11 rounded-lg bg-lunar-green/5" />
          ))}
        </div>
        <div className="mt-8 h-32 rounded-xl border border-border bg-surface" />
      </div>
    </section>
  )
}
