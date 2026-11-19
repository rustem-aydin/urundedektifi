#!/usr/bin/env node
/**
 * Ürün dosyası edge önbelleği: Cloudflare Cache Rule kur / doğrula / kaldır.
 *
 * Neden var: Next ürün sayfasını ISR ile 300 sn tutuyor (`x-nextjs-cache: HIT`) ama
 * Cloudflare HTML'i varsayılan olarak önbelleklemiyor (`cf-cache-status: DYNAMIC`),
 * yani her tarama origin'e gidiyor. Kural, `/urun/<barkod>` yanıtlarını 60 sn edge'de
 * tutar (prod ölçümü: 0.129 s → ~0.11 s).
 *
 * Kullanım (CF_API_TOKEN: Zone → Cache Rules → Edit + Zone → Read):
 *   CF_API_TOKEN=... node scripts/cf-cache-rule.mjs apply
 *   CF_API_TOKEN=... node scripts/cf-cache-rule.mjs verify
 *   CF_API_TOKEN=... node scripts/cf-cache-rule.mjs remove
 *
 * `apply` kuralı kurar, hemen doğrular ve önbellek ÇALIŞMIYORSA (tüm yanıtlar
 * DYNAMIC) kuralı kendisi kaldırır: origin `vary: rsc, next-router-state-tree, …`
 * gönderdiği için Cloudflare bu yanıtları önbelleklemiyor olabilir; o durumda kural
 * boşuna durmasın. `--keep` ile otomatik geri alma kapatılır.
 */
import { readFileSync } from 'node:fs'

const ZONE_NAME = process.env.CF_ZONE_NAME ?? 'barkoddedektifi.com'
const API = 'https://api.cloudflare.com/client/v4'
const RULE = {
  description: 'Ürün dosyası HTML/RSC: 60 sn edge TTL',
  expression: '(http.request.uri.path matches "^/urun/[0-9]+/?$")',
  action: 'set_cache_settings',
  enabled: true,
  action_parameters: {
    cache: true,
    edge_ttl: { mode: 'override_origin', default: 60 },
    browser_ttl: { mode: 'respect_origin' },
    serve_stale: { disable_stale_while_updating: true },
  },
}

const token = process.env.CF_API_TOKEN ?? readDotEnv('CF_API_TOKEN')
if (!token) fail('CF_API_TOKEN yok (Zone → Cache Rules: Edit izinli token gerekir).')

const command = process.argv[2] ?? 'verify'
const keep = process.argv.includes('--keep')

const zoneId = process.env.CF_ZONE_ID ?? (await resolveZoneId())

switch (command) {
  case 'apply':
    await apply()
    break
  case 'verify':
    await verify({ exitOnFailure: true })
    break
  case 'remove':
    await remove()
    break
  default:
    fail(`Bilinmeyen komut: ${command} (apply | verify | remove)`)
}

async function apply() {
  const res = await cf('PUT', `/zones/${zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`, {
    name: 'main',
    description: 'Ürün dosyası edge önbelleği (tarama sonrası sayfa açılışı)',
    rules: [RULE],
  })
  if (!res.success) {
    console.error('Kural kurulamadı:', JSON.stringify(res.errors))
    process.exit(1)
  }
  console.log(`Kural kuruldu (ruleset sürüm ${res.result?.version}).`)
  await sleep(3000)
  const ok = await verify({ exitOnFailure: false })
  if (!ok && !keep) {
    console.log('Kural işe yaramadı (yanıtlar DYNAMIC) — geri alınıyor.')
    await remove()
    process.exit(1)
  }
}

async function remove() {
  const res = await cf('DELETE', `/zones/${zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`)
  console.log(res.success ? 'Kural kaldırıldı.' : `Kaldırma yanıtı: ${JSON.stringify(res.errors)}`)
}

/** Örnek URL'ler sitemap'ten: gerçek, yayında ürün dosyaları. */
async function sampleUrls(count = 6) {
  const origin = `https://${ZONE_NAME}`
  const xml = await (await fetch(`${origin}/sitemap.xml`)).text()
  const urls = [...xml.matchAll(/<loc>([^<]*\/urun\/[^<]+)<\/loc>/g)].map((m) => m[1])
  if (urls.length === 0) fail('sitemap.xml içinde /urun/ URL yok; örnek URL bulunamadı.')
  return urls.slice(0, count)
}

async function verify({ exitOnFailure }) {
  const urls = await sampleUrls()
  const counts = new Map()
  const timings = []
  for (const url of urls) {
    for (let i = 0; i < 2; i++) {
      const started = Date.now()
      const res = await fetch(url)
      await res.arrayBuffer()
      const status = (res.headers.get('cf-cache-status') ?? 'YOK').toUpperCase()
      counts.set(status, (counts.get(status) ?? 0) + 1)
      if (i === 1) timings.push(Date.now() - started)
    }
  }
  timings.sort((a, b) => a - b)
  const median = timings[Math.floor(timings.length / 2)]
  const summary = [...counts.entries()].map(([k, v]) => `${k}=${v}`).join(' ')
  console.log(`cf-cache-status: ${summary} | TTFB medyan ~${median} ms (${urls.length} URL)`)

  const cached = (counts.get('HIT') ?? 0) > 0
  console.log(
    cached
      ? 'Edge önbelleği ÇALIŞIYOR.'
      : 'Edge önbelleği çalışmıyor: origin `vary: rsc, …` başlığı engelliyor olabilir.',
  )
  if (exitOnFailure && !cached) process.exit(1)
  return cached
}

async function resolveZoneId() {
  const res = await cf('GET', `/zones?name=${encodeURIComponent(ZONE_NAME)}`)
  const zone = res.result?.[0]
  if (!res.success || !zone) {
    console.error('Zone bulunamadı:', JSON.stringify(res.errors))
    process.exit(1)
  }
  return zone.id
}

async function cf(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
