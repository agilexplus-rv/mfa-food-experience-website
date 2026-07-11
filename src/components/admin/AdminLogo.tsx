/**
 * Custom logo for the Payload admin login view, replacing the default
 * generic Payload wordmark with the Malta Food Experience brand.
 *
 * Rudie 2026-07-12: wrapped in a link to the public homepage -- staff
 * clicking the brand mark on /admin/login expect it to behave like
 * every other site logo (a way back to the public site), not a
 * decorative dead image.
 *
 * @see https://payloadcms.com/docs/custom-components/root-components#graphicslogo
 */
export default function AdminLogo() {
  return (
    <a href="/" aria-label="Malta Food Experience — go to homepage">
      <img
        src="/brand/logos/Malta Food - Primary.svg"
        alt="Malta Food Experience"
        style={{ width: '220px', maxWidth: '80vw', height: 'auto' }}
      />
    </a>
  )
}
