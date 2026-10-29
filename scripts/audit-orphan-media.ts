import fs from 'node:fs/promises'
import { z } from 'zod'
import { createPayloadClient, type IdDoc, type PayloadClient } from './lib/payload-rest'

/**
 * Medya kütüphanesindeki SAHİPSİZ (hiçbir dokümanın göstermediği) dosyaları bulur.
 *
 * Ürün, marka, kategori, uzman, yazı, sayfa, kullanıcı ve uzman kuralı
 * kayıtlarının medya alanlarındaki tüm kimlikleri toplar; `media`
 * koleksiyonunda kalan kimlikleri "kullanılmayan dosya" olarak raporlar.
 *
 * Kapsam: karşılaştırma iki katmanda yapılır —
 *   1) CMS: hiçbir dokümanın göstermediği `media` satırları,
 *   2) S3/RustFS: medya satırlarının ürettiği anahtarlarla eşleşmeyen nesneler
 *      (kamuya açık bucket listesi okunabiliyorsa; `--s3-base` ile verilir).
 *
 * Salt okunur: hiçbir şeyi silmez, `--json <dosya>` ile tam listeyi yazar.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/audit-orphan-media.ts
 *   ... --json orphan-media.json --s3-base https://rusts.elharezmi.com/urundedektifi
 */

const API = (process.env.SEED_API_URL ?? 'https://urundedektifi.elharezmi.com/api').replace(
  /\/$/,
  '',
)
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

const jsonArgIndex = process.argv.indexOf('--json')
const jsonPath = jsonArgIndex > -1 ? process.argv[jsonArgIndex + 1] : null
const s3ArgIndex = process.argv.indexOf('--s3-base')
const s3Base =
  s3ArgIndex > -1 ? (process.argv[s3ArgIndex + 1] ?? '').replace(/\/$/, '') : ''

const PAGE_SIZE = 200

/** Koleksiyon başına medya taşıyan alanlar. */
const SOURCES: { collection: string; select: Record<string, boolean> }[] = [
  {
    collection: 'products',
    select: {
      frontImage: true,
      ingredientsImage: true,
      nutritionImage: true,
      recyclingImage: true,
      additionalImages: true,
    },
  },
  { collection: 'brands', select: { logo: true } },
  { collection: 'categories', select: { icon: true } },
  { collection: 'experts', select: { avatar: true, cover: true } },
  { collection: 'posts', select: { cover: true } },
  { collection: 'pages', select: { ogImage: true } },
  { collection: 'users', select: { avatar: true } },
  { collection: 'expert-rules', select: { evidence: true } },
]

const MediaRow = z
  .object({
    id: z.number(),
    filename: z.string().nullish(),
    filesize: z.number().nullish(),
    sizes: z
      .record(z.string(), z.object({ filename: z.string().nullish() }).loose())
      .nullish(),
  })
  .loose()
type MediaRow = z.infer<typeof MediaRow>

/** Bucket listesindeki XML alanlarını çözer. */
function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

type S3Object = { key: string; size: number }

/** Kamuya açık bucket listesini sayfalayarak okur (ListObjectsV2). */
async function listBucketObjects(base: string): Promise<S3Object[]> {
  const objects: S3Object[] = []
  let token = ''
  for (;;) {
    const url = new URL(base)
    url.searchParams.set('list-type', '2')
    url.searchParams.set('max-keys', '1000')
    if (token) url.searchParams.set('continuation-token', token)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`S3 listesi ${res.status}: ${base}`)
    const xml = await res.text()
    for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = match[1].match(/<Key>([\s\S]*?)<\/Key>/)?.[1]
      if (!key) continue
      const size = match[1].match(/<Size>(\d+)<\/Size>/)?.[1]
      objects.push({ key: decodeXml(key), size: Number(size ?? 0) })
    }
    if (!/<IsTruncated>true<\/IsTruncated>/.test(xml)) break
    token = decodeXml(
      xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? '',
    )
    if (!token) break
  }
  return objects
}

/** Bir dokümanın medya alanlarındaki kimlikleri toplar. */
function mediaIdsOf(doc: IdDoc): number[] {
  const ids: number[] = []
  const push = (value: unknown) => {
    if (typeof value === 'number') ids.push(value)
    else if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'number') {
      ids.push(value.id)
    }
  }

  for (const field of [
    'frontImage',
    'ingredientsImage',
    'nutritionImage',
    'recyclingImage',
    'logo',
    'icon',
    'avatar',
    'cover',
    'ogImage',
  ]) {
    push(doc[field])
  }

  const additional = doc.additionalImages
  if (Array.isArray(additional)) {
    for (const row of additional) {
      if (row && typeof row === 'object' && 'image' in row) push(row.image)
    }
  }

  const evidence = doc.evidence
  if (Array.isArray(evidence)) {
    for (const row of evidence) {
      if (row && typeof row === 'object' && 'media' in row) push(row.media)
    }
  }

  return ids
}

async function collectReferenced(client: PayloadClient): Promise<Map<number, string>> {
  const referenced = new Map<number, string>()

  for (const source of SOURCES) {
    let page = 1
    let scanned = 0
    for (;;) {
      const result = await client.find(source.collection, {
        limit: PAGE_SIZE,
        depth: 0,
        page,
        select: source.select,
      })
      for (const doc of result.docs) {
        for (const id of mediaIdsOf(doc)) referenced.set(id, source.collection)
      }
      scanned += result.docs.length
      if (result.docs.length < PAGE_SIZE || scanned >= result.totalDocs) break
      page += 1
    }
    console.log(`  ${source.collection}: ${scanned} kayıt tarandı`)
  }

  return referenced
}

async function collectMedia(client: PayloadClient): Promise<MediaRow[]> {
  const media: MediaRow[] = []
  let page = 1
  for (;;) {
    const result = await client.find('media', {
      limit: PAGE_SIZE,
      depth: 0,
      page,
      sort: 'id',
    })
    media.push(...result.docs.map((doc) => MediaRow.parse(doc)))
    if (result.docs.length < PAGE_SIZE || media.length >= result.totalDocs) break
    page += 1
  }
  return media
}

async function main() {
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })
  console.log(`Hedef: ${client.api}`)
  await client.login()

  const referenced = await collectReferenced(client)
  const media = await collectMedia(client)

  const orphans = media.filter((row) => !referenced.has(row.id))
  const totalBytes = media.reduce((sum, row) => sum + (row.filesize ?? 0), 0)
  const orphanBytes = orphans.reduce((sum, row) => sum + (row.filesize ?? 0), 0)
  const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

  console.log('')
  console.log(`Medya kaydı        : ${media.length}`)
  console.log(`Kullanılan         : ${media.length - orphans.length} (${mb(totalBytes - orphanBytes)})`)
  console.log(`KULLANILMAYAN      : ${orphans.length} (${mb(orphanBytes)})`)

  const biggest = [...orphans].sort((a, b) => (b.filesize ?? 0) - (a.filesize ?? 0)).slice(0, 10)
  if (biggest.length > 0) {
    console.log('\nEn büyük 10 kullanılmayan dosya:')
    for (const row of biggest) {
      console.log(`  ${row.id}\t${mb(row.filesize ?? 0)}\t${row.filename ?? '(adsız)'}`)
    }
  }

  const report: { media: { id: number; filename: string | null; filesize: number }[]; s3?: unknown } =
    {
      media: orphans.map((row) => ({
        id: row.id,
        filename: row.filename ?? null,
        filesize: row.filesize ?? 0,
      })),
    }

  if (s3Base) {
    // Medya satırı olmayan nesneler: silinmiş kayıtların artıkları ve yarım
    // yüklemeler burada görünür. Ters yön de raporlanır: satırı olup nesnesi
    // olmayan dosyalar (kırık görsel).
    const expected = new Set<string>()
    for (const row of media) {
      if (row.filename) expected.add(row.filename)
      for (const size of Object.values(row.sizes ?? {})) {
        if (size?.filename) expected.add(size.filename)
      }
    }

    const objects = await listBucketObjects(s3Base)
    const orphanObjects = objects.filter((object) => !expected.has(object.key))
    const objectKeys = new Set(objects.map((object) => object.key))
    const missingObjects = [...expected].filter((key) => !objectKeys.has(key))
    const orphanObjectBytes = orphanObjects.reduce((sum, object) => sum + object.size, 0)

    console.log('')
    console.log(`Bucket nesnesi     : ${objects.length} (${mb(objects.reduce((sum, o) => sum + o.size, 0))})`)
    console.log(`Nesnesiz medya     : ${missingObjects.length} (kayıt var, dosya yok)`)
    console.log(`KAYITSIZ NESNE     : ${orphanObjects.length} (${mb(orphanObjectBytes)})`)

    const biggestObjects = [...orphanObjects]
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
    if (biggestObjects.length > 0) {
      console.log('\nEn büyük 10 kayıtsız nesne:')
      for (const object of biggestObjects) console.log(`  ${mb(object.size)}\t${object.key}`)
    }
    if (missingObjects.length > 0) {
      console.log('\nDosyası bulunamayan medya (ilk 10):')
      for (const key of missingObjects.slice(0, 10)) console.log(`  ${key}`)
    }

    report.s3 = { objects: objects.length, orphanObjects, missingObjects }
  }

  if (jsonPath) {
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2))
    console.log(`\nListe yazıldı: ${jsonPath}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
