import type { CollectionConfig } from 'payload'

import {
  FEEDBACK_TARGETS,
  invalidateProductFeedbackCache,
  relationId,
} from '@/lib/productFeedback'
import type { User } from '@/payload-types'

/**
 * Ürün verisi doğrulaması + yorumlar.
 *
 * Kayıtlar yalnızca ürün uçlarından yazılır (`POST /api/products/feedback/:barcode/...`):
 * yazma yolu, "kullanıcı + ürün + bölüm başına tek oy" kuralını ve varsayılan metinleri
 * orada uygular. Bu koleksiyonun kendi REST create/update kapısı kapalıdır; panelde
 * yalnız görüntüleme ve silme yapılır. Ham okuma da kapalı, çünkü ilişki derinliği
 * yazarın e-posta adresini sızdırırdı.
 */

const PANEL_ROLES: User['role'][] = ['admin', 'editor']

const isPanelUser = (user: User | null) => PANEL_ROLES.includes(user?.role ?? 'user')

export const ProductFeedback: CollectionConfig = {
  slug: 'product-feedback',
  labels: {
    singular: 'Ürün Geri Bildirimi',
    plural: 'Ürün Geri Bildirimleri',
  },
  admin: {
    useAsTitle: 'text',
    defaultColumns: ['product', 'target', 'kind', 'verdict', 'author', 'createdAt'],
    group: 'Ürünler',
    description:
      'Kullanıcıların ürün verisi doğrulamaları ve yorumları. Doğrulama oyu kendi yorum metnini taşır; panelde yalnız inceleme ve silme yapılır. Yazma, ürünün kendi uçlarından geçer.',
  },
  access: {
    read: ({ req: { user } }) => isPanelUser(user as User | null),
    create: () => false,
    update: () => false,
    delete: ({ req: { user } }) => isPanelUser(user as User | null),
  },
  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
      label: 'Ürün',
    },
    {
      name: 'target',
      type: 'select',
      index: true,
      label: 'Doğrulanan Bölüm',
      options: FEEDBACK_TARGETS.map((target) => ({ label: target.label, value: target.key })),
      admin: {
        description:
          'Serbest yorumlarda boştur. Doğrulama oylarında hangi dosya bölümünün oylandığını gösterir.',
      },
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'comment',
      index: true,
      label: 'Tür',
      options: [
        { label: 'Doğrulama oyu', value: 'vote' },
        { label: 'Yorum', value: 'comment' },
      ],
    },
    {
      name: 'verdict',
      type: 'select',
      label: 'Karar',
      options: [
        { label: 'Doğru', value: 'confirm' },
        { label: 'Doğru değil', value: 'refute' },
      ],
      admin: {
        condition: (data) => data?.kind === 'vote',
        description: 'Yalnız doğrulama oylarında dolar.',
      },
    },
    {
      name: 'text',
      type: 'textarea',
      required: true,
      maxLength: 500,
      label: 'Metin',
      admin: {
        description:
          'Doğrulama oylarında varsayılan metin sunucuda yazılır ("Verilerin doğruluğunu teyit ediyorum." / "Doğru olmadığını bildiriyorum çünkü ...").',
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      label: 'Yazan',
    },
  ],
  hooks: {
    afterChange: [
      ({ doc }) => {
        invalidateProductFeedbackCache(relationId(doc.product))
        return doc
      },
    ],
    afterDelete: [
      ({ doc }) => {
        invalidateProductFeedbackCache(relationId(doc.product))
        return doc
      },
    ],
  },
}
