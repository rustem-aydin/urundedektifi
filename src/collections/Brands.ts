import type { CollectionConfig } from 'payload'
import { slugify } from '@/lib/slugify'
import type { User } from '@/payload-types'

export const Brands: CollectionConfig = {
  slug: 'brands',
  labels: {
    singular: 'Marka',
    plural: 'Markalar',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'country', 'isBoycotted'],
    group: 'Katalog',
    description:
      'Ürün markaları. Boykotlu olarak işaretlenirse, kural motoru bu markanın TÜM ürünlerini otomatik boykot eder.',
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
      label: 'Marka Adı',
      required: true,
      index: true,
      admin: {
        description: 'Markanın tam adı (Örn: "Coca-Cola", "Ülker", "Nestlé").',
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
          "URL'de kullanılacak kısa ad. Otomatik üretilir. Sadece küçük harf, rakam ve tire kullanın.",
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'Marka Logosu',
      admin: {
        description:
          'Marka logosu (kare veya yatay format). Şeffaf arka planlı PNG önerilir. Liste ve ürün sayfalarında görüntülenir.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Açıklama',
      admin: {
        description: 'Marka hakkında kısa bilgi.',
      },
    },
    {
      name: 'country',
      type: 'text',
      label: 'Merkez Ülke',
      admin: {
        description:
          'Marka ana şirketinin bulunduğu ülke. Kural motorunda ülke bazlı boykot analizi için kullanılır (Örn: "ABD", "İsviçre", "Türkiye").',
      },
    },
    {
      name: 'website',
      type: 'text',
      label: 'Resmi Web Sitesi',
      admin: {
        description: "Marka resmi web sitesi URL'i (Örn: https://www.example.com).",
      },
    },
    {
      name: 'isBoycotted',
      type: 'checkbox',
      label: 'Genel Olarak Boykotlu Marka',
      defaultValue: false,
      admin: {
        description:
          'Bu marka genel olarak boykot ediliyor mu? İşaretlenirse, kural motorunda "Marka boykotlu" kuralı bu markaya otomatik uygulanır.',
        position: 'sidebar',
      },
    },
    {
      name: 'boycottReason',
      type: 'textarea',
      label: 'Boykot Gerekçesi',
      admin: {
        condition: (data) => data?.isBoycotted,
        description:
          'Bu marka neden boykot ediliyor? Kullanıcılara gösterilecek açıklama (Örn: "İsrail-Filistin sorunu sebebiyle uluslararası BDS hareketi tarafından boykot edilmektedir.").',
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
