import { describe, expect, it } from 'vitest'
import { isSignatureDenied, storageRetryStrategy } from '@/lib/s3Retry'

/**
 * Medya rotası S3 deposundan dosya okurken RustFS'in imza reddini (403) yiyor.
 * Bu strateji reddi sınırlı sayıda yeniden dener; sınır aşılırsa özgün hata yükselir.
 */

const forbidden = (name = 'Unknown', status = 403) =>
  Object.assign(new Error('forbidden'), { name, $metadata: { httpStatusCode: status } })

describe('isSignatureDenied', () => {
  it('adlandırılmış ve RustFS biçimindeki 403 hatalarını imza reddi sayar', () => {
    expect(isSignatureDenied(forbidden('SignatureDoesNotMatch'))).toBe(true)
    expect(isSignatureDenied(forbidden())).toBe(true)
    expect(isSignatureDenied({ Code: 'SignatureDoesNotMatch' })).toBe(true)
  })

  it('diğer hataları imza reddi saymaz', () => {
    expect(isSignatureDenied(forbidden('NoSuchKey', 404))).toBe(false)
    expect(isSignatureDenied(new Error('boom'))).toBe(false)
    expect(isSignatureDenied(null)).toBe(false)
  })
})

describe('storageRetryStrategy', () => {
  it('imza reddini sınıra kadar yeniden dener, sonra özgün hatayı yükseltir', async () => {
    let token = await storageRetryStrategy.acquireInitialRetryToken()
    const attempts: number[] = []

    for (;;) {
      try {
        token = await storageRetryStrategy.refreshRetryTokenForRetry(token, {
          error: forbidden(),
          errorType: 'CLIENT_ERROR',
        })
        attempts.push(token.getRetryCount())
      } catch (error) {
        expect((error as Error).message).toBe('forbidden')
        break
      }
    }

    expect(attempts).toEqual([1, 2, 3, 4])
  })

  it('geçici hatada SDK varsayılanıyla aynı sınırı (3) uygular', async () => {
    let token = await storageRetryStrategy.acquireInitialRetryToken()
    const attempts: number[] = []

    for (;;) {
      try {
        token = await storageRetryStrategy.refreshRetryTokenForRetry(token, {
          error: forbidden('InternalError', 500),
          errorType: 'SERVER_ERROR',
        })
        attempts.push(token.getRetryCount())
      } catch {
        break
      }
    }

    expect(attempts).toEqual([1, 2, 3])
  })

  it('istemci hatasını (404/400) yeniden denemez', async () => {
    const token = await storageRetryStrategy.acquireInitialRetryToken()
    await expect(
      storageRetryStrategy.refreshRetryTokenForRetry(token, {
        error: forbidden('NoSuchKey', 404),
        errorType: 'CLIENT_ERROR',
      }),
    ).rejects.toThrow('forbidden')
  })

  it('denemeler arasında bekleme süresi üretir (0 ms değil)', async () => {
    const token = await storageRetryStrategy.acquireInitialRetryToken()
    const next = await storageRetryStrategy.refreshRetryTokenForRetry(token, {
      error: forbidden(),
      errorType: 'CLIENT_ERROR',
    })
    expect(next.getRetryDelay()).toBeGreaterThan(0)
    expect(next.getRetryDelay()).toBeLessThanOrEqual(1250)
  })
})
