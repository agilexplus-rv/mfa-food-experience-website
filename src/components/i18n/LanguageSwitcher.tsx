"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * LanguageSwitcher — EN | MT pill toggle.
 *
 * Per ADR-006:
 * - User-activated only: the Google Translate widget script is NOT loaded
 *   on page load. It loads only after the user explicitly accepts the
 *   cookie-consent gate.
 * - On first click of "MT", an ePrivacy consent prompt appears.
 * - On Accept: the widget script loads, the page translates to Maltese,
 *   and a `translate_consent=true` cookie is set (no prompt on subsequent
 *   navigation within the session).
 * - On Decline: the page remains in English; no script loads.
 *
 * Brand styling (NFR-1):
 * - Active language: Lunar Green fill, Soft Beige text.
 * - Inactive language: Soft Beige/30 border, Soft Beige/70 text.
 * - Hover on inactive: Terracotta fill (large-text-safe 3.5:1).
 * - Montserrat SemiBold via the font variable.
 *
 * Session persistence (FR-10.3): a `lang` cookie (SameSite=Lax, Secure)
 * stores the selected language; the switcher restores it on mount.
 */

const CONSENT_COOKIE = "translate_consent"
const LANG_COOKIE = "lang"
const GT_SCRIPT_SRC =
  "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"

type Lang = "en" | "mt"

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
  return match ? match.split("=")[1] : null
}

function setCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax; Secure`
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

export function LanguageSwitcher() {
  const [lang, setLang] = useState<Lang>("en")
  const [showConsent, setShowConsent] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)
  const [widgetReady, setWidgetReady] = useState(false)
  const widgetDivRef = useRef<HTMLDivElement>(null)

  // Restore language + consent from cookies on mount.
  useEffect(() => {
    const savedConsent = getCookie(CONSENT_COOKIE) === "true"
    const savedLang = getCookie(LANG_COOKIE) as Lang | null
    setConsentGiven(savedConsent)
    if (savedConsent && savedLang === "mt") {
      setLang("mt")
      void loadWidget().then(() => applyLanguage("mt"))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load the Google Translate widget script (once).
  const loadWidget = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (widgetReady) {
        resolve()
        return
      }
      window.googleTranslateElementInit = () => {
        if (window.google?.translate?.TranslateElement && widgetDivRef.current) {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: "en",
              includedLanguages: "en,mt",
              autoDisplay: false,
            },
            widgetDivRef.current,
          )
          setWidgetReady(true)
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
        window.googleTranslateElementInit?.()
        resolve()
      }
    })
  }, [widgetReady])

  // Programmatically trigger a language change on the hidden GT <select>.
  // Also sets document.documentElement.lang so <html lang> reflects the
  // active language client-side (best-effort; GT may override it).
  const applyLanguage = useCallback((target: Lang) => {
    document.documentElement.lang = target

    if (target === "en") {
      const select = document.querySelector<HTMLSelectElement>(
        "#google_translate_element select",
      )
      if (select) {
        select.value = "en"
        select.dispatchEvent(new Event("change", { bubbles: true }))
      }
      return
    }

    const trySelect = () => {
      const select = document.querySelector<HTMLSelectElement>(
        "#google_translate_element select",
      )
      if (select) {
        select.value = "mt"
        select.dispatchEvent(new Event("change", { bubbles: true }))
      } else {
        setTimeout(trySelect, 200)
      }
    }
    trySelect()
  }, [])

  const handleSelect = useCallback(
    (target: Lang) => {
      setLang(target)
      setCookie(LANG_COOKIE, target, 1)

      if (target === "en") {
        applyLanguage("en")
        return
      }

      if (!consentGiven) {
        setShowConsent(true)
        return
      }

      void loadWidget().then(() => applyLanguage("mt"))
    },
    [consentGiven, loadWidget, applyLanguage],
  )

  const handleAccept = useCallback(() => {
    setCookie(CONSENT_COOKIE, "true", 365)
    setConsentGiven(true)
    setShowConsent(false)
    void loadWidget().then(() => applyLanguage("mt"))
  }, [loadWidget, applyLanguage])

  const handleDecline = useCallback(() => {
    setShowConsent(false)
    setLang("en")
    setCookie(LANG_COOKIE, "en", 1)
  }, [])

  const pillBase =
    "rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-2 focus:outline-offset-1 focus:outline-matte-gold"

  return (
    <div className="relative flex items-center gap-1">
      {/* Hidden Google Translate widget container */}
      <div
        ref={widgetDivRef}
        id="google_translate_element"
        className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
        aria-hidden="true"
      />

      {/* EN pill */}
      <button
        type="button"
        onClick={() => handleSelect("en")}
        aria-pressed={lang === "en"}
        className={`${pillBase} ${
          lang === "en"
            ? "bg-soft-beige text-lunar-green"
            : "border border-soft-beige/30 text-soft-beige/70 hover:bg-terracotta hover:text-soft-beige"
        }`}
      >
        EN
      </button>

      {/* MT pill */}
      <button
        type="button"
        onClick={() => handleSelect("mt")}
        aria-pressed={lang === "mt"}
        className={`${pillBase} ${
          lang === "mt"
            ? "bg-soft-beige text-lunar-green"
            : "border border-soft-beige/30 text-soft-beige/70 hover:bg-terracotta hover:text-soft-beige"
        }`}
      >
        MT
      </button>

      {/* Cookie-consent gate */}
      {showConsent && (
        <div
          role="dialog"
          aria-label="Google Translate consent"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-matte-gold/40 bg-soft-beige p-4 text-lunar-green shadow-lg"
        >
          <p className="text-xs leading-relaxed">
            This site uses Google Translate, which may set cookies and send
            page content to Google. Do you accept?
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleDecline}
              className="rounded-full border border-lunar-green/30 px-3 py-1 text-xs font-semibold text-lunar-green transition-colors hover:bg-lunar-green/10 focus:outline-2 focus:outline-offset-1 focus:outline-matte-gold"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="rounded-full bg-lunar-green px-3 py-1 text-xs font-semibold text-soft-beige transition-colors hover:bg-terracotta focus:outline-2 focus:outline-offset-1 focus:outline-matte-gold"
            >
              Accept
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
