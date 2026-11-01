import sharp from 'sharp'

import { providerChatEndpoint } from '@/globals/AiSettings'
import { AiError, analyzeProduct, type AnalyzeInput } from '@/lib/wizard/ai'
import type { Extraction } from '@/lib/wizard/ai'
import type { Payload } from 'payload'

/**
 * Katkı arka plan analizi (ADR 0028).
 *
 * Ürün katkı olarak açıldığı anda YZ etiket okuması sunucuda başlar; inceleme ekranı açıldığında
 * alanlar hazır gelir. Tarayıcıdaki analiz yolu (oturum jetonuyla vekil) aynen durur; buradaki
 * iş aynı prompt/şemayı kullanır, yalnız sağlayıcıya doğrudan gider.
 */

export const AI_STATUSES = ['none', 'running', 'done', 'failed'] as const
export type AiStatus = (typeof AI_STATUSES)[number]

export type StoredAnalysis = {
  extraction?: Extraction
  usage?: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } | null
  model?: string
  repaired?: boolean
  degraded?: boolean
  analyzedAt?: string
  photoCount?: number
  /** Son deneme başarısızsa nedeni; önceki `extraction` korunur. */
  error?: string
  failedAt?: string
}

type MediaRef = { id?: number | string; url?: string | null; mimeType?: string | null }

/** Ürünün fotoğrafları, inceleme ekranıyla aynı sırada: ön yüz → içindekiler → besin → … */
function photoRefsOf(doc: Record<string, unknown>): MediaRef[] {
  const asRef = (value: unknown): MediaRef | null => {
    if (!value || typeof value !== 'object') return null
    const media = value as MediaRef
    return media.url ? media : null
  }
  const rows: (MediaRef | null)[] = [
    asRef(doc.frontImage),
    asRef(doc.ingredientsImage),
    asRef(doc.nutritionImage),
    asRef(doc.recyclingImage),
  ]
  for (const row of (doc.additionalImages as { image?: unknown }[] | null) ?? []) {
    rows.push(asRef(row?.image))
  }
  return rows.filter((row): row is MediaRef => row !== null)
}

/** Medya adresi göreli olabilir (yerel disk); sunucunun kendisine mutlak adresle gidilir. */
function absoluteMediaUrl(payload: Payload, url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const configured = (payload.config.serverURL ?? '').trim().replace(/\/+$/, '')
  const base = configured || `http://127.0.0.1:${process.env.PORT ?? 3000}`
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

/** Sağlayıcıya gönderilecek gövde: uzun kenar 1600 px, JPEG — istemciyle aynı sınır. */
async function toBase64Jpeg(bytes: ArrayBuffer): Promise<string> {
  const jpeg = await sharp(Buffer.from(bytes))
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer()
  return jpeg.toString('base64')
}

async function readProduct(payload: Payload, productId: string) {
  return payload.findByID({
    collection: 'products',
    id: productId,
    depth: 1,
    overrideAccess: true,
    disableErrors: true,
  })
}

async function writeStatus(
  payload: Payload,
  productId: string,
  status: AiStatus,
  analysis: StoredAnalysis,
): Promise<void> {
  await payload.update({
    collection: 'products',
    id: productId,
    data: { aiStatus: status, aiAnalysis: analysis },
    overrideAccess: true,
    depth: 0,
  })
}

/**
 * Analizi çalıştırır ve sonucu ürüne yazar. Çağıran beklemek zorunda değildir; hata fırlatmaz,
 * ürünün `aiStatus` alanına yazar (inceleme ekranı oradan okur).
 */
export async function runProductAnalysis({
  payload,
  productId,
  force = false,
}: {
  payload: Payload
  productId: string
  force?: boolean
}): Promise<AiStatus> {
  const log = payload.logger
  try {
    const doc = (await readProduct(payload, productId)) as unknown as Record<string, unknown> | null
    if (!doc) {
      log.warn(`Ürün analizi: #${productId} bulunamadı.`)
      return 'failed'
    }
    const current = (doc.aiAnalysis as StoredAnalysis | null) ?? {}
    if (!force && doc.aiStatus === 'running') return 'running'

    const photos = photoRefsOf(doc)
    if (!photos.length) {
      await writeStatus(payload, productId, 'failed', {
        ...current,
        error: 'Üründe analiz edilecek fotoğraf yok.',
        failedAt: new Date().toISOString(),
      })
      return 'failed'
    }

    const endpoint = await providerChatEndpoint(payload)
    if (!endpoint) {
      await writeStatus(payload, productId, 'failed', {
        ...current,
        error: 'Yapay zekâ sağlayıcısı ayarlanmamış.',
        failedAt: new Date().toISOString(),
      })
      return 'failed'
    }

    await writeStatus(payload, productId, 'running', current)

    const images: AnalyzeInput['images'] = []
    for (const [index, photo] of photos.entries()) {
      const url = absoluteMediaUrl(payload, String(photo.url))
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) throw new Error(`Fotoğraf ${index + 1} okunamadı (${response.status}).`)
      images.push({ index, base64: await toBase64Jpeg(await response.arrayBuffer()) })
    }

    const result = await analyzeProduct({ token: '', images, previous: null, hints: [] }, endpoint)
    const stored: StoredAnalysis = {
      extraction: result.data,
      usage: result.usage,
      model: result.model,
      repaired: result.repaired,
      degraded: result.degraded,
      analyzedAt: new Date().toISOString(),
      photoCount: images.length,
    }
    await writeStatus(payload, productId, 'done', stored)
    return 'done'
  } catch (error) {
    const message =
      error instanceof AiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Bilinmeyen hata.'
    log.error(`Ürün analizi #${productId} başarısız: ${message}`)
    try {
      const doc = (await readProduct(payload, productId)) as unknown as Record<string, unknown> | null
      const current = (doc?.aiAnalysis as StoredAnalysis | null) ?? {}
      await writeStatus(payload, productId, 'failed', {
        ...current,
        error: message,
        failedAt: new Date().toISOString(),
      })
    } catch {
      // Ürün silinmiş olabilir: durum yazımı da başarısız, yapacak bir şey yok.
    }
    return 'failed'
  }
}

/**
 * Ateşle-ve-unut: katkı uç noktası yanıtı beklemez. Node süreci istekten sonra da yaşadığı için
 * analiz arka planda tamamlanır; sonuç ürünün `aiAnalysis` alanına yazılır.
 */
export function queueProductAnalysis(payload: Payload, productId: string): void {
  void runProductAnalysis({ payload, productId }).catch((error: unknown) => {
    payload.logger.error(
      `Ürün analizi kuyruğa alınamadı #${productId}: ${error instanceof Error ? error.message : String(error)}`,
    )
  })
}
