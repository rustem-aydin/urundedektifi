import { LRUCache } from 'lru-cache'

/**
 * Sayfa verisi için süreç içi önbellek.
 *
 * Ana sayfa ve kategori ağacı her istekte 5–7 sorgu çalıştırıyordu; bot trafiği
 * doğrudan veritabanına iniyordu. Burada yalnız **sorgu sonuçları** tutulur,
 * HTML üretimi değişmez. Değer olarak `Promise` saklanır: aynı anda gelen
 * istekler tek yükleme paylaşır (cache stampede yok).
 *
 * İçerik yazımında `clearServerCache()` çağrılır; ayrıca 5 dakikada tazelenir.
 */
const WINDOW_MS = 5 * 60_000

const store = new LRUCache<string, Promise<unknown>>({ max: 50 })

export function cached<T>(key: string, load: () => Promise<T>, ttlMs = WINDOW_MS): Promise<T> {
  const hit = store.get(key) as Promise<T> | undefined
  if (hit) return hit

  const promise = load().catch((error: unknown) => {
    // Başarısız yükleme önbellekte kalmamalı: sonraki istek yeniden denesin.
    store.delete(key)
    throw error
  })
  store.set(key, promise, { ttl: ttlMs })
  return promise
}

export function clearServerCache(): void {
  store.clear()
}
