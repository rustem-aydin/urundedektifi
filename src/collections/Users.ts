import type { CollectionConfig } from 'payload'
import type { User } from '@/payload-types'

const isAdmin = (user: User | null) => user?.role === 'admin'

/** Panel erişimi olan roller: tüketici (`user`) hesabı admin paneline giremez. */
const PANEL_ROLES: User['role'][] = ['admin', 'editor', 'expert']

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Kullanıcı',
    plural: 'Kullanıcılar',
  },
  auth: {
    cookies: {
      sameSite: 'Lax',
      secure: false,
    },
    // Tüketici uygulaması oturumu: kısa süreli jeton sürekli yeniden giriş demek.
    tokenExpiration: 604800, // 7 gün
    maxLoginAttempts: 5,
    lockTime: 600000, // 10 dk
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    group: 'Sistem',
    description:
      'Sistem kullanıcıları. Admin, editör, uzman ve normal üye olabilirler. Normal üyeler yalnızca site ve mobil uygulamada oturum açar, panele giremez.',
  },
  access: {
    // Panel erişimi (Payload: access.admin). Verilmezse her authenticated kullanıcı panele girer.
    admin: ({ req: { user } }) => PANEL_ROLES.includes((user as User | null)?.role ?? 'user'),
    // Açık kayıt: tüketici hesabı. Rol yükseltmesi `role` alanının alan-seviyesi
    // erişimiyle engellenir: admin olmayan istekte gönderilen rol yok sayılır.
    create: () => true,
    delete: ({ req: { user } }) => isAdmin(user as User | null),
    update: ({ req: { user }, id }) => {
      if (isAdmin(user as User | null)) return true
      return user?.id === id
    },
    // Kendi dokümanını okuyabilir (oturum + takip listesi); başkasını yalnız admin.
    read: ({ req: { user } }) => {
      const current = user as User | null
      if (!current) return false
      if (isAdmin(current)) return true
      return { id: { equals: current.id } }
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Ad Soyad',
      required: true,
      admin: {
        description: 'Kullanıcının gerçek adı ve soyadı. Sitede bu isim görüntülenir.',
      },
    },
    {
      name: 'role',
      type: 'select',
      label: 'Yetki Rolü',
      required: true,
      defaultValue: 'user',
      options: [
        { label: 'Admin (Tüm yetkiler)', value: 'admin' },
        { label: 'Editör (İçerik yönetimi)', value: 'editor' },
        { label: 'Uzman (Kural ve yorum yazar)', value: 'expert' },
        { label: 'Kullanıcı (Standart üye)', value: 'user' },
      ],
      // Kayıtta da güncellemede de rolü yalnız admin belirler (yetki yükseltme kilidi).
      access: {
        create: ({ req: { user } }) => (user as User | null)?.role === 'admin',
        update: ({ req: { user } }) => (user as User | null)?.role === 'admin',
      },
      admin: {
        position: 'sidebar',
        description:
          'Admin tüm yetkilere sahiptir. Editör içerik yönetir. Uzman kural/yorum yazar. Kullanıcı standart üyedir.',
      },
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      label: 'Profil Fotoğrafı',
      admin: {
        description: 'Kare formatında, en az 200x200 piksel önerilir.',
      },
    },
    {
      name: 'following',
      type: 'relationship',
      relationTo: 'experts',
      hasMany: true,
      index: true,
      label: 'Takip Edilen Uzmanlar',
      admin: {
        description:
          'Kullanıcının takip ettiği uzmanlar. Anasayfadaki yazı rayını ve uzman profillerindeki takip durumunu besler.',
      },
    },
  ],
}
