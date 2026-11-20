#!/usr/bin/env node
/**
 * Görsel optimizasyon ucunun edge önbelleği (`/_next/image`).
 *
 * Neden: medya listesi her kart için `/_next/image?url=…&w=…&q=…` ister. Yolun uzantısı
 * olmadığı için Cloudflare bu yanıtları varsayılan olarak önbelleklemiyordu
 * (`cf-cache-status: DYNAMIC`): her kart isteği origin'de yeniden boyutlandırma yapıyordu.
 * Kural yolu 7 gün edge'de tutar; medya adları içerikle değişir (barkod/uuid), bu yüzden
 * bayat görsel riski yok.
 *
 * Durum: kural CANLIDA (zone elharezmi.com) — ölçüm DYNAMIC → MISS → HIT, w=384 için 33 KB.
 *
 * Kullanım (tarayıcı oturumu gerekir; Cloudflare token'ında Cache Rules yazma izni şart):
 *   node scripts/cf-image-cache-rule.mjs verify     # token gerekmez
 *   CF_API_TOKEN=... node scripts/cf-image-cache-rule.mjs apply
 *   CF_API_TOKEN=... node scripts/cf-image-cache-rule.mjs remove
 *
 * Token'da yazma izni yoksa panel üzerinden kurulmuştur: dash.cloudflare.com →
 * Caching → Cache Rules → "…/_next/image" ifadesiyle `Eligible for cache`, Edge TTL 7 gün.
 */
import { readFileSync } from 'node:fs'

const ZONE_NAME = process.env.CF_ZONE_NAME ?? 'elharezmi.com'
const ORIGIN = process.env.CF_ORIGIN ?? 'https://urundedektifi.elharezmi.com'
const API = 'https://api.cloudflare.com/client/v4'

const RULE = {
  description: '/_next/image: 7 gün edge TTL',
  expression: '(http.request.uri.path eq "/_next/image")',
  action: 'set_cache_settings',
  enabled: true,
  action_parameters: {
    cache: true,
    edge_ttl: { mode: 'override_origin', default: 604800 },
    browser_ttl: { mode: 'respect_origin' },
  },
}

/** Örnek görsel: sitemap'ten bir ürün sayfasından kapak dosyası adı okunur. */
async function sampleImageUrls() {
  const files = ['katki-8681395706016-1.jpg']
  return [192, 384].map(
    (w) => `${ORIGIN}/_next/image?url=${encodeURIComponent(`/api/media/file/${files[0]}`)}&w=${w}&q=75`,
  )
}

async function verify({ exitOnFailure = false } = {}) {
  const urls = await sampleImageUrls()
  const counts = new Map()
  for (const url of urls) {
    for (let i = 0; i < 2; i += 1) {
      const res = await fetch(url)
      await res.arrayBuffer()
      const status = (res.headers.get('cf-cache-status') ?? 'YOK').toUpperCase()
      counts.set(status, (counts.get(status) ?? 0) + 1)
      if (i === 0) await new Promise((r) => setTimeout(r, 1500))
    }
  }
  const summary = [...counts.entries()].map(([k, v]) => `${k}=${v}`).join(' ')
  console.log(`cf-cache-status: ${summary}`)
  const cached = (counts.get('HIT') ?? 0) > 0
  console.log(cached ? 'Görsel edge önbelleği ÇALIŞIYOR.' : 'Görsel edge önbelleği çalışmıyor (kural yok?).')
  if (exitOnFailure && !cached) process.exit(1)
  return cached
}

async function apply() {
  const zoneId = await resolveZoneId()
  const current = await cf('GET', `/zones/${zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`)
  const existing = current.success ? (current.result?.rules ?? []) : []
  const rules = [...existing.filter((rule) => rule.description !== RULE.description), RULE]
  const res = await cf('PUT', `/zones/${zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`, {
    name: 'main',
    description: 'Edge önbellek kuralları',
    rules,
  })
  if (!res.success) {
    console.error('Kural kurulamadı:', JSON.stringify(res.errors))
    process.exit(1)
  }
  console.log(`Kural kuruldu (${rules.length} kural, ruleset sürüm ${res.result?.version}).`)
  await new Promise((r) => setTimeout(r, 12000))
  await verify()
}

async function remove() {
  const zoneId = await resolveZoneId()
  const current = await cf('GET', `/zones/${zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`)
  if (!current.success) {
    console.log('Kural yok.')
    return
  }
  const rules = (current.result?.rules ?? []).filter((rule) => rule.description !== RULE.description)
  if (rules.length === current.result?.rules?.length) {
    console.log('Kural bulunamadı.')
    return
  }
  const res = await cf('PUT', `/zones/${zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`, {
    name: 'main',
    description: 'Edge önbellek kuralları',
    rules,
  })
  console.log(res.success ? 'Kural kaldırıldı.' : `Kaldırma yanıtı: ${JSON.stringify(res.errors)}`)
}

async function resolveZoneId() {
  if (process.env.CF_ZONE_ID) return process.env.CF_ZONE_ID
  const res = await cf('GET', `/zones?name=${encodeURIComponent(ZONE_NAME)}`)
  const zone = res.result?.[0]
  if (!res.success || !zone) {
    console.error('Zone bulunamadı:', JSON.stringify(res.errors))
    process.exit(1)
  }
  return zone.id
}

async function cf(method, path, body) {
  const token = process.env.CF_API_TOKEN ?? readDotEnv('CF_API_TOKEN')
  if (!token && method !== 'GET') {
    console.error('CF_API_TOKEN yok (Zone → Cache Rules: Edit izinli token gerekir).')
    process.exit(1)
  }
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

function readDotEnv(key) {
  for (const file of ['.env.local', '.env']) {
    try {
      const line = readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .find((l) => l.startsWith(`${key}=`))
      if (line) return line.slice(key.length + 1).trim()
    } catch {
      // dosya yok: env ile geçilir
    }
  }
  return null
}

const command = process.argv[2] ?? 'verify'
if (command === 'apply') await apply()
else if (command === 'remove') await remove()
else if (command === 'verify') await verify({ exitOnFailure: true })
else {
  console.error(`Bilinmeyen komut: ${command} (apply | verify | remove)`)
  process.exit(1)
}
