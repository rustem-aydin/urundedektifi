import type { CollectionConfig } from 'payload'

export const Countries: CollectionConfig = {
  slug: 'countries',
  labels: {
    singular: 'Ülke',
    plural: 'Ülkeler',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'code'],
    group: 'Master Listeler',
    description:
      'Üretim yeri ülkelerin master listesi. Uzman kuralları bu listeden seçim yapar (Örn: "İsrail menşeli ürünler → Boykot" kuralı). "code" alanı GS1 barkod prefixidir (3 hane).',
  },
  access: {
    create: () => true,
    delete: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user }, id }) => {
      if (user?.role === 'admin') return true
      return user?.id === id
    },
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Ülke Adı',
      required: true,
      index: true,
      admin: {
        description:
          'Ülkenin tam adı (Örn: "Türkiye", "Almanya", "İsrail", "Amerika Birleşik Devletleri"). Barkod prefix eşleştirmesi bu ada göre yapılır, bu yüzden standart isim kullanın.',
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
      name: 'code',
      type: 'text',
      label: 'GS1 Barkod Prefix (3 hane)',
      admin: {
        description:
          'Bu ülkeye ait ana GS1 barkod prefixi (3 hane, sıfır dolgulu). Örn: Türkiye="868", Almanya="400", ABD="000". Barkod girilirken ilk 3 hane bu alanla eşleşirse ülke otomatik atanır. Birden fazla prefix varsa birini buraya, diğerlerini "Ek Prefixler" alanına yazın.',
      },
    },
    {
      name: 'aliases',
      type: 'array',
      labels: { singular: 'Ek Prefix', plural: 'Ek Prefixler (3 hane)' },
      admin: {
        description:
          "Bu ülkeye ait ek GS1 prefix'ler (3 hane, sıfır dolgulu). Örn: ABD için 000-139 aralığındaki diğer prefix'ler. Sadece \"code\" alanında belirtilmeyen ek prefix'ler eklenir.",
      },
      fields: [
        {
          name: 'prefix',
          type: 'text',
          label: 'Prefix',
          required: true,
          admin: {
            description: '3 haneli GS1 prefix (Örn: "869", "030").',
          },
        },
      ],
    },
    {
      name: 'iso',
      type: 'text',
      label: 'ISO 3166-1 Alpha-2',
      admin: {
        description:
          'Ülkenin uluslararası 2 harfli kodu (Örn: "TR", "DE", "IL", "US"). Görsel/gösterim amaçlıdır.',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (operation === 'create' && data?.name && !data.slug) {
          data.slug = data.name
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
