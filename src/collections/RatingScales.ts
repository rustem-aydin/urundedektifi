import type { CollectionConfig } from 'payload'

export const RatingScales: CollectionConfig = {
  slug: 'rating-scales',
  labels: {
    singular: 'Derecelendirme',
    plural: 'Derecelendirmeler',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'expert', 'color', 'order'],
    group: 'Uzmanlar',
    description:
      'Uzmanların kendi derecelendirme ölçekleri. Her uzman kendi ölçeğini oluşturur (Örn: Boykot Dedektifi → "Boykot", "Şüpheli", "Boykot Değil"). Uzman Kuralları bu ölçeklerden birini referans alır.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      ['admin', 'editor', 'expert'].includes(user?.role || ''),
    update: ({ req: { user } }) => {
      if (['admin', 'editor'].includes(user?.role || '')) return true
      if (user?.role === 'expert') {
        return { 'expert.user': { equals: user?.id } } as any
      }
      return false
    },
    delete: ({ req: { user } }) => ['admin', 'editor'].includes(user?.role || ''),
  },
  fields: [
    {
      name: 'expert',
      type: 'relationship',
      relationTo: 'experts',
      label: 'Sahibi Uzman',
      required: true,
      admin: {
        description: 'Bu derecelendirme ölçeğini oluşturan uzman.',
      },
    },
    {
      name: 'name',
      type: 'text',
      label: 'Derece Adı',
      required: true,
      admin: {
        description:
          'Derecenin adı. Sitede badge olarak gösterilir (Örn: "Boykot", "Şüpheli", "Boykot Değil", "Helal", "Sağlıklı", "Dikkat").',
      },
    },
    {
      name: 'color',
      type: 'text',
      label: 'Renk (HEX Kodu)',
      admin: {
        description:
          'Badge rengi. HEX formatında girin (Örn: #dc2626 kırmızı, #16a34a yeşil, #f59e0b turuncu, #6b7280 gri). Boş bırakılırsa varsayılan gri kullanılır.',
      },
    },
    {
      name: 'order',
      type: 'number',
      label: 'Sıralama',
      defaultValue: 0,
      admin: {
        description:
          'Uzmanın kendi ölçeğindeki sırası. Küçük değerler önce gösterilir (Örn: 0=ilk, 1=ikinci).',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Açıklama',
      admin: {
        description:
          'Bu derecenin ne anlama geldiği (Örn: "Ürün doğrudan boykot listesinde", "Şüpheli bağlantılar mevcut ama kanıtlanmamış").',
      },
    },
  ],
}
