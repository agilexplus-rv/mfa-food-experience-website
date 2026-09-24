'use client'

import { useEffect, useState } from 'react'

/**
 * MtText — curated Maltese for short UI strings that Google Translate
 * gets wrong (Rudie 2026-07-12).
 *
 * Root cause this fixes: the Google Translate widget machine-translates
 * "Book" as the NOUN ("Ktieb" -- a book you read) instead of the verb
 * ("Ibbukkja" -- make a booking). Short, context-free button labels are
 * exactly where statistical MT fails worst, and the free website-widget
 * has no glossary/do-not-translate term API to correct it.
 *
 * Approach: the rendered <span> carries the "notranslate" class --
 * Google's widget documentedly skips elements with this class -- and
 * this component swaps in our own curated Maltese when the site
 * language is MT (read from the same `lang` cookie LanguageSwitcher
 * writes). English text is served during SSR so static pages stay
 * static and there is no hydration flash for the EN default.
 *
 * Use ONLY for short CTAs/labels where the curated translation is
 * unambiguous. Long body copy stays with the widget.
 */

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null
}

export function MtText({ en, mt }: { en: string; mt: string }) {
  const [text, setText] = useState(en)

  useEffect(() => {
    if (getCookie('lang') === 'mt') setText(mt)
  }, [mt])

  return <span className="notranslate">{text}</span>
}
