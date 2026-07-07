/**
 * Custom logo for the Payload admin login view, replacing the default
 * generic Payload wordmark with the Malta Food Experience brand.
 *
 * @see https://payloadcms.com/docs/custom-components/root-components#graphicslogo
 */
export default function AdminLogo() {
  return (
    <img
      src="/brand/logos/Malta Food - Primary.svg"
      alt="Malta Food Experience"
      style={{ width: '220px', maxWidth: '80vw', height: 'auto' }}
    />
  )
}
