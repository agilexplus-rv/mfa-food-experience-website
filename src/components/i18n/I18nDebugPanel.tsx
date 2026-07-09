"use client"

import { useEffect, useState } from "react"

/**
 * I18nDebugPanel — an on-page, no-dev-tools-required diagnostic panel for
 * the language switcher / Google Translate widget, added 2026-07-09 after
 * repeated back-and-forth trying to diagnose "translation not working" on
 * an iPad where the reporting user has no access to browser dev tools.
 *
 * Only renders when the URL has ?debug=i18n appended (e.g.
 * https://.../?debug=i18n) -- invisible otherwise, zero risk to normal
 * users or Lighthouse/SEO. Shows, in plain readable text directly on the
 * page: cookies, consent state, and the live state of the Google
 * Translate widget's internal <select class="goog-te-combo"> (does it
 * exist, how many languages did it actually load). This turns whatever
 * device the user is holding into a diagnostic tool without any
 * dev-tools access, by just reading the panel and reporting back what it
 * says.
 *
 * Remove this component (and its one import + JSX line in
 * src/app/(frontend)/layout.tsx) once the underlying translation issue is
 * confirmed resolved -- it is a temporary diagnostic aid, not a
 * permanent feature.
 */
export function I18nDebugPanel() {
  // Read the URL flag synchronously on first render (not in an effect) --
  // window.location.search is stable and available during the client
  // render pass here since this component only ever mounts client-side
  // (it's nested under a "use client" root layout), so there is no
  // hydration-mismatch risk in reading it eagerly via useState's
  // initializer instead of committing it via a post-mount setState call.
  const [visible] = useState(() => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).get("debug") === "i18n"
  })
  const [info, setInfo] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!visible) return

    const refresh = () => {
      const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo")
      setInfo({
        "URL": window.location.href,
        "document.cookie": document.cookie || "(empty)",
        "localStorage.mfa_cookie_consent": (() => {
          try { return localStorage.getItem("mfa_cookie_consent") ?? "(not set)" }
          catch { return "(localStorage unavailable)" }
        })(),
        "documentElement.lang": document.documentElement.lang || "(not set)",
        "GT script tag present": document.querySelector('script[src*="translate.google.com"]') ? "yes" : "no",
        "window.google.translate exists": typeof (window as unknown as { google?: unknown }).google !== "undefined" ? "yes" : "no",
        "goog-te-combo exists": combo ? "yes" : "no",
        "goog-te-combo option count": combo ? String(combo.options.length) : "n/a",
        "goog-te-combo aria-label": combo?.getAttribute("aria-label") ?? "n/a",
        "widget div innerHTML length": String(
          document.getElementById("google_translate_element")?.innerHTML.length ?? 0,
        ),
        "viewport width x height": `${window.innerWidth} x ${window.innerHeight}`,
        "user agent": navigator.userAgent,
      })
    }

    refresh()
    const interval = setInterval(refresh, 1500)
    return () => clearInterval(interval)
  }, [visible])

  if (!visible) return null

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 999999,
        maxHeight: "50vh",
        overflowY: "auto",
        background: "rgba(10, 10, 10, 0.96)",
        color: "#7CFC7C",
        fontFamily: "monospace",
        fontSize: "11px",
        lineHeight: 1.5,
        padding: "10px 12px",
        borderTop: "2px solid #7CFC7C",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 6, color: "#fff" }}>
        i18n debug panel (remove ?debug=i18n from the URL to hide)
      </div>
      {Object.entries(info).map(([k, v]) => (
        <div key={k} style={{ wordBreak: "break-all", marginBottom: 2 }}>
          <span style={{ color: "#ffcc66" }}>{k}:</span> {v}
        </div>
      ))}
    </div>
  )
}
