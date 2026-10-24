import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload_mcp_api_keys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"label" varchar,
  	"description" varchar,
  	"products_find" boolean DEFAULT false,
  	"products_create" boolean DEFAULT false,
  	"products_update" boolean DEFAULT false,
  	"products_delete" boolean DEFAULT false,
  	"categories_find" boolean DEFAULT false,
  	"categories_create" boolean DEFAULT false,
  	"categories_update" boolean DEFAULT false,
  	"categories_delete" boolean DEFAULT false,
  	"topics_find" boolean DEFAULT false,
  	"topics_create" boolean DEFAULT false,
  	"topics_update" boolean DEFAULT false,
  	"topics_delete" boolean DEFAULT false,
  	"brands_find" boolean DEFAULT false,
  	"brands_create" boolean DEFAULT false,
  	"brands_update" boolean DEFAULT false,
  	"brands_delete" boolean DEFAULT false,
  	"nutrients_find" boolean DEFAULT false,
  	"nutrients_create" boolean DEFAULT false,
  	"nutrients_update" boolean DEFAULT false,
  	"nutrients_delete" boolean DEFAULT false,
  	"allergens_find" boolean DEFAULT false,
  	"allergens_create" boolean DEFAULT false,
  	"allergens_update" boolean DEFAULT false,
  	"allergens_delete" boolean DEFAULT false,
  	"ingredients_find" boolean DEFAULT false,
  	"ingredients_create" boolean DEFAULT false,
  	"ingredients_update" boolean DEFAULT false,
  	"ingredients_delete" boolean DEFAULT false,
  	"additives_find" boolean DEFAULT false,
  	"additives_create" boolean DEFAULT false,
  	"additives_update" boolean DEFAULT false,
  	"additives_delete" boolean DEFAULT false,
  	"countries_find" boolean DEFAULT false,
  	"countries_create" boolean DEFAULT false,
  	"countries_update" boolean DEFAULT false,
  	"countries_delete" boolean DEFAULT false,
  	"rating_scales_find" boolean DEFAULT false,
  	"rating_scales_create" boolean DEFAULT false,
  	"rating_scales_update" boolean DEFAULT false,
  	"rating_scales_delete" boolean DEFAULT false,
  	"experts_find" boolean DEFAULT false,
  	"experts_create" boolean DEFAULT false,
  	"experts_update" boolean DEFAULT false,
  	"experts_delete" boolean DEFAULT false,
  	"expert_rules_find" boolean DEFAULT false,
  	"expert_rules_create" boolean DEFAULT false,
  	"expert_rules_update" boolean DEFAULT false,
  	"expert_rules_delete" boolean DEFAULT false,
  	"pages_find" boolean DEFAULT false,
  	"pages_create" boolean DEFAULT false,
  	"pages_update" boolean DEFAULT false,
  	"pages_delete" boolean DEFAULT false,
  	"payload_mcp_tool_get_product_case_by_barcode" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar
  );
  
  ALTER TABLE "products_items" ALTER COLUMN "percent_estimate" DROP NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "payload_mcp_api_keys" ADD CONSTRAINT "payload_mcp_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "payload_mcp_api_keys_user_idx" ON "payload_mcp_api_keys" USING btree ("user_id");
  CREATE INDEX "payload_mcp_api_keys_updated_at_idx" ON "payload_mcp_api_keys" USING btree ("updated_at");
  CREATE INDEX "payload_mcp_api_keys_created_at_idx" ON "payload_mcp_api_keys" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx" ON "payload_preferences_rels" USING btree ("payload_mcp_api_keys_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_mcp_api_keys" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload_mcp_api_keys" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk";
  
  DROP INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx";
  ALTER TABLE "products_items" ALTER COLUMN "percent_estimate" SET NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "payload_mcp_api_keys_id";`)
}
