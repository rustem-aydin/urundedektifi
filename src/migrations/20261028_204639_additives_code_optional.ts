import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * `additives.code` artık opsiyonel: her etiket E-kodu yazmıyor, adı bilinen katkı kodsuz
 * kaydedilebilmeli. Tekil indeks (`additives_code_idx`) duruyor; Postgres tekil indeksleri
 * birden çok NULL'u kabul eder, bu yüzden kodsuz kayıtlar çakışmaz.
 *
 * Yeni `title` sütunu admin başlığıdır (`useAsTitle`) — E-kodu varsa "E330 · Sitrik Asit",
 * yoksa yalnız ad. Mevcut satırlar aynı kuralla doldurulur; bundan sonrasını beforeChange
 * hook'u yazar.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "additives" ALTER COLUMN "code" DROP NOT NULL;`)
  await db.execute(sql`
   ALTER TABLE "additives" ADD COLUMN IF NOT EXISTS "title" varchar;`)
  await db.execute(sql`
   UPDATE "additives"
   SET "title" = CASE
     WHEN "code" IS NULL OR "code" = '' THEN "name"
     ELSE "code" || ' · ' || "name"
   END
   WHERE "title" IS NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "additives" DROP COLUMN IF EXISTS "title";`)
  // Kodsuz satır varsa bu ifade bilinçli olarak hata verir: kodu uydurmak yerine
  // geri alma engellenir, veri sessizce bozulmaz.
  await db.execute(sql`
   ALTER TABLE "additives" ALTER COLUMN "code" SET NOT NULL;`)
}
