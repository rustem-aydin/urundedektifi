import { randomBytes } from 'node:crypto'

import { type CollectionConfig } from 'payload'
import type { User } from '@/payload-types'
import { buildPublicProfile } from '@/lib/productContributions'
import {
  allowedGoogleAudiences,
  issueUserToken,
  verifyGoogleIdToken,
  type GoogleProfile,
} from '@/lib/googleAuth'

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
  endpoints: [
    {
      /**
       * Hesabı sil: kullanıcı yalnız kendi hesabını silebilir (jeton zorunlu).
       *
       * Google Play, hesap oluşturan uygulamalarda "hesabımı sil" yolu ister; bu uç hem
       * web `/hesap-sil` sayfasını hem mobil profil ekranını besler. Kişisel veriler
       * (ad, e-posta, bio, avatar, takip listesi) satırla birlikte silinir; kullanıcının
       * açtığı oturumlar da temizlenir. Katkı sağladığı ürün kayıtları silinmez:
       * onlar katalog verisidir, katkıcı bağı kullanıcı silinince boşalır.
       */
      path: '/delete-account',
      method: 'post',
      handler: async (req) => {
        const user = req.user
        if (!user) {
          return Response.json({ error: 'Bu işlem için giriş yapmalısın.' }, { status: 401 })
        }
        try {
          await req.payload.delete({
            collection: 'users',
            id: user.id,
            overrideAccess: true,
          })
        } catch (error) {
          req.payload.logger.error({ err: error }, 'hesap silinemedi')
          return Response.json({ error: 'Hesap silinemedi. Tekrar dene.' }, { status: 500 })
        }
        return Response.json({ ok: true })
      },
    },
    {
      // Herkese açık profil: e-posta ve hesap alanları sızmadan yalnız kamuya açık özet.
      // Web `/profil/[id]` sunucu tarafında bu yardımcıyı doğrudan çağırır; mobil bu uçtan okur.
      path: '/profile/:id',
      method: 'get',
      handler: async (req) => {
        const id = String(req.routeParams?.id ?? '')
        if (!id) return Response.json({ error: 'Kullanıcı gerekli' }, { status: 400 })
        const profile = await buildPublicProfile(req.payload, id)
        if (!profile) return Response.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
        return Response.json(profile)
      },
    },
    {
      // Google ile giriş (web: GIS ID token, mobil: Google Sign-In ID token).
      // Jeton yalnız burada doğrulanır; istemciler Google istemci sırrı taşımaz.
      path: '/google',
      method: 'post',
      handler: async (req) => {
        const audiences = allowedGoogleAudiences()
        if (audiences.length === 0) {
          return Response.json(
            { error: 'Google ile giriş henüz yapılandırılmadı.' },
            { status: 503 },
          )
        }

        let idToken = ''
        try {
          const body = (await req.json?.()) as { idToken?: unknown } | null
          if (body && typeof body.idToken === 'string') idToken = body.idToken.trim()
        } catch {
          // Gövde JSON değil: aşağıdaki eksik-jeton yanıtı döner.
        }
        if (!idToken) {
          return Response.json({ error: 'Google kimlik jetonu gerekli.' }, { status: 400 })
        }

        let profile: GoogleProfile | null
        try {
          profile = await verifyGoogleIdToken(idToken, audiences)
        } catch {
          // İmza/seyirci/veren doğrulanamadı ya da süre doldu.
          return Response.json(
            { error: 'Google oturumu doğrulanamadı. Tekrar dene.' },
            { status: 401 },
          )
        }
        if (!profile) {
          return Response.json(
            { error: 'Google hesabının e-postası doğrulanmamış. Başka bir hesapla dene.' },
            { status: 401 },
          )
        }

        const { payload } = req
        // İlk ölçüt Google'ın kararlı `sub` değeri: e-posta değişse bile hesap bulunur.
        const byGoogle = await payload.find({
          collection: 'users',
          where: { googleId: { equals: profile.sub } },
          limit: 1,
          pagination: false,
          depth: 0,
          overrideAccess: true,
          req,
        })
        let user: User | null = byGoogle.docs[0] ?? null

        if (!user) {
          // Postgres'te e-posta benzersizliği büyük/küçük harfe duyarlıdır; kayıtlar farklı
          // yazımla açılmış olabilir. `like` ile geniş arayıp tam eşleşmeyi kendimiz seçeriz.
          const byEmail = await payload.find({
            collection: 'users',
            where: { email: { like: profile.email } },
            limit: 20,
            depth: 0,
            overrideAccess: true,
            req,
          })
          const existing = byEmail.docs.find(
            (doc) => String(doc.email ?? '').trim().toLowerCase() === profile.email,
          )

          if (existing) {
            if (existing.googleId && existing.googleId !== profile.sub) {
              return Response.json(
                { error: 'Bu e-posta başka bir Google hesabına bağlı.' },
                { status: 409 },
              )
            }
            // E-posta sahipliği artık Google tarafından kanıtlandı. Şifreyle açılmış hesabı
            // bağlarken eski şifre döndürülür: doğrulanmamış e-posta ile önceden açılmış bir
            // "gölge" hesabın şifresi, gerçek sahibin Google girişiyle erişim kazanmasına yol açmasın.
            user = await payload.update({
              collection: 'users',
              id: existing.id,
              data: { googleId: profile.sub, password: randomBytes(32).toString('base64url') },
              overrideAccess: true,
              depth: 0,
              req,
            })
          } else {
            try {
              user = await payload.create({
                collection: 'users',
                data: {
                  name: profile.name,
                  email: profile.email,
                  password: randomBytes(32).toString('base64url'),
                  googleId: profile.sub,
                  role: 'user',
                },
                overrideAccess: true,
                depth: 0,
                req,
              })
            } catch (error) {
              // Aynı Google hesabıyla eşzamanlı iki giriş: kaydı yarışın kazananı belirledi.
              const raced = await payload.find({
                collection: 'users',
                where: { googleId: { equals: profile.sub } },
                limit: 1,
                pagination: false,
                depth: 0,
                overrideAccess: true,
                req,
              })
              if (!raced.docs[0]) throw error
              user = raced.docs[0]
            }
          }
        }

        if (!user) {
          return Response.json({ error: 'Hesap açılamadı. Tekrar dene.' }, { status: 500 })
        }

        const expiration = payload.collections.users.config.auth.tokenExpiration
        const tokenExpiration = typeof expiration === 'number' ? expiration : 604800
        const { token, exp } = await issueUserToken({
          id: user.id,
          email: String(user.email),
          secret: payload.secret,
          tokenExpiration,
        })
        const sessionUser = await payload.findByID({
          collection: 'users',
          id: user.id,
          depth: 2,
          overrideAccess: true,
          req,
        })
        return Response.json({ token, exp, user: sessionUser })
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
        { label: 'Uzman (Kendi yazı, kural ve ölçeğini yönetir)', value: 'expert' },
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
          'Admin tüm yetkilere sahiptir. Editör içerik yönetir. Uzman kendi yazı, kural ve derecelendirmesini yönetir; bu rol Uzmanlar ekranından otomatik atanır. Kullanıcı standart üyedir.',
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
      name: 'googleId',
      type: 'text',
      label: 'Google Hesabı',
      unique: true,
      // Yalnız `/api/users/google` ucu yazar (overrideAccess). Genel REST bu alanı göremez.
      access: {
        create: () => false,
        update: () => false,
      },
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Google ile giriş yapıldığında otomatik doldurulur. Elle değiştirilmez.',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'Kısa Tanıtım',
      maxLength: 280,
      admin: {
        description:
          'Herkese açık profilde görünen kısa tanıtım. Boş bırakılabilir; e-posta ve diğer hesap bilgileri profilde gösterilmez.',
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
