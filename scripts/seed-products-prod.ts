import { setTimeout as sleep } from 'node:timers/promises'
import { z } from 'zod'
import { createPayloadClient } from './lib/payload-rest'
import {
  createOffImporter,
  fetchOffProduct,
  productName,
  type OffProduct,
} from './lib/off-import'

/**
 * Seçili ürünleri (Open Food Facts verisi) UZAK Payload REST API'sine yazar.
 * Ürün başına: barkod, ad, marka, kategori, menşe ülke, içindekiler (master
 * kayıtlara bağlı), alerjen, katkı maddeleri, besin değerleri, etiketler ve
 * gerçek ürün fotoğrafları (ön yüz + içindekiler + besin tablosu) aktarılır.
 *
 * Dönüşüm mantığı `lib/off-import.ts` içindedir; toplu aktarım
 * (`off-bulk-import.ts`) aynı katmanı kullanır.
 *
 * Idempotent: barkoda göre upsert eder (var olan kaydı günceller).
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-products-prod.ts
 */

const API = process.env.SEED_API_URL ?? 'https://urundedektifi.elharezmi.com/api'
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

/** Türkiye pazarında satılan, OFF'ta fotoğraflı ve tam verili 20 ürün. */
const BARCODES = [
  '8690766009205', // Ülker Çizi Peynirli Kraker 70 g
  '8690504028536', // Ülker Dido Sütlü Çikolatalı Gofret 35 g
  '8690504142959', // Ülker Bol Sütlü Kare Çikolata 60 g
  '8690504121541', // Ülker Çokokrem 950 g
  '8690766086473', // Ülker Rulokat 170 g
  '8690526028040', // Eti Karam Bitter 60 g
  '8690526083254', // Eti Tutku Bisküvi 100 g
  '8690526063508', // Eti Burçak Sütlü Çikolatalı Bisküvi 114 g
  '8690526069500', // Eti Lifalif Yulaf Ezmesi 500 g
  '8696362804718', // Heinz Domates Ketçabı 460 g
  '8690574114528', // Pepsi 2,5 L
  '8695077102010', // Dost Tam Yağlı Süt 1 L
  '8690565100530', // Pınar Süt 1 L
  '8692886310711', // Altınkılıç Kefir 1 L
  '8690787251010', // Tadım Kavrulmuş Siyah Ay Çekirdeği 180 g
  '8681630310015', // Züber %100 Fıstık Ezmesi 315 g
  '8695077124685', // Bolbol Mayonez 870 g
  '8683130067796', // Calve Ranch Sos 250 ml
  '5000112672039', // Coca-Cola 1,5 L
  '80135876', // Nutella 400 g
]

const ProductSummary = z
  .object({
    name: z.string(),
    brand: z.object({ name: z.string() }).nullish(),
    category: z.object({ name: z.string() }).nullish(),
    frontImage: z.unknown().nullish(),
  })
  .loose()

async function main() {
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })
  console.log(`Hedef: ${client.api}`)
  await client.login()
  console.log(`  Giriş yapıldı: ${EMAIL}`)

  // Ürünleri OFF'tan çek
  const products: OffProduct[] = []
  for (const barcode of BARCODES) {
    products.push(await fetchOffProduct(barcode))
    await sleep(1200)
  }
  console.log(`  OFF'tan ${products.length} ürün alındı`)

  const importer = await createOffImporter(client, { images: 'all', existing: 'update' })
  await importer.init()
  await importer.prefetchIngredients(products)

  let created = 0
  let updated = 0
  let skipped = 0
  const failures: string[] = []

  for (const product of products) {
    try {
      const result = await importer.importProduct(product)
      if (result.status === 'created') {
        created++
        console.log(`  + ${result.barcode} ${productName(product)} | ${result.items} içindekiler, ${result.nutrition} besin`)
      } else if (result.status === 'updated') {
        updated++
        console.log(`  ↻ ${result.barcode} ${productName(product)} | ${result.items} içindekiler, ${result.nutrition} besin`)
      } else {
        skipped++
        console.log(`  · ${result.barcode} atlandı: ${result.reason}`)
      }
    } catch (error) {
      failures.push(`${product.code}: ${(error as Error).message}`)
      console.log(`  ! ${product.code} atlandı: ${(error as Error).message}`)
    }
  }

  // Doğrulama
  const published = await client.find('products', {
    where: { status: { equals: 'published' } },
    limit: 0,
  })
  const sample = await client.find('products', {
    where: { barcode: { equals: BARCODES[0] } },
    depth: 1,
    limit: 1,
  })
  const doc = sample.docs[0]
  console.log('\nDoğrulama:')
  console.log(`  Yeni ürün: ${created} · Güncellenen: ${updated} · Atlanan: ${skipped} · Hata: ${failures.length}`)
  for (const failure of failures) console.log(`    ! ${failure}`)
  console.log(`  Yayındaki ürün sayısı: ${published.totalDocs}`)
  if (doc) {
    const summary = ProductSummary.parse(doc)
    console.log(
      `  Örnek: ${summary.name} | marka: ${summary.brand?.name ?? '-'} | kategori: ${summary.category?.name ?? '-'} | görsel: ${summary.frontImage ? 'var' : 'yok'}`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
