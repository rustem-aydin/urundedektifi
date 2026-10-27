import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

/**
 * Bir konuda kural yazan uzmanlar.
 *
 * Kural seti 3.900'ü aştığı için "hangi uzmanlar bu konuda yazmış" bilgisi kural
 * satırları çekilerek değil, tek `GROUP BY` ile üretilir (bkz. ruleStats).
 */
export type TopicExpert = { id: string; name: string; slug: string; rules: number }

export async function topicExperts(payload: Payload, topicId: string | number): Promise<TopicExpert[]> {
  const numericId = Number(topicId)
  if (!Number.isFinite(numericId)) return []

  const db = payload.db as unknown as PostgresAdapter
  const result = (await db.execute({
    drizzle: db.drizzle,
    sql: sql`
      SELECT
        e."id" AS "id",
        e."name" AS "name",
        e."slug" AS "slug",
        COUNT(*)::int AS "rules"
      FROM "expert_rules" r
      JOIN "experts" e ON e."id" = r."expert_id"
      WHERE r."topic_id" = ${numericId} AND r."is_active" = true
      GROUP BY e."id", e."name", e."slug"
      ORDER BY e."name"
    `,
  })) as { rows?: { id?: number | string; name?: string; slug?: string; rules?: number | string }[] }

  return (result.rows ?? [])
    .filter((row) => row.id != null && row.name && row.slug)
    .map((row) => ({
      id: String(row.id),
      name: row.name as string,
      slug: row.slug as string,
      rules: Number(row.rules ?? 0),
    }))
}
