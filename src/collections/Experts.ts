import type { CollectionConfig } from 'payload'
import { slugify } from '@/lib/slugify'
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
        description:
          'URL\'de kullanılacak kısa ad. /uzmanlar/ahmet-hocam gibi. Otomatik üretilir.',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      label: 'Sistem Kullanıcı Hesabı',
      admin: {
        description:
          'Uzmanın admin panele giriş yapacağı kullanıcı hesabı (opsiyonel). Boş bırakılırsa sadece admin tarafından yönetilir.',
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
            description: 'Sertifika veya belgenin tam adı (Örn: "Helal Gıda Denetçisi Sertifikası").',
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
            description: 'Twitter profil URL\'i.',
          },
        },
        {
          name: 'instagram',
          type: 'text',
          label: 'Instagram Hesabı',
          admin: {
            description: 'Instagram profil URL\'i.',
          },
        },
        {
          name: 'linkedin',
          type: 'text',
          label: 'LinkedIn Profili',
          admin: {
            description: 'LinkedIn profil URL\'i.',
          },
        },
        {
          name: 'youtube',
          type: 'text',
          label: 'YouTube Kanalı',
          admin: {
            description: 'YouTube kanal URL\'i.',
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
  },
}
