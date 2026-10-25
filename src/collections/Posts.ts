import { APIError, type Access, type CollectionConfig, type Payload, type Where } from 'payload'

import { lexicalToMarkdown } from '@/lib/postMarkdown'
import { slugify } from '@/lib/slugify'
import type { User } from '@/payload-types'

/**
 * Uzman yazıları ("Uzman kaleminden").
 *
 * Kanonik gövde Lexical JSON'dur; `bodyMarkdown` her kayıtta hook'ta türetilir.
 * Yayın modeli ürünlerdeki gibi `status` alanıyla (repoda Payload drafts kullanılmıyor).
 * Okuma yalnız yayınlanmış yazılara açıktır — `products`'taki `read: () => true` deseni
 * burada kopyalanmaz, aksi hâlde taslaklar ham REST'ten sızardı.
 */

const PANEL_ROLES: User['role'][] = ['admin', 'editor']

/** Oturumdaki uzman kullanıcısının `experts` kaydı (yoksa null). */
async function expertIdForUser(payload: Payload, userId: string | number): Promise<string | null> {
  const result = await payload.find({
    collection: 'experts',
    where: { user: { equals: userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const expert = result.docs[0]
  return expert ? String(expert.id) : null
}

const PUBLISHED_ONLY: Where = { status: { equals: 'published' } }

const readAccess: Access = async ({ req }) => {
  const user = req.user as User | null
  if (user && PANEL_ROLES.includes(user.role)) return true
  if (user?.role === 'expert') {
    const expertId = await expertIdForUser(req.payload, user.id)
    if (!expertId) return PUBLISHED_ONLY
    const ownOrPublished: Where = {
      or: [{ status: { equals: 'published' } }, { expert: { equals: expertId } }],
    }
    return ownOrPublished
  }
  return PUBLISHED_ONLY
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: {
    singular: 'Uzman Yazısı',
    plural: 'Uzman Yazıları',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'expert', 'status', 'publishedAt'],
    group: 'Uzmanlar',
    description:
      'Uzmanların paylaştığı yazılar. Yayınlanan yazılar anasayfadaki hikâye rayında ve uzman profilinde görünür. Gövde Lexical olarak yazılır; markdown sürümü kayıtta otomatik üretilir.',
  },
  access: {
    read: readAccess,
    create: ({ req: { user } }) =>
      ['admin', 'editor', 'expert'].includes((user as User | null)?.role ?? ''),
    update: async ({ req }) => {
      const user = req.user as User | null
      if (!user) return false
      if (PANEL_ROLES.includes(user.role)) return true
      if (user.role !== 'expert') return false
      const expertId = await expertIdForUser(req.payload, user.id)
      return expertId ? { expert: { equals: expertId } } : false
    },
    delete: ({ req: { user } }) => PANEL_ROLES.includes((user as User | null)?.role ?? 'user'),
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Başlık',
      required: true,
      admin: {
        description: 'Yazının başlığı. Rayda ve kartlarda bu başlık görünür.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      label: 'URL Kısa Adı (Slug)',
      unique: true,
      index: true,
      admin: {
        description: 'Boş bırakılırsa başlıktan üretilir. /yazilar/<slug> adresinde kullanılır.',
        position: 'sidebar',
      },
    },
    {
      name: 'expert',
      type: 'relationship',
      relationTo: 'experts',
      required: true,
      index: true,
      label: 'Uzman',
      admin: {
        description:
          'Yazının sahibi. Uzman rolüyle giriş yapan kullanıcıda otomatik doldurulur ve değiştirilemez.',
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      label: 'Özet',
      admin: {
        description: 'Kart ve ray için 1-2 cümlelik özet. Boşsa gövdenin ilk paragrafı kullanılır.',
      },
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      label: 'Kapak Görseli',
      admin: {
        description: 'Opsiyonel. Boşsa dosya estetiğinde tipografik zemin üretilir.',
      },
    },
    {
      name: 'body',
      type: 'richText',
      label: 'Gövde',
      required: true,
    },
    {
      name: 'bodyMarkdown',
      type: 'textarea',
      label: 'Markdown Sürümü',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description:
          'Gövdeden otomatik üretilir, elle düzenlenemez. API tüketicileri ve SEO için hazır markdown.',
      },
    },
    {
      name: 'topics',
      type: 'relationship',
      relationTo: 'topics',
      hasMany: true,
      label: 'Konular',
    },
    {
      name: 'status',
      type: 'select',
      label: 'Durum',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: [
        { label: 'Taslak', value: 'draft' },
        { label: 'Yayında', value: 'published' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Yayın Tarihi',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Yayına alındığında boşsa otomatik doldurulur.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const user = req.user as User | null

        // Uzman rolü: yazı daima kendi uzman kaydına bağlanır, başkasına atfedilemez.
        if (user?.role === 'expert') {
          const expertId = await expertIdForUser(req.payload, user.id)
          if (!expertId) {
            throw new APIError(
              'Hesabınıza bağlı bir uzman kaydı yok. Yazı paylaşmak için yöneticiyle iletişime geçin.',
              400,
            )
          }
          data.expert = expertId
        }

        if (!data.slug && data.title) data.slug = slugify(String(data.title))
        if (data.status === 'published' && !data.publishedAt) {
          data.publishedAt = new Date().toISOString()
        }

        const body = data.body ?? originalDoc?.body
        data.bodyMarkdown = await lexicalToMarkdown(body as never, async (id) => {
          try {
            const media = await req.payload.findByID({
              collection: 'media',
              id,
              depth: 0,
              overrideAccess: true,
            })
            return media?.url ? { url: media.url, alt: media.alt ?? '' } : null
          } catch {
            return null
          }
        })

        return data
      },
    ],
  },
}
