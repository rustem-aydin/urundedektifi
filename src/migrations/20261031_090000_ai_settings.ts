import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * `ai_settings` global tablosu: yapay zekâ sağlayıcısı tek merkezde (web + mobil).
 *
 * DDL elle yazıldı. Payload global tablosunun gerçek sütunları:
 * - `id` serial,
 * - global alanları (`base_url`, `api_key`, `model`, `required: true` → NOT NULL; `defaultValue`
 *   tanımlı alanlarda `DEFAULT` — Payload şeması `withDefault` ile aynı sütunu üretir),
 * - Payload'ın global'lere zorunlu eklediği `updated_at` / `created_at`
 *   (`timestamp(3) with time zone`, nullable; tarih alanının drizzle karşılığı).
 *
 * İfadeler idempotenttir (2026-10-24'te idempotent olmayan migration konteyneri 502'ye
 * düşürmüştü).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "ai_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"base_url" varchar DEFAULT 'https://api.openai.com/v1' NOT NULL,
  	"api_key" varchar NOT NULL,
  	"model" varchar DEFAULT 'gpt-4.1-mini' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS "ai_settings" CASCADE;`)
}
