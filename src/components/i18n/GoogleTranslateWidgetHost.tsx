"use client"

import { useEffect, useRef } from "react"

/**
 * GoogleTranslateWidgetHost — the SINGLE, singleton host for the actual
 * Google Translate widget (hidden div + script load + TranslateElement
 * instantiation).
 *
 * Split out from LanguageSwitcher (2026-07-09) after a real regression:
 * LanguageSwitcher is now rendered twice simultaneously (once in
 * SiteHeader, hidden via `hidden md:block`; once inside MobileNav's
 * drawer, which is always mounted in the DOM and only visibility-toggled
 * via CSS transform/`md:hidden` -- neither is actually unmounted at any
 * breakpoint). Both instances used to render their own
 * `id="google_translate_element"` div and call `loadWidget()` on mount,
 * producing two elements with the same id and two competing
 * `window.googleTranslateElementInit` assignments. Whichever mounted/ran
 * last silently won the race, so effectively only one instance's pills
 * ever worked, and the *other* pill's clicks changed cookies but couldn't
 * reliably drive a real widget instance bound to a live DOM node -- which
 * is exactly the "language buttons not changing the language" regression
 * this file fixes.
 *
 * Fix: exactly one host, mounted once in the root layout
 * (src/app/(frontend)/layout.tsx), owns the widget div + script load +
 * TranslateElement construction. LanguageSwitcher instances (as many as
 * you like) are now pure pill buttons that only read/write the `lang` and
 * `googtrans` cookies and reload the page -- since activate() already
 * does a full page reload on every language switch, no cross-instance
 * React state syncing is needed; the reload re-runs this singleton's
 * mount effect against the new cookie value regardless of which pill was
 * clicked.
 */

const LANG_COOKIE = "lang"
const CONSENT_COOKIE = "translate_consent"
const GT_SCRIPT_SRC =
  "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"

type Lang = "en" | "mt"

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null
}

function hasConsent(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (localStorage.getItem("mfa_cookie_consent") === "all") return true
  } catch { /* localStorage not available */ }
  return getCookie(CONSENT_COOKIE) === "true"
}

declare global {
  interface Window {
    googleTranslateElementInit?: () => void
    google?: {
      translate?: {
        TranslateElement?: new (
          opts: {
            pageLanguage: string
            includedLanguages?: string
            autoDisplay?: boolean
          },
          el: string | HTMLElement,
        ) => void
      }
    }
  }
}

function loadWidget(widgetDiv: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            includedLanguages: "en,mt",
            autoDisplay: false,
          },
          widgetDiv,
        )
      }
      resolve()
    }

    const scriptBase = GT_SCRIPT_SRC.split("?")[0]
    if (!document.querySelector(`script[src^="${scriptBase}"]`)) {
      const script = document.createElement("script")
      script.src = GT_SCRIPT_SRC
      script.async = true
      script.onerror = () => resolve()
      document.head.appendChild(script)
    } else {
      resolve()
    }
  })
}

export function GoogleTranslateWidgetHost() {
  const widgetDivRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const consented = hasConsent()
    const savedLang = getCookie(LANG_COOKIE) as Lang | null
    if (consented && savedLang === "mt" && widgetDivRef.current) {
      document.documentElement.lang = "mt"
      void loadWidget(widgetDivRef.current)
    }
  }, [])

  return (
    <div
      ref={widgetDivRef}
      id="google_translate_element"
      className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
      aria-hidden="true"
    />
  )
}
