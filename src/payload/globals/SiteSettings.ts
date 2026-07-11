import type { GlobalConfig } from 'payload'

/**
 * SiteSettings — Payload Global for site-wide presentation options.
 *
 * Currently houses the homepage Hero background-image toggle:
 * when `heroBackgroundImage` is populated (a Media upload), the
 * Hero section renders with that image as a darkened background.
 * When unset, Hero falls back to the default text-only Soft-Beige
 * layout — preserving existing behaviour for sites that never
 * configure an image.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: {
    // Public: the homepage needs to read the hero image setting.
    read: () => true,
    // Admin only: only admins can change site settings.
    update: ({ req: { user } }) =>
      (user as { role?: string } | null)?.role === 'admin',
  },
  admin: {
    group: 'Content',
  },
  fields: [
    {
      name: 'heroBackgroundImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Hero background image',
      admin: {
        description:
          'Optional. When set, the homepage Hero section renders with this image as a darkened background (with an overlay gradient for text readability). When empty, Hero uses the default text-only Soft-Beige layout.',
      },
    },
    {
      // Rudie 2026-07-11: admin-configurable recipient(s) for the public
      // /contact form (src/app/(frontend)/contact/actions.ts). One or
      // more email addresses, semicolon-separated. Falls back to
      // ADMIN_ALERT_EMAIL / FROM_EMAIL env vars when unset (see
      // adminAlertEmail() in src/lib/env.ts) so a site that never
      // configures this still delivers messages somewhere.
      name: 'contactFormRecipients',
      type: 'text',
      label: 'Contact form recipient email(s)',
      admin: {
        description:
          'One or more email addresses to receive contact-form submissions, separated by semicolons (e.g. info@foodagency.mt; bookings@foodagency.mt). Leave empty to use the ADMIN_ALERT_EMAIL / FROM_EMAIL environment default.',
      },
    },
  ],
}
