import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * İtiraz kayıtları (`objections`) — ürün görüşüne itiraz formu.
 *
 * DDL elle yazıldı; `migrate:create` mevcut veritabanına göre yalnız bu tabloyu
 * değil, eski elle yazılmış migration'ların ürettiği tabloları da yeniden
 * eklemeye çalışıyordu. Tüm ifadeler idempotenttir: dev-push'un bıraktığı
 * nesneler üretim deploy'unu kırmaz (bkz. 2026-10-24 502 olayı).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
     CREATE TYPE "public"."enum_objections_type" AS ENUM('gorus_dayanak', 'veri_hatasi', 'diger');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  await db.execute(sql`
   DO $$ BEGIN
     CREATE TYPE "public"."enum_objections_status" AS ENUM('new', 'in_review', 'resolved', 'rejected');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "objections" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"type" "enum_objections_type" NOT NULL,
  	"product_barcode" varchar,
  	"product_name" varchar,
  	"expert_name" varchar,
  	"rule_name" varchar,
  	"page_url" varchar,
  	"message" varchar NOT NULL,
  	"ip" varchar,
  	"user_agent" varchar,
  	"status" "enum_objections_status" DEFAULT 'new' NOT NULL,
  	"email_sent" boolean DEFAULT false,
  	"email_error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  `)

  // Panel belge kilidi ilişkisi: Payload her koleksiyon için bu sütunu ister.
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "objections_id" integer;
  `)

  await db.execute(sql`
   DO $$ BEGIN
     ALTER TABLE "payload_locked_documents_rels"
       ADD CONSTRAINT "payload_locked_documents_rels_objections_fk"
       FOREIGN KEY ("objections_id") REFERENCES "public"."objections"("id")
       ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "objections_type_idx" ON "objections" USING btree ("type");
  `)
  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "objections_status_idx" ON "objections" USING btree ("status");
  `)
  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "objections_updated_at_idx" ON "objections" USING btree ("updated_at");
  `)
  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "objections_created_at_idx" ON "objections" USING btree ("created_at");
  `)
  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_objections_id_idx"
     ON "payload_locked_documents_rels" USING btree ("objections_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels"
     DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_objections_fk";
  `)
  await db.execute(sql`
   DROP INDEX IF EXISTS "payload_locked_documents_rels_objections_id_idx";
  `)
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "objections_id";
  `)
  await db.execute(sql`DROP TABLE IF EXISTS "objections" CASCADE;`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_objections_type";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_objections_status";`)
}
