import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Markalardaki genel boykot bayrağı kaldırıldı (ADR 0023).
 *
 * `brands.is_boycotted` / `brands.boycott_reason` sütunları düşer; marka hakkındaki
 * hüküm artık yalnız uzman kurallarından gelir (Boykot Dedektifi marka başına bir
 * `brand` kuralı yazar, ADR 0016). Bu bayrağa bağlı iki şey de gider:
 *
 * - `expert_rules` tablosundaki `brand_boycotted` kural tipi: bu tür kurallar marka
 *   ilişkisi taşımadığı için bayrak kalkınca hiçbir zaman eşleşmez, yani ölüdür.
 *   Kalan satırlar silinir, ardından enum değeri yeniden oluşturulan tipten çıkarılır
 *   (Postgres tek tek enum değeri silemez).
 * - Ürün dosyasındaki "Boykotlu marka" damgası salt sunum koduydu; şema işi yok.
 *
 * İfadeler idempotenttir.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "brands" DROP COLUMN IF EXISTS "is_boycotted";`)
  await db.execute(sql`ALTER TABLE "brands" DROP COLUMN IF EXISTS "boycott_reason";`)

  // Bayrağa bağlı kural tipi: eşleşmesi imkânsız ölü satırlar.
  await db.execute(sql`DELETE FROM "expert_rules" WHERE "rule_type" = 'brand_boycotted';`)

  await db.execute(sql`
   DO $$
   BEGIN
     IF EXISTS (
       SELECT 1 FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'enum_expert_rules_rule_type'
         AND e.enumlabel = 'brand_boycotted'
     ) THEN
       CREATE TYPE "public"."enum_expert_rules_rule_type_new" AS ENUM('ingredient_text', 'ingredient_excludes', 'additive_code', 'allergen', 'country', 'brand', 'category', 'nutrition_max', 'nutrition_min', 'label_has', 'label_missing');
       ALTER TABLE "expert_rules" ALTER COLUMN "rule_type" TYPE "public"."enum_expert_rules_rule_type_new" USING "rule_type"::text::"public"."enum_expert_rules_rule_type_new";
       DROP TYPE "public"."enum_expert_rules_rule_type";
       ALTER TYPE "public"."enum_expert_rules_rule_type_new" RENAME TO "enum_expert_rules_rule_type";
     END IF;
   END
   $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Geri alma şemayı eski haline getirir; silinen bayrak verisi ve `brand_boycotted`
  // kuralları geri gelmez (boykot durumu artık uzman kurallarında yaşıyor).
  await db.execute(sql`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "is_boycotted" boolean DEFAULT false;`)
  await db.execute(sql`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "boycott_reason" varchar;`)

  await db.execute(sql`
   DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'enum_expert_rules_rule_type'
         AND e.enumlabel = 'brand_boycotted'
     ) THEN
       CREATE TYPE "public"."enum_expert_rules_rule_type_new" AS ENUM('ingredient_text', 'ingredient_excludes', 'additive_code', 'allergen', 'country', 'brand', 'brand_boycotted', 'category', 'nutrition_max', 'nutrition_min', 'label_has', 'label_missing');
       ALTER TABLE "expert_rules" ALTER COLUMN "rule_type" TYPE "public"."enum_expert_rules_rule_type_new" USING "rule_type"::text::"public"."enum_expert_rules_rule_type_new";
       DROP TYPE "public"."enum_expert_rules_rule_type";
       ALTER TYPE "public"."enum_expert_rules_rule_type_new" RENAME TO "enum_expert_rules_rule_type";
     END IF;
   END
   $$;
  `)
}
