import type { CollectionConfig } from 'payload'
import { slugify } from '@/lib/slugify'
import type { User } from '@/payload-types'

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: {
    singular: 'Ürün Kategorisi',
    plural: 'Ürün Kategorileri',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'parent'],
    group: 'Katalog',
    description:
      'Ürünlerin tip kategorileri (içecek, atıştırmalık, süt ürünleri vb.). Hiyerarşik yapıdadır — alt kategori eklenebilir.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => ['admin', 'editor'].includes((user as User | null)?.role || ''),
    update: ({ req: { user } }) => ['admin', 'editor'].includes((user as User | null)?.role || ''),
    delete: ({ req: { user } }) => (user as User | null)?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Kategori Adı',
      required: true,
      admin: {
        description:
          'Sitede görünecek kategori adı (Örn: "Atıştırmalık", "Süt Ürünleri", "İçecek").',
      },
    },
    {
      name: 'slug',
      type: 'text',
      label: 'URL Kısa Adı (Slug)',
      required: true,
      unique: true,
      index: true,
      admin: {
        hidden: true,
        description:
          "URL'de kullanılacak kısa ad. Otomatik üretilir, Türkçe karakterler İngilizce karşılıklarına dönüşür. Sadece küçük harf, rakam ve tire kullanın.",
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Açıklama',
      admin: {
        description: 'Kategori sayfasında görünecek kısa açıklama (isteğe bağlı).',
      },
    },
    {
      name: 'icon',
      type: 'upload',
      relationTo: 'media',
      label: 'Kategori İkonu',
      admin: {
        description:
          'Kategoriyi temsil eden küçük görsel (Örn: bir meyve fotoğrafı). Kare format önerilir.',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      label: 'Üst Kategori',
      admin: {
        description:
          'Eğer bu bir alt kategori ise üst kategoriyi seçin. Ana kategori için boş bırakın (Örn: "Meyve Suyu" → "İçecek" altında).',
      },
    },
    {
      name: 'order',
      type: 'number',
      label: 'Sıralama',
      defaultValue: 0,
      admin: {
        description:
          'Listeleme sırası. Küçük değerler önce gösterilir (Örn: 1=en üstte, 10=en altta).',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (operation === 'create' && data?.name && !data.slug) {
          data.slug = slugify(data.name)
        }
        return data
      },
    ],
  },
}
