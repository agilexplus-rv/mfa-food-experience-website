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

        a,
        .btn--style-link {
          color: #C9643D;
        }

        .template-minimal {
          background-color: #F9F4EF;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .template-minimal__wrap {
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
          padding: 48px 40px;
          background: #FFFFFF;
          border-radius: 12px;
          box-shadow: 0 4px 24px rgba(51, 72, 61, 0.08);
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
      }
    `}</style>
  )
}
