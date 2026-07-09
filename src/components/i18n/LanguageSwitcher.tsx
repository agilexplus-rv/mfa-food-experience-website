"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * LanguageSwitcher — EN | MT pill toggle.
 *
 * Per ADR-006 and EU-Legal-8 / DPIA-8:
 * - User-activated only: the Google Translate widget script is NOT loaded
 *   on page load. It loads only after the user explicitly accepts the
 *   CookieBanner consent ("all" level).
 * - Consent is governed by the CookieBanner component
 *   (src/components/compliance/CookieBanner.tsx). The consent state is
 *   stored in localStorage under "mfa_cookie_consent".
 * - If consent is "necessary" only: Google Translate is not loaded and
 *   the MT pill shows the inline consent prompt on click, offering the
 *   user a chance to upgrade their consent.
 * - If consent is "all": Google Translate loads (widget script + cookies)
 *   and the language pill toggles without re-prompting.
 *
 * Research: Google Translate widget loads a third-party script from
 * translate.google.com and may set cookies (_ga, googtrans, NID, etc.).
 * Under the ePrivacy Directive (2002/58/EC) as transposed in Malta via
 * S.L. 440.01, this is NOT "strictly necessary" — prior informed consent
 * IS required before the script loads. The CookieBanner gates this.
 *
 * Brand styling (NFR-1):
 * - Active language: Lunar Green fill, Soft Beige text.
 * - Inactive language: Soft Beige/30 border, Soft Beige/70 text.
 * - Hover on inactive: Terracotta fill (large-text-safe 3.5:1).
 * - Montserrat SemiBold via the font variable.
 *
 * Session persistence (FR-10.3): a `lang` cookie (SameSite=Lax, Secure)
 * stores the selected language; the switcher restores it on mount.
 *
 * Activation mechanism:
 * Google's Website Translator widget exposes a hidden `<select class="goog-te-combo">`
 * that in theory can be driven programmatically by setting `.value` and dispatching a
 * `change` event. In practice this is unreliable across Google Translate script
 * versions/CDN builds — the event handler GT actually listens for is an internal one
 * attached after the widget's own iframes finish booting, and a synthetic `change`
 * event frequently fires before that, or against an already-stale listener. The
 * documented-reliable alternative (used by most production integrations) is the
 * `googtrans` cookie: GT reads `googtrans=/{from}/{to}` during widget initialisation
 * and auto-applies the translation itself — no fragile DOM event needed. Switching
 * language therefore sets/clears that cookie and reloads the page so the widget
 * re-initialises against the new cookie value.
 */

// Consent for Google Translate is now governed by the CookieBanner component.
// The CookieBanner stores consent in localStorage under "mfa_cookie_consent".
// Values: "all" (GT is allowed) or "necessary" (GT is blocked).
// We also keep translate_consent for backward compatibility with existing sessions.
const CONSENT_COOKIE = "translate_consent"
const LANG_COOKIE = "lang"
const GOOGTRANS_COOKIE = "googtrans"

/** Check if the user has given consent for Google Translate.
 * Primary: localStorage mfa_cookie_consent === "all" (from CookieBanner).
 * Fallback: translate_consent cookie (from previous LanguageSwitcher behaviour). */
function hasConsent(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (localStorage.getItem("mfa_cookie_consent") === "all") return true
  } catch { /* localStorage not available */ }
  return getCookie(CONSENT_COOKIE) === "true"
}
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

function setCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax; Secure`
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax; Secure`
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

/** Load the Google Translate widget script + instantiate the element (once per page load). */
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
      // Script tag already present (e.g. fast client nav) — GT re-runs its
      // global init callback on its own once its internal state is ready.
      resolve()
    }
  })
}

export function LanguageSwitcher() {
  const [lang, setLang] = useState<Lang>("en")
  const [showConsent, setShowConsent] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)
  const widgetDivRef = useRef<HTMLDivElement>(null)

  // Restore language + consent on mount. Checks CookieBanner consent
  // (localStorage mfa_cookie_consent) as primary, falls back to translate_consent
  // cookie. If MT was previously active, the `googtrans` cookie is already set
  // from the prior session, so loading the widget script causes GT to auto-translate.
  useEffect(() => {
    const consented = hasConsent()
    const savedLang = getCookie(LANG_COOKIE) as Lang | null
    setConsentGiven(consented)
    if (consented && savedLang === "mt" && widgetDivRef.current) {
      setLang("mt")
      document.documentElement.lang = "mt"
      void loadWidget(widgetDivRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activate = useCallback((target: Lang) => {
    setCookie(LANG_COOKIE, target, 365)
    if (target === "mt") {
      setCookie(GOOGTRANS_COOKIE, "/en/mt", 365)
    } else {
      deleteCookie(GOOGTRANS_COOKIE)
    }
    // GT only picks up the googtrans cookie during its own initialisation,
    // so a full reload is the reliable way to apply the change in both
    // directions (mt->en and en->mt).
    window.location.reload()
  }, [])

  const handleSelect = useCallback(
    (target: Lang) => {
      if (target === lang) return

      if (target === "en") {
        activate("en")
        return
      }

      if (!consentGiven) {
        setShowConsent(true)
        return
      }

      activate("mt")
    },
    [lang, consentGiven, activate],
  )

  const handleAccept = useCallback(() => {
    // Update the CookieBanner's consent state so future visits reflect "all" consent
    try { localStorage.setItem("mfa_cookie_consent", "all") } catch { /* ok */ }
    setCookie(CONSENT_COOKIE, "true", 365)
    setShowConsent(false)
    activate("mt")
  }, [activate])

  const handleDecline = useCallback(() => {
    setShowConsent(false)
    setLang("en")
    setCookie(LANG_COOKIE, "en", 1)
  }, [])

  const pillBase =
    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-2 focus:outline-offset-1 focus:outline-matte-gold"

  return (
    <div className="relative flex items-center gap-1">
      {/* Hidden Google Translate widget container */}
      <div
        ref={widgetDivRef}
        id="google_translate_element"
        className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
        aria-hidden="true"
      />

      {/* EN pill -- UK flag, the conventional flag used for the English
          option on Malta-facing sites (gov.mt and equivalents use the same
          EN=UK / MT=Malta pairing since "English flag" isn't a distinct
          national flag). */}
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
        <span aria-hidden="true" className="text-sm leading-none">🇬🇧</span>
        EN
      </button>

      {/* MT pill -- Malta flag */}
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
        <span aria-hidden="true" className="text-sm leading-none">🇲🇹</span>
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
