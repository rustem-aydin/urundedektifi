import type { CollectionConfig } from 'payload'

export const Allergens: CollectionConfig = {
  slug: 'allergens',
  labels: { singular: 'Alerjen', plural: 'Alerjenler' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug'],
    group: 'Alerjenler',
  },
  access: { read: () => true },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Ad',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug',
      required: true,
      unique: true,
      admin: {
        description: 'Teknik ad: energy-kj, fat, vitamin-c, vb.',
      },
    },
  ],
}
