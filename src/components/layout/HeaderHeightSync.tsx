'use client'

import { useEffect } from 'react'

/**
 * Publishes the sticky site header's real rendered height as the CSS
 * variable `--site-header-h`, so full-screen sections (the homepage
 * hero) can size themselves to exactly `100svh - header` -- the
 * header + hero never exceed one viewport. globals.css provides
 * per-breakpoint fallbacks for the first paint / no-JS.
 */
export function HeaderHeightSync() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('[data-site-header]')
    if (!header) return
    const apply = () => {
      document.documentElement.style.setProperty('--site-header-h', `${header.offsetHeight}px`)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(header)
    return () => ro.disconnect()
  }, [])
  return null
}
