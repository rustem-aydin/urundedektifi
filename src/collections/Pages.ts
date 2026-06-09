import type { CollectionConfig } from 'payload'

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: {
    singular: 'Sayfa',
    plural: 'Sayfalar',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status'],
    group: 'İçerik',
    description:
      'Hakkımızda, Metodoloji, Gizlilik Politikası, Kullanım Şartları gibi statik içerik sayfaları.',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Sayfa Başlığı',
      required: true,
      admin: {
        description: 'Sayfanın başlığı (Örn: "Hakkımızda", "Metodoloji", "Gizlilik Politikası").',
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
        description:
          'URL\'de kullanılacak kısa ad. Sayfaya /sayfa/[slug] üzerinden erişilir. Otomatik üretilir.',
      },
    },
    {
      name: 'content',
      type: 'textarea',
      label: 'Sayfa İçeriği',
      admin: {
        description:
          'Sayfanın ana içeriği. Düz metin olarak yazılır (satır sonları korunur). Markdown benzeri basit biçimlendirme kullanabilirsiniz.',
      },
    },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO & Sosyal Medya',
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          label: 'SEO Başlık (Meta Title)',
          admin: {
            description:
              'Google arama sonuçlarında görünecek başlık. Boş bırakılırsa sayfa başlığı kullanılır (maks. 60 karakter önerilir).',
          },
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          label: 'SEO Açıklama (Meta Description)',
          admin: {
            description:
              'Google arama sonuçlarında başlığın altında görünecek açıklama (maks. 160 karakter önerilir).',
          },
        },
        {
          name: 'ogImage',
          type: 'upload',
          relationTo: 'media',
          label: 'Sosyal Medya Görseli (Open Graph)',
          admin: {
            description:
              'Facebook, Twitter vb. paylaşımlarda görünecek görsel. 1200x630 piksel önerilir.',
          },
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      label: 'Yayın Durumu',
      defaultValue: 'draft',
      options: [
        { label: '📝 Taslak', value: 'draft' },
        { label: '✅ Yayında', value: 'published' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Sadece "Yayında" durumundaki sayfalar sitede görüntülenir.',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (operation === 'create' && data?.title && !data.slug) {
          data.slug = data.title
            .toLowerCase()
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ı/g, 'i')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
        }
        return data
      },
    ],
  },
}
