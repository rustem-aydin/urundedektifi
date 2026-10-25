import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `product-feedback`: ürün verisi doğrulamaları + yorumlar (ADR 0012).
 *
 * DDL, Payload'ın drizzle şemasından `payload migrate:create` ile üretildi. Tek elle eklenen
 * ifade `product_feedback_vote_unique` kısmi tekil indeksidir ("kullanıcı + ürün + bölüm
 * başına tek oy"); Payload şema anlık görüntüsünde alan düzeyinde karşılığı olmadığı için
 * sonraki `migrate:create` çalışmaları bu indeksi diff'te gösterebilir — indeks korunmalıdır.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_product_feedback_target" AS ENUM('uyarilar', 'icindekiler', 'besin-degerleri', 'genel-bilgiler', 'teknik-ozellikler', 'aciklama');
  CREATE TYPE "public"."enum_product_feedback_kind" AS ENUM('vote', 'comment');
  CREATE TYPE "public"."enum_product_feedback_verdict" AS ENUM('confirm', 'refute');
  CREATE TABLE "product_feedback" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"target" "enum_product_feedback_target",
  	"kind" "enum_product_feedback_kind" DEFAULT 'comment' NOT NULL,
  	"verdict" "enum_product_feedback_verdict",
  	"text" varchar NOT NULL,
  	"author_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "product_feedback_id" integer;
  ALTER TABLE "product_feedback" ADD CONSTRAINT "product_feedback_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "product_feedback" ADD CONSTRAINT "product_feedback_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "product_feedback_product_idx" ON "product_feedback" USING btree ("product_id");
  CREATE INDEX "product_feedback_target_idx" ON "product_feedback" USING btree ("target");
  CREATE INDEX "product_feedback_kind_idx" ON "product_feedback" USING btree ("kind");
  CREATE INDEX "product_feedback_author_idx" ON "product_feedback" USING btree ("author_id");
  CREATE INDEX "product_feedback_updated_at_idx" ON "product_feedback" USING btree ("updated_at");
  CREATE INDEX "product_feedback_created_at_idx" ON "product_feedback" USING btree ("created_at");
  -- Aynı kullanıcı aynı bölüme tek oy: yarış koşulunda ikinci satırı veritabanı reddeder.
  CREATE UNIQUE INDEX "product_feedback_vote_unique" ON "product_feedback" USING btree ("product_id", "target", "author_id") WHERE "kind" = 'vote';
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_product_feedback_fk" FOREIGN KEY ("product_feedback_id") REFERENCES "public"."product_feedback"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_product_feedback_id_idx" ON "payload_locked_documents_rels" USING btree ("product_feedback_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "product_feedback" DISABLE ROW LEVEL SECURITY;
  DROP INDEX "product_feedback_vote_unique";
  DROP TABLE "product_feedback" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_product_feedback_fk";
  
  DROP INDEX "payload_locked_documents_rels_product_feedback_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "product_feedback_id";
  DROP TYPE "public"."enum_product_feedback_target";
  DROP TYPE "public"."enum_product_feedback_kind";
  DROP TYPE "public"."enum_product_feedback_verdict";`)
}
