/**
 * S3 deposu (RustFS) için yeniden deneme stratejisi.
 *
 * RustFS 1.0.0-alpha.78 uzun süre ayakta kaldığında yoğun yükte imza doğrulamasını
 * rastgele reddediyor: `/api/media/file/<dosya>` isteği 403 `SignatureDoesNotMatch`
 * (SDK'da adsız 403 "UnknownError") alıyor, Payload bu hatayı yakalayıp 500
 * "Internal Server Error" dönüyor, Next görsel iyileştiricisi de 400 veriyor ve
 * ürün listesindeki kart kırık görselle kalıyor (tarayıcı aynı isteği tekrar denemez).
 *
 * SDK 403'ü "client" hatası saydığı için kendi başına yeniden denemez; aynı anda
 * yapılan bir sonraki deneme ise neredeyse her zaman başarılı oluyor (kanıt: hatalı
 * isteklerin anında tekrarı 200 döndü). Bu strateji imza reddini ve SDK'nın varsayılan
 * olarak denediği geçici hataları sınırlı sayıda yeniden dener. İmzalama her denemede
 * yeniden yapılır (retry ara katmanı imzalama ara katmanının dışında çalışır).
 */

type RetryToken = {
  getRetryCount(): number
  getRetryDelay(): number
}

export type RetryErrorInfo = {
  error?: unknown
  errorType: 'TRANSIENT' | 'THROTTLING' | 'SERVER_ERROR' | 'CLIENT_ERROR'
  retryAfterHint?: Date
}

/** İmza reddi için toplam ek deneme sayısı (ilk istek hariç). */
const SIGNATURE_RETRIES = 4
/** Ağ/5xx/throttle için ek deneme sayısı; SDK varsayılanıyla aynı sınır. */
const TRANSIENT_RETRIES = 3
const BASE_DELAY_MS = 100
const MAX_DELAY_MS = 1200

const makeToken = (retryCount: number, retryDelay = 0): RetryToken => ({
  getRetryCount: () => retryCount,
  getRetryDelay: () => retryDelay,
})

const backoffDelay = (retryCount: number): number => {
  const delay = BASE_DELAY_MS * 2 ** Math.max(0, retryCount - 1)
  // Aynı anda dönen istekler aynı anahtara yığılmasın diye küçük bir sapma.
  return Math.min(MAX_DELAY_MS, delay) + Math.floor(Math.random() * 50)
}

/**
 * RustFS imza reddi: SDK hatayı `SignatureDoesNotMatch` ya da adı "Unknown" olan
 * gövdesiz 403 olarak gösteriyor. Kimlik bilgisi sabit olduğu için yinelenen 403'ler
 * sınırlı sayıda denenir.
 */
export function isSignatureDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } }
  if (candidate.name === 'SignatureDoesNotMatch' || candidate.Code === 'SignatureDoesNotMatch') {
    return true
  }
  return candidate.$metadata?.httpStatusCode === 403
}

export const storageRetryStrategy = {
  async acquireInitialRetryToken(): Promise<RetryToken> {
    return makeToken(0)
  },

  async refreshRetryTokenForRetry(token: RetryToken, errorInfo: RetryErrorInfo): Promise<RetryToken> {
    const attempt = token.getRetryCount()
    const signatureDenied = isSignatureDenied(errorInfo.error)
    const retryable = signatureDenied || errorInfo.errorType !== 'CLIENT_ERROR'
    const limit = signatureDenied ? SIGNATURE_RETRIES : TRANSIENT_RETRIES

    if (!retryable || attempt >= limit) {
      throw errorInfo.error ?? new Error('Yeniden deneme sınırı aşıldı')
    }

    const hint = errorInfo.retryAfterHint ? errorInfo.retryAfterHint.getTime() - Date.now() : 0
    const delay = hint > 0 ? Math.min(hint, MAX_DELAY_MS) : backoffDelay(attempt + 1)
    return makeToken(attempt + 1, delay)
  },

  recordSuccess(): void {
    // Deneme sayacı istek başına tutulduğu için başarıda temizlenecek ortak durum yok.
  },
}
