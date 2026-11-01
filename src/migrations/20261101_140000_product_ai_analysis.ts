import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Arka plan etiket okuması (ADR 0028): `products.ai_status` + `products.ai_analysis`.
 *
 * - `ai_status` Payload'ın select alanı olduğu için Postgres enum'u olarak yazılır; varsayılan
 *   `none`, mevcut satırlar da bu değerle dolar.
 * - `ai_analysis` JSON (jsonb): çıkarılan alanlar, eksik fotoğraf talepleri, kullanım bilgisi ve
 *   son hata. Sunucu yazar; alan düzeyi erişimi kapalı olduğundan REST/panel yazamaz.
 *
 * İfadeler idempotenttir: yarıda kalan deploy tekrar çalıştırıldığında hata vermez.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_products_ai_status" AS ENUM('none', 'running', 'done', 'failed');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;`)

  await db.execute(sql`
   ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ai_status" "enum_products_ai_status" DEFAULT 'none' NOT NULL;`)

  await db.execute(sql`
   ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ai_analysis" jsonb;`)

  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "products_ai_status_idx" ON "products" USING btree ("ai_status");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "products_ai_status_idx";`)

  await db.execute(sql`
   ALTER TABLE "products" DROP COLUMN IF EXISTS "ai_analysis";`)

  await db.execute(sql`
   ALTER TABLE "products" DROP COLUMN IF EXISTS "ai_status";`)

  await db.execute(sql`
   DROP TYPE IF EXISTS "public"."enum_products_ai_status";`)
}
