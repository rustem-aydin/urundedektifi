import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import type { Category } from '@/payload-types'

/**
 * Ürün kategorileri hiyerarşisi (`categories.parent`).
 *
 * Kategori sayfaları tek bir ağaç okur: kökler, alt kategoriler ve yayındaki ürün
 * sayıları. Sayımlar ürün tablosunda tek `GROUP BY` ile alınır; kategori başına
 * ayrı `count` sorgusu açılmaz.
 */

export type CategoryNode = {
  id: string
  name: string
  slug: string
  description: string | null
  iconUrl: string | null
  iconAlt: string | null
  parentId: string | null
  order: number
  /** Yalnız bu kategoriye atanmış yayındaki ürün sayısı. */
  directProductCount: number
  /** Alt kategoriler dahil yayındaki ürün sayısı. */
  productCount: number
  children: CategoryNode[]
}

export type CategoryTree = {
  roots: CategoryNode[]
  all: CategoryNode[]
  byId: Map<string, CategoryNode>
  bySlug: Map<string, CategoryNode>
}

type CategoryRow = Pick<Category, 'id' | 'name' | 'slug' | 'description' | 'icon' | 'parent' | 'order'>

function relationId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'object' && 'id' in value) {
    const id = value.id
    return id == null ? null : String(id)
  }
  return String(value)
}

function iconFields(icon: unknown): { iconUrl: string | null; iconAlt: string | null } {
  if (!icon || typeof icon !== 'object') return { iconUrl: null, iconAlt: null }

  let iconUrl: string | null = null
  let iconAlt: string | null = null
  if ('url' in icon && typeof icon.url === 'string') iconUrl = icon.url
  if ('alt' in icon && typeof icon.alt === 'string') iconAlt = icon.alt

  if ('sizes' in icon && icon.sizes && typeof icon.sizes === 'object' && 'small' in icon.sizes) {
    const small = icon.sizes.small
    if (small && typeof small === 'object' && 'url' in small && typeof small.url === 'string') {
      iconUrl = small.url
    }
  }

  return { iconUrl, iconAlt }
}

/** Kategori → yayındaki ürün sayısı (tek SQL turu). */
async function categoryProductCounts(payload: Payload): Promise<Map<string, number>> {
  // Payload'ın db alanı sürücü tipini generic tutar; postgres adaptörü olduğu config'ten sabit.
  const db = payload.db as unknown as PostgresAdapter
  const executed: unknown = await db.execute({
    drizzle: db.drizzle,
    sql: sql`
      SELECT "category_id", COUNT(*)::int AS "products"
      FROM "products"
      WHERE "status" = 'published' AND "category_id" IS NOT NULL
      GROUP BY "category_id"
    `,
  })

  const rows =
    executed && typeof executed === 'object' && 'rows' in executed && Array.isArray(executed.rows)
      ? executed.rows
      : []

  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const categoryId = 'category_id' in row ? row.category_id : null
    const products = 'products' in row ? row.products : 0
    if (categoryId != null) counts.set(String(categoryId), Number(products ?? 0))
  }
  return counts
}

/** Bir düğümün üst zincirinde döngü var mı? Bozuk CMS verisi ağacı kilitlemesin. */
function inParentCycle(node: CategoryNode, byId: Map<string, CategoryNode>): boolean {
  const seen = new Set<string>([node.id])
  let cursor = node.parentId
  while (cursor) {
    if (seen.has(cursor)) return true
    seen.add(cursor)
    cursor = byId.get(cursor)?.parentId ?? null
  }
  return false
}

function sortNodes(nodes: CategoryNode[]): void {
  nodes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'tr'))
  for (const node of nodes) sortNodes(node.children)
}

export async function loadCategoryTree(payload: Payload): Promise<CategoryTree> {
  const [categories, counts] = await Promise.all([
    payload.find({ collection: 'categories', limit: 500, pagination: false, depth: 1 }),
    categoryProductCounts(payload),
  ])

  const all: CategoryNode[] = categories.docs.map((row: CategoryRow) => {
    const parentId = relationId(row.parent)
    const { iconUrl, iconAlt } = iconFields(row.icon)
    return {
      id: String(row.id),
      name: row.name ?? 'İsimsiz kategori',
      slug: row.slug ?? String(row.id),
      description: row.description ?? null,
      iconUrl,
      iconAlt,
      parentId: parentId === String(row.id) ? null : parentId,
      order: Number(row.order ?? 0),
      directProductCount: counts.get(String(row.id)) ?? 0,
      productCount: 0,
      children: [],
    }
  })

  const byId = new Map(all.map((node) => [node.id, node]))
  const roots: CategoryNode[] = []

  for (const node of all) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    if (parent && !inParentCycle(node, byId)) parent.children.push(node)
    else roots.push(node)
  }

  /** Alt kategori ürünleri üst kategoriye toplanır; döngü artık yok ama yine de korunur. */
  const seen = new Set<string>()
  const total = (node: CategoryNode): number => {
    if (seen.has(node.id)) return 0
    seen.add(node.id)
    const sum = node.children.reduce((acc, child) => acc + total(child), node.directProductCount)
    node.productCount = sum
    return sum
  }
  for (const root of roots) total(root)

  sortNodes(roots)

  return {
    roots,
    all,
    byId,
    bySlug: new Map(all.map((node) => [node.slug, node])),
  }
}

/** Kategori kendisi + tüm torunları (ürün süzgeci için). */
export function categoryDescendantIds(node: CategoryNode): string[] {
  const ids: string[] = []
  const walk = (current: CategoryNode) => {
    ids.push(current.id)
    for (const child of current.children) walk(child)
  }
  walk(node)
  return ids
}

/** Kökten seçili kategoriye kadar üst zincir (kendisi hariç). */
export function categoryAncestors(tree: CategoryTree, node: CategoryNode): CategoryNode[] {
  const chain: CategoryNode[] = []
  const seen = new Set<string>([node.id])
  let cursor = node.parentId ? tree.byId.get(node.parentId) : undefined
  while (cursor && !seen.has(cursor.id)) {
    chain.unshift(cursor)
    seen.add(cursor.id)
    cursor = cursor.parentId ? tree.byId.get(cursor.parentId) : undefined
  }
  return chain
}
