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

// FIFTH root cause (2026-07-10): CSP style-src blocked the widget's CSS at
// www.gstatic.com. The element.js script calls _loadCss() which creates a
// <link rel=stylesheet> to gstatic.com — and the CSP header had style-src:
// 'self' 'unsafe-inline' with NO gstatic.com allowance. The browser silently
// blocked this cross-origin stylesheet; without it, TranslateElement
// constructed successfully but its internal init never populated
// goog-te-combo with language options (empty <select>). The widget hides its
// gadget div with display:none and the entire cookie-driven AND DOM-driven
// activation path dead-ends on the empty combo. The securitypolicyviolation
// event fires but wasn't being listened for (now recommended to always
// listen during debugging). The fix is a one-line CSP change in
// next.config.ts: add https://www.gstatic.com to style-src. This is the
// MINIMAL fix — the widget has always loaded this CSS; it was only noticed
// as broken after Phase 4.4 added a strict CSP that finally blocked it.
// Symptom: goog-te-combo exists but options.length === 0, zero JS errors,
// zero console warnings, cookies + lang attr all correct. The gstatic.com
// CSS request shows duration:0 transferSize:0 in Performance API — a
// hallmark of a CSP-blocked subresource.
//
// Belt-and-suspenders fallback: GT's widget is documented to auto-apply
// the translation itself as soon as it reads the `googtrans` cookie
// during its own initialisation (see the module doc comment). In
// practice this has proven unreliable to verify -- observed sessions
// showed the widget constructing successfully but its internal
// <select class="goog-te-combo"> never populating with real language
// options, independent of the cookie's value or encoding. Rather than
// trust the cookie mechanism alone, this function polls for the combo to
// actually populate, then drives it directly by setting `.value` and
// dispatching a `change` event -- the mechanism GT's own UI uses when a
// user manually picks a language from the dropdown. This runs in
// addition to (not instead of) the googtrans cookie, so if either
// mechanism works, the translation applies.
function driveComboWhenReady(targetLangCode: string, attempts = 0): void {
  if (attempts > 40) return // ~20s budget (40 * 500ms), then give up quietly
  const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo")
  if (combo && combo.options.length > 0) {
    const hasTarget = Array.from(combo.options).some((o) => o.value === targetLangCode)
    if (hasTarget) {
      combo.value = targetLangCode
      combo.dispatchEvent(new Event("change", { bubbles: true }))
      return
    }
  }
  setTimeout(() => driveComboWhenReady(targetLangCode, attempts + 1), 500)
}

export function GoogleTranslateWidgetHost() {
  const widgetDivRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const consented = hasConsent()
    const savedLang = getCookie(LANG_COOKIE) as Lang | null
    if (consented && savedLang === "mt" && widgetDivRef.current) {
      document.documentElement.lang = "mt"
      void loadWidget(widgetDivRef.current).then(() => {
        // Give the cookie-driven auto-apply a moment to take effect on its
        // own first; only start the DOM-driven fallback after a short
        // delay so we're not fighting GT's own initialisation mid-flight.
        setTimeout(() => driveComboWhenReady("mt"), 800)
      })
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
