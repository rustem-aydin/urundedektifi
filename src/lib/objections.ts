/**
 * Ürün görüşü itirazları: doğrulama, e-posta metni ve sınırlar.
 *
 * Uç (`POST /api/objections`) ile form (`ObjectionDialog`) aynı sınırları ve
 * tür listesini kullanır; böylece istemci doğrulaması sunucunun sözleşmesinden
 * sapmaz. E-posta metni burada üretilir: kullanıcı metni HTML'e yazılmadan
 * önce kaçırılır (kayıt panelde düz metin, e-posta HTML).
 */

export const OBJECTION_TYPES = [
  { label: 'Görüş/dayanak itirazı', value: 'gorus_dayanak' },
  { label: 'Ürün verisi hatası', value: 'veri_hatasi' },
  { label: 'Diğer', value: 'diger' },
] as const

export type ObjectionType = (typeof OBJECTION_TYPES)[number]['value']

export const OBJECTION_TYPE_VALUES = OBJECTION_TYPES.map((type) => type.value)

export const OBJECTION_STATUSES = [
  { label: 'Yeni', value: 'new' },
  { label: 'İncelemede', value: 'in_review' },
  { label: 'Çözüldü', value: 'resolved' },
  { label: 'Reddedildi', value: 'rejected' },
] as const

export type ObjectionStatus = (typeof OBJECTION_STATUSES)[number]['value']

export const OBJECTION_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  messageMin: 20,
  messageMax: 4000,
  emailMax: 254,
  metaMax: 500,
  maxUrls: 5,
} as const

export type ObjectionData = {
  name: string
  email: string
  type: ObjectionType
  productBarcode: string
  productName: string
  expertName: string
  ruleName: string
  pageUrl: string
  message: string
}

export type ObjectionValidation =
  | { ok: true; data: ObjectionData }
  | { ok: false; errors: Record<string, string> }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Tam bağlantı belirteci sayılır: `https://www.x` tek URL'dir, iki değil.
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** Mesajdaki bağlantı sayısı: `http(s)://` ve `www.` geçişleri sayılır. */
export function countObjectionUrls(message: string): number {
  return message.match(URL_PATTERN)?.length ?? 0
}

export function typeLabel(type: ObjectionType): string {
  return OBJECTION_TYPES.find((entry) => entry.value === type)?.label ?? type
}

/** Sayfa adresi yalnız göreli yol ya da http(s) olabilir; `javascript:` vb. e-postaya girmez. */
export function safePageUrl(value: unknown): string {
  const candidate = text(value, OBJECTION_LIMITS.metaMax)
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate
  if (/^https?:\/\//i.test(candidate)) return candidate
  return ''
}

export function validateObjection(raw: Record<string, unknown>): ObjectionValidation {
  const errors: Record<string, string> = {}

  const name = text(raw.name, OBJECTION_LIMITS.nameMax + 1)
  if (name.length < OBJECTION_LIMITS.nameMin || name.length > OBJECTION_LIMITS.nameMax) {
    errors.name = `Ad soyad ${OBJECTION_LIMITS.nameMin}–${OBJECTION_LIMITS.nameMax} karakter olmalı.`
  }

  const email = text(raw.email, OBJECTION_LIMITS.emailMax + 1).toLowerCase()
  if (!email || email.length > OBJECTION_LIMITS.emailMax || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Geçerli bir e-posta adresi gir.'
  }

  const typeValue = typeof raw.type === 'string' ? raw.type : ''
  const type = OBJECTION_TYPE_VALUES.includes(typeValue as ObjectionType)
    ? (typeValue as ObjectionType)
    : null
  if (!type) errors.type = 'İtiraz türü seç.'

  const message = text(raw.message, OBJECTION_LIMITS.messageMax + 1)
  if (message.length < OBJECTION_LIMITS.messageMin || message.length > OBJECTION_LIMITS.messageMax) {
    errors.message = `Mesaj ${OBJECTION_LIMITS.messageMin}–${OBJECTION_LIMITS.messageMax} karakter olmalı.`
  } else if (countObjectionUrls(message) > OBJECTION_LIMITS.maxUrls) {
    errors.message = `Mesajda en fazla ${OBJECTION_LIMITS.maxUrls} bağlantı olabilir.`
  }

  if (Object.keys(errors).length > 0 || !type) return { ok: false, errors }

  return {
    ok: true,
    data: {
      name,
      email,
      type,
      productBarcode: text(raw.productBarcode, OBJECTION_LIMITS.metaMax),
      productName: text(raw.productName, OBJECTION_LIMITS.metaMax),
      expertName: text(raw.expertName, OBJECTION_LIMITS.metaMax),
      ruleName: text(raw.ruleName, OBJECTION_LIMITS.metaMax),
      pageUrl: safePageUrl(raw.pageUrl),
      message,
    },
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Konu satırına başlık enjeksiyonu taşımamak için satır sonları tek boşluğa iner. */
function subjectPart(value: string, fallback: string): string {
  const clean = value.replace(/[\r\n]+/g, ' ').trim()
  return clean || fallback
}

export type ObjectionEmail = {
  subject: string
  text: string
  html: string
}

export function buildObjectionEmail(data: ObjectionData): ObjectionEmail {
  const label = typeLabel(data.type)
  const product = subjectPart(data.productName, 'Ürün dosyası')
  const subject = `[İtiraz] ${product} · ${label}`

  const lines = [
    'Yeni itiraz kaydı',
    '',
    `Ad soyad: ${data.name}`,
    `E-posta: ${data.email}`,
    `Tür: ${label}`,
    `Ürün: ${data.productName || '—'}`,
    `Barkod: ${data.productBarcode || '—'}`,
    `Uzman: ${data.expertName || '—'}`,
    `Görüş/dayanak: ${data.ruleName || '—'}`,
    `Sayfa: ${data.pageUrl || '—'}`,
    '',
    'Mesaj:',
    data.message,
  ]

  const row = (labelText: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${escapeHtml(
      labelText,
    )}</td><td style="padding:4px 0">${escapeHtml(value || '—')}</td></tr>`

  const pageHref = /^https?:\/\//i.test(data.pageUrl) ? data.pageUrl : ''
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">',
    `<h2 style="font-size:16px;margin:0 0 12px">${escapeHtml(subject)}</h2>`,
    '<table style="border-collapse:collapse;margin:0 0 12px">',
    row('Ad soyad', data.name),
    row('E-posta', data.email),
    row('Tür', label),
    row('Ürün', data.productName),
    row('Barkod', data.productBarcode),
    row('Uzman', data.expertName),
    row('Görüş/dayanak', data.ruleName),
    pageHref
      ? `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">Sayfa</td><td style="padding:4px 0"><a href="${escapeHtml(
          pageHref,
        )}">${escapeHtml(data.pageUrl)}</a></td></tr>`
      : row('Sayfa', data.pageUrl),
    '</table>',
    '<p style="margin:0 0 4px;color:#666">Mesaj</p>',
    `<p style="margin:0;white-space:pre-wrap">${escapeHtml(data.message)}</p>`,
    '</div>',
  ].join('')

  return { subject, text: lines.join('\n'), html }
}
