import type { GlobalConfig, PayloadRequest } from 'payload'

import type { User } from '@/payload-types'

/**
 * Yapay zekâ sağlayıcısı — tek merkez (web + mobil).
 *
 * Sağlayıcı adresi, model ve API anahtarı yalnız burada tutulur. İstemciler anahtarı hiç
 * görmez: Ekle sihirbazının etiket okuma çağrısı sunucudaki `/api/ai-settings/chat`
 * vekilinden geçer, anahtar burada kalır. Böylece yönetici tek yerden sağlayıcıyı değiştirir,
 * her istemci (tarayıcı, telefon) aynı sağlayıcıyı kullanır — cihaz başına anahtar gerekmez.
 *
 * Uçlar (Payload global uçları `/api/globals/{slug}/...` altında yayınlanır):
 * - `GET  /api/globals/ai-settings/status` → yapılandırıldı mı + adres/model (anahtar yok)
 * - `GET  /api/globals/ai-settings/models` → sağlayıcının model listesi (vekil)
 * - `POST /api/globals/ai-settings/chat`   → chat/completions vekili (yalnız yanıt gövdesi geçer)
 *
 * Yetki: ürün ekleyen roller (admin, editör). Tüketici hesabı vekili kullanamaz; aksi hâlde
 * ücretsiz bir LLM geçidi olurdu.
 */

/** Ürün ekleyen roller: vekil uçları ve durum okuması bunlara açık. */
const AI_ROLES: User['role'][] = ['admin', 'editor']

const CHAT_TIMEOUT_MS = 175_000
const MODELS_TIMEOUT_MS = 20_000

function canUseAi(req: PayloadRequest): boolean {
  const role = (req.user as User | null)?.role
  return role ? AI_ROLES.includes(role) : false
}

type ProviderConfig = {
  baseUrl: string
  apiKey: string
  model: string
}

/** Global'ı sunucu tarafında okur: `apiKey` REST'e kapalıdır, vekil overrideAccess ile görür. */
async function readProviderConfig(req: PayloadRequest): Promise<ProviderConfig | null> {
  const doc = (await req.payload.findGlobal({
    slug: 'ai-settings',
    depth: 0,
    overrideAccess: true,
  })) as unknown as Partial<ProviderConfig> | null
  const baseUrl =
    typeof doc?.baseUrl === 'string' ? doc.baseUrl.trim().replace(/\/+$/, '') : ''
  const apiKey = typeof doc?.apiKey === 'string' ? doc.apiKey.trim() : ''
  const model = typeof doc?.model === 'string' ? doc.model.trim() : ''
  if (!baseUrl || !apiKey || !model) return null
  return { baseUrl, apiKey, model }
}

/** Sağlayıcı yanıtını olduğu gibi istemciye geçirir (durum kodu + gövde + içerik türü). */
async function relayProviderResponse(response: Response): Promise<Response> {
  const body = await response.text()
  return new Response(body, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  })
}

async function callProvider(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timer)
  }
}

function unauthorized(): Response {
  return Response.json(
    { error: 'Yapay zekâ çağrısı için admin ya da editör hesabıyla giriş yap.' },
    { status: 401 },
  )
}

const NOT_CONFIGURED = {
  error:
    'Yapay zekâ sağlayıcısı ayarlanmamış. Yönetim panelinde Sistem → Yapay zekâ sağlayıcısı bölümünü doldur.',
}

function providerUnreachable(req: PayloadRequest, error: unknown, what: string): Response {
  const detail = error instanceof Error ? error.message : String(error)
  req.payload.logger.error(`${what} ulaşılamadı: ${detail}`)
  return Response.json(
    { error: `Yapay zekâ sağlayıcısına ulaşılamadı (${what}). Adresi ve anahtarı kontrol et.` },
    { status: 502 },
  )
}

export const AiSettings: GlobalConfig = {
  slug: 'ai-settings',
  label: 'Yapay zekâ sağlayıcısı',
  admin: {
    group: 'Sistem',
    description:
      'Ekle sihirbazının etiket okuma adımı bu sağlayıcıyı kullanır. Web ve mobil uygulama ' +
      'aynı ayarı okur; API anahtarı yalnız sunucuda kalır, istemcilere gönderilmez.',
  },
  access: {
    // Panel rolleri ayarı görebilir; tüketici hesabı okuyamaz.
    read: ({ req: { user } }) => {
      const role = (user as User | null)?.role
      return role ? AI_ROLES.includes(role) : false
    },
    // Ayarı yalnız admin değiştirir: tek merkez, tüm istemcileri etkiler.
    update: ({ req: { user } }) => (user as User | null)?.role === 'admin',
  },
  fields: [
    {
      name: 'baseUrl',
      type: 'text',
      required: true,
      label: 'Servis adresi',
      defaultValue: 'https://api.openai.com/v1',
      admin: {
        description:
          'OpenAI uyumlu servis adresi. `.../v1` ekini kendin yaz; adresin sonundaki eğik ' +
          'çizgiler temizlenir.',
      },
    },
    {
      name: 'apiKey',
      type: 'text',
      required: true,
      label: 'API anahtarı',
      // Anahtar REST yanıtlarına sızmaz: yalnız admin okuyabilir (panel formu için gerekli).
      // İstemciler hiç görmez; vekil uçlar global'i overrideAccess ile okur.
      access: {
        read: ({ req: { user } }) => (user as User | null)?.role === 'admin',
      },
      admin: {
        description:
          'Yalnız sunucuda kullanılır ve yalnız admin görebilir. İstemcilere (web/mobil) hiçbir ' +
          'zaman gönderilmez.',
      },
    },
    {
      name: 'model',
      type: 'text',
      required: true,
      label: 'Model',
      defaultValue: 'gpt-4.1-mini',
      admin: {
        description: 'Görsel (vision) destekli, JSON şeması kabul eden bir model seç.',
      },
    },
  ],
  endpoints: [
    {
      // İstemciler "sağlayıcı hazır mı" sorusunu buradan yanıtlar: anahtar dönmez.
      path: '/status',
      method: 'get',
      handler: async (req) => {
        if (!canUseAi(req)) return unauthorized()
        const config = await readProviderConfig(req)
        if (!config) return Response.json({ configured: false, baseUrl: null, model: null })
        return Response.json({ configured: true, baseUrl: config.baseUrl, model: config.model })
      },
    },
    {
      path: '/models',
      method: 'get',
      handler: async (req) => {
        if (!canUseAi(req)) return unauthorized()
        const config = await readProviderConfig(req)
        if (!config) return Response.json(NOT_CONFIGURED, { status: 503 })
        try {
          const response = await callProvider(
            `${config.baseUrl}/models`,
            { headers: { Authorization: `Bearer ${config.apiKey}` }, method: 'GET' },
            MODELS_TIMEOUT_MS,
          )
          return relayProviderResponse(response)
        } catch (error) {
          return providerUnreachable(req, error, 'model listesi')
        }
      },
    },
    {
      path: '/chat',
      method: 'post',
      handler: async (req) => {
        if (!canUseAi(req)) return unauthorized()
        const config = await readProviderConfig(req)
        if (!config) return Response.json(NOT_CONFIGURED, { status: 503 })

        const incoming = (await req.json?.()) as Record<string, unknown> | null
        if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.messages)) {
          return Response.json({ error: 'messages dizisi gerekli.' }, { status: 400 })
        }
        // Model sunucudan gelir: istemci başka model isteyemez, anahtar istemciden gelmez.
        const body = { ...incoming, model: config.model }
        delete (body as Record<string, unknown>).api_key

        try {
          const response = await callProvider(
            `${config.baseUrl}/chat/completions`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`,
              },
              body: JSON.stringify(body),
            },
            CHAT_TIMEOUT_MS,
          )
          return relayProviderResponse(response)
        } catch (error) {
          return providerUnreachable(req, error, 'analiz')
        }
      },
    },
  ],
}
