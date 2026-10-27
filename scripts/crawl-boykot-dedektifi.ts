import fs from 'fs'
import path from 'path'
import { setTimeout as sleep } from 'node:timers/promises'

/**
 * Boykot Dedektifi marka veritabanını kendi sitesinden yeniden üretir.
 *
 * Kaynak: https://boykotdedektifi.com/site-haritasi — 3.950 marka sayfası.
 * Çıktı: src/lib/seed/data/boykot-dedektifi-brands.json (seed planının okuduğu tek veri dosyası).
 *
 * Sayfalar yalnız okunur; eşzamanlılık 8 ile sınırlıdır. Site yapısı değişirse
 * (rozet sınıfı, breadcrumb) betik uyarı basar ve o markayı atlar.
 *
 * Kullanım: node --import tsx/esm scripts/crawl-boykot-dedektifi.ts [--concurrency 8]
 */

const BASE = 'https://boykotdedektifi.com'
const OUT = path.resolve('src/lib/seed/data/boykot-dedektifi-brands.json')

const STATUSES = ['Ahlaken Boykot', 'İkincil Boykot', 'Araştırılıyor', 'Şüpheli', 'Boykot', 'Uygun'] as const
type SiteStatus = (typeof STATUSES)[number]

type SiteBrandRecord = {
  name: string
  siteSlug: string
  status: SiteStatus
  owner: string | null
  country: string | null
  categories: string[]
  about: string | null
  verdict: string | null
  views: number | null
}

function text(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function clean(value: string | null | undefined, maxLength?: number): string | null {
  const normalized = text(value ?? '')
  if (!normalized) return null
  if (!maxLength || normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength).replace(/[ ,.;:]+$/, '')}…`
}

async function fetchText(url: string, tries = 3): Promise<string | null> {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'urundedektifi-seed/1.0' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch {
      if (attempt === tries - 1) return null
      await sleep(1000 * (attempt + 1))
    }
  }
  return null
}

function parseBrand(slug: string, raw: string): SiteBrandRecord | null {
  const crumbs = raw.match(/<nav class="brand-breadcrumb[\s\S]*?<\/nav>/)
  const strong = crumbs?.[0].match(/<strong[^>]*>([\s\S]*?)<\/strong>/)
  const h1 = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)

  let name = strong ? text(strong[1]) : ''
  if (!name && h1) {
    name = text(h1[1])
    for (const status of STATUSES) {
      if (name.endsWith(` ${status}`)) name = name.slice(0, -status.length - 1)
    }
  }
  if (!name) return null

  const badge = raw.match(
    /<div class="status-badge-premium[^"]*"[^>]*style="([^"]*)"[^>]*>\s*(?:<i[^>]*><\/i>)?\s*([\s\S]*?)\s*<\/div>/,
  )
  const statusText = badge ? text(badge[2]) : ''
  const status = STATUSES.find((value) => value === statusText)
  if (!status) return null

  const owner = raw.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*<p class="text-muted small">\s*([\s\S]*?)\s*<\/p>/)
  const categoryLinks = [...raw.matchAll(/<a[^>]*class="category-pill"[^>]*>([\s\S]*?)<\/a>/g)].map((m) =>
    text(m[1]),
  )
  const countryPill = raw.match(/<span class="category-pill">([\s\S]*?)<\/span>/)
  const countryText = countryPill ? text(countryPill[1]) : ''
  const about = raw.match(/<div class="h4 fw-bold">[\s\S]*?Hakkında<\/div>\s*<p[^>]*>([\s\S]*?)<\/p>/)
  const alert = raw.match(/<div class="alert border-0 shadow-sm"[\s\S]*?<\/div>\s*<\/div>/)
  const views = raw.match(/visitor-badge[\s\S]*?<span>([\d.]+)<\/span>/)

  let verdict = alert ? text(alert[0]) : null
  if (verdict) {
    const marker = 'Boykot mu? İsrail malı mı? '
    const at = verdict.indexOf(marker)
    if (at >= 0) verdict = verdict.slice(at + marker.length).trim()
  }

  return {
    name,
    siteSlug: slug,
    status,
    owner: clean(owner?.[1]),
    country: countryText.includes(':') ? clean(countryText.split(':')[1]) : clean(countryText),
    categories: categoryLinks.map((value) => clean(value)).filter((value): value is string => Boolean(value)),
    about: clean(about?.[1], 800),
    verdict: clean(verdict, 1600),
    views: views ? Number(views[1].replace(/\./g, '')) : null,
  }
}

async function main() {
  const concurrencyArg = process.argv.indexOf('--concurrency')
  const concurrency = concurrencyArg > 0 ? Number(process.argv[concurrencyArg + 1]) || 8 : 8

  console.log('Site haritası okunuyor…')
  const sitemap = await fetchText(`${BASE}/site-haritasi`)
  if (!sitemap) throw new Error('Site haritası alınamadı')
  const slugs = [...new Set([...sitemap.matchAll(/href="\/b\/([^"]+)"/g)].map((m) => m[1]))]
  console.log(`Marka sayfası: ${slugs.length}`)

  const records: SiteBrandRecord[] = []
  let cursor = 0
  let skipped = 0

  async function worker() {
    while (cursor < slugs.length) {
      const slug = slugs[cursor++]
      const raw = await fetchText(`${BASE}/b/${slug}`)
      if (!raw) {
        skipped++
        console.warn(`  atlandı (indirilemedi): ${slug}`)
        continue
      }
      const parsed = parseBrand(slug, raw)
      if (!parsed) {
        skipped++
        console.warn(`  atlandı (çözümlenemedi): ${slug}`)
        continue
      }
      records.push(parsed)
      if (records.length % 250 === 0) console.log(`  ${records.length}/${slugs.length}`)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  records.sort((a, b) => a.name.localeCompare(b.name, 'tr'))

  const byStatus = new Map<string, number>()
  for (const record of records) byStatus.set(record.status, (byStatus.get(record.status) ?? 0) + 1)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(records), 'utf8')

  console.log(`\nYazıldı: ${OUT}`)
  console.log(`  Kayıt: ${records.length} (atlanan ${skipped})`)
  console.log(`  Durum: ${[...byStatus].map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  console.log(`  Boyut: ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
