"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

/**
 * MobileNav — hamburger drawer for viewports < 960px.
 *
 * - A hamburger button is visible only below the md breakpoint.
 * - Clicking opens a right-aligned slide-over drawer with the same nav
 *   items as the desktop header.
 * - Accessible: aria-expanded on the toggle, aria-controls on the drawer,
 *   Esc closes, and focus is moved into the drawer on open (lightweight
 *   focus management; full trap omitted per spec but keyboard-closable).
 * - Body scroll is locked while open.
 * - The language switcher lives separately in the header and remains
 *   visible at all breakpoints, so it is not duplicated here.
 */

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Experiences", href: "/services" },
  { label: "Classes", href: "/services/classes" },
  { label: "Book Now", href: "/services" },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  // Lock body scroll + move focus into drawer when open.
  useEffect(() => {
    if (!open) {
      toggleRef.current?.focus()
      return
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const firstLink = drawerRef.current?.querySelector<HTMLAnchorElement>("a, button")
    firstLink?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  return (
    <>
      {/* Hamburger toggle — visible only below md (<960px) */}
      <button
        ref={toggleRef}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center rounded-md p-2 text-soft-beige transition-colors hover:text-matte-gold focus:outline-2 focus:outline-offset-1 focus:outline-matte-gold md:hidden"
      >
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        id="mobile-nav-drawer"
        role="dialog"
        aria-label="Mobile navigation"
        className={`fixed right-0 top-0 z-50 h-full w-72 max-w-[85vw] transform bg-lunar-green text-soft-beige shadow-xl transition-transform duration-200 ease-out md:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-soft-beige/20 px-4 py-4">
          <span className="text-sm font-bold uppercase tracking-wider text-matte-gold">
            Menu
          </span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-soft-beige transition-colors hover:text-matte-gold focus:outline-2 focus:outline-offset-1 focus:outline-matte-gold"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-3 text-base font-semibold text-soft-beige transition-colors hover:bg-soft-beige/10 hover:text-matte-gold focus:outline-2 focus:outline-offset-1 focus:outline-matte-gold"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}
