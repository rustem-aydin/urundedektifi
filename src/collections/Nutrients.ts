import type { CollectionConfig } from 'payload'

export const Nutrients: CollectionConfig = {
  slug: 'nutrients',
  labels: { singular: 'Besin', plural: 'Besinler' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug'],
    group: 'Referans Veriler',
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
