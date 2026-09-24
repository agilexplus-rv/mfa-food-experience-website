/**
 * Presentational card for an approved testimonial (FR-8).
 *
 * Displays the author's name, testimonial text, and optional linked event
 * name. Brand-styled with the 4-colour palette: Lunar Green, Terracotta,
 * Matte Gold, Soft Beige.
 */
export interface TestimonialCardProps {
  name: string
  text: string
  eventName?: string
}

export function TestimonialCard({ name, text, eventName }: TestimonialCardProps) {
  return (
    <blockquote
      className="relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-6 shadow-sm"
      aria-label={`Testimonial by ${name}`}
    >
      <p className="text-base leading-relaxed text-lunar-green">
        &ldquo;{text}&rdquo;
      </p>
      <footer className="mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <cite className="text-sm font-bold not-italic text-lunar-green">
          &mdash; {name}
        </cite>
        {eventName && (
          <span className="rounded-full bg-soft-beige/80 px-2.5 py-0.5 text-xs font-semibold text-text-light">
            {eventName}
          </span>
        )}
      </footer>
    </blockquote>
  )
}
