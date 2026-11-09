import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

/**
 * Toplam tarama sayısı.
 *
 * Sitede ayrı bir tarama olay tablosu yok; bir barkod okutulup ürün dosyası açıldığında
 * ürünün `goruntulenme` sayacı artar (bkz. POST /api/products/:id/goruntulenme).
 * Toplam, tüm ürünlerin sayaçlarının tek SUM sorgusuyla toplanmasıdır — 9.500 ürün
 * satırı uygulamaya çekilmez. Arşivlenmiş ürünlerin geçmiş taramaları da toplamda kalır.
 */
export async function totalProductScans(payload: Payload): Promise<number> {
  const db = payload.db as unknown as PostgresAdapter
  const result = (await db.execute({
    drizzle: db.drizzle,
    // SUM(numeric) sürücüden metin döner; double precision ile sayıya çevrilir.
    sql: sql`SELECT COALESCE(SUM("goruntulenme"), 0)::double precision AS "total" FROM "products"`,
  })) as { rows?: { total?: string | number | null }[] }

  const value = Number(result.rows?.[0]?.total ?? 0)
  return Number.isFinite(value) ? Math.trunc(value) : 0
}
