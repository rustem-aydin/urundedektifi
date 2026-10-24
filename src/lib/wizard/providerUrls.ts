/**
 * Sağlayıcı adres yardımcıları (ADR 0008).
 * Base URL tam olarak kullanıcının yazdığı gibi çağrılır: `.../v1` eklemek kullanıcının işidir,
 * çünkü bazı gateways'ler `/v1` beklemez. Yalnız sondaki eğik çizgiler temizlenir.
 */
export function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

export function chatCompletionsUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/chat/completions`
}

export function modelsUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/models`
}
