import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * `media.imageSizes` kaldırıldı: her yükleme tek dosya olarak saklanır
 * (ölçeklendirme Next.js tarafında). Uygulama türevleri kullanmıyordu;
 * bucket'ta görsel başına 2-4 fazladan nesne duruyordu.
 *
 * DDL elle yazıldı: `payload migrate:create` son anlık görüntüyle diff alırken
 * ilgisiz kısmi indeksleri de `DROP INDEX` olarak öneriyor. Anlık görüntü
 * (`.json`) bir önceki sürümden `sizes_*` sütunları çıkarılarak üretildi.
 *
 * Sütunlar tamamen boşaltılmış değil: 11.478 satırda eski türev bilgisi duruyor
 * ve DROP ile birlikte gider. Dosyaların kendisi S3'te kalır (temizliği ayrı
 * bir iş); burada yalnız şema hizalanır.
 */
const COLUMNS = [
  'sizes_thumbnail_url',
  'sizes_thumbnail_width',
  'sizes_thumbnail_height',
  'sizes_thumbnail_mime_type',
  'sizes_thumbnail_filesize',
  'sizes_thumbnail_filename',
  'sizes_small_url',
  'sizes_small_width',
  'sizes_small_height',
  'sizes_small_mime_type',
  'sizes_small_filesize',
  'sizes_small_filename',
  'sizes_medium_url',
  'sizes_medium_width',
  'sizes_medium_height',
  'sizes_medium_mime_type',
  'sizes_medium_filesize',
  'sizes_medium_filename',
  'sizes_large_url',
  'sizes_large_width',
  'sizes_large_height',
  'sizes_large_mime_type',
  'sizes_large_filesize',
  'sizes_large_filename',
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const column of COLUMNS) {
    await db.execute(sql.raw(`ALTER TABLE "media" DROP COLUMN IF EXISTS "${column}";`))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Geri alma yalnız sütunları geri getirir; türev dosyaları hesaplanmaz.
  // Yeniden türev üretmek gerekirse `imageSizes` yapılandırması geri konmalı
  // ve her medya kaydı yeniden yüklenmeli.
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_url" varchar;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_width" numeric;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_height" numeric;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_mime_type" varchar;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_filesize" numeric;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_filename" varchar;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_small_url" varchar;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_small_width" numeric;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_small_height" numeric;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_small_mime_type" varchar;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_small_filesize" numeric;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_small_filename" varchar;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_url" varchar;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_width" numeric;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_height" numeric;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_mime_type" varchar;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_filesize" numeric;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_filename" varchar;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_url" varchar;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_width" numeric;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_height" numeric;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_mime_type" varchar;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_filesize" numeric;`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_filename" varchar;`)
}
