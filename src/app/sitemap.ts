import type { MetadataRoute } from 'next'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { findAllDocs } from '@/lib/findAllDocs'
import { absoluteUrl } from '@/lib/seo'
import type { Category, Expert, ExpertRule, Ingredient, Post, Product, Topic } from '@/payload-types'

export const dynamic = 'force-dynamic'

/**
 * Dinamik site haritası.
 *
 * Yalnız yayındaki ve herkese açık kayıtlar girer. Sorgular sayfalanmış okuma
 * kullanır (`findAllDocs`); katalog büyüdüğünde tek dev `limit: 0` sorgusu
 * açılmaz. Sonuç bir saat bellekte tutulur: her bot isteği veritabanına gitmez.
 */

const CACHE_TTL_MS = 60 * 60 * 1000

let cache: { at: number; entries: MetadataRoute.Sitemap } | null = null

type Entry = MetadataRoute.Sitemap[number]

function entry(
  path: string,
  options: {
    lastModified?: string | Date | null
    changeFrequency?: Entry['changeFrequency']
    priority?: number
  } = {},
): Entry {
  const parsed = options.lastModified ? new Date(options.lastModified) : null
  return {
    url: absoluteUrl(path),
    ...(parsed && !Number.isNaN(parsed.getTime()) ? { lastModified: parsed } : {}),
    changeFrequency: options.changeFrequency ?? 'weekly',
    priority: options.priority ?? 0.6,
  }
}

async function safeFind<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load()
  } catch {
    // Tek koleksiyon okunamazsa site haritası tamamen düşmesin.
    return []
  }
}

function slugPath(prefix: string, slug: string | null | undefined): string | null {
  const clean = (slug ?? '').trim()
  return clean ? `${prefix}/${encodeURIComponent(clean)}` : null
}

function baseEntries(): MetadataRoute.Sitemap {
  return [
    entry('/', { changeFrequency: 'daily', priority: 1 }),
    entry('/urunler', { changeFrequency: 'daily', priority: 0.9 }),
    entry('/kategoriler', { changeFrequency: 'weekly', priority: 0.8 }),
    entry('/konular', { changeFrequency: 'weekly', priority: 0.7 }),
    entry('/uzmanlar', { changeFrequency: 'weekly', priority: 0.8 }),
    entry('/tara', { changeFrequency: 'monthly', priority: 0.6 }),
    entry('/gizlilik', { changeFrequency: 'yearly', priority: 0.2 }),
  ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.entries

  let payload: Payload
  try {
    payload = await getPayload({ config: await config })
  } catch {
    // Veritabanı geçici olarak yoksa site haritası 500 yerine temel sayfaları döner.
    return baseEntries()
  }

  const [products, categories, topics, experts, posts, ingredients, rules] = await Promise.all([
    safeFind(() =>
      findAllDocs<Product>(payload, 'products', {
        where: { status: { equals: 'published' } },
        select: { barcode: true, updatedAt: true },
        pageSize: 2000,
      }),
    ),
    safeFind(() =>
      findAllDocs<Category>(payload, 'categories', {
        select: { slug: true, updatedAt: true },
        pageSize: 500,
      }),
    ),
    safeFind(() =>
      findAllDocs<Topic>(payload, 'topics', {
        select: { slug: true, updatedAt: true },
        pageSize: 500,
      }),
    ),
    safeFind(() =>
      findAllDocs<Expert>(payload, 'experts', {
        where: { isPublic: { equals: true } },
        select: { slug: true, updatedAt: true },
        pageSize: 500,
      }),
    ),
    safeFind(() =>
      findAllDocs<Post>(payload, 'posts', {
        where: { status: { equals: 'published' } },
        select: { slug: true, updatedAt: true },
        pageSize: 500,
      }),
    ),
    safeFind(() =>
      findAllDocs<Ingredient>(payload, 'ingredients', {
        select: { slug: true, updatedAt: true },
        pageSize: 2000,
      }),
    ),
    safeFind(() =>
      findAllDocs<ExpertRule>(payload, 'expert-rules', {
        where: { isActive: { equals: true } },
        select: { updatedAt: true },
        pageSize: 2000,
      }),
    ),
  ])

  const entries = baseEntries()

  for (const product of products) {
    const barcode = (product.barcode ?? '').trim()
    if (!barcode) continue
    entries.push(
      entry(`/urun/${encodeURIComponent(barcode)}`, {
        lastModified: product.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.8,
      }),
    )
  }

  for (const category of categories) {
    const path = slugPath('/kategoriler', category.slug)
    if (!path) continue
    entries.push(
      entry(path, {
        lastModified: category.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.7,
      }),
    )
  }

  for (const topic of topics) {
    const path = slugPath('/konu', topic.slug)
    if (!path) continue
    entries.push(
      entry(path, {
        lastModified: topic.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.6,
      }),
    )
  }

  for (const expert of experts) {
    const path = slugPath('/uzmanlar', expert.slug)
    if (!path) continue
    entries.push(
      entry(path, {
        lastModified: expert.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.7,
      }),
    )
  }

  for (const post of posts) {
    const path = slugPath('/yazilar', post.slug)
    if (!path) continue
    entries.push(
      entry(path, {
        lastModified: post.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.6,
      }),
    )
  }

  for (const ingredient of ingredients) {
    const path = slugPath('/icerik', ingredient.slug)
    if (!path) continue
    entries.push(
      entry(path, {
        lastModified: ingredient.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.5,
      }),
    )
  }

  for (const rule of rules) {
    entries.push(
      entry(`/kural/${encodeURIComponent(String(rule.id))}`, {
        lastModified: rule.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.5,
      }),
    )
  }

  cache = { at: now, entries }
  return entries
}
