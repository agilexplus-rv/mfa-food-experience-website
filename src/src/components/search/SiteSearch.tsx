"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * SiteSearch — a brand-styled, keyboard-accessible search input for
 * the site header (desktop) and mobile drawer.
 *
 * On submit (Enter or button click), navigates to /search?q=<query>.
 * No live per-keystroke queries — submit-on-enter keeps things simple
 * and avoids unnecessary server round-trips.
 *
 * Uses only brand tokens: Lunar Green, Terracotta, Matte Gold, Soft Beige.
 */
export function SiteSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex items-center gap-1"
    >
      <label htmlFor="site-search-input" className="sr-only">
        Search the site
      </label>
      {/* Navbar control consistency (Rudie 2026-07-12): every header
          control -- this input, its button, and the language dropdown
          trigger -- shares one exact height (h-9), border treatment
          (soft-beige/30, full-round), and text size, so the toolbar
          reads as one clean row instead of three mismatched controls. */}
      <input
        id="site-search-input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        aria-label="Search the site"
        className="h-9 w-32 rounded-full border border-soft-beige/30 bg-lunar-green/80 px-4 text-sm text-soft-beige placeholder:text-soft-beige/50 focus:border-matte-gold focus:outline-2 focus:outline-offset-1 focus:outline-matte-gold sm:w-40 box-border"
      />
      <button
        type="submit"
        aria-label="Search"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-terracotta text-soft-beige transition-colors hover:bg-terracotta/85 focus:outline-2 focus:outline-offset-1 focus:outline-matte-gold"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
    </form>
  )
}
