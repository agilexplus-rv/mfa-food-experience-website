'use client'

import { useEffect } from 'react'

/**
 * Adds a password-reveal (eye icon) toggle to the login view's password
 * field via direct DOM manipulation, since Payload's built-in LoginForm
 * hardcodes its own PasswordField with no custom-component override slot
 * for that specific field (unlike collection-level password fields,
 * which do support Field.Input overrides). This is the pragmatic fix
 * given that constraint -- confirmed via node_modules/@payloadcms/next's
 * LoginForm source, which renders PasswordField directly with no
 * Field/Input override prop threaded through for the login route.
 *
 * Addresses the 2026-07-07 impeccable critique P1: door-staff users
 * blind-type a password on a phone keyboard, often one-handed and under
 * time pressure at a venue entrance, with no way to verify what they
 * typed before submitting -- compounding the P0 silent-failure risk if
 * a typo goes unnoticed.
 */
export default function AdminPasswordReveal() {
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>(
      '.login__form input[type="password"]',
    )
    if (!input || input.dataset.revealWired) return
    input.dataset.revealWired = 'true'

    const wrap = input.parentElement
    if (!wrap) return
    wrap.style.position = 'relative'

    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.setAttribute('aria-label', 'Show password')
    toggle.style.cssText = [
      'position:absolute',
      'right:12px',
      'top:50%',
      'transform:translateY(-50%)',
      'background:none',
      'border:none',
      'cursor:pointer',
      'padding:4px',
      'display:flex',
      'align-items:center',
      'color:#6B7F74',
      'line-height:0',
    ].join(';')
    toggle.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>'

    let revealed = false
    toggle.addEventListener('click', () => {
      revealed = !revealed
      input.type = revealed ? 'text' : 'password'
      toggle.setAttribute('aria-label', revealed ? 'Hide password' : 'Show password')
      toggle.style.color = revealed ? '#33483D' : '#6B7F74'
    })

    input.style.paddingRight = '40px'
    wrap.appendChild(toggle)

    return () => {
      toggle.remove()
      delete input.dataset.revealWired
    }
  }, [])

  return null
}
