import { APIError, type CollectionConfig } from 'payload'
import { slugify } from '@/lib/slugify'
import { expertRules, invalidateProductCaseCache, listProductsForRules } from '@/lib/productCase'
import {
  createExpertAccount,
  ensureExpertAccountRole,
  relationshipId,
} from '@/lib/expertAccounts'
import type { User } from '@/payload-types'

export const Experts: CollectionConfig = {
  slug: 'experts',
  labels: {
    singular: 'Uzman',
    plural: 'Uzmanlar',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'title', 'verified', 'isPublic'],
    group: 'Uzmanlar',
    description:
      'Ürün değerlendirmesi yapan uzmanlar. Her uzman kendi derecelendirme ölçeğini oluşturur (Boykot, Helal, Sağlık vb.) ve kendi kurallarını yazar. Sadece doğrulanmış ve "Herkese Açık" işaretli uzmanlar sitede görünür.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => ['admin', 'editor'].includes((user as User | null)?.role || ''),
    update: ({ req: { user } }) => {
      if (['admin', 'editor'].includes((user as User | null)?.role || '')) return true
      if ((user as User | null)?.role === 'expert') {
        return { user: { equals: user?.id } } as any
      }
      return false
    },
    delete: ({ req: { user } }) => (user as User | null)?.role === 'admin',
  },
  endpoints: [
    {
      // Takipçi sayısı: `users.read` yalnız kendi dokümanına açık olduğu için anonim
      // istemci `users` sorgusu yapamaz; sayı uzman üzerinden public servis edilir.
      path: '/:id/stats',
      method: 'get',
      handler: async (req) => {
        const id = req.routeParams?.id as string | undefined
        if (!id) return Response.json({ error: 'Uzman kimliği gerekli' }, { status: 400 })

        const expert = await req.payload.findByID({
          collection: 'experts',
          id,
          depth: 0,
          overrideAccess: true,
        })
        if (!expert || expert.isPublic === false) {
          return Response.json({ error: 'Uzman bulunamadı' }, { status: 404 })
        }

        const followers = await req.payload.count({
          collection: 'users',
          where: { following: { in: [id] } },
          overrideAccess: true,
        })

        return Response.json({ followerCount: followers.totalDocs })
      },
    },
    {
      // Uzmanın kurallarına takılan yayınlanmış ürünler — mobil profil bu uçtan okur.
      path: '/:id/products',
      method: 'get',
      handler: async (req) => {
        const id = req.routeParams?.id as string | undefined
        if (!id) return Response.json({ error: 'Uzman kimliği gerekli' }, { status: 400 })

        const expert = await req.payload.findByID({
          collection: 'experts',
          id,
          depth: 0,
          overrideAccess: true,
        })
        if (!expert || expert.isPublic === false) {
          return Response.json({ error: 'Uzman bulunamadı' }, { status: 404 })
        }

        // Kural seti binlerce marka kuralına çıktı: sabit limit kullanılırsa ürünler
        // sessizce eksik eşleşir. Kurallar önbellekten gelir; kart için yalnız istenen
        // kadarı Dosya'ya çevrilir (334 eşleşme için tam dönüşüm boşa gidiyordu).
        const rules = await expertRules(req.payload, id)

        const { total, products } = await listProductsForRules(req.payload, rules, { limit: 6 })
        return Response.json({ total, products })
      },
    },
  ],
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Ad Soyad',
      required: true,
      admin: {
        description: 'Uzmanın gerçek adı ve soyadı. Sitede her yerde bu isim görünür.',
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
        description: "URL'de kullanılacak kısa ad. /uzmanlar/ahmet-hocam gibi. Otomatik üretilir.",
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      label: 'Panel Hesabı',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description:
          'Uzmanın admin panele gireceği hesap. Uzman kaydı ilk kaydedildiğinde otomatik açılır: e-posta uzmanın adından türetilir (ör. boykot_dedektifi@expert.local), şifre Kullanıcılar ekranından admin tarafından belirlenir. 1 uzman = 1 hesap; elle değiştirilemez.',
      },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Ünvan / Pozisyon',
      admin: {
        description:
          'Uzmanın mesleki ünvanı (Örn: "Gıda Mühendisi", "Helal Denetçisi", "Diyetisyen", "Çevre Mühendisi").',
      },
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      label: 'Profil Fotoğrafı',
      admin: {
        description: 'Kare formatında, en az 400x400 piksel önerilir. Şeffaf arka plan opsiyonel.',
      },
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      label: 'Profil Kapak Görseli',
      admin: {
        description:
          'Profil sayfasının üst şeridi. Opsiyonel; boşsa dosya estetiğinde tipografik zemin üretilir.',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'Biyografi',
      admin: {
        description:
          'Uzman hakkında kısa biyografi. Uzman profili sayfasında ve kartında görüntülenir (2-3 paragraf önerilir).',
      },
    },
    {
      name: 'credentials',
      type: 'array',
      labels: { singular: 'Sertifika / Belge', plural: 'Sertifikalar ve Belgeler' },
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Sertifika/Belge Adı',
          required: true,
          admin: {
            description:
              'Sertifika veya belgenin tam adı (Örn: "Helal Gıda Denetçisi Sertifikası").',
          },
        },
        {
          name: 'year',
          type: 'number',
          label: 'Yıl',
          admin: {
            description: 'Alındığı yıl (Örn: 2020).',
          },
        },
        {
          name: 'issuer',
          type: 'text',
          label: 'Veren Kurum',
          admin: {
            description: 'Sertifikayı veren kurum (Örn: "GIMDES", "TÜBİTAK", "Üniversite Adı").',
          },
        },
      ],
    },
    {
      name: 'verified',
      type: 'checkbox',
      label: 'Doğrulanmış Uzman',
      defaultValue: false,
      admin: {
        description:
          'Admin tarafından doğrulanmış uzman. Sadece doğrulanmış uzmanlar anasayfada ve filtrelerde gösterilir.',
        position: 'sidebar',
      },
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      label: 'Herkese Açık',
      defaultValue: true,
      admin: {
        description:
          'Sitede görüntülensin mi? İşaret kaldırılırsa uzman sadece admin panelde görünür.',
        position: 'sidebar',
      },
    },
    {
      name: 'socialLinks',
      type: 'group',
      label: 'Sosyal Medya & Web',
      fields: [
        {
          name: 'website',
          type: 'text',
          label: 'Kişisel Web Sitesi',
          admin: {
            description: 'Uzmanın kendi web sitesi (https:// ile birlikte).',
          },
        },
        {
          name: 'twitter',
          type: 'text',
          label: 'Twitter / X Hesabı',
          admin: {
            description: "Twitter profil URL'i.",
          },
        },
        {
          name: 'instagram',
          type: 'text',
          label: 'Instagram Hesabı',
          admin: {
            description: "Instagram profil URL'i.",
          },
        },
        {
          name: 'linkedin',
          type: 'text',
          label: 'LinkedIn Profili',
          admin: {
            description: "LinkedIn profil URL'i.",
          },
        },
        {
          name: 'youtube',
          type: 'text',
          label: 'YouTube Kanalı',
          admin: {
            description: "YouTube kanal URL'i.",
          },
        },
      ],
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
    // Her uzmanın tam olarak bir panel hesabı vardır (ADR 0030). Hesap ya uzman
    // kaydından otomatik açılır ya da bağlanan hesap uzmana çekilir.
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const linked =
          relationshipId(data?.user) ?? relationshipId(originalDoc?.user)

        if (linked) {
          // 1 uzman = 1 hesap: aynı hesap ikinci bir uzmana bağlanamaz.
          const clash = await req.payload.find({
            collection: 'experts',
            where: {
              and: [
                { user: { equals: linked } },
                ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
              ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
            req,
          })
          if (clash.docs.length > 0) {
            throw new APIError(
              'Bu hesap başka bir uzmana bağlı. Bir hesap yalnız bir uzmana ait olabilir.',
              400,
            )
          }
          data.user = linked
          await ensureExpertAccountRole(req.payload, linked, req)
          return data
        }

        const name =
          typeof data?.name === 'string' && data.name.trim()
            ? data.name
            : typeof originalDoc?.name === 'string'
              ? originalDoc.name
              : ''
        if (!name.trim()) {
          throw new APIError('Uzmanın adı olmadan panel hesabı açılamaz.', 400)
        }
        data.user = await createExpertAccount(req.payload, name, req)
        return data
      },
    ],
    // Uzman adı/slug/avatarı ürün dosyasındaki hüküm satırlarında görünür: case önbelleği düşsün.
    afterChange: [() => invalidateProductCaseCache()],
    afterDelete: [
      async ({ doc, req }) => {
        invalidateProductCaseCache()
        // Uzman silinince hesabı da gider; admin/editör hesabı asla cascade silinmez.
        const linked = relationshipId(doc?.user)
        if (!linked) return
        const account = await req.payload
          .findByID({
            collection: 'users',
            id: linked,
            depth: 0,
            overrideAccess: true,
            req,
          })
          .catch(() => null)
        if (!account) return
        const role = (account as User | null)?.role
        if (role === 'admin' || role === 'editor') return
        await req.payload
          .delete({ collection: 'users', id: linked, overrideAccess: true, req })
          .catch(() => undefined)
      },
    ],
  },
}
