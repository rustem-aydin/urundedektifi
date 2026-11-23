import { LRUCache } from 'lru-cache'

/**
 * İtiraz ucu için IP başına saatlik pencere (5 istek).
 *
 * `ruleStats` önbelleğindeki desen: süreç içi, TTL'li ve sabit boyutlu. Sunucu
 * yeniden başlarsa sayaç sıfırlanır; itiraz kaydı zaten kalıcıdır, bu yalnız
 * aynı IP'den ardışık denemeleri yavaşlatır (asıl kalıcı kayıt Postgres'te).
 * Sayaç yalnız gerçek gönderim denemelerinde tüketilir; honeypot isteği
 * buraya gelmeden sessizce 200 döner.
 */

const WINDOW_MS = 60 * 60 * 1000
const LIMIT = 5

const attempts = new LRUCache<string, number[]>({
  max: 5_000,
  ttl: WINDOW_MS,
})

export type ObjectionRateDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

export function consumeObjectionAttempt(ip: string, now = Date.now()): ObjectionRateDecision {
  const key = ip || 'unknown'
  const recent = (attempts.get(key) ?? []).filter((at) => now - at < WINDOW_MS)

  if (recent.length >= LIMIT) {
    const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000))
    attempts.set(key, recent)
    return { allowed: false, retryAfterSeconds }
  }

  recent.push(now)
  attempts.set(key, recent)
  return { allowed: true }
}

/** Testlerde pencereler arası durum taşınmasın. */
export function resetObjectionRateLimit(): void {
  attempts.clear()
}
