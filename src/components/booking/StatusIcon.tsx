/**
 * Round status badge used at the top of the booking return pages
 * (/booking/confirmation, /booking/cancel, /booking/pay).
 */

type Variant = 'success' | 'pending' | 'failed' | 'info' | 'clock'

const RING: Record<Variant, string> = {
  success: 'bg-lunar-green text-white ring-lunar-green/15',
  pending: 'bg-matte-gold/15 text-accent-text ring-matte-gold/30',
  failed: 'bg-terracotta/10 text-terracotta-dark ring-terracotta/25',
  info: 'bg-lunar-green/5 text-text-light ring-border',
  // Temporary outage (e.g. VIVA unreachable): waiting, not failed.
  clock: 'bg-matte-gold/15 text-accent-text ring-matte-gold/30',
}

export function StatusIcon({ variant }: { variant: Variant }) {
  return (
    <div
      className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ring-8 ${RING[variant]}`}
      aria-hidden="true"
    >
      {variant === 'pending' ? (
        <svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        <svg
          className="h-7 w-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {variant === 'success' && <path d="M5 12.5l4.5 4.5L19 7.5" />}
          {variant === 'failed' && <path d="M7 7l10 10M17 7L7 17" />}
          {variant === 'info' && (
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 7.5v.01" />
            </>
          )}
          {variant === 'clock' && (
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </>
          )}
        </svg>
      )}
    </div>
  )
}
