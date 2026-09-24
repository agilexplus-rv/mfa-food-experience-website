import type { GlobalConfig } from 'payload'

/**
 * SocialMediaSettings — Payload Global for admin-configurable social
 * media links rendered in the site footer (SiteFooter.tsx).
 *
 * Replaces the previously hardcoded SOCIALS array in SiteFooter.tsx
 * (which used placeholder "#" hrefs). Each platform entry has:
 *   - platform:  select (instagram, facebook, x)
 *   - url:       text (the full https:// URL)
 *   - published: checkbox (visible/hidden in the footer)
 *
 * The footer reads this Global and renders only entries where
 * published === true. When false, the platform's icon/link is
 * omitted entirely from the DOM.
 *
 * NEW PAYLOAD GLOBAL — REQUIRES MANUAL TURSO SCHEMA PUSH BEFORE DEPLOY.
 */
export const SocialMediaSettings: GlobalConfig = {
  slug: 'social-media-settings',
  access: {
    // Public: the footer needs to read these on every page.
    read: () => true,
    // Admin only: only admins can change social media settings.
    update: ({ req: { user } }) =>
      (user as { role?: string } | null)?.role === 'admin',
  },
  admin: {
    group: 'Content',
  },
  fields: [
    {
      name: 'platforms',
      type: 'array',
      label: 'Social media platforms',
      admin: {
        description:
          'Configure each social media platform. When "Published" is off, the platform icon is hidden from the footer entirely.',
      },
      defaultValue: [
        { platform: 'instagram', url: '', published: false },
        { platform: 'facebook', url: '', published: false },
        { platform: 'x', url: '', published: false },
      ],
      fields: [
        {
          name: 'platform',
          type: 'select',
          label: 'Platform',
          required: true,
          options: [
            { label: 'Instagram', value: 'instagram' },
            { label: 'Facebook', value: 'facebook' },
            { label: 'X', value: 'x' },
          ],
          admin: { width: '33%' },
        },
        {
          name: 'url',
          type: 'text',
          label: 'Profile URL',
          admin: {
            width: '34%',
            description: 'Full URL including https:// (e.g. https://instagram.com/yourpage)',
          },
        },
        {
          name: 'published',
          type: 'checkbox',
          label: 'Published (visible in footer)',
          defaultValue: false,
          admin: { width: '33%' },
        },
      ],
    },
  ],
}
