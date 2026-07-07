"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { montserrat } from "@/lib/fonts"

/**
 * CookieBanner — ePrivacy / GDPR cookie consent banner.
 *
 * Displays on first visit (localStorage flag). Brand-styled with the 4-colour
 * palette (Lunar Green #33483D, Terracotta #C9643D, Matte Gold #B8974D,
 * Soft Beige #F9F4EF) and Montserrat.
 *
 * Consent levels:
 *  - "all": Accept all cookies (Google Translate + any analytics).
 *  - "necessary": Strictly necessary cookies only (session, CSRF).
 *    Non-essential scripts (Google Translate) remain gated.
 *
 * Research (ePrivacy Directive 2002/58/EC transposed as Malta S.L. 440.01):
 *  - Recital 66 + Art. 5(3): storing/accessing information on user equipment
 *    requires prior informed consent UNLESS the cookie is "strictly necessary"
 *    for a service explicitly requested by the user.
 *  - Strictly necessary: session cookies, CSRF tokens, shopping-cart state.
 *    Exempt from consent.
 *  - Google Translate widget: loads a third-party script from
 *    translate.google.com and may set cookies (_ga, googtrans, etc.). This is
 *    NOT strictly necessary — consent IS required before the script loads.
 *    The LanguageSwitcher respects this by checking the consent state.
 *
 * @at-compliance DPIA-8, EU-Legal-8 (cookie banner gating non-essential scripts)
 */

const STORAGE_KEY = "mfa_cookie_consent"
const CONSENT_VALUES = ["all", "necessary"] as const
type ConsentValue = (typeof CONSENT_VALUES)[number]

export { CONSENT_VALUES }
export type { ConsentValue }

/** Read the consent state (for use by LanguageSwitcher and other consumers). */
export function getCookieConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null
  const val = localStorage.getItem(STORAGE_KEY)
  if (val === "all" || val === "necessary") return val
  return null
}

/** Subscribe to consent changes (LanguageSwitcher can react). */
export function onConsentChange(cb: (val: ConsentValue) => void): () => void {
  if (typeof window === "undefined") return () => {}
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      if (e.newValue === "all" || e.newValue === "necessary") {
        cb(e.newValue)
      }
    }
  }
  window.addEventListener("storage", handler)
  return () => window.removeEventListener("storage", handler)
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (getCookieConsent() === null) {
      setVisible(true)
    }
  }, [])

  const handleConsent = useCallback((level: ConsentValue) => {
    localStorage.setItem(STORAGE_KEY, level)
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className={`${montserrat.variable} font-montserrat fixed bottom-0 left-0 right-0 z-50 border-t border-lunar-green/15 bg-soft-beige shadow-lg`}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-lunar-green/80">
          This site uses cookies for essential functionality and, with your
          consent, for Google Translate. See our{" "}
          <Link
            href="/legal/cookie-policy"
            className="font-semibold text-terracotta underline hover:text-terracotta/80"
          >
            Cookie Policy
          </Link>{" "}
          for details.
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => handleConsent("necessary")}
            className="rounded-full border border-lunar-green/30 px-4 py-2 text-sm font-semibold text-lunar-green transition-colors hover:bg-lunar-green/10 focus:outline-2 focus:outline-offset-2 focus:outline-matte-gold"
          >
            Necessary only
          </button>
          <button
            type="button"
            onClick={() => handleConsent("all")}
            className="rounded-full bg-lunar-green px-4 py-2 text-sm font-semibold text-soft-beige transition-colors hover:bg-terracotta focus:outline-2 focus:outline-offset-2 focus:outline-matte-gold"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}
