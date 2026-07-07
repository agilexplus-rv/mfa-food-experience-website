/**
 * Injects Malta Food Experience brand CSS variable overrides into the
 * Payload admin panel (login screen + full admin UI once logged in).
 *
 * Payload's Admin UI is themed via a documented set of CSS custom
 * properties (--theme-*) that are safe and intended to be overridden --
 * see https://payloadcms.com/docs/admin/customizing-css. Rendering a
 * plain <style> tag from a root component (admin.components.header,
 * which renders above the Payload header on every admin route including
 * the login view) is the supported way to apply this without needing
 * SCSS build tooling wired into the Payload admin bundle.
 *
 * Brand palette (matches src/app/(frontend)/globals.css exactly):
 *   Lunar Green  #33483D  -- primary / success accents
 *   Terracotta   #C9643D  -- secondary / warning-adjacent accents
 *   Matte Gold   #B8974D  -- tertiary accent
 *   Soft Beige   #F9F4EF  -- background
 */
export default function AdminThemeStyles() {
  return (
    <style>{`
      @layer payload-default {
        :root,
        html[data-theme='light'] {
          --theme-bg: #F9F4EF;
          --theme-input-bg: #FFFFFF;
          --theme-text: #33483D;
          --theme-elevation-0: #F9F4EF;
          --theme-elevation-50: #F4EDE3;
          --theme-elevation-100: #EFE6D8;
          --theme-elevation-150: #E5D8C4;
          --theme-elevation-200: #DCCBB2;
          --theme-elevation-400: #C9B491;
          --theme-elevation-500: #B29B75;
          --theme-success-500: #33483D;
          --theme-success-50: #E7ECE9;
          --theme-warning-500: #B8974D;
          --theme-warning-50: #F5EEE0;
          --theme-error-500: #C9643D;
          --theme-error-50: #FBEAE2;
        }

        html[data-theme='dark'] {
          --theme-bg: #1E2A24;
          --theme-input-bg: #26362E;
          --theme-text: #F9F4EF;
          --theme-elevation-0: #1E2A24;
          --theme-elevation-50: #26362E;
          --theme-elevation-100: #2E4238;
        }

        body {
          font-family: var(--font-sans, 'Montserrat', ui-sans-serif, system-ui, sans-serif);
        }

        /* Primary buttons (Login, Save, etc.) use the brand primary color */
        .btn--style-primary {
          --theme-success-500: #33483D;
          background: #33483D;
        }
        .btn--style-primary:hover {
          background: #4A6B59;
        }

        /* Text-safe terracotta: the decorative brand terracotta (#C9643D)
           fails WCAG AA for text (3.91:1 on white, 3.58:1 on Soft Beige,
           vs the 4.5:1 required for normal-size text -- confirmed by the
           2026-07-07 impeccable critique, P1). This darkened variant
           (#9C4E2F) keeps the same hue but hits 5.42:1/5.92:1, comfortably
           clearing AA on both backgrounds, and is reserved for text/link
           use only -- the original #C9643D remains correct for decorative,
           non-text applications (borders, icons, large graphic accents). */
        a,
        .btn--style-link {
          color: #9C4E2F;
        }

        .template-minimal {
          background-color: #F9F4EF;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .template-minimal__wrap {
          /* box-sizing: border-box is required here -- without it, the
             40px horizontal padding ADDS to the 100% width instead of
             being subtracted from it, overflowing a real mobile
             viewport (e.g. 390px) by 80px. Confirmed via width-budget
             arithmetic during the 2026-07-07 impeccable critique P2
             follow-up: this Hermes environment's browser tooling cannot
             truly emulate a narrow mobile viewport (window.resizeTo is a
             documented no-op here), so this was verified by computed-
             style inspection + arithmetic, not a rendered screenshot at
             the actual target width -- flagging that limitation
             explicitly rather than claiming a visual verification that
             wasn't actually possible. */
          box-sizing: border-box;
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
          padding: 48px 40px;
          background: #FFFFFF;
          border-radius: 12px;
          box-shadow: 0 4px 24px rgba(51, 72, 61, 0.08);
        }

        @media (max-width: 480px) {
          .template-minimal__wrap {
            padding: 40px 24px;
            border-radius: 8px;
          }
        }

        /* P2 fix: Payload's default large-button sizing (420px) doesn't
           true up to the login card's actual input width (452px at the
           card's own padding), leaving a ~32px trailing-edge gap on an
           otherwise minimal card where the misalignment reads immediately
           (2026-07-07 impeccable critique). Force the login form's
           primary button to fill the same width as its sibling inputs. */
        .login__form .btn--style-primary {
          width: 100%;
        }

        .login__brand {
          display: flex;
          justify-content: center;
          margin-bottom: 32px;
        }

        .login__brand img {
          width: 180px !important;
          height: auto !important;
        }

        .login__form .field-type {
          margin-bottom: 16px;
        }

        /* P2 fix (mobile viewport verification, 2026-07-07 impeccable
           critique follow-up): Payload's default text/email/password
           inputs render with box-sizing: content-box, so their own
           padding+border is added on top of the computed width rather
           than absorbed into it. At a real narrow viewport (390px
           confirmed via a browser resize during this fix -- the
           previous attempt in this same file used getBoundingClientRect
           arithmetic only, since window.resizeTo() usually no-ops in
           this environment; this time an actual resize landed and
           exposed a genuine 25px horizontal overflow/scrollbar on the
           login card, traced to this exact input box-sizing issue),
           this pushes the email input 383px wide inside a 342px
           available slot, overflowing the document. Force border-box on
           every input within the login form so declared widths are
           truly their rendered widths. */
        .login__form input {
          box-sizing: border-box !important;
          max-width: 100%;
        }

        /* Safety net: ensure Payload/Sonner's toast notification region
           always renders fixed to the viewport, regardless of document
           flow/height changes introduced by the .template-minimal flex
           centering above. Without this, a toast (e.g. "incorrect email
           or password") can render far down an artificially-tall page
           and be invisible without scrolling -- a real, confirmed P0
           bug found during design review (2026-07-07 critique). */
        section[aria-label="Notifications alt+T"] {
          position: fixed !important;
          bottom: 24px !important;
          right: 24px !important;
          left: auto !important;
          top: auto !important;
          z-index: 9999 !important;
        }
      }
    `}</style>
  )
}
