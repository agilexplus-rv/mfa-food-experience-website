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

        /* Snags #2 + #4 (2026-07-12): on mobile, the login/forgot/
           reset pages set .template-minimal to min-height: auto (see
           the max-width:640px block below) so the page can be as
           short as its content rather than always filling the full
           viewport height. If the form content is shorter than the
           viewport, the leftover space below it would otherwise show
           the browser's default body background (white) instead of
           matching the card/page colour -- Payload's own stylesheet
           never sets an explicit background-color on html/body (only
           on specific components), so this was previously relying
           entirely on .template-minimal's own background, which only
           covers its own box, not the full page below a short-content
           mobile view. Setting it explicitly here on html/body
           guarantees the ENTIRE viewport (not just the template's own
           box) always matches --theme-bg, which is the same colour
           .template-minimal__wrap uses for its card background on
           desktop and the same colour the page falls back to on
           mobile once the card chrome is stripped -- i.e. body,
           .template-minimal, and .template-minimal__wrap are now
           guaranteed to share one identical colour end-to-end. */
        html,
        body {
          background-color: #F9F4EF;
        }
        html[data-theme='dark'],
        html[data-theme='dark'] body {
          background-color: #1E2A24;
        }

        /* Primary buttons (Login, Save, etc.) match the public site's
           primary CTA pattern exactly (see e.g. src/components/home/
           Hero.tsx's "Book an Event" button: rounded-lg, bold, soft-beige
           text, hover-to-85%-opacity via color-mix), but in Lunar Green
           rather than the site's Terracotta -- an admin/operational
           surface intentionally uses the primary (not accent) brand
           color to read as distinct from the public-facing marketing
           CTAs, per PRODUCT.md's brand-continuity principle. */
        .btn--style-primary {
          --theme-success-500: #33483D;
          background: #33483D;
          color: #F9F4EF;
          border-radius: 0.5rem;
          font-weight: 700;
          padding: 0.875rem 1.5rem;
          transition: background-color 150ms ease;
          border: none;
        }
        .btn--style-primary:hover {
          background: color-mix(in srgb, #33483D 85%, transparent);
        }
        .btn--style-primary .btn__content,
        .btn--style-primary .btn__label {
          color: #F9F4EF;
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

        /* Rudie 2026-07-11 + 2026-07-12: on real mobile viewports the
           white card chrome (background, border-radius, drop-shadow,
           fixed max-width) around the email/password/Login/
           Forgot-password group looks like an odd floating box rather
           than a page -- there's no surrounding content for a "card"
           to visually separate from. Below 640px, strip the card
           treatment entirely so the form sits directly on the page
           background, full-width within its padding, like a native
           mobile form -- and pull the whole block to the TOP of the
           viewport (not vertically centred, which on a short mobile
           screen with the keyboard later opening pushes content
           around awkwardly) with breathing room above the logo
           instead. ONLY applies inside this @media block -- desktop/
           tablet above 640px are completely untouched and keep the
           centred card exactly as before. */
        @media (max-width: 640px) {
          .template-minimal {
            align-items: flex-start;
            min-height: auto;
          }
          .template-minimal__wrap {
            max-width: 100%;
            background: none;
            box-shadow: none;
            border-radius: 0;
            padding: 0 20px 32px;
            padding-top: max(32px, env(safe-area-inset-top));
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

        /* Rudie 2026-07-12 (snags #3 + #4): /admin/forgot and
           /admin/reset render via Payload's ForgotPasswordView/
           ResetPasswordView, which -- unlike LoginView -- never
           include a Logo component at all (confirmed via
           node_modules/@payloadcms/next/dist/views/ForgotPassword/
           index.js + ResetPassword/index.js: no Logo import, no
           brand wrapper). AdminGlobalStyles renders the same
           AdminLogo, and AdminBrandReparent.tsx (a small client-side
           effect, since no config-level override slot exists for
           these two views) physically moves it to be the FIRST CHILD
           of .template-minimal__wrap on those two pages specifically
           -- i.e. literally the same div that contains the email
           field and submit button, matching the exact request rather
           than an adjacent box that only looked similar. This class
           now styles the logo AS a normal child of that wrap (no
           longer floating outside it via :has() sibling-targeting),
           and .template-minimal__wrap's own background/padding rules
           above already make its background match the surrounding
           page (#FFFFFF card on desktop, transparent/page-colour on
           mobile per the max-width:640px rules) -- so satisfying
           "logo in the same div" also directly satisfies "forgot-
           password mobile background matches the div enclosing
           email/password/button", since they're now the same element
           by construction, not just colour-matched independently. */
        .admin-brand-inject {
          display: none;
        }
        /* Once AdminBrandReparent.tsx has moved it inside
           .template-minimal__wrap on the forgot/reset pages, it
           becomes a DESCENDANT of section.forgot-password /
           .reset-password -- this is what actually reveals it.
           On the login page it is never moved (stays an un-relocated
           sibling before section.login), so it stays display:none
           there and the login page's own native .login__brand block
           remains the only visible logo -- no duplicate. */
        .forgot-password .admin-brand-inject,
        .reset-password .admin-brand-inject {
          display: flex;
          justify-content: center;
          margin-bottom: 32px;
        }
        .admin-brand-inject img {
          width: 180px !important;
          height: auto !important;
        }

        /* Match the login page's own heading/description styling
           (2026-07-07 impeccable critique) on the forgot-password and
           reset-password FormHeader block (node_modules/@payloadcms/
           next/dist/elements/FormHeader/index.js renders a bare
           a plain form-header div containing h1 + p, with no brand styling applied by
           Payload's defaults -- this is the actual "CSS not exactly
           like the login page" gap: the login view has no equivalent
           heading at all, so there was nothing to match against
           before beyond generic Payload defaults, but the brand
           typography/colour/spacing rhythm established for the rest
           of the login card should extend here too). */
        .form-header h1 {
          color: #33483D;
          font-family: var(--font-sans, 'Montserrat', ui-sans-serif, system-ui, sans-serif);
          font-weight: 700;
          font-size: 1.25rem;
          margin: 0 0 8px;
          text-align: center;
        }
        .form-header p {
          color: #6B7F74;
          font-size: 0.875rem;
          line-height: 1.5;
          margin: 0 0 24px;
          text-align: center;
        }
        .forgot-password .btn--style-primary,
        .reset-password .btn--style-primary {
          width: 100%;
        }

        /* Snag #1 (2026-07-12): style the "Back to login" link
           (ForgotPasswordView / ResetPassword render it as a bare <a>
           sibling after the form -- see node_modules/@payloadcms/next/
           dist/views/ForgotPassword/index.js + ResetPassword/index.js)
           to EXACTLY match the "Forgot password?" link's typography on
           the login page (small, same font-size/margin-top -- see the
           .login__form > a rule further down), except centred instead
           of right-aligned, since there's no button for it to visually
           pair with here the way "Forgot password?" pairs with Login. */
        .forgot-password .template-minimal__wrap > a,
        .reset-password .template-minimal__wrap > a {
          display: block;
          text-align: center;
          font-size: 0.75rem;
          margin-top: 12px;
        }
        .forgot-password .field-type,
        .reset-password .field-type {
          margin-bottom: 16px;
        }
        .forgot-password input,
        .reset-password input {
          box-sizing: border-box !important;
          max-width: 100%;
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

        /* Rudie 2026-07-11: reorder the login form so the Login button
           sits BETWEEN the password field and "Forgot password?" --
           Payload's default DOM order is inputWrap -> <a> (forgot) ->
           .form-submit (button), i.e. the link sits ABOVE the button.
           .login__form's direct children are exactly three nodes:
           .login__form__inputWrap, a bare <a>, and a .form-submit div
           wrapping the actual <button> -- confirmed via inspecting
           document.querySelector('.login__form').children on the live
           page (2026-07-11). No override slot exists for
           this link's position/class in node_modules/@payloadcms/next/
           dist/views/Login/LoginForm/index.js, so a flex-order
           override here is the only lever available short of forking
           the view. Also shrinks the link and right-aligns it, per
           explicit design direction -- it's a secondary/tertiary
           action, not a primary one, and shouldn't visually compete
           with Login. */
        .login__form {
          display: flex;
          flex-direction: column;
        }
        .login__form__inputWrap {
          order: 1;
        }
        .login__form > .form-submit {
          order: 2;
        }
        .login__form > a {
          order: 3;
          align-self: flex-end;
          margin-top: 12px;
          font-size: 0.75rem;
          text-align: right;
        }

        /* Safety net: ensure Payload/Sonner's toast notification region
           always renders fixed to the viewport, regardless of document
           flow/height changes introduced by the .template-minimal flex
           centering above. Without this, a toast (e.g. "incorrect email
           or password") can render far down an artificially-tall page
           and be invisible without scrolling -- a real, confirmed P0
           bug found during design review (2026-07-07 critique).
           2026-07-12: position is now top-center + 30s duration via
           payload.config.ts's admin.toast (a first-class documented
           option -- position/timing no longer need a CSS override),
           but this fixed/pinned rule stays as the same safety net,
           now anchored top instead of bottom, and widened into a
           full-viewport-width floating BANNER look per explicit
           design direction, rather than a small corner toast. */
        section[aria-label="Notifications alt+T"] {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: auto !important;
          width: 100% !important;
          display: flex;
          justify-content: center;
          z-index: 9999 !important;
          padding-top: env(safe-area-inset-top, 0px);
        }
        section[aria-label="Notifications alt+T"] [data-sonner-toaster] {
          width: min(560px, calc(100vw - 32px)) !important;
        }
        /* Banner styling: brand-coloured left border keyed to toast
           type (error/success/warning/info), full readable width,
           generous padding, and a properly sized/clickable close (X)
           button -- Payload's Sonner wrapper already renders a close
           button by default (closeButton: true in ToastContainer),
           this just makes it visually match the banner treatment
           instead of the tiny default corner-toast affordance. */
        [data-sonner-toaster] [data-sonner-toast] {
          border-radius: 10px;
          border-width: 1px;
          border-left-width: 4px;
          padding: 16px 44px 16px 20px;
          font-size: 0.9375rem;
          box-shadow: 0 8px 24px rgba(51, 72, 61, 0.16);
        }
        [data-sonner-toaster] [data-sonner-toast][data-type="error"] {
          border-left-color: #C9643D;
        }
        [data-sonner-toaster] [data-sonner-toast][data-type="success"] {
          border-left-color: #33483D;
        }
        [data-sonner-toaster] [data-sonner-toast][data-type="warning"],
        [data-sonner-toaster] [data-sonner-toast][data-type="loading"] {
          border-left-color: #B8974D;
        }
        [data-sonner-toaster] [data-close-button] {
          width: 24px !important;
          height: 24px !important;
          opacity: 0.7;
        }
        [data-sonner-toaster] [data-close-button]:hover {
          opacity: 1;
        }
      }
    `}</style>
  )
}
