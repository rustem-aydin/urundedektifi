import type { CollectionConfig, PayloadRequest } from 'payload'

import {
  OBJECTION_STATUSES,
  OBJECTION_TYPES,
  buildObjectionEmail,
  validateObjection,
} from '@/lib/objections'
import { consumeObjectionAttempt } from '@/lib/objectionRateLimit'
import type { User } from '@/payload-types'

/**
 * Ürün görüşü itirazları (marka sahibi / kullanıcı).
 *
 * Kayıt yalnız `POST /api/objections` ucundan açılır: uç gövdeyi doğrular,
 * honeypot ve IP başına saatlik sınırı uygular, kaydı `overrideAccess` ile
 * yazar, ardından sahibe e-posta gönderir. Koleksiyonun kendi REST create
 * kapısı kapalıdır; panelde admin okur, durumu yalnız admin değiştirir.
 */

const isAdmin = (user: User | null | undefined) => user?.role === 'admin'

function clientIp(headers: Headers): string {
  const cf = headers.get('cf-connecting-ip')
  if (cf?.trim()) return cf.trim()

  const forwarded = headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]
  if (first?.trim()) return first.trim()

  return headers.get('x-real-ip')?.trim() || 'unknown'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const Objections: CollectionConfig = {
  slug: 'objections',
  labels: {
    singular: 'İtiraz',
    plural: 'İtirazlar',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'productName', 'createdAt', 'status'],
    group: 'Ürünler',
    description:
      'Ürün dosyalarındaki uzman görüşlerine yapılan itirazlar. Kayıt yalnız ürün sayfasındaki formdan açılır; durum ve e-posta sonucu panelde izlenir.',
  },
  access: {
    read: ({ req: { user } }) => isAdmin(user as User | null),
    // Tek yazma kapısı `POST /api/objections` (overrideAccess).
    create: () => false,
    update: ({ req: { user } }) => isAdmin(user as User | null),
    delete: ({ req: { user } }) => isAdmin(user as User | null),
  },
  endpoints: [
    {
      // Koleksiyonun kökü: `/api/objections` (Payload path '/' olarak eşler).
      path: '/',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        let body: unknown = null
        try {
          body = await req.json?.()
        } catch {
          body = null
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return Response.json(
            { ok: false, error: 'Geçersiz istek gövdesi.' },
            { status: 400 },
          )
        }

        const raw = body as Record<string, unknown>
        // Honeypot: bot doldurur. Sessizce başarı dön; kayıt ve e-posta yok.
        if (typeof raw.website === 'string' && raw.website.trim() !== '') {
          return Response.json({ ok: true, emailSent: true })
        }

        const ip = clientIp(req.headers)
        const rate = consumeObjectionAttempt(ip)
        if (!rate.allowed) {
          return Response.json(
            {
              ok: false,
              error: 'Aynı adresten saatte en fazla 5 itiraz gönderilebilir.',
            },
            {
              status: 429,
              headers: { 'retry-after': String(rate.retryAfterSeconds) },
            },
          )
        }

        const validation = validateObjection(raw)
        if (!validation.ok) {
          return Response.json(
            { ok: false, error: 'Lütfen işaretli alanları düzelt.', errors: validation.errors },
            { status: 400 },
          )
        }

        const data = validation.data
        let created: { id: string | number }
        try {
          created = await req.payload.create({
            collection: 'objections',
            overrideAccess: true,
            data: {
              ...data,
              ip,
              userAgent: (req.headers.get('user-agent') ?? '').slice(0, 500),
              status: 'new',
              emailSent: false,
            },
          })
        } catch (error) {
          req.payload.logger.error({ err: error, msg: 'İtiraz kaydı oluşturulamadı' })
          return Response.json(
            { ok: false, error: 'İtiraz kaydedilemedi. Lütfen tekrar dene.' },
            { status: 500 },
          )
        }

        const recordEmailFailure = async (message: string) => {
          try {
            await req.payload.update({
              collection: 'objections',
              id: created.id,
              overrideAccess: true,
              data: { emailSent: false, emailError: message.slice(0, 500) },
            })
          } catch (updateError) {
            req.payload.logger.error({
              err: updateError,
              msg: 'İtiraz e-posta hatası kayda yazılamadı',
            })
          }
        }

        // Adaptör yokken Payload `sendEmail` çağrısını sessizce konsola yazar ve
        // başarı döner; "gönderildi" dememek için burada açıkça başarısız sayılır.
        if (!process.env.SMTP_HOST) {
          await recordEmailFailure('SMTP yapılandırılmadı (SMTP_HOST boş).')
          return Response.json({ ok: true, emailSent: false })
        }

        try {
          const mail = buildObjectionEmail(data)
          await req.payload.sendEmail({
            to: process.env.OBJECTION_EMAIL?.trim() || 'rustemaydinnn@gmail.com',
            replyTo: data.email,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
          })
          await req.payload.update({
            collection: 'objections',
            id: created.id,
            overrideAccess: true,
            data: { emailSent: true, emailError: '' },
          })
          return Response.json({ ok: true, emailSent: true })
        } catch (error) {
          // Kayıt kaybolmaz: panelde görünür, `emailError` üzerinden izlenir.
          const message = errorMessage(error)
          req.payload.logger.error({ err: error, msg: 'İtiraz e-postası gönderilemedi' })
          await recordEmailFailure(message)
          return Response.json({ ok: true, emailSent: false })
        }
      },
    },
  ],
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      minLength: 2,
      maxLength: 80,
      label: 'Ad soyad',
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      label: 'E-posta',
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      index: true,
      label: 'İtiraz türü',
      options: OBJECTION_TYPES.map((type) => ({ label: type.label, value: type.value })),
    },
    {
      name: 'productBarcode',
      type: 'text',
      label: 'Ürün barkodu',
      admin: { readOnly: true },
    },
    {
      name: 'productName',
      type: 'text',
      label: 'Ürün adı',
      admin: { readOnly: true },
    },
    {
      name: 'expertName',
      type: 'text',
      label: 'Uzman',
      admin: { readOnly: true },
    },
    {
      name: 'ruleName',
      type: 'text',
      label: 'Görüş/dayanak',
      admin: { readOnly: true },
    },
    {
      name: 'pageUrl',
      type: 'text',
      label: 'Sayfa URL',
      admin: { readOnly: true },
    },
    {
      name: 'message',
      type: 'textarea',
      required: true,
      minLength: 20,
      maxLength: 4000,
      label: 'Mesaj',
      admin: { readOnly: true },
    },
    {
      name: 'ip',
      type: 'text',
      label: 'IP',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'userAgent',
      type: 'text',
      label: 'User-Agent',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      label: 'Durum',
      options: OBJECTION_STATUSES.map((status) => ({ label: status.label, value: status.value })),
      access: {
        // Durumu yalnız admin değiştirir; uç oluştururken `new` yazar.
        update: ({ req: { user } }) => isAdmin(user as User | null),
      },
      admin: {
        description: 'Yalnız yönetici değiştirebilir.',
      },
    },
    {
      name: 'emailSent',
      type: 'checkbox',
      defaultValue: false,
      label: 'E-posta gönderildi',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'emailError',
      type: 'text',
      label: 'E-posta hatası',
      admin: { readOnly: true, position: 'sidebar' },
      access: {
        read: ({ req: { user } }) => isAdmin(user as User | null),
      },
    },
  ],
}
