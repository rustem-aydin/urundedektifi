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

/**
 * Yanıt akış halinde okunur (SSE). Sağlayıcı düşünen (reasoning) model olduğunda tek parça
 * 100 saniyeyi aşabiliyor; araya giren vekil/proxy boş bağlantıyı kesiyordu. Bu yüzden iki
 * ayrı sınır var: parçalar arası sessizlik ve toplam süre.
 */
const ANALYSIS_STALL_MS = 60_000
const ANALYSIS_TOTAL_MS = 240_000

/** Sağlayıcıya özel ipucu: düşünme (reasoning) kapalı — analiz süresini ~4 kat kısaltır. */
const PROVIDER_HINTS: Record<string, unknown> = { chat_template_kwargs: { enable_thinking: false } }

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

type ChatRequest = {
  messages: ChatMessage[]
  responseFormat: Record<string, unknown>
  /** Sağlayıcıya özel alanlar (ör. düşünmeyi kapatma); 400 alınırsa bir kez çıkarılıp denenir. */
  hints?: Record<string, unknown>
}

/** Tek parçanın gelmesini beklerken sınırı aşarsa akışı keser (`null` = süre doldu). */
function readWithDeadline(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  ms: number,
): Promise<ReadableStreamReadResult<Uint8Array> | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms)
  })
  return Promise.race([reader.read(), timeout]).finally(() => clearTimeout(timer))
}

/** SSE gövdesini `ChatResponse`a indirger: parça parça birleşen içerik + son kullanım bilgisi. */
async function readChatStream(
  response: Response,
  controller: AbortController,
  what: string,
): Promise<ChatResponse> {
  const reader = response.body?.getReader()
  if (!reader) throw new AiError('format', 200, 'Sağlayıcı boş yanıt döndü. Tekrar dene.')

  const decoder = new TextDecoder()
  const deadline = Date.now() + ANALYSIS_TOTAL_MS
  let buffer = ''
  let content = ''
  let model: string | undefined
  let usage: ChatResponse['usage']

  const consume = (line: string) => {
    if (!line.startsWith('data:')) return
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') return
    let event: {
      model?: string
      choices?: { delta?: { content?: string | null } }[]
      usage?: ChatResponse['usage']
      error?: { message?: string }
    }
    try {
      event = JSON.parse(data)
    } catch {
      return
    }
    if (event.error?.message) throw new AiError('request', 200, event.error.message)
    if (typeof event.model === 'string') model = event.model
    const delta = event.choices?.[0]?.delta?.content
    if (typeof delta === 'string') content += delta
    if (event.usage) usage = event.usage
  }

  try {
    for (;;) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        controller.abort()
        throw new AiError(
          'network',
          0,
          `${what} ${Math.round(ANALYSIS_TOTAL_MS / 1000)} saniyede bitmedi. Fotoğraf sayısını azaltıp tekrar dene.`,
        )
      }
      const chunk = await readWithDeadline(reader, Math.min(remaining, ANALYSIS_STALL_MS))
      if (!chunk) {
        controller.abort()
        throw new AiError(
          'network',
          0,
          `${what} ${Math.round(ANALYSIS_STALL_MS / 1000)} saniye boyunca yanıt vermedi. Fotoğraf sayısını azaltıp tekrar dene.`,
        )
      }
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })
      let cut = buffer.indexOf('\n')
      while (cut >= 0) {
        consume(buffer.slice(0, cut).trim())
        buffer = buffer.slice(cut + 1)
        cut = buffer.indexOf('\n')
      }
    }
    if (buffer.trim()) consume(buffer.trim())
  } finally {
    void reader.cancel().catch(() => undefined)
  }

  if (!content.trim()) throw new AiError('format', 200, 'Sağlayıcı boş yanıt döndü. Tekrar dene.')
  return { model, choices: [{ message: { content } }], usage }
}

async function postChatOnce(
  input: AnalyzeInput,
  request: ChatRequest,
): Promise<{ payload: ChatResponse; rejected: boolean }> {
  // Modeli sunucu koyar: istemci model adı ya da anahtar göndermez.
  const body: Record<string, unknown> = {
    temperature: 0.1,
    messages: request.messages,
    response_format: request.responseFormat,
    stream: true,
    stream_options: { include_usage: true },
    ...request.hints,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ANALYSIS_TOTAL_MS)
  let response: Response
  try {
    response = await fetch(CHAT_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${input.token}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    if (controller.signal.aborted) {
      throw new AiError(
        'network',
        0,
        `Analiz ${Math.round(ANALYSIS_TOTAL_MS / 1000)} saniyede bitmedi. Fotoğraf sayısını azaltıp tekrar dene.`,
      )
    }
    throw new AiError('network', 0, 'Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.')
  }

  try {
    if (response.status === 401 || response.status === 403) {
      throw new AiError('auth', response.status, 'Oturumun sona ermiş ya da bu işlem için yetkin yok.')
    }
    if (response.status === 400) {
      // Şemayı (ve ipuçlarını) reddetti: çağıran katman sadeleştirilmiş istekle tekrar dener.
      return { payload: { choices: [] }, rejected: true }
    }
    if (!response.ok) {
      const detail = await bodyError(response)
      throw new AiError(
        'request',
        response.status,
        detail || `Sağlayıcı hata verdi (kod ${response.status}). Tekrar dene.`,
      )
    }

    const type = response.headers.get('content-type') ?? ''
    if (type.includes('text/event-stream')) {
      return { payload: await readChatStream(response, controller, 'Analiz'), rejected: false }
    }
    // Vekil/sağlayıcı akışı desteklemiyorsa gövde tek JSON olarak gelir.
    return { payload: (await response.json()) as ChatResponse, rejected: false }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Şemalı istek: düşünme ipucuyla akış. Sağlayıcı ipucunu/şemayı reddederse (400) önce ipuçsuz,
 * ardından şemasız (`json_object`) tekrar dener.
 */
async function postChat(
  input: AnalyzeInput,
  messages: ChatMessage[],
  responseFormat: Record<string, unknown>,
  hints: Record<string, unknown> | undefined,
  fallbackMessages: ChatMessage[] = messages,
): Promise<{ payload: ChatResponse; degraded: boolean }> {
  const attempts: { hints?: Record<string, unknown>; format: Record<string, unknown>; messages: ChatMessage[] }[] = [
    { hints, format: responseFormat, messages },
    { hints: undefined, format: responseFormat, messages },
  ]
  if (responseFormat.type === 'json_schema') {
    attempts.push({ hints: undefined, format: { type: 'json_object' }, messages: fallbackMessages })
  }

  let degraded = false
  for (const [index, attempt] of attempts.entries()) {
    const result = await postChatOnce(input, {
      messages: attempt.messages,
      responseFormat: attempt.format,
      hints: attempt.hints,
    })
    if (!result.rejected) return { payload: result.payload, degraded }
    // 400: bu varyantı sağlayıcı reddetti. Sonraki (daha sade) varyantı dene.
    degraded = true
    if (index === attempts.length - 1) break
  }
  throw new AiError('format', 200, 'Sağlayıcı şemalı yanıtı desteklemiyor. Tekrar dene.')
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
  /** `json_object`a düşülürse şema promptta taşınır (sağlayıcı şemayı reddettiğinde). */
  const plainMessages: ChatMessage[] = [
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
  ]

  const strict = await postChat(
    input,
    messages,
    {
      type: 'json_schema',
      json_schema: { name: 'product_extraction', strict: true, schema: EXTRACTION_JSON_SCHEMA },
    },
    PROVIDER_HINTS,
    plainMessages,
  )
  const degraded = strict.degraded
  let payload = strict.payload

  let raw = contentOf(payload)
  let parsed = extractionSchema.safeParse(safeJson(raw))
  let repaired = false

  if (!parsed.success) {
    repaired = true
    const issues = parsed.error.issues
      .slice(0, 12)
      .map((issue) => `${issue.path.join('.') || 'kök'}: ${issue.message}`)
      .join('\n')
    const repairTurn: ChatMessage[] = [
      ...(degraded ? plainMessages : messages),
      { role: 'assistant', content: raw },
      {
        role: 'user',
        content: `JSON şemaya uymuyor. Hatalar:\n${issues}\nYalnızca düzeltilmiş, geçerli JSON döndür.`,
      },
    ]
    const repairPayload = await postChat(
      input,
      repairTurn,
      degraded
        ? { type: 'json_object' }
        : {
            type: 'json_schema',
            json_schema: { name: 'product_extraction', strict: true, schema: EXTRACTION_JSON_SCHEMA },
          },
      PROVIDER_HINTS,
    )
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
