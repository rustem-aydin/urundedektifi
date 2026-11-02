import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ürün listelerinin sıralama indeksi.
 *
 * Tüm ürün ızgaraları `status = 'published'` süzgeciyle `goruntulenme DESC,
 * created_at DESC` sırasında okunur (bkz. `src/lib/productCardData.ts`). Bu iki
 * kolonda indeks yokken Postgres 10 bin satırı sıralayıp yalnız ilk 24'ünü
 * kullanıyordu; ölçüm: tam kayıt okumasında 950 ms, kart okumasında 138 ms.
 * Bileşik indeks sıralamayı taramaya çevirir (ölçüm: 16 ms / 18 ms).
 *
 * İfade idempotenttir: yarıda kalan deploy tekrar çalıştırıldığında hata vermez.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "products_status_goruntulenme_created_idx"
    ON "products" USING btree ("status", "goruntulenme" DESC, "created_at" DESC);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "products_status_goruntulenme_created_idx";`)
}
