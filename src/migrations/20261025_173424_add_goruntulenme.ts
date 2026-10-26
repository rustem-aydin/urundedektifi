import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * `products.goruntulenme`: ürün dosyası görüntülenme sayacı.
 *
 * DDL elle yazıldı, `payload migrate:create` çalıştırılmadı: son şema anlık görüntüsünde
 * elle eklenen `product_feedback_vote_unique` kısmi tekil indeksi yok, üretici onu
 * `DROP INDEX` olarak diff'e koyardı. Anlık görüntüye yalnız yeni sütun eklendi.
 * Sayaç `numeric` (Payload `number` alanı bu tipe karşılık gelir); Postgres sürücüsü
 * değeri metin döndürür, sunucu `Number()` ile sayıya çevirir.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "goruntulenme" numeric DEFAULT 0;`)
  await db.execute(sql`
   UPDATE "products" SET "goruntulenme" = 0 WHERE "goruntulenme" IS NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" DROP COLUMN IF EXISTS "goruntulenme";`)
}
