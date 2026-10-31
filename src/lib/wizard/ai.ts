import { z } from 'zod'

import { API_BASE } from './api'

/**
 * OpenAI uyumlu vision istemcisi (ADR 0008, web uyarlaması).
 * Tek çağrı + katı JSON şeması; şema tutmazsa tek onarım turu. Sağlayıcı `json_schema`
 * desteklemiyorsa `json_object` ile aynı şema prompt içinde gönderilir.
 *
 * Sağlayıcı ayarı tek merkezde (Payload global `ai-settings`): istek doğrudan sağlayıcıya
 * değil, sunucudaki `/api/globals/ai-settings/chat` vekiline gider. API anahtarı tarayıcıya hiç inmez.
 */

const CHAT_PROXY_URL = `${API_BASE}/globals/ai-settings/chat`

const ANALYSIS_TIMEOUT_MS = 120_000
const MODEL_TIMEOUT_MS = 20_000

export const PHOTO_ROLES = ['front', 'ingredients', 'nutrition', 'recycling', 'additional', 'unknown'] as const
export type PhotoRole = (typeof PHOTO_ROLES)[number]

/** Backend'in `products.labels` seçenekleri (Products.ts) — AI yalnız bu değerleri döndürür. */
export const LABEL_VALUES = [
  'vegan',
  'vegetarian',
  'gluten-free',
  'lactose-free',
  'organic',
  'halal-certified',
  'kosher',
  'non-gmo',
  'natural',
  'no-additives',
  'sugar-free',
  'ce-mark',
  'rohs',
  'energy-star',
  'cruelty-free',
  'vegan-certified-cosmetics',
  'bpa-free',
  'paraben-free',
  'sulfate-free',
  'recyclable',
  'disposable',
  'reusable',
  'oeko-tex',
  'gots',
  'fair-trade',
  'fsc',
  'energy-a-plus-plus-plus',
  'energy-a-plus-plus',
  'energy-a-plus',
  'energy-a',
  'energy-b',
] as const

export const extractionSchema = z.object({
  barcode: z.string().nullable(),
  name: z.string().nullable(),
  brandName: z.string().nullable(),
  categoryName: z.string().nullable(),
  manufacturer: z.string().nullable(),
  countryName: z.string().nullable(),
  size: z.string().nullable(),
  packaging: z.string().nullable(),
  description: z.string().nullable(),
  usage: z.string().nullable(),
  storage: z.string().nullable(),
  nutriscore: z.enum(['a', 'b', 'c', 'd', 'e']).nullable(),
  labels: z.array(z.enum(LABEL_VALUES)),
  ingredients: z.array(
    z.object({
      name: z.string(),
      /** Etikette yüzde yazıyorsa; yoksa null (alan opsiyonel). */
      percent: z.number().nullable(),
    }),
  ),
  additives: z.array(z.object({ code: z.string().nullable(), name: z.string().nullable() })),
  allergens: z.array(z.string()),
  nutrition: z
    .object({
      per: z.enum(['100g', '100ml', 'serving']).nullable(),
      items: z.array(z.object({ name: z.string(), amount: z.number(), unit: z.string() })),
    })
    .nullable(),
  warnings: z.array(z.object({ severity: z.enum(['low', 'medium', 'high']), text: z.string() })),
  specifications: z.array(
    z.object({ key: z.string(), value: z.string(), unit: z.string().nullable() }),
  ),
  /** Her fotoğrafın hangi role ait olduğu (fotoğraf sırası = index). */
  photoRoles: z.array(z.object({ index: z.number().int(), role: z.enum(PHOTO_ROLES) })),
  /** Okunamayan alanlar için "şu fotoğrafı gönder" talepleri. */
  requests: z.array(
    z.object({
      need: z.string(),
      hint: z.string(),
      fields: z.array(z.string()),
    }),
  ),
  confidence: z.array(z.object({ field: z.string(), level: z.enum(['high', 'medium', 'low']) })),
  complete: z.boolean(),
})

export type Extraction = z.infer<typeof extractionSchema>

export type AnalysisUsage = {
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

export type AnalyzeInput = {
  /** Kullanıcının Payload jetonu: vekil uç ürün ekleyen roller için açıktır. */
  token: string
  /** Fotoğraflar, gönderim sırasıyla; `index` photoRoles ve requests için kimlik. */
  images: { index: number; base64: string }[]
  /** Önceki turun çıktısı: aynı alanlar 0'dan okunmasın. */
  previous: Extraction | null
  /** Kullanıcının yeni eklediği fotoğraflarla karşılanan talepler. */
  hints: string[]
}

export type AnalyzeResult = {
  data: Extraction
  usage: AnalysisUsage | null
  model: string
  repaired: boolean
  /** Sağlayıcı json_schema'yı reddetti, json_object ile devam edildi. */
  degraded: boolean
}

export type AiErrorKind = 'auth' | 'request' | 'network' | 'format'

export class AiError extends Error {
  kind: AiErrorKind
  status: number

  constructor(kind: AiErrorKind, status: number, message: string) {
    super(message)
    this.name = 'AiError'
    this.kind = kind
    this.status = status
  }
}

/* ---------------------------- JSON şeması ---------------------------- */

/** OpenAI strict modu `additionalProperties:false` ve tüm alanların `required` olmasını ister. */
function closedSchema(schema: z.ZodType): Record<string, unknown> {
  const generated = z.toJSONSchema(schema) as Record<string, unknown>
  const { $schema: _ignored, ...rest } = generated
  return rest
}

export const EXTRACTION_JSON_SCHEMA = closedSchema(extractionSchema)

/* ------------------------------ Mesajlar ----------------------------- */

const SYSTEM_PROMPT = `Sen bir ürün etiketi okuyucusun. Kullanıcı Türkiye'de satılan bir ürünün paket fotoğraflarını gönderiyor.
Görevin: yalnızca fotoğraflarda GÖRÜNEN bilgiyi yapılandırılmış JSON'a çevirmek.

Kurallar:
1. Uydurma. Fotoğrafta okunmayan alan null olur. Tahmin ettiysen confidence listesinde "low" işaretle.
2. İçindekiler listesini etiketteki sırayla, tek tek ayır ("şeker, buğday unu, palm yağı" → 3 satır). Yüzde yalnızca etikette yazıyorsa doldur, yoksa null.
3. Katkı maddelerini E-kodu ile ayır (E322, E621). Kod yazmıyorsa code null, adı name'e yaz.
4. Alerjenleri (gluten, süt, yumurta, soya, fıstık, sert kabuklu yemişler, balık, kabuklular, kereviz, hardal, susam, sülfit, lupin, yumuşakça) etikette vurgulanmışsa listele.
5. Besin değerleri tablosunu "100g", "100ml" veya "serving" ölçüsüyle, her satırı ad + miktar + birim olarak ver.
6. Etiket/sertifika listesi için YALNIZ şu değerleri kullan: ${LABEL_VALUES.join(', ')}. Emin değilsen listeye ekleme.
7. photoRoles: her fotoğrafın index'ini (0'dan başlar) ve rolünü yaz: front (ön yüz), ingredients (içindekiler), nutrition (besin tablosu), recycling (geri dönüşüm), additional (diğer), unknown.
8. Okunamayan, kesik, bulanık veya eksik her bilgi için requests listesine bir talep ekle: need (ne eksik), hint (kullanıcı hangi açıdan, ne kadar yakın çekmeli), fields (hangi alanlar). Eksik yoksa requests boş, complete true.
9. Dil Türkçe. Marka ve kategori adlarını etikette yazdığı gibi bırak (eşleme sonra yapılacak).`

function buildUserText(input: AnalyzeInput): string {
  const parts: string[] = []
  parts.push(
    `Fotoğraf sayısı: ${input.images.length}. Fotoğraf index'leri: ${input.images.map((image) => image.index).join(', ')}.`,
  )
  if (input.previous) {
    parts.push(
      `Önceki turdan çıkarılan bilgiler (yeni fotoğraflarla GÜNCELLE, elinde olanı koru):\n${JSON.stringify(input.previous)}`,
    )
  } else {
    parts.push('Bu ilk analiz turu.')
  }
  if (input.hints.length) {
    parts.push(`Bu turda karşılanan talepler: ${input.hints.join(' | ')}`)
  }
  parts.push('Yanıtı yalnızca şemaya uygun JSON olarak dön.')
  return parts.join('\n\n')
}

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] }

type ChatResponse = {
  model?: string
  choices?: { message?: { content?: string | null } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

/* ---------------------------- HTTP katmanı --------------------------- */

async function postChat(
  input: AnalyzeInput,
  messages: ChatMessage[],
  responseFormat: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ payload: ChatResponse; degraded: boolean }> {
  // Modeli sunucu koyar: istemci model adı ya da anahtar göndermez.
  const body = {
    temperature: 0.1,
    messages,
    response_format: responseFormat,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetch(CHAT_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${input.token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    if (controller.signal.aborted) {
      throw new AiError(
        'network',
        0,
        `Analiz ${Math.round(timeoutMs / 1000)} saniyede bitmedi. Fotoğraf sayısını azaltıp tekrar dene.`,
      )
    }
    throw new AiError('network', 0, 'Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.')
  } finally {
    clearTimeout(timer)
  }

  if (response.status === 401 || response.status === 403) {
    throw new AiError('auth', response.status, 'Oturumun sona ermiş ya da bu işlem için yetkin yok.')
  }
  if (response.status === 400 && responseFormat.type === 'json_schema') {
    return { payload: { choices: [] }, degraded: true }
  }
  if (!response.ok) {
    const detail = await bodyError(response)
    throw new AiError(
      'request',
      response.status,
      detail || `Sağlayıcı hata verdi (kod ${response.status}). Tekrar dene.`,
    )
  }

  return { payload: (await response.json()) as ChatResponse, degraded: false }
}

/** Vekil ve sağlayıcı hata gövdelerinde tek anlaşılır cümle arar (`{ error }` / `{ message }`). */
async function bodyError(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  if (!text.trim()) return ''
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object') {
      if ('error' in parsed) {
        const error = parsed.error
        if (typeof error === 'string' && error.trim()) return error.trim()
        if (error && typeof error === 'object' && 'message' in error) {
          const message = (error as { message?: unknown }).message
          if (typeof message === 'string' && message.trim()) return message.trim()
        }
      }
      if ('message' in parsed && typeof (parsed as { message?: unknown }).message === 'string') {
        return String((parsed as { message: string }).message).trim()
      }
    }
  } catch {
    // JSON değil: ham metnin ilk satırı yeter.
  }
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > 200 ? `${flat.slice(0, 200)}…` : flat
}

function contentOf(payload: ChatResponse): string {
  const content = payload.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new AiError('format', 200, 'Sağlayıcı boş yanıt döndü. Tekrar dene.')
  }
  return content
}

function usageOf(payload: ChatResponse): AnalysisUsage | null {
  if (!payload.usage) return null
  return {
    promptTokens: payload.usage.prompt_tokens ?? null,
    completionTokens: payload.usage.completion_tokens ?? null,
    totalTokens: payload.usage.total_tokens ?? null,
  }
}

function parseJson(text: string): unknown {
  // Bazı gateway'ler JSON'u ```json bloğuna sarar.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fenced ? fenced[1] : text).trim()
  return JSON.parse(candidate)
}

/** JSON çözülemezse `null` döner: onarım turuna düşer, çağrı kesilmez. */
function safeJson(text: string): unknown {
  try {
    return parseJson(text)
  } catch {
    return null
  }
}

/* ------------------------------- API -------------------------------- */

export async function analyzeProduct(input: AnalyzeInput): Promise<AnalyzeResult> {
  const content: ContentPart[] = [{ type: 'text', text: buildUserText(input) }]
  for (const image of input.images) {
    content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image.base64}` } })
  }
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content },
  ]

  let degraded = false
  let payload: ChatResponse
  const strict = await postChat(
    input,
    messages,
    {
      type: 'json_schema',
      json_schema: { name: 'product_extraction', strict: true, schema: EXTRACTION_JSON_SCHEMA },
    },
    ANALYSIS_TIMEOUT_MS,
  )
  if (strict.degraded) {
    degraded = true
    const fallback = await postChat(
      input,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${buildUserText(input)}\n\nJSON şeması:\n${JSON.stringify(EXTRACTION_JSON_SCHEMA)}`,
            },
            ...content.slice(1),
          ],
        },
      ],
      { type: 'json_object' },
      ANALYSIS_TIMEOUT_MS,
    )
    payload = fallback.payload
  } else {
    payload = strict.payload
  }

  let raw = contentOf(payload)
  let parsed = extractionSchema.safeParse(safeJson(raw))
  let repaired = false

  if (!parsed.success) {
    repaired = true
    const issues = parsed.error.issues
      .slice(0, 12)
      .map((issue) => `${issue.path.join('.') || 'kök'}: ${issue.message}`)
      .join('\n')
    const repairPayload = await postChat(
      input,
      [
        ...messages,
        { role: 'assistant', content: raw },
        {
          role: 'user',
          content: `JSON şemaya uymuyor. Hatalar:\n${issues}\nYalnızca düzeltilmiş, geçerli JSON döndür.`,
        },
      ],
      degraded
        ? { type: 'json_object' }
        : {
            type: 'json_schema',
            json_schema: { name: 'product_extraction', strict: true, schema: EXTRACTION_JSON_SCHEMA },
          },
      ANALYSIS_TIMEOUT_MS,
    )
    if (repairPayload.degraded) {
      throw new AiError('format', 200, 'Sağlayıcı şemalı yanıtı desteklemiyor. Tekrar dene.')
    }
    payload = repairPayload.payload
    raw = contentOf(payload)
    parsed = extractionSchema.safeParse(safeJson(raw))
  }

  if (!parsed.success) {
    throw new AiError('format', 200, 'Yapay zekâ yanıtı beklenen biçimde gelmedi. Tekrar dene.')
  }

  return {
    data: parsed.data,
    usage: usageOf(payload),
    model: typeof payload.model === 'string' ? payload.model : 'bilinmiyor',
    repaired,
    degraded,
  }
}
