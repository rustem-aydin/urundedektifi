import { normalizeBaseUrl } from './providerUrls'

/**
 * Yapay zekâ sağlayıcısı ayarları (ADR 0008, web uyarlaması).
 *
 * Mobilde anahtar cihaz kasasında (expo-secure-store) tutulur. Tarayıcıda eşdeğeri yok:
 * API anahtarı `sessionStorage`'da (sekme kapanınca silinir), base URL + model `localStorage`'da
 * saklanır. Anahtar hiçbir zaman sunucumuza gönderilmez, doğrudan sağlayıcıya gider.
 */

const KEY_STORAGE = 'urundedektifi.ai.key'
const SETTINGS_STORAGE = 'urundedektifi.ai.provider'

export type ProviderSettings = {
  baseUrl: string
  model: string
}

function browser(): boolean {
  return typeof window !== 'undefined'
}

export function readApiKey(): string | null {
  if (!browser()) return null
  return window.sessionStorage.getItem(KEY_STORAGE)
}

export function writeApiKey(apiKey: string): void {
  if (!browser()) return
  window.sessionStorage.setItem(KEY_STORAGE, apiKey.trim())
}

export function readProviderSettings(): ProviderSettings | null {
  if (!browser()) return null
  const raw = window.localStorage.getItem(SETTINGS_STORAGE)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      'baseUrl' in parsed &&
      'model' in parsed &&
      typeof parsed.baseUrl === 'string' &&
      typeof parsed.model === 'string'
    ) {
      return { baseUrl: parsed.baseUrl, model: parsed.model }
    }
    return null
  } catch {
    return null
  }
}

export function writeProviderSettings(settings: ProviderSettings): void {
  if (!browser()) return
  window.localStorage.setItem(
    SETTINGS_STORAGE,
    JSON.stringify({ baseUrl: normalizeBaseUrl(settings.baseUrl), model: settings.model.trim() }),
  )
}

/** Ayarlar tam mı: sihirbazın analiz adımı bunu arar. */
export function readReadyProvider(): { apiKey: string; settings: ProviderSettings } | null {
  const apiKey = readApiKey()
  const settings = readProviderSettings()
  if (!apiKey || !settings?.baseUrl || !settings.model) return null
  return { apiKey, settings }
}
