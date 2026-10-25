import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Uzman yazıları (`posts`), uzman kapak görseli ve tüketici takip alanı (`users.following`).
 *
 * Tüm ifadeler idempotenttir: dev-push'un üretimde bıraktığı nesneler migration'ı
 * kırmasın (2026-10-24'te idempotent olmayan migration konteyneri 502'ye düşürmüştü).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
     CREATE TYPE "public"."enum_posts_status" AS ENUM('draft', 'published');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"experts_id" integer
  );
  `)

  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar,
  	"expert_id" integer NOT NULL,
  	"excerpt" varchar,
  	"cover_id" integer,
  	"body" jsonb NOT NULL,
  	"body_markdown" varchar,
  	"status" "enum_posts_status" DEFAULT 'draft' NOT NULL,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  `)

  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"topics_id" integer
  );
  `)

  await db.execute(sql`
   ALTER TABLE "experts" ADD COLUMN IF NOT EXISTS "cover_id" integer;
  `)
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "posts_id" integer;
  `)

  // Foreign key'ler: aynı constraint iki kez eklenmesin.
  await db.execute(sql`
   DO $$ BEGIN
     ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
   DO $$ BEGIN
     ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_experts_fk" FOREIGN KEY ("experts_id") REFERENCES "public"."experts"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
   DO $$ BEGIN
     ALTER TABLE "posts" ADD CONSTRAINT "posts_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
   DO $$ BEGIN
     ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
   DO $$ BEGIN
     ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
   DO $$ BEGIN
     ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
   DO $$ BEGIN
     ALTER TABLE "experts" ADD CONSTRAINT "experts_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
   DO $$ BEGIN
     ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  await db.execute(sql`
   CREATE INDEX IF NOT EXISTS "users_rels_order_idx" ON "users_rels" USING btree ("order");
   CREATE INDEX IF NOT EXISTS "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
   CREATE INDEX IF NOT EXISTS "users_rels_path_idx" ON "users_rels" USING btree ("path");
   CREATE INDEX IF NOT EXISTS "users_rels_experts_id_idx" ON "users_rels" USING btree ("experts_id");
   CREATE UNIQUE INDEX IF NOT EXISTS "posts_slug_idx" ON "posts" USING btree ("slug");
   CREATE INDEX IF NOT EXISTS "posts_expert_idx" ON "posts" USING btree ("expert_id");
   CREATE INDEX IF NOT EXISTS "posts_cover_idx" ON "posts" USING btree ("cover_id");
   CREATE INDEX IF NOT EXISTS "posts_status_idx" ON "posts" USING btree ("status");
   CREATE INDEX IF NOT EXISTS "posts_published_at_idx" ON "posts" USING btree ("published_at");
   CREATE INDEX IF NOT EXISTS "posts_updated_at_idx" ON "posts" USING btree ("updated_at");
   CREATE INDEX IF NOT EXISTS "posts_created_at_idx" ON "posts" USING btree ("created_at");
   CREATE INDEX IF NOT EXISTS "posts_rels_order_idx" ON "posts_rels" USING btree ("order");
   CREATE INDEX IF NOT EXISTS "posts_rels_parent_idx" ON "posts_rels" USING btree ("parent_id");
   CREATE INDEX IF NOT EXISTS "posts_rels_path_idx" ON "posts_rels" USING btree ("path");
   CREATE INDEX IF NOT EXISTS "posts_rels_topics_id_idx" ON "posts_rels" USING btree ("topics_id");
   CREATE INDEX IF NOT EXISTS "experts_cover_idx" ON "experts" USING btree ("cover_id");
   CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("posts_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS "users_rels" CASCADE;
   DROP TABLE IF EXISTS "posts" CASCADE;
   DROP TABLE IF EXISTS "posts_rels" CASCADE;
   ALTER TABLE "experts" DROP CONSTRAINT IF EXISTS "experts_cover_id_media_id_fk";
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_posts_fk";
   DROP INDEX IF EXISTS "experts_cover_idx";
   DROP INDEX IF EXISTS "payload_locked_documents_rels_posts_id_idx";
   ALTER TABLE "experts" DROP COLUMN IF EXISTS "cover_id";
   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "posts_id";
   DROP TYPE IF EXISTS "public"."enum_posts_status";
  `)
}
