import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Herkese açık profiller + ürün katkıları.
 *
 * - `users.bio`: profilde görünen kısa tanıtım.
 * - `product_contributions`: kim, hangi ürüne, hangi işle (oluşturdu/düzenledi/doğruladı)
 *   katkı verdi. Ürün sayfasındaki "Katkıda Bulunanlar" avatar grubu ve profiller buradan
 *   beslenir.
 *
 * Tüm ifadeler idempotenttir: dev-push'un üretimde bıraktığı nesneler migration'ı kırmasın
 * (2026-10-24'te idempotent olmayan migration konteyneri 502'ye düşürmüştü).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" varchar;`)

  await db.execute(sql`
   DO $$ BEGIN
     CREATE TYPE "public"."enum_product_contributions_kind" AS ENUM('create', 'update', 'verify');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "product_contributions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"user_id" integer,
  	"kind" "enum_product_contributions_kind" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  `)

  // İlişkiler NULL'a düşebilir: ürün/hesap silinince `ON DELETE SET NULL` çalışsın.
  // (NOT NULL sütunda silme FK ihlaliyle düşerdi — ürün hiç silinemezdi.)
  await db.execute(sql`
   ALTER TABLE "product_contributions" ALTER COLUMN "product_id" DROP NOT NULL;`)
  await db.execute(sql`
   ALTER TABLE "product_contributions" ALTER COLUMN "user_id" DROP NOT NULL;`)

  await db.execute(sql`
   DO $$ BEGIN
     ALTER TABLE "product_contributions"
       ADD CONSTRAINT "product_contributions_product_id_products_id_fk"
       FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  await db.execute(sql`
   DO $$ BEGIN
     ALTER TABLE "product_contributions"
       ADD CONSTRAINT "product_contributions_user_id_users_id_fk"
       FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "product_contributions_product_idx"
     ON "product_contributions" USING btree ("product_id");`)
  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "product_contributions_user_idx"
     ON "product_contributions" USING btree ("user_id");`)
  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "product_contributions_kind_idx"
     ON "product_contributions" USING btree ("kind");`)
  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "product_contributions_updated_at_idx"
     ON "product_contributions" USING btree ("updated_at");`)
  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "product_contributions_created_at_idx"
     ON "product_contributions" USING btree ("created_at");`)

  // Geçmiş doldurması (idempotent): eski kayıtlar da katkıcı göstersin.
  //  - Ürünü ekleyen: `products.submitted_by_id`.
  //  - Doğrulama oyu veren: `product_feedback` (kind = 'vote') yazarı.
  // Düzenleme geçmişi tutulmadığı için `update` geriye dönük üretilmez.
  await db.execute(sql`
   INSERT INTO "product_contributions" ("product_id", "user_id", "kind")
   SELECT p."id", p."submitted_by_id", 'create'::"enum_product_contributions_kind"
   FROM "products" p
   WHERE p."submitted_by_id" IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM "product_contributions" c
       WHERE c."product_id" = p."id" AND c."user_id" = p."submitted_by_id" AND c."kind" = 'create'
     );`)

  await db.execute(sql`
   INSERT INTO "product_contributions" ("product_id", "user_id", "kind")
   SELECT DISTINCT f."product_id", f."author_id", 'verify'::"enum_product_contributions_kind"
   FROM "product_feedback" f
   WHERE f."kind" = 'vote' AND f."author_id" IS NOT NULL AND f."product_id" IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM "product_contributions" c
       WHERE c."product_id" = f."product_id" AND c."user_id" = f."author_id" AND c."kind" = 'verify'
     );`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS "product_contributions" CASCADE;`)
  await db.execute(sql`
   DROP TYPE IF EXISTS "public"."enum_product_contributions_kind";`)
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN IF EXISTS "bio";`)
}
