import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor', 'expert', 'user');
  CREATE TYPE "public"."enum_products_allergens" AS ENUM('gluten', 'milk', 'egg', 'soy', 'peanut', 'nuts', 'fish', 'shellfish', 'sesame', 'mustard', 'celery', 'sulphite');
  CREATE TYPE "public"."enum_products_labels" AS ENUM('vegan', 'vegetarian', 'gluten-free', 'lactose-free', 'organic', 'halal-certified', 'kosher', 'non-gmo', 'natural', 'no-additives', 'sugar-free', 'ce-mark', 'rohs', 'energy-star', 'cruelty-free', 'vegan-certified-cosmetics', 'bpa-free', 'paraben-free', 'sulfate-free', 'recyclable', 'disposable', 'reusable', 'oeko-tex', 'gots', 'fair-trade', 'fsc', 'energy-a-plus-plus-plus', 'energy-a-plus-plus', 'energy-a-plus', 'energy-a', 'energy-b');
  CREATE TYPE "public"."enum_products_warnings_severity" AS ENUM('low', 'medium', 'high');
  CREATE TYPE "public"."enum_products_nutriscore" AS ENUM('a', 'b', 'c', 'd', 'e');
  CREATE TYPE "public"."enum_products_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_expert_rules_evidence_type" AS ENUM('image', 'document', 'link');
  CREATE TYPE "public"."enum_expert_rules_rule_type" AS ENUM('ingredient_text', 'ingredient_excludes', 'additive_code', 'allergen', 'country', 'brand', 'brand_boycotted', 'category', 'nutrition_max', 'nutrition_min', 'label_has', 'label_missing');
  CREATE TYPE "public"."enum_expert_rules_allergen" AS ENUM('gluten', 'milk', 'egg', 'soy', 'peanut', 'nuts', 'fish', 'shellfish', 'sesame', 'mustard', 'celery', 'sulphite');
  CREATE TYPE "public"."enum_expert_rules_label" AS ENUM('vegan', 'vegetarian', 'gluten-free', 'lactose-free', 'organic', 'halal-certified', 'kosher', 'non-gmo', 'natural', 'no-additives', 'sugar-free');
  CREATE TYPE "public"."enum_expert_rules_nutrition_field" AS ENUM('sugars', 'addedSugars', 'fat', 'saturatedFat', 'salt', 'sodium', 'energyKcal');
  CREATE TYPE "public"."enum_additives_function" AS ENUM('acidity_regulator', 'antioxidant', 'flavor_enhancer', 'emulsifier', 'preservative', 'color', 'sweetener', 'thickener', 'anti_caking', 'leavening', 'stabilizer', 'other');
  CREATE TYPE "public"."enum_additives_risk_level" AS ENUM('low', 'medium', 'high');
  CREATE TYPE "public"."enum_additives_halal_status" AS ENUM('halal', 'haram', 'mashbooh', 'unknown');
  CREATE TYPE "public"."enum_additives_is_vegan" AS ENUM('yes', 'no', 'unknown');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'user' NOT NULL,
  	"avatar_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_small_url" varchar,
  	"sizes_small_width" numeric,
  	"sizes_small_height" numeric,
  	"sizes_small_mime_type" varchar,
  	"sizes_small_filesize" numeric,
  	"sizes_small_filename" varchar,
  	"sizes_medium_url" varchar,
  	"sizes_medium_width" numeric,
  	"sizes_medium_height" numeric,
  	"sizes_medium_mime_type" varchar,
  	"sizes_medium_filesize" numeric,
  	"sizes_medium_filename" varchar,
  	"sizes_large_url" varchar,
  	"sizes_large_width" numeric,
  	"sizes_large_height" numeric,
  	"sizes_large_mime_type" varchar,
  	"sizes_large_filesize" numeric,
  	"sizes_large_filename" varchar
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"icon_id" integer,
  	"parent_id" integer,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "topics" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"icon" varchar,
  	"color" varchar,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "brands" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"logo_id" integer,
  	"description" varchar,
  	"country" varchar,
  	"website" varchar,
  	"is_boycotted" boolean DEFAULT false,
  	"boycott_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_additional_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"caption" varchar
  );
  
  CREATE TABLE "products_allergens" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_products_allergens",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "products_labels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_products_labels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "products_specifications" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"value" varchar NOT NULL,
  	"unit" varchar
  );
  
  CREATE TABLE "products_warnings" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"severity" "enum_products_warnings_severity" DEFAULT 'medium' NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "products_prices" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"barcode" varchar NOT NULL,
  	"description" varchar,
  	"front_image_id" integer NOT NULL,
  	"ingredients_image_id" integer,
  	"nutrition_image_id" integer,
  	"recycling_image_id" integer,
  	"brand_id" integer NOT NULL,
  	"category_id" integer NOT NULL,
  	"manufacturer" varchar,
  	"country_id" integer,
  	"nutrition_facts_serving_size" varchar,
  	"nutrition_facts_servings_per_package" numeric,
  	"nutrition_facts_energy_kcal" numeric,
  	"nutrition_facts_energy_kj" numeric,
  	"nutrition_facts_fat" numeric,
  	"nutrition_facts_saturated_fat" numeric,
  	"nutrition_facts_trans_fat" numeric,
  	"nutrition_facts_carbohydrates" numeric,
  	"nutrition_facts_sugars" numeric,
  	"nutrition_facts_added_sugars" numeric,
  	"nutrition_facts_fiber" numeric,
  	"nutrition_facts_protein" numeric,
  	"nutrition_facts_salt" numeric,
  	"nutrition_facts_sodium" numeric,
  	"nutriscore" "enum_products_nutriscore",
  	"packaging" varchar,
  	"size" varchar,
  	"model" varchar,
  	"sku" varchar,
  	"warranty" varchar,
  	"usage" varchar,
  	"storage" varchar,
  	"status" "enum_products_status" DEFAULT 'draft' NOT NULL,
  	"submitted_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"ingredients_id" integer,
  	"additives_id" integer
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"content" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_image_id" integer,
  	"status" "enum_pages_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "experts_credentials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"year" numeric,
  	"issuer" varchar
  );
  
  CREATE TABLE "experts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"user_id" integer,
  	"title" varchar,
  	"avatar_id" integer,
  	"bio" varchar,
  	"verified" boolean DEFAULT false,
  	"is_public" boolean DEFAULT true,
  	"social_links_website" varchar,
  	"social_links_twitter" varchar,
  	"social_links_instagram" varchar,
  	"social_links_linkedin" varchar,
  	"social_links_youtube" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "expert_rules_evidence" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_expert_rules_evidence_type" DEFAULT 'image' NOT NULL,
  	"media_id" integer,
  	"url" varchar,
  	"caption" varchar
  );
  
  CREATE TABLE "expert_rules_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "expert_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"expert_id" integer NOT NULL,
  	"topic_id" integer NOT NULL,
  	"rating_id" integer NOT NULL,
  	"rule_type" "enum_expert_rules_rule_type" NOT NULL,
  	"ingredient_id" integer,
  	"additive_id" integer,
  	"brand_id" integer,
  	"country_id" integer,
  	"product_type_id" integer,
  	"allergen" "enum_expert_rules_allergen",
  	"label" "enum_expert_rules_label",
  	"nutrition_field" "enum_expert_rules_nutrition_field",
  	"nutrition_threshold" numeric,
  	"description" varchar NOT NULL,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rating_scales" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"expert_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"color" varchar,
  	"order" numeric DEFAULT 0,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ingredients_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"alias" varchar NOT NULL
  );
  
  CREATE TABLE "ingredients" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "additives_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"alias" varchar NOT NULL
  );
  
  CREATE TABLE "additives_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "additives" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"function" "enum_additives_function",
  	"risk_level" "enum_additives_risk_level",
  	"halal_status" "enum_additives_halal_status",
  	"is_vegan" "enum_additives_is_vegan",
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "countries_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"prefix" varchar NOT NULL
  );
  
  CREATE TABLE "countries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"code" varchar,
  	"iso" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"categories_id" integer,
  	"topics_id" integer,
  	"brands_id" integer,
  	"products_id" integer,
  	"pages_id" integer,
  	"experts_id" integer,
  	"expert_rules_id" integer,
  	"rating_scales_id" integer,
  	"ingredients_id" integer,
  	"additives_id" integer,
  	"countries_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brands" ADD CONSTRAINT "brands_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_additional_images" ADD CONSTRAINT "products_additional_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_additional_images" ADD CONSTRAINT "products_additional_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_allergens" ADD CONSTRAINT "products_allergens_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_labels" ADD CONSTRAINT "products_labels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_specifications" ADD CONSTRAINT "products_specifications_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_warnings" ADD CONSTRAINT "products_warnings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_prices" ADD CONSTRAINT "products_prices_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_front_image_id_media_id_fk" FOREIGN KEY ("front_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_ingredients_image_id_media_id_fk" FOREIGN KEY ("ingredients_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_nutrition_image_id_media_id_fk" FOREIGN KEY ("nutrition_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_recycling_image_id_media_id_fk" FOREIGN KEY ("recycling_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_ingredients_fk" FOREIGN KEY ("ingredients_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_additives_fk" FOREIGN KEY ("additives_id") REFERENCES "public"."additives"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "experts_credentials" ADD CONSTRAINT "experts_credentials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."experts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "experts" ADD CONSTRAINT "experts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "experts" ADD CONSTRAINT "experts_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expert_rules_evidence" ADD CONSTRAINT "expert_rules_evidence_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expert_rules_evidence" ADD CONSTRAINT "expert_rules_evidence_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."expert_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "expert_rules_sources" ADD CONSTRAINT "expert_rules_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."expert_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "expert_rules" ADD CONSTRAINT "expert_rules_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expert_rules" ADD CONSTRAINT "expert_rules_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expert_rules" ADD CONSTRAINT "expert_rules_rating_id_rating_scales_id_fk" FOREIGN KEY ("rating_id") REFERENCES "public"."rating_scales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expert_rules" ADD CONSTRAINT "expert_rules_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expert_rules" ADD CONSTRAINT "expert_rules_additive_id_additives_id_fk" FOREIGN KEY ("additive_id") REFERENCES "public"."additives"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expert_rules" ADD CONSTRAINT "expert_rules_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expert_rules" ADD CONSTRAINT "expert_rules_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expert_rules" ADD CONSTRAINT "expert_rules_product_type_id_categories_id_fk" FOREIGN KEY ("product_type_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rating_scales" ADD CONSTRAINT "rating_scales_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ingredients_aliases" ADD CONSTRAINT "ingredients_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "additives_aliases" ADD CONSTRAINT "additives_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."additives"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "additives_sources" ADD CONSTRAINT "additives_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."additives"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "countries_aliases" ADD CONSTRAINT "countries_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brands_fk" FOREIGN KEY ("brands_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_experts_fk" FOREIGN KEY ("experts_id") REFERENCES "public"."experts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_expert_rules_fk" FOREIGN KEY ("expert_rules_id") REFERENCES "public"."expert_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rating_scales_fk" FOREIGN KEY ("rating_scales_id") REFERENCES "public"."rating_scales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ingredients_fk" FOREIGN KEY ("ingredients_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_additives_fk" FOREIGN KEY ("additives_id") REFERENCES "public"."additives"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_countries_fk" FOREIGN KEY ("countries_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_avatar_idx" ON "users" USING btree ("avatar_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_small_sizes_small_filename_idx" ON "media" USING btree ("sizes_small_filename");
  CREATE INDEX "media_sizes_medium_sizes_medium_filename_idx" ON "media" USING btree ("sizes_medium_filename");
  CREATE INDEX "media_sizes_large_sizes_large_filename_idx" ON "media" USING btree ("sizes_large_filename");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_icon_idx" ON "categories" USING btree ("icon_id");
  CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "topics_slug_idx" ON "topics" USING btree ("slug");
  CREATE INDEX "topics_updated_at_idx" ON "topics" USING btree ("updated_at");
  CREATE INDEX "topics_created_at_idx" ON "topics" USING btree ("created_at");
  CREATE INDEX "brands_name_idx" ON "brands" USING btree ("name");
  CREATE UNIQUE INDEX "brands_slug_idx" ON "brands" USING btree ("slug");
  CREATE INDEX "brands_logo_idx" ON "brands" USING btree ("logo_id");
  CREATE INDEX "brands_updated_at_idx" ON "brands" USING btree ("updated_at");
  CREATE INDEX "brands_created_at_idx" ON "brands" USING btree ("created_at");
  CREATE INDEX "products_additional_images_order_idx" ON "products_additional_images" USING btree ("_order");
  CREATE INDEX "products_additional_images_parent_id_idx" ON "products_additional_images" USING btree ("_parent_id");
  CREATE INDEX "products_additional_images_image_idx" ON "products_additional_images" USING btree ("image_id");
  CREATE INDEX "products_allergens_order_idx" ON "products_allergens" USING btree ("order");
  CREATE INDEX "products_allergens_parent_idx" ON "products_allergens" USING btree ("parent_id");
  CREATE INDEX "products_labels_order_idx" ON "products_labels" USING btree ("order");
  CREATE INDEX "products_labels_parent_idx" ON "products_labels" USING btree ("parent_id");
  CREATE INDEX "products_specifications_order_idx" ON "products_specifications" USING btree ("_order");
  CREATE INDEX "products_specifications_parent_id_idx" ON "products_specifications" USING btree ("_parent_id");
  CREATE INDEX "products_warnings_order_idx" ON "products_warnings" USING btree ("_order");
  CREATE INDEX "products_warnings_parent_id_idx" ON "products_warnings" USING btree ("_parent_id");
  CREATE INDEX "products_prices_order_idx" ON "products_prices" USING btree ("_order");
  CREATE INDEX "products_prices_parent_id_idx" ON "products_prices" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");
  CREATE UNIQUE INDEX "products_barcode_idx" ON "products" USING btree ("barcode");
  CREATE INDEX "products_front_image_idx" ON "products" USING btree ("front_image_id");
  CREATE INDEX "products_ingredients_image_idx" ON "products" USING btree ("ingredients_image_id");
  CREATE INDEX "products_nutrition_image_idx" ON "products" USING btree ("nutrition_image_id");
  CREATE INDEX "products_recycling_image_idx" ON "products" USING btree ("recycling_image_id");
  CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand_id");
  CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");
  CREATE INDEX "products_country_idx" ON "products" USING btree ("country_id");
  CREATE INDEX "products_submitted_by_idx" ON "products" USING btree ("submitted_by_id");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_ingredients_id_idx" ON "products_rels" USING btree ("ingredients_id");
  CREATE INDEX "products_rels_additives_id_idx" ON "products_rels" USING btree ("additives_id");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_seo_seo_og_image_idx" ON "pages" USING btree ("seo_og_image_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "experts_credentials_order_idx" ON "experts_credentials" USING btree ("_order");
  CREATE INDEX "experts_credentials_parent_id_idx" ON "experts_credentials" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "experts_slug_idx" ON "experts" USING btree ("slug");
  CREATE INDEX "experts_user_idx" ON "experts" USING btree ("user_id");
  CREATE INDEX "experts_avatar_idx" ON "experts" USING btree ("avatar_id");
  CREATE INDEX "experts_updated_at_idx" ON "experts" USING btree ("updated_at");
  CREATE INDEX "experts_created_at_idx" ON "experts" USING btree ("created_at");
  CREATE INDEX "expert_rules_evidence_order_idx" ON "expert_rules_evidence" USING btree ("_order");
  CREATE INDEX "expert_rules_evidence_parent_id_idx" ON "expert_rules_evidence" USING btree ("_parent_id");
  CREATE INDEX "expert_rules_evidence_media_idx" ON "expert_rules_evidence" USING btree ("media_id");
  CREATE INDEX "expert_rules_sources_order_idx" ON "expert_rules_sources" USING btree ("_order");
  CREATE INDEX "expert_rules_sources_parent_id_idx" ON "expert_rules_sources" USING btree ("_parent_id");
  CREATE INDEX "expert_rules_expert_idx" ON "expert_rules" USING btree ("expert_id");
  CREATE INDEX "expert_rules_topic_idx" ON "expert_rules" USING btree ("topic_id");
  CREATE INDEX "expert_rules_rating_idx" ON "expert_rules" USING btree ("rating_id");
  CREATE INDEX "expert_rules_ingredient_idx" ON "expert_rules" USING btree ("ingredient_id");
  CREATE INDEX "expert_rules_additive_idx" ON "expert_rules" USING btree ("additive_id");
  CREATE INDEX "expert_rules_brand_idx" ON "expert_rules" USING btree ("brand_id");
  CREATE INDEX "expert_rules_country_idx" ON "expert_rules" USING btree ("country_id");
  CREATE INDEX "expert_rules_product_type_idx" ON "expert_rules" USING btree ("product_type_id");
  CREATE INDEX "expert_rules_updated_at_idx" ON "expert_rules" USING btree ("updated_at");
  CREATE INDEX "expert_rules_created_at_idx" ON "expert_rules" USING btree ("created_at");
  CREATE INDEX "rating_scales_expert_idx" ON "rating_scales" USING btree ("expert_id");
  CREATE INDEX "rating_scales_updated_at_idx" ON "rating_scales" USING btree ("updated_at");
  CREATE INDEX "rating_scales_created_at_idx" ON "rating_scales" USING btree ("created_at");
  CREATE INDEX "ingredients_aliases_order_idx" ON "ingredients_aliases" USING btree ("_order");
  CREATE INDEX "ingredients_aliases_parent_id_idx" ON "ingredients_aliases" USING btree ("_parent_id");
  CREATE INDEX "ingredients_name_idx" ON "ingredients" USING btree ("name");
  CREATE INDEX "ingredients_updated_at_idx" ON "ingredients" USING btree ("updated_at");
  CREATE INDEX "ingredients_created_at_idx" ON "ingredients" USING btree ("created_at");
  CREATE INDEX "additives_aliases_order_idx" ON "additives_aliases" USING btree ("_order");
  CREATE INDEX "additives_aliases_parent_id_idx" ON "additives_aliases" USING btree ("_parent_id");
  CREATE INDEX "additives_sources_order_idx" ON "additives_sources" USING btree ("_order");
  CREATE INDEX "additives_sources_parent_id_idx" ON "additives_sources" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "additives_code_idx" ON "additives" USING btree ("code");
  CREATE INDEX "additives_updated_at_idx" ON "additives" USING btree ("updated_at");
  CREATE INDEX "additives_created_at_idx" ON "additives" USING btree ("created_at");
  CREATE INDEX "countries_aliases_order_idx" ON "countries_aliases" USING btree ("_order");
  CREATE INDEX "countries_aliases_parent_id_idx" ON "countries_aliases" USING btree ("_parent_id");
  CREATE INDEX "countries_name_idx" ON "countries" USING btree ("name");
  CREATE INDEX "countries_updated_at_idx" ON "countries" USING btree ("updated_at");
  CREATE INDEX "countries_created_at_idx" ON "countries" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_topics_id_idx" ON "payload_locked_documents_rels" USING btree ("topics_id");
  CREATE INDEX "payload_locked_documents_rels_brands_id_idx" ON "payload_locked_documents_rels" USING btree ("brands_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_experts_id_idx" ON "payload_locked_documents_rels" USING btree ("experts_id");
  CREATE INDEX "payload_locked_documents_rels_expert_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("expert_rules_id");
  CREATE INDEX "payload_locked_documents_rels_rating_scales_id_idx" ON "payload_locked_documents_rels" USING btree ("rating_scales_id");
  CREATE INDEX "payload_locked_documents_rels_ingredients_id_idx" ON "payload_locked_documents_rels" USING btree ("ingredients_id");
  CREATE INDEX "payload_locked_documents_rels_additives_id_idx" ON "payload_locked_documents_rels" USING btree ("additives_id");
  CREATE INDEX "payload_locked_documents_rels_countries_id_idx" ON "payload_locked_documents_rels" USING btree ("countries_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "topics" CASCADE;
  DROP TABLE "brands" CASCADE;
  DROP TABLE "products_additional_images" CASCADE;
  DROP TABLE "products_allergens" CASCADE;
  DROP TABLE "products_labels" CASCADE;
  DROP TABLE "products_specifications" CASCADE;
  DROP TABLE "products_warnings" CASCADE;
  DROP TABLE "products_prices" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "experts_credentials" CASCADE;
  DROP TABLE "experts" CASCADE;
  DROP TABLE "expert_rules_evidence" CASCADE;
  DROP TABLE "expert_rules_sources" CASCADE;
  DROP TABLE "expert_rules" CASCADE;
  DROP TABLE "rating_scales" CASCADE;
  DROP TABLE "ingredients_aliases" CASCADE;
  DROP TABLE "ingredients" CASCADE;
  DROP TABLE "additives_aliases" CASCADE;
  DROP TABLE "additives_sources" CASCADE;
  DROP TABLE "additives" CASCADE;
  DROP TABLE "countries_aliases" CASCADE;
  DROP TABLE "countries" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_products_allergens";
  DROP TYPE "public"."enum_products_labels";
  DROP TYPE "public"."enum_products_warnings_severity";
  DROP TYPE "public"."enum_products_nutriscore";
  DROP TYPE "public"."enum_products_status";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum_expert_rules_evidence_type";
  DROP TYPE "public"."enum_expert_rules_rule_type";
  DROP TYPE "public"."enum_expert_rules_allergen";
  DROP TYPE "public"."enum_expert_rules_label";
  DROP TYPE "public"."enum_expert_rules_nutrition_field";
  DROP TYPE "public"."enum_additives_function";
  DROP TYPE "public"."enum_additives_risk_level";
  DROP TYPE "public"."enum_additives_halal_status";
  DROP TYPE "public"."enum_additives_is_vegan";`)
}
