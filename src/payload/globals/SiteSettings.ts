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
  ],
}
