import type { CollectionConfig } from 'payload'

export const Policies: CollectionConfig = {
  slug: 'policies',
  admin: {
    useAsTitle: 'title',
  },
  timestamps: true,
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
    },
  ],
}
