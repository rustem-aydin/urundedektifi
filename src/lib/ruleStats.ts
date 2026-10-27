import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

/**
 * Sayfalardaki konu/uzman kural sayaçları.
 *
 * Kural seti 3.900'ü aştığı için sayaç uğruna tüm kuralları çekmek ana sayfayı, /konular
 * ve /uzmanlar'ı saniyelerce bekletiyordu (RSC içinde satır başına maliyet çok yüksek).
 * Bunun yerine tek `GROUP BY` sorgusu çalıştırılır; sonuç 60 sn süreç içi önbellekte tutulur
 * ve kural yazımı/silmesi önbelleği düşürür (bkz. ExpertRules hook'ları).
 */

export type RuleStats = {
  /** topic_id → { rules, experts } */
  byTopic: Map<string, { rules: number; experts: number }>
  /** expert_id → { rules, topics } */
  byExpert: Map<string, { rules: number; topics: number }>
  total: number
}

const TTL_MS = 60_000
let cache: { stats: RuleStats; at: number } | null = null

export function invalidateRuleStats() {
  cache = null
}

export async function ruleStats(payload: Payload): Promise<RuleStats> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.stats

  const db = payload.db as unknown as PostgresAdapter
  const result = (await db.execute({
    drizzle: db.drizzle,
    sql: sql`
      SELECT
        "topic_id",
        "expert_id",
        COUNT(*)::int AS "rules",
        COUNT(DISTINCT "expert_id")::int AS "experts",
        COUNT(DISTINCT "topic_id")::int AS "topics"
      FROM "expert_rules"
      WHERE "is_active" = true
      GROUP BY GROUPING SETS (("topic_id"), ("expert_id"))
    `,
  })) as {
    rows?: {
      topic_id?: number | null
      expert_id?: number | null
      rules?: number | string
      experts?: number | string
      topics?: number | string
    }[]
  }

  const byTopic: RuleStats['byTopic'] = new Map()
  const byExpert: RuleStats['byExpert'] = new Map()
  let total = 0

  for (const row of result.rows ?? []) {
    const rules = Number(row.rules ?? 0)
    if (row.topic_id != null) {
      byTopic.set(String(row.topic_id), { rules, experts: Number(row.experts ?? 0) })
      total += rules
    }
    if (row.expert_id != null) {
      byExpert.set(String(row.expert_id), { rules, topics: Number(row.topics ?? 0) })
    }
  }

  const stats = { byTopic, byExpert, total }
  cache = { stats, at: Date.now() }
  return stats
}
