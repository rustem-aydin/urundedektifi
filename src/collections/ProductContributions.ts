import type { CollectionConfig } from 'payload'

import { CONTRIBUTION_KINDS, CONTRIBUTION_LABELS } from '@/lib/contributionLabels'
import type { User } from '@/payload-types'

/**
 * Ürün katkıları.
 *
 * Kim, hangi ürüne, hangi işle katkı verdi: oluşturma / düzenleme / doğrulama.
 * Yazma yalnız sunucudan (ürün kancaları ve ürün uçları) yapılır; REST create/update
 * kapalıdır, böylece kimse kendini katkıcı olarak ekleyemez. Okuma herkese açıktır:
 * ürün sayfasındaki "Katkıda Bulunanlar" avatar grubu ve herkese açık profiller
 * buradan beslenir.
 */
export const ProductContributions: CollectionConfig = {
  slug: 'product-contributions',
  labels: {
    singular: 'Ürün Katkısı',
    plural: 'Ürün Katkıları',
  },
  admin: {
    useAsTitle: 'kind',
    defaultColumns: ['product', 'user', 'kind', 'createdAt'],
    group: 'Ürünler',
    description:
      'Bir ürüne kimin ne işle katkı verdiği. Oluşturma, düzenleme ve doğrulama otomatik kaydedilir; elle ekleme yapılmaz.',
  },
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: ({ req: { user } }) => (user as User | null)?.role === 'admin',
  },
  fields: [
    {
      // Opsiyonel (NULL'a düşebilir): ürün veya hesap silinince Payload ilişkiyi
      // `ON DELETE SET NULL` ile boşaltır. `required` olsaydı sütun NOT NULL olur,
      // silme FK ihlaliyle düşerdi — ürün silinemez hâle gelirdi.
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      index: true,
      label: 'Ürün',
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      label: 'Kullanıcı',
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      label: 'Katkı Türü',
      options: CONTRIBUTION_KINDS.map((kind) => ({ label: CONTRIBUTION_LABELS[kind], value: kind })),
    },
  ],
}
