'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { MtText } from '@/components/i18n/MtText'

export interface ReadMoreContent {
  title: string
  /** Optional line under the title, e.g. date · time · price. */
  subtitle?: string
  /** Pre-rendered (server-side) HTML of the experience description. */
  descriptionHtml?: string
  imageUrl?: string
  imageAlt?: string
  /** Where "Book Now" goes; omitted when booking isn't possible. */
  bookHref?: string
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * "Read more" button that opens a dialog with the experience's picture
 * and full description, plus a Book Now link. The picture is shown only
 * here (not on the card) per the client's "picture with each experience
 * (read more only)" request.
 */
export function ReadMoreButton({ content, className = '' }: { content: ReadMoreContent; className?: string }) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const items = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    items()[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      const list = items()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      trigger?.focus()
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={[
          'inline-flex items-center gap-1 text-sm font-semibold text-accent-text transition-colors hover:text-lunar-green',
          'focus:outline-2 focus:outline-offset-2 focus:outline-lunar-green',
          className,
        ].join(' ')}
      >
        <MtText en="Read more" mt="Aqra iktar" />
        <span className="sr-only">about {content.title}</span>
        <span aria-hidden="true">&rarr;</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white text-left shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 text-lunar-green shadow hover:bg-white focus:outline-2 focus:outline-offset-2 focus:outline-lunar-green"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="overflow-y-auto">
              {content.imageUrl && (
                <div className="aspect-[16/9] w-full bg-lunar-green/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={content.imageUrl}
                    alt={content.imageAlt || content.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="p-6 sm:p-8">
                <h2 id={titleId} className="pr-8 text-2xl font-black tracking-tight text-lunar-green">
                  {content.title}
                </h2>
                {content.subtitle && (
                  <p className="mt-1 text-sm font-semibold text-text-light">{content.subtitle}</p>
                )}
                {content.descriptionHtml ? (
                  <div
                    className="prose prose-sm mt-4 max-w-none text-text-light prose-headings:text-lunar-green prose-strong:text-lunar-green prose-a:text-terracotta-dark"
                    dangerouslySetInnerHTML={{ __html: content.descriptionHtml }}
                  />
                ) : (
                  <p className="mt-4 text-sm text-text-light">More details about this experience are coming soon.</p>
                )}
              </div>
            </div>

            {content.bookHref && (
              <div className="flex justify-end border-t border-border bg-soft-beige/60 px-6 py-4">
                <Link
                  href={content.bookHref}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta-dark px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-terracotta/85 focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
                >
                  <MtText en="Book Now" mt="Ibbukkja Issa" />
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
