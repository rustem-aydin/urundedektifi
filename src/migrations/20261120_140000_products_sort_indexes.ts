import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ürün listesinin yeni sıralamaları için indeksler (`?sirala=`).
 *
 * `20261102_090000_products_view_sort_index` yalnız `(status, goruntulenme DESC, created_at DESC)`
 * yolunu kapatıyordu. Liste artık eklenme tarihine ve ada göre de sıralanabiliyor
 * (bkz. `PRODUCT_SORT_OPTIONS`); bu iki sıralama indekssiz kalırsa Postgres yayındaki
 * tüm satırları sıralayıp ilk 24'ünü kullanır — sayfa başına onlarca milisaniye.
 *
 * Btree indeksleri her iki yönde taranabildiği için `(status, created_at DESC)` hem
 * "en yeni" hem "en eski", `(status, name)` hem A→Z hem Z→A sorgusunu karşılar.
 * İfadeler idempotenttir: yarıda kalan deploy tekrar çalıştırıldığında hata vermez.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "products_status_created_idx"
    ON "products" USING btree ("status", "created_at" DESC);`)

  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "products_status_name_idx"
    ON "products" USING btree ("status", "name");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS "products_status_created_idx";`)

  await db.execute(sql`DROP INDEX IF EXISTS "products_status_name_idx";`)
}
