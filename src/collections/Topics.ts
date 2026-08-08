import type { CollectionConfig } from 'payload'
import { slugify } from '@/lib/slugify'

export const Topics: CollectionConfig = {
  slug: 'topics',
  labels: {
    singular: 'Konu',
    plural: 'Konular',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'icon', 'color', 'order'],
    group: 'Katalog',
    description:
      'Uzmanların çalıştığı alanlar. Helal, Vegan, Çevresel, Boykot, Katkı Maddeleri vb. gibi istediğiniz kadar konu tanımlayabilirsiniz.',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Konu Adı',
      required: true,
      admin: {
        description:
          'Konunun görünen adı (Örn: "Helal Gıda", "Vegan", "Çevresel Etki", "Boykot", "Katkı Maddeleri").',
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
          'URL\'de kullanılacak kısa ad. Otomatik üretilir, Türkçe karakterler dönüştürülür. Sadece küçük harf, rakam ve tire kullanın.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Açıklama',
      admin: {
        description:
          'Bu konunun ne anlama geldiğini açıklayan metin. Kullanıcı konu sayfasında görür (Örn: "Helal: İslami usullere uygun üretim, hayvansal kaynak kontrolü").',
      },
    },
    {
      name: 'icon',
      type: 'text',
      label: 'İkon (Emoji)',
      admin: {
        description:
          'Konuyu temsil eden emoji (Örn: 🛑, ☪️, 🌱, 🐾, 🧪, 🌾, 💚). Liste halinde gösterilirken kullanılır.',
      },
    },
    {
      name: 'color',
      type: 'text',
      label: 'Renk (HEX Kodu)',
      admin: {
        description:
          'Konu rozetlerinin ve başlıklarının rengi. HEX formatında girin (Örn: #16a34a yeşil için, #dc2626 kırmızı için, #7c3aed mor için). Boş bırakılırsa varsayılan gri kullanılır.',
      },
    },
    {
      name: 'order',
      type: 'number',
      label: 'Sıralama',
      defaultValue: 0,
      admin: {
        description:
          'Konu listeleme sırası. Küçük değerler önce gösterilir (Örn: 1=en üstte, 10=en altta).',
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
