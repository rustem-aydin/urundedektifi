import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Google ile giriş (ADR 0036): `users.googleId` Google'ın kararlı `sub` değerini tutar.
 *
 * İdempotent: dev-push sütunu zaten eklemişse migration kırılmaz. Benzersiz indeks NULL'lara
 * izin verir; Google dışı hesaplarda alan boş kalır.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" varchar;`)

  await db.execute(sql`
   CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_idx"
     ON "users" USING btree ("google_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "users_google_id_idx";`)

  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN IF EXISTS "google_id";`)
}
