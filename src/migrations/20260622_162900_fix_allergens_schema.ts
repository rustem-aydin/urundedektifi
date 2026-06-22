import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_nutrition_per" AS ENUM('100g', '100ml', 'serving');
  CREATE TABLE "nutrients" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"ingredients_id" integer,
  	"percent_estimate" numeric NOT NULL
  );
  
  CREATE TABLE "products_nutrition_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"nutrient_id" integer NOT NULL,
  	"amount" numeric NOT NULL,
  	"unit" varchar DEFAULT 'mg' NOT NULL
  );
  
  CREATE TABLE "allergens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "products_allergens" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "products_allergens" CASCADE;
  ALTER TABLE "products_rels" DROP CONSTRAINT "products_rels_ingredients_fk";
  
  DROP INDEX "products_rels_ingredients_id_idx";
  ALTER TABLE "products_additional_images" ALTER COLUMN "image_id" DROP NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "name" DROP NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "barcode" DROP NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "front_image_id" DROP NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "brand_id" DROP NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "category_id" DROP NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "status" DROP NOT NULL;
  ALTER TABLE "products" ADD COLUMN "allergens_id" integer;
  ALTER TABLE "products" ADD COLUMN "nutrition_per" "enum_products_nutrition_per" DEFAULT '100g' NOT NULL;
  ALTER TABLE "products" ADD COLUMN "is_submit" boolean;
  ALTER TABLE "countries" ADD COLUMN "slug" varchar DEFAULT 'turkey';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "nutrients_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "allergens_id" integer;
  ALTER TABLE "products_items" ADD CONSTRAINT "products_items_ingredients_id_ingredients_id_fk" FOREIGN KEY ("ingredients_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_items" ADD CONSTRAINT "products_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_nutrition_items" ADD CONSTRAINT "products_nutrition_items_nutrient_id_nutrients_id_fk" FOREIGN KEY ("nutrient_id") REFERENCES "public"."nutrients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_nutrition_items" ADD CONSTRAINT "products_nutrition_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "nutrients_slug_idx" ON "nutrients" USING btree ("slug");
  CREATE INDEX "nutrients_updated_at_idx" ON "nutrients" USING btree ("updated_at");
  CREATE INDEX "nutrients_created_at_idx" ON "nutrients" USING btree ("created_at");
  CREATE INDEX "products_items_order_idx" ON "products_items" USING btree ("_order");
  CREATE INDEX "products_items_parent_id_idx" ON "products_items" USING btree ("_parent_id");
  CREATE INDEX "products_items_ingredients_idx" ON "products_items" USING btree ("ingredients_id");
  CREATE INDEX "products_nutrition_items_order_idx" ON "products_nutrition_items" USING btree ("_order");
  CREATE INDEX "products_nutrition_items_parent_id_idx" ON "products_nutrition_items" USING btree ("_parent_id");
  CREATE INDEX "products_nutrition_items_nutrient_idx" ON "products_nutrition_items" USING btree ("nutrient_id");
  CREATE UNIQUE INDEX "allergens_slug_idx" ON "allergens" USING btree ("slug");
  CREATE INDEX "allergens_updated_at_idx" ON "allergens" USING btree ("updated_at");
  CREATE INDEX "allergens_created_at_idx" ON "allergens" USING btree ("created_at");
  ALTER TABLE "products" ADD CONSTRAINT "products_allergens_id_allergens_id_fk" FOREIGN KEY ("allergens_id") REFERENCES "public"."allergens"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_nutrients_fk" FOREIGN KEY ("nutrients_id") REFERENCES "public"."nutrients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_allergens_fk" FOREIGN KEY ("allergens_id") REFERENCES "public"."allergens"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_allergens_idx" ON "products" USING btree ("allergens_id");
  CREATE UNIQUE INDEX "countries_slug_idx" ON "countries" USING btree ("slug");
  CREATE INDEX "payload_locked_documents_rels_nutrients_id_idx" ON "payload_locked_documents_rels" USING btree ("nutrients_id");
  CREATE INDEX "payload_locked_documents_rels_allergens_id_idx" ON "payload_locked_documents_rels" USING btree ("allergens_id");
  ALTER TABLE "products" DROP COLUMN "nutrition_facts_serving_size";
  ALTER TABLE "products" DROP COLUMN "nutrition_facts_servings_per_package";
  ALTER TABLE "products" DROP COLUMN "nutrition_facts_energy_kcal";
  ALTER TABLE "products" DROP COLUMN "nutrition_facts_energy_kj";
  ALTER TABLE "products" DROP COLUMN "nutrition_facts_fat";
  ALTER TABLE "products" DROP COLUMN "nutrition_facts_saturated_fat";
  ALTER TABLE "products" DROP COLUMN "nutrition_facts_trans_fat";
  ALTER TABLE "products" DROP COLUMN "nutrition_facts_carbohydrates";
  ALTER TABLE "products" DROP COLUMN "nutrition_facts_sugars";
  ALTER TABLE "products" DROP COLUMN "nutrition_facts_added_sugars";
  ALTER TABLE "products" DROP COLUMN "nutrition_facts_fiber";
  ALTER TABLE "products" DROP COLUMN "nutrition_facts_protein";
  ALTER TABLE "products" DROP COLUMN "nutrition_facts_salt";
  ALTER TABLE "products" DROP COLUMN "nutrition_facts_sodium";
  ALTER TABLE "products_rels" DROP COLUMN "ingredients_id";
  DROP TYPE "public"."enum_products_allergens";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_allergens" AS ENUM('gluten', 'milk', 'egg', 'soy', 'peanut', 'nuts', 'fish', 'shellfish', 'sesame', 'mustard', 'celery', 'sulphite');
  CREATE TABLE "products_allergens" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_products_allergens",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "nutrients" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_nutrition_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "allergens" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "nutrients" CASCADE;
  DROP TABLE "products_items" CASCADE;
  DROP TABLE "products_nutrition_items" CASCADE;
  DROP TABLE "allergens" CASCADE;
  ALTER TABLE "products" DROP CONSTRAINT "products_allergens_id_allergens_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_nutrients_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_allergens_fk";
  
  DROP INDEX "products_allergens_idx";
  DROP INDEX "countries_slug_idx";
  DROP INDEX "payload_locked_documents_rels_nutrients_id_idx";
  DROP INDEX "payload_locked_documents_rels_allergens_id_idx";
  ALTER TABLE "products_additional_images" ALTER COLUMN "image_id" SET NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "barcode" SET NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "front_image_id" SET NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "brand_id" SET NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "category_id" SET NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "status" SET NOT NULL;
  ALTER TABLE "products" ADD COLUMN "nutrition_facts_serving_size" varchar;
  ALTER TABLE "products" ADD COLUMN "nutrition_facts_servings_per_package" numeric;
  ALTER TABLE "products" ADD COLUMN "nutrition_facts_energy_kcal" numeric;
  ALTER TABLE "products" ADD COLUMN "nutrition_facts_energy_kj" numeric;
  ALTER TABLE "products" ADD COLUMN "nutrition_facts_fat" numeric;
  ALTER TABLE "products" ADD COLUMN "nutrition_facts_saturated_fat" numeric;
  ALTER TABLE "products" ADD COLUMN "nutrition_facts_trans_fat" numeric;
  ALTER TABLE "products" ADD COLUMN "nutrition_facts_carbohydrates" numeric;
  ALTER TABLE "products" ADD COLUMN "nutrition_facts_sugars" numeric;
  ALTER TABLE "products" ADD COLUMN "nutrition_facts_added_sugars" numeric;
  ALTER TABLE "products" ADD COLUMN "nutrition_facts_fiber" numeric;
  ALTER TABLE "products" ADD COLUMN "nutrition_facts_protein" numeric;
  ALTER TABLE "products" ADD COLUMN "nutrition_facts_salt" numeric;
  ALTER TABLE "products" ADD COLUMN "nutrition_facts_sodium" numeric;
  ALTER TABLE "products_rels" ADD COLUMN "ingredients_id" integer;
  ALTER TABLE "products_allergens" ADD CONSTRAINT "products_allergens_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_allergens_order_idx" ON "products_allergens" USING btree ("order");
  CREATE INDEX "products_allergens_parent_idx" ON "products_allergens" USING btree ("parent_id");
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_ingredients_fk" FOREIGN KEY ("ingredients_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_rels_ingredients_id_idx" ON "products_rels" USING btree ("ingredients_id");
  ALTER TABLE "products" DROP COLUMN "allergens_id";
  ALTER TABLE "products" DROP COLUMN "nutrition_per";
  ALTER TABLE "products" DROP COLUMN "is_submit";
  ALTER TABLE "countries" DROP COLUMN "slug";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "nutrients_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "allergens_id";
  DROP TYPE "public"."enum_products_nutrition_per";`)
}
