import Link from 'next/link'

import type { BookingEventSummary } from '@/lib/bookings/lookup'
import { formatDay, formatTimeRange } from '@/lib/format-date'
import { StatusIcon } from './StatusIcon'

/**
 * "Payment service temporarily unavailable": shown on /booking/confirmation
 * when we can't reach the VIVA API to confirm a payment (network error,
 * timeout, 5xx), instead of an endless "Confirming…" spinner.
 *
 * Pure markup with no hooks or directive, so it renders as a server
 * component from the confirmation page (retry = reload the same URL,
 * works without JS) and inside the client ConfirmationStatus (retry =
 * onRetry callback). "I'll try later" is a native <details> disclosure
 * for the same reason.
 *
 * Copy note: the visitor only gets here via VIVA's *success* redirect, so
 * their card has most likely been charged. We must not tell them nothing
 * was taken or push them into a second booking (double charge); a late
 * VIVA confirmation is still honoured after the payment deadline.
 *
 * Shows the booking reference, so it is excluded from Google Translate
 * per ADR-006 Sec 4.
 */

const primaryCta =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-terracotta-dark px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-terracotta/85 disabled:cursor-wait disabled:opacity-70'
const secondaryCta =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-lunar-green/30 px-6 py-3 text-sm font-bold text-lunar-green transition-colors hover:bg-lunar-green/10'

type VivaUnreachableProps = {
  reference: string
  event?: BookingEventSummary | null
  /** Fallback when only the title is known (client status endpoint). */
  eventTitle?: string
  /** VIVA TransactionId (?t=), for quoting to support. */
  transactionId?: string
} & (
  | { /** Server: "Try again now" reloads this URL, re-running the VIVA check. */ retryHref: string }
  | { /** Client: "Try again now" re-verifies in place. */ onRetry: () => void; retrying?: boolean }
)

export function VivaUnreachable(props: VivaUnreachableProps) {
  const { reference, event, transactionId } = props
  const title = event?.title ?? props.eventTitle

  return (
    <div className="notranslate">
      <div role="status" aria-live="polite">
        <StatusIcon variant="clock" />
        <h1 className="mt-8 text-3xl font-black tracking-[-0.02em] text-lunar-green sm:text-4xl">
          Payment service temporarily unavailable
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-text-light">
          We couldn&apos;t reach VIVA, our payment provider, to confirm your payment. This is a temporary problem on
          their side. <strong className="font-semibold text-lunar-green">Please don&apos;t pay again</strong>: if your
          payment went through, it&apos;s safe and we&apos;ll confirm your booking as soon as VIVA responds.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-md overflow-hidden rounded-xl border border-border bg-surface text-left shadow-sm">
        <div className="border-b border-dashed border-border bg-matte-gold/15 px-6 py-3">
          <span className="text-xs font-bold uppercase tracking-wide text-accent-text">Awaiting confirmation</span>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-5 text-sm">
          {title && (
            <div className="col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">Experience</dt>
              <dd className="font-semibold text-lunar-green">{title}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">Reference</dt>
            <dd className="font-mono font-semibold text-lunar-green">{reference}</dd>
          </div>
          {event && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">Date</dt>
              <dd className="font-semibold text-lunar-green">
                {formatDay(event.date)}
                <span className="block text-xs font-normal text-text-light">
                  {formatTimeRange(event.startTime, event.endTime)}
                </span>
              </dd>
            </div>
          )}
          {transactionId && (
            <div className="col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-light">VIVA transaction ID</dt>
              <dd className="break-all font-mono text-xs font-medium text-lunar-green">{transactionId}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        {'retryHref' in props ? (
          // Plain <a>: a full reload re-runs the server-side VIVA check.
          <a href={props.retryHref} className={primaryCta}>
            Try again now
          </a>
        ) : (
          <button
            type="button"
            onClick={props.onRetry}
            disabled={props.retrying}
            aria-busy={props.retrying || undefined}
            className={primaryCta}
          >
            {props.retrying ? 'Checking with VIVA…' : 'Try again now'}
          </button>
        )}

        <details className="w-full max-w-md">
          <summary className={`${secondaryCta} mx-auto w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
            I&apos;ll try later
          </summary>
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface px-5 py-4 text-left text-sm text-text-light">
            <p>
              Keep the link to this page and open it again later to finish confirming. If your payment went through,
              we&apos;ll also email your confirmation once VIVA confirms it, so please don&apos;t start a second
              booking for the same experience or you may be charged twice.
            </p>
            <p>
              If your payment <em>didn&apos;t</em> go through, your seats are only held until the payment window ends.
              After that you&apos;ll need to start a new booking.
            </p>
            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <Link href="/services" className={secondaryCta}>
                Browse experiences
              </Link>
              <Link href="/contact" className={secondaryCta}>
                Contact us
              </Link>
            </div>
          </div>
        </details>
      </div>

      <p className="mt-10 text-xs text-text-light">
        Not sure whether you were charged?{' '}
        <Link href="/contact" className="font-semibold text-terracotta-dark underline">
          Contact us
        </Link>{' '}
        and quote reference <span className="font-mono font-semibold">{reference}</span>.
      </p>
    </div>
  )
}
