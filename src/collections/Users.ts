import type { CollectionConfig } from 'payload'

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
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    group: 'Sistem',
    description: 'Sistem kullanıcıları. Admin, editör, uzman ve normal üye olabilirler.',
  },
  access: {
    create: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user }, id }) => {
      if (user?.role === 'admin') return true
      return user?.id === id
    },
    read: ({ req: { user } }) => user?.role === 'admin',
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
      access: {
        update: ({ req: { user } }) => user?.role === 'admin',
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
  ],
}
