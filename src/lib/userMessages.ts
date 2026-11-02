/**
 * Kullanıcıya gösterilecek tek cümlelik mesajlar.
 *
 * Sunucu/Payload hataları teknik metin taşıyabilir ("ValidationError", "duplicate key",
 * "Failed to fetch", HTTP kodu). Bu yardımcı her yerde aynı sade Türkçe karşılığı üretir:
 * form içi uyarılar, toast'lar ve durum panelleri aynı dili konuşur.
 */

export const NETWORK_MESSAGE =
  'Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.'
export const TIMEOUT_MESSAGE =
  'İşlem beklenenden uzun sürdü. Bağlantını kontrol edip tekrar dene.'
export const SERVER_MESSAGE =
  'Sunucuda geçici bir sorun var. Birkaç dakika sonra tekrar dene.'
export const GENERIC_MESSAGE = 'İşlem tamamlanamadı. Lütfen tekrar dene.'
export const INVALID_INPUT_MESSAGE =
  'Gönderilen bilgiler eksik ya da geçersiz. Alanları kontrol edip tekrar dene.'

/** Teknik ayrıntı taşıyan metinleri yakalar; bunlar kullanıcıya gösterilmez. */
const TECHNICAL =
  /(sql|postgres|constraint|duplicate key|unique violation|validation ?error|internal server|econn|enotfound|failed to fetch|network ?error|load failed|status code|status \d{3}|undefined|null value|stack trace|syntaxerror|typeerror|invalid input|invalid value|is required|payload cms)/i

const NETWORK_ERROR = /(failed to fetch|network ?error|load failed|network request failed|fetch failed)/i

/**
 * Sunucudan gelen ayrıntıyı sadeleştirir. `detail` Payload'ın `errors[0].message`
 * alanı ya da özel uçların `error` cümlesidir.
 */
export function friendlyServerMessage(detail: string | null | undefined, status: number): string {
  if (status === 401) return 'Oturumun sona ermiş. Yeniden giriş yap.'
  if (status === 403) return 'Bu işlem için yetkin yok. Gerekli rolle giriş yaptığından emin ol.'
  if (status === 404) return 'Aradığın kayıt bulunamadı; silinmiş olabilir.'
  if (status === 429) return 'Çok fazla deneme yaptın. Biraz bekleyip tekrar dene.'
  if (status === 0) return NETWORK_MESSAGE
  if (status >= 500) return SERVER_MESSAGE

  const text = detail?.trim()
  if (!text) return status === 400 || status === 422 ? INVALID_INPUT_MESSAGE : GENERIC_MESSAGE

  if (/e-?posta.*(zaten|kayıtlı|kullanılıyor)|email.*(already|exists|unique|duplicate)/i.test(text)) {
    return 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı dene.'
  }
  if (/barkod.*(başka|kayıtlı|kullanılıyor|tekrar)|barcode.*(already|exists|unique|duplicate)/i.test(text)) {
    return 'Bu barkod başka bir ürün dosyasında kayıtlı.'
  }
  if (/(şifre|password).*(kısa|zayıf|8|karakter|geçersiz|invalid)/i.test(text)) {
    return 'Şifre kurallara uymuyor. En az 8 karakterlik bir şifre kullan.'
  }
  if (/(oturum|token|jwt).*(sona|geçersiz|expired|invalid)/i.test(text)) {
    return 'Oturumun sona ermiş. Yeniden giriş yap.'
  }
  if (/(dosya|fotoğraf|görsel|file|image|upload|mime).*(boyut|büyük|geçersiz|desteklenmiyor|size|large|invalid)/i.test(text)) {
    return 'Dosya yüklenemedi. JPG ya da PNG ve 10 MB altı bir fotoğraf dene.'
  }
  if (TECHNICAL.test(text) || NETWORK_ERROR.test(text)) {
    return status === 400 || status === 422 ? INVALID_INPUT_MESSAGE : GENERIC_MESSAGE
  }
  // Zaten anlaşılır Türkçe cümle: olduğu gibi göster.
  return text
}

/** Bilinmeyen bir hatayı kullanıcıya gösterilebilecek tek cümleye indirger. */
export function userMessage(error: unknown, fallback: string = GENERIC_MESSAGE): string {
  const like = error && typeof error === 'object' ? (error as Record<string, unknown>) : null
  const message = typeof like?.message === 'string' ? like.message.trim() : ''
  const kind = typeof like?.kind === 'string' ? like.kind : null
  const status = typeof like?.status === 'number' ? like.status : 0

  if (like?.name === 'AbortError') return TIMEOUT_MESSAGE
  if (like?.name === 'AiError') {
    // AI istemcisi teknik ayrıntıyı "\nAyrıntı: ..." satırına ekler; kullanıcıya yalnız
    // ilk satırdaki anlaşılır cümle gösterilir.
    const firstLine = message.split('\n')[0]
    return firstLine && !TECHNICAL.test(firstLine)
      ? firstLine
      : 'Yapay zekâ analizi tamamlanamadı. Birkaç dakika sonra tekrar dene.'
  }
  if (kind === 'offline') return NETWORK_MESSAGE
  if (kind === 'unauthorized') {
    return message && !TECHNICAL.test(message)
      ? message
      : friendlyServerMessage(null, status || 401)
  }
  if (kind === 'notFound') {
    return message && !TECHNICAL.test(message)
      ? message
      : 'Aradığın kayıt bulunamadı; silinmiş olabilir.'
  }
  if (kind === 'server') {
    if (message && !TECHNICAL.test(message) && !NETWORK_ERROR.test(message)) return message
    return friendlyServerMessage(null, status || 500)
  }
  if (NETWORK_ERROR.test(message)) return NETWORK_MESSAGE
  if (message && !TECHNICAL.test(message)) return message
  return fallback
}
