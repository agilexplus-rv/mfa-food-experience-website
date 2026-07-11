"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * LanguageSwitcher — EN | MT dropdown.
 *
 * 2026-07-12 (Rudie): converted from a two-pill button toggle to a
 * dropdown. All selection/consent/cookie logic is UNCHANGED -- only the
 * presentation layer moved from two always-visible buttons to a single
 * trigger button + options menu. The extensive root-cause notes below
 * (stale consent, googtrans cookie encoding, CSP, self-healing
 * re-activation) all still apply verbatim.
 *
 * Safe to render multiple times simultaneously (e.g. once in SiteHeader
 * for desktop, once inside MobileNav's drawer for mobile — both are
 * always mounted in the DOM at once, just visibility-toggled via CSS, not
 * actually unmounted at any breakpoint). This component only owns the
 * pill buttons + cookie read/write; the actual Google Translate widget
 * (hidden div + script load + TranslateElement instantiation) lives in a
 * single singleton, GoogleTranslateWidgetHost, mounted once in the root
 * layout (src/app/(frontend)/layout.tsx). See that file's doc comment for
 * the regression this split fixes: two LanguageSwitcher instances used to
 * each render their own `id="google_translate_element"` div, producing a
 * duplicate-id DOM and a race on `window.googleTranslateElementInit` that
 * broke the widget for both.
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

const CONSENT_COOKIE = "translate_consent"
const LANG_COOKIE = "lang"
const GOOGTRANS_COOKIE = "googtrans"

function hasConsent(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (localStorage.getItem("mfa_cookie_consent") === "all") return true
  } catch { /* localStorage not available */ }
  return getCookie(CONSENT_COOKIE) === "true"
}

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

// Google Translate's own widget script reads document.cookie looking for
// the LITERAL string "googtrans=/en/mt" (unencoded slashes) to decide
// which language pair to auto-apply on init. setCookie() above always
// URL-encodes its value via encodeURIComponent, which turns "/en/mt" into
// "%2Fen%2Fmt" -- a value Google's own cookie parser doesn't recognise,
// so the widget silently never applies the translation even though the
// cookie is set, the script loads, and TranslateElement constructs
// successfully (confirmed empirically: goog-te-combo exists but never
// gets populated with real language options). This was a pre-existing
// bug (present before the singleton-host split), not something the
// earlier fix introduced -- setCookie()'s blanket encoding is correct
// for plain string values like `lang` and `translate_consent`, just not
// for this one Google-specific cookie which needs its raw, unescaped
// format preserved.
function setRawCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax; Secure`
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax; Secure`
}

const LANG_OPTIONS: { value: Lang; label: string; flag: string }[] = [
  // UK flag is the conventional flag for the English option on
  // Malta-facing sites (gov.mt and equivalents use the same EN=UK /
  // MT=Malta pairing since "English flag" isn't a distinct national flag).
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "mt", label: "Malti", flag: "🇲🇹" },
]

export function LanguageSwitcher() {
  const [lang, setLang] = useState<Lang>("en")
  const [showConsent, setShowConsent] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close the dropdown on any outside click/tap or Escape. Safe with two
  // simultaneously-mounted instances (desktop header + mobile drawer):
  // each instance only closes ITSELF, keyed off its own rootRef.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  // Restore language on mount, from the `lang` cookie. Consent is
  // deliberately NOT cached into state here (see the FOURTH root cause
  // note on handleSelect below) -- it's always re-read live via
  // hasConsent() at the moment a decision actually needs it, so it can
  // never go stale relative to a same-tab CookieBanner accept. The actual
  // widget (if MT was previously active) is loaded by the singleton
  // GoogleTranslateWidgetHost, not here -- this only sets local
  // pill-highlight state to match.
  useEffect(() => {
    const savedLang = getCookie(LANG_COOKIE) as Lang | null
    if (hasConsent() && savedLang === "mt") {
      setLang("mt")
    }
  }, [])

  const activate = useCallback((target: Lang) => {
    setCookie(LANG_COOKIE, target, 365)
    if (target === "mt") {
      setRawCookie(GOOGTRANS_COOKIE, "/en/mt", 365)
    } else {
      deleteCookie(GOOGTRANS_COOKIE)
    }
    // GT only picks up the googtrans cookie during its own initialisation,
    // so a full reload is the reliable way to apply the change in both
    // directions (mt->en and en->mt). This also re-runs
    // GoogleTranslateWidgetHost's mount effect against the new cookie
    // value, regardless of which LanguageSwitcher instance was clicked.
    window.location.reload()
  }, [])

  // NOTE: deliberately does NOT early-return when target === lang. Lang
  // state here is inferred purely from the `lang` cookie, which reflects
  // what was *requested*, not whether the widget actually applied a
  // translation -- a real prior bug (see setRawCookie above) meant the
  // cookie could say "mt" while the page was still rendering English.
  // With the old `if (target === lang) return` guard, a user stuck in
  // that state had NO way to retry from the UI: clicking MT again was a
  // silent no-op (no reload, no error, nothing changes -- exactly the
  // symptom reported 2026-07-09). Always re-running activate() on every
  // click guarantees the cookie gets rewritten and the page reloads even
  // if state and reality have drifted apart; the cost is one extra reload
  // in the rare case where the user clicks a pill that's already correctly
  // active, which is a fully acceptable trade for self-healing behaviour.
  //
  // FIFTH root cause (2026-07-10): CSP style-src blocked www.gstatic.com,
// preventing the Google Translate widget's own stylesheet from loading. The
// widget constructs TranslateElement successfully (no JS errors), creates the
// goog-te-combo <select>, but never populates it with language options because
// its internal init depends on the blocked CSS. Result: goog-te-combo.options.
// length === 0 permanently, so both the cookie-driven and DOM-driven activation
// paths dead-end. The securitypolicyviolation event fires but wasn't being
// listened for. Fix: add https://www.gstatic.com to style-src in next.config.ts.
// See GoogleTranslateWidgetHost.tsx for the full diagnosis.
//
// FOURTH root cause (2026-07-09): `consentGiven` was only ever set once,
  // in the mount-time useEffect above. If a user loads the page, accepts
  // the CookieBanner ("Accept all" -> writes localStorage in the SAME
  // render pass, does NOT remount this component), then clicks MT, this
  // component's `consentGiven` state is still the STALE `false` it read
  // on its own mount -- before the banner was accepted. So the consent
  // dialog below re-prompts every time even though consent was already
  // given moments earlier in the same page load, and the user never sees
  // any error or feedback explaining why. (CookieBanner does export an
  // `onConsentChange` pub/sub helper seemingly built for exactly this,
  // but LanguageSwitcher never actually calls it -- and even if it did,
  // the underlying `window.addEventListener("storage", ...)` mechanism it
  // uses is a browser-spec dead end here: the native `storage` event only
  // ever fires in OTHER tabs/windows, never in the same tab that called
  // `localStorage.setItem()`. It cannot be made to work for same-tab
  // consent sync no matter how it's wired.)
  //
  // Fix: re-read consent live, at click time, directly from localStorage/
  // cookie via hasConsent(), instead of trusting a value captured once at
  // mount. This is correct regardless of whether the CookieBanner was
  // accepted before this component mounted, during the same page view
  // after it mounted, or in a previous session.
  const handleSelect = useCallback(
    (target: Lang) => {
      setOpen(false)
      if (target === "en") {
        activate("en")
        return
      }

      if (hasConsent()) {
        activate("mt")
        return
      }

      setShowConsent(true)
    },
    [activate],
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

  const current = LANG_OPTIONS.find((o) => o.value === lang) ?? LANG_OPTIONS[0]

  return (
    <div ref={rootRef} className="relative flex items-center">
      {/* Dropdown trigger -- shows the currently active language */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${current.label}. Change language`}
        className="flex items-center gap-1.5 rounded-full border border-soft-beige/30 px-3 py-1 text-xs font-semibold text-soft-beige transition-colors hover:border-soft-beige/60 focus:outline-2 focus:outline-offset-1 focus:outline-matte-gold"
      >
        <span aria-hidden="true" className="text-sm leading-none">{current.flag}</span>
        {current.value.toUpperCase()}
        {/* Chevron -- rotates when open */}
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>

      {/* Options menu */}
      {open && (
        <ul
          role="listbox"
          aria-label="Select language"
          className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-lg border border-matte-gold/40 bg-soft-beige py-1 text-lunar-green shadow-lg"
        >
          {LANG_OPTIONS.map((opt) => (
            <li key={opt.value} role="option" aria-selected={lang === opt.value}>
              <button
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors hover:bg-lunar-green/10 focus:outline-2 focus:-outline-offset-2 focus:outline-matte-gold ${
                  lang === opt.value ? "font-bold" : "font-medium"
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none">{opt.flag}</span>
                {opt.label}
                {lang === opt.value && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 12 12"
                    className="ml-auto h-3.5 w-3.5 text-lunar-green"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 6.5 4.5 9 10 3.5" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

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
