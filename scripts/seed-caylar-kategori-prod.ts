import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Amazon.com.tr "Çaylar" kategorisinden (node 22380529031) barkodu doğrulanmış
 * ürünleri UZAK Payload REST API'sine yazar.
 *
 * Barkod kaynağı: ambalaj görselinden ZXing ile okunan EAN-13, ya da Amazon ürün
 * bilgilerindeki "Üretici Referansı" / "Ürün Model Numarası" alanı. Her barkodun
 * kontrol hanesi doğrulandı; görseldeki barkod ile Türkiye barkodu farklıysa
 * Türkiye barkodu ana kayıt yapıldı, diğeri specifications'a yazıldı.
 *
 * Idempotent: marka/içindekiler ad+slug ile, medya alt metni ile, ürün barkod ile upsert edilir.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-caylar-kategori-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const IMAGE_ROOT = path.join(process.cwd(), '.seed-images')
/** Prod Cloudflare rate limitini asmamak icin istekler arasi bekleme. */
const REQUEST_GAP_MS = Number(process.env.SEED_GAP_MS ?? 350)
const MAX_RETRIES = 4

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const CATEGORY_ID = 13 // Kahve & Çay
const COUNTRY_ID = 1 // Türkiye
const PRICE_DATE = '2026-11-20T00:00:00.000Z'

type IngredientRef = { id?: number; name: string; slug?: string }
type BrandRef = { id?: number; name: string; slug: string; country?: string }

type ProductSeed = {
  asin: string
  barcode: string
  name: string
  slug: string
  size: string
  packaging: string
  price: number
  description: string
  brand: BrandRef
  manufacturer: string
  items: IngredientRef[]
  labels: string[]
  storage: string
  usage: string
  specifications: { key: string; value: string }[]
  warnings: { severity: 'low' | 'medium' | 'high'; text: string }[]
  nutrition?: { per: '100g' | '100ml' | 'serving'; items: { nutrient: number; amount: number; unit: string }[] }
  media: { key: string; file: string; alt: string }[]
  frontKey: string
  additional: { key: string; caption: string }[]
}

const PRODUCTS: ProductSeed[] = [
  {
    asin: "B07K8YDLT1",
    barcode: "8690639000315",
    name: "Lipton Yellow Label Dökme Çay 1 kg",
    slug: "lipton-yellow-label-dokme-1kg",
    size: "1000 g",
    packaging: "Folyo iç astarlı kağıt ambalaj (dökme çay)",
    price: 349.9,
    description: "Lipton Yellow Label, Doğu Karadeniz ve dünya çaylarının harmanından üretilen dökme siyah çaydır. Etiketinde 48×3,2 g demlik poşet varyantıyla aynı harman ailesi yer alır; bu kayıt 1000 g dökme ambalaj içindir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B07K8YDLT1) ürün bilgileri ve ürün ambalajı; ambalaj barkodu 8720608617630 görselden okundu, Türkiye barkodu 8690639000315 Amazon 'Üretici Referansı' alanından doğrulandı.",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Demliğe yeterli miktarda çay koyup kaynamış su ekleyin; 10-15 dakika demlendikten sonra servis edin (ambalaj ve ürün açıklaması).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Dökme siyah çay" },
      { key: "Net Miktar", value: "1000 g" },
      { key: "Ambalaj", value: "Folyo astarlı kağıt paket" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "Gıda İşletmecisi", value: "Lipton Gıda ve Çay Sanayi ve Ticaret Anonim Şirketi, İnkılap Mah. Dr. Adnan Büyükdeniz Cad. No:13-8, Ümraniye/İstanbul" },
      { key: "İşletme Kayıt No", value: "TR-54-K-024711" },
      { key: "Tüketici Hattı", value: "0850 822 67 12" },
      { key: "Web", value: "www.lipton.com.tr" },
      { key: "EAN-13 (Türkiye)", value: "8690639000315" },
      { key: "Barkod Kaynağı", value: "Amazon 'Üretici Referansı' + ambalaj görseli" },
      { key: "Ambalaj Barkodu (İhracat)", value: "8720608617630 (paket fotoğrafında basılı)" },
      { key: "Amazon ASIN", value: "B07K8YDLT1" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 349,90 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-yellow-label-dokme-1kg-front.jpg", alt: "Lipton Yellow Label Dökme Çay 1 kg — Ön yüz" },
      { key: "ek1", file: "lipton-yellow-label-dokme-1kg-ek1.jpg", alt: "Lipton Yellow Label Dökme Çay 1 kg — Ambalaj (paket)" },
      { key: "ek2", file: "lipton-yellow-label-dokme-1kg-ek2.jpg", alt: "Lipton Yellow Label Dökme Çay 1 kg — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (paket)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B07K8XP123",
    barcode: "8690639001336",
    name: "Lipton Earl Grey Demlik Poşet Çay 100'lü (320 g)",
    slug: "lipton-earl-grey-demlik-100",
    size: "100 × 3,2 g (320 g)",
    packaging: "Karton kutu, 100 demlik poşet",
    price: 180.87,
    description: "Lipton Earl Grey, Doğu Karadeniz siyah çayının bergamot aromasıyla harmanlandığı demlik poşet çaydır. 100 demlik poşet (320 g) içerir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B07K8XP123) ve ürün ambalajı; ambalaj barkodu 8720608631315 görselden okundu, Türkiye barkodu 8690639001336 Amazon 'Üretici Referansı' alanından doğrulandı.",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
      { id: 4439, name: "Bergamot Aroması" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Bir demlik poşeti demliğe koyun, kaynamış su ekleyip 3-5 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Aromalı siyah çay, demlik poşet" },
      { key: "Çeşit", value: "Earl Grey (bergamot aromalı)" },
      { key: "Net Miktar", value: "320 g" },
      { key: "Poşet Sayısı", value: "100 demlik poşet (poşet başına 3,2 g)" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "Gıda İşletmecisi", value: "Lipton Gıda ve Çay Sanayi ve Ticaret Anonim Şirketi, İnkılap Mah. Dr. Adnan Büyükdeniz Cad. No:13-8, Ümraniye/İstanbul" },
      { key: "İşletme Kayıt No", value: "TR-54-K-024711" },
      { key: "EAN-13 (Türkiye)", value: "8690639001336" },
      { key: "Ambalaj Barkodu (İhracat)", value: "8720608631315 (paket fotoğrafında basılı)" },
      { key: "Amazon ASIN", value: "B07K8XP123" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 180,87 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-earl-grey-demlik-100-front.jpg", alt: "Lipton Earl Grey Demlik Poşet Çay 100'lü (320 g) — Ön yüz" },
      { key: "ek1", file: "lipton-earl-grey-demlik-100-ek1.jpg", alt: "Lipton Earl Grey Demlik Poşet Çay 100'lü (320 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "lipton-earl-grey-demlik-100-ek2.jpg", alt: "Lipton Earl Grey Demlik Poşet Çay 100'lü (320 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B00BB0IHK8",
    barcode: "8720608631360",
    name: "Lipton Yellow Label Demlik Poşet Çay 100'lü (320 g)",
    slug: "lipton-yellow-label-demlik-100",
    size: "100 × 3,2 g (320 g)",
    packaging: "Karton kutu, 100 demlik poşet",
    price: 180.0,
    description: "Lipton Yellow Label demlik poşet çay, özenle harmanlanan siyah çay yapraklarından üretilir; 100 demlik poşet (320 g) içerir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B00BB0IHK8) ve ürün ambalajı; barkod ambalaj görselinden okundu (8720608631360).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Demlik poşetini demliğe koyun, kaynamış su ekleyip birkaç dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Siyah çay, demlik poşet" },
      { key: "Net Miktar", value: "320 g" },
      { key: "Poşet Sayısı", value: "100 demlik poşet (3,2 g)" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "Ürün Ölçüleri", value: "18,6 × 12,5 × 9,7 cm" },
      { key: "EAN-13", value: "8720608631360" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (arka yüz, görselden okundu)" },
      { key: "Amazon ASIN", value: "B00BB0IHK8" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 180,00 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-yellow-label-demlik-100-front.jpg", alt: "Lipton Yellow Label Demlik Poşet Çay 100'lü (320 g) — Ön yüz" },
      { key: "ek1", file: "lipton-yellow-label-demlik-100-ek1.jpg", alt: "Lipton Yellow Label Demlik Poşet Çay 100'lü (320 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "lipton-yellow-label-demlik-100-ek2.jpg", alt: "Lipton Yellow Label Demlik Poşet Çay 100'lü (320 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B00UAQNBOQ",
    barcode: "8720608617500",
    name: "Lipton Earl Grey Dökme Çay 500 g",
    slug: "lipton-earl-grey-dokme-500",
    size: "500 g",
    packaging: "Folyo iç astarlı kağıt ambalaj (dökme çay)",
    price: 234.47,
    description: "Lipton Earl Grey dökme çay, Doğu Karadeniz'de yetişen siyah çay yapraklarının bergamot aromasıyla harmanlanmasıyla üretilir. 500 g dökme ambalaj.\n\nVeri kaynağı: Amazon.com.tr (ASIN B00UAQNBOQ) ve ürün ambalajı; barkod ambalaj görselinden okundu (8720608617500).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
      { id: 4439, name: "Bergamot Aroması" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Demliğe çay koyup kaynamış su ekleyin, 10-15 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Aromalı siyah çay, dökme" },
      { key: "Çeşit", value: "Earl Grey (bergamot aromalı)" },
      { key: "Net Miktar", value: "500 g" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "EAN-13", value: "8720608617500" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B00UAQNBOQ" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 234,47 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-earl-grey-dokme-500-front.jpg", alt: "Lipton Earl Grey Dökme Çay 500 g — Ön yüz" },
      { key: "ek1", file: "lipton-earl-grey-dokme-500-ek1.jpg", alt: "Lipton Earl Grey Dökme Çay 500 g — Ambalaj (arka yüz)" },
      { key: "ek2", file: "lipton-earl-grey-dokme-500-ek2.jpg", alt: "Lipton Earl Grey Dökme Çay 500 g — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B07K27H8X3",
    barcode: "8720608631353",
    name: "Lipton Yellow Label Demlik Poşet Çay 48'li (153 g)",
    slug: "lipton-yellow-label-demlik-48",
    size: "48 × 3,2 g (153 g)",
    packaging: "Karton kutu, 48 demlik poşet",
    price: 104.32,
    description: "Lipton Yellow Label demlik süzen poşet siyah çay; 48 poşet (153 g) içerir. Ambalajda demleme poşetlerinin doğal ağaç liflerinden üretildiği ve ambalajın geri dönüştürülebilir olduğu belirtilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B07K27H8X3) ve ürün ambalajının arka yüzü; barkod görselden okundu (8720608631353).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: ["recyclable"],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Bir poşeti demliğe koyun, kaynamış su ekleyip 5-7 dakika bekletin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Siyah çay, demlik poşet" },
      { key: "Net Miktar", value: "153 g" },
      { key: "Poşet Sayısı", value: "48 demlik poşet (3,2 g)" },
      { key: "Poşet Malzemesi", value: "Doğal ağaç lifi (ambalaj)" },
      { key: "Gıda İşletmecisi", value: "Lipton Gıda ve Çay Sanayi ve Ticaret A.Ş., Ümraniye/İstanbul" },
      { key: "İşletme Kayıt No", value: "TR-54-K-024711" },
      { key: "Tüketici Hattı", value: "0850 822 67 12" },
      { key: "EAN-13", value: "8720608631353" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (arka yüz, görselden okundu)" },
      { key: "Amazon ASIN", value: "B07K27H8X3" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 104,32 TL (20 Kasım 2026)" },
    ],
    warnings: [

    ],
    nutrition: {
        per: "100ml" as const,
        items: [
          { nutrient: 2, amount: 1, unit: "kcal" },
          { nutrient: 1, amount: 4, unit: "kJ" },
          { nutrient: 4, amount: 0, unit: "g" },
          { nutrient: 5, amount: 0, unit: "g" },
          { nutrient: 7, amount: 0, unit: "g" },
          { nutrient: 8, amount: 0, unit: "g" },
          { nutrient: 19, amount: 0.5, unit: "g (en fazla)" },
          { nutrient: 20, amount: 0, unit: "g" },
        ],
      },
    media: [
      { key: "front", file: "lipton-yellow-label-demlik-48-front.jpg", alt: "Lipton Yellow Label Demlik Poşet Çay 48'li (153 g) — Ön yüz" },
      { key: "ek1", file: "lipton-yellow-label-demlik-48-ek1.jpg", alt: "Lipton Yellow Label Demlik Poşet Çay 48'li (153 g) — Ambalaj (ön yüz)" },
      { key: "ek2", file: "lipton-yellow-label-demlik-48-ek2.jpg", alt: "Lipton Yellow Label Demlik Poşet Çay 48'li (153 g) — Ambalaj (yan yüz)" },
      { key: "ek3", file: "lipton-yellow-label-demlik-48-ek3.jpg", alt: "Lipton Yellow Label Demlik Poşet Çay 48'li (153 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (ön yüz)" },
      { key: "ek2", caption: "Ambalaj (yan yüz)" },
      { key: "ek3", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B0CRHPGGNT",
    barcode: "8720608617807",
    name: "Lipton Yellow Label Bardak Poşet Çay 100'lü (200 g)",
    slug: "lipton-yellow-label-bardak-100",
    size: "100 × 2 g (200 g)",
    packaging: "Karton kutu, 100 bardak poşet",
    price: 256.5,
    description: "Lipton Yellow Label bardak poşet siyah çay; 100 adet süzen bardak poşet (200 g) içerir. Tek fincan için pratik demleme.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0CRHPGGNT) ve ürün ambalajı; barkod ambalaj görselinden okundu (8720608617807).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Lipton",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Bir poşeti fincana koyun, kaynamış su ekleyip 2-3 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Siyah çay, bardak poşet" },
      { key: "Net Miktar", value: "200 g" },
      { key: "Poşet Sayısı", value: "100 bardak poşet" },
      { key: "Üretici", value: "Lipton" },
      { key: "EAN-13", value: "8720608617807" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B0CRHPGGNT" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 256,50 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-yellow-label-bardak-100-front.jpg", alt: "Lipton Yellow Label Bardak Poşet Çay 100'lü (200 g) — Ön yüz" },
      { key: "ek1", file: "lipton-yellow-label-bardak-100-ek1.jpg", alt: "Lipton Yellow Label Bardak Poşet Çay 100'lü (200 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "lipton-yellow-label-bardak-100-ek2.jpg", alt: "Lipton Yellow Label Bardak Poşet Çay 100'lü (200 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B0CRHPLYWZ",
    barcode: "8720608617852",
    name: "Lipton Earl Grey Bardak Poşet Çay 100'lü (200 g)",
    slug: "lipton-earl-grey-bardak-100",
    size: "100 × 2 g (200 g)",
    packaging: "Karton kutu, 100 bardak poşet",
    price: 281.39,
    description: "Lipton Earl Grey bardak poşet çay; bergamot aromalı siyah çay, 100 bardak poşet (200 g).\n\nVeri kaynağı: Amazon.com.tr (ASIN B0CRHPLYWZ) ve ürün ambalajı; barkod ambalaj görselinden okundu (8720608617852).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
      { id: 4439, name: "Bergamot Aroması" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Bir poşeti fincana koyun, kaynamış su ekleyip 2-3 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Aromalı siyah çay, bardak poşet" },
      { key: "Çeşit", value: "Earl Grey (bergamot)" },
      { key: "Net Miktar", value: "200 g" },
      { key: "Poşet Sayısı", value: "100 bardak poşet" },
      { key: "EAN-13", value: "8720608617852" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B0CRHPLYWZ" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 281,39 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-earl-grey-bardak-100-front.jpg", alt: "Lipton Earl Grey Bardak Poşet Çay 100'lü (200 g) — Ön yüz" },
      { key: "ek1", file: "lipton-earl-grey-bardak-100-ek1.jpg", alt: "Lipton Earl Grey Bardak Poşet Çay 100'lü (200 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "lipton-earl-grey-bardak-100-ek2.jpg", alt: "Lipton Earl Grey Bardak Poşet Çay 100'lü (200 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B0GS9NSDM4",
    barcode: "5063305011466",
    name: "Lipton Yellow Label Bardak Çay 50'li (100 g)",
    slug: "lipton-yellow-label-bardak-50",
    size: "50 × 2 g (100 g)",
    packaging: "Karton kutu, 50 bardak poşet",
    price: 158.56,
    description: "Lipton Yellow Label 50'li bardak çay; tek fincanlık süzen poşetlerde siyah çay (100 g).\n\nVeri kaynağı: Amazon.com.tr (ASIN B0GS9NSDM4) ve ürün ambalajı; barkod ambalaj görselinden okundu (5063305011466).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Lipton Gıda ve Çay San. ve Tic. A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Bir bardak poşeti fincana koyun, kaynamış su ekleyip 2-3 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Siyah çay, bardak poşet" },
      { key: "Net Miktar", value: "100 g" },
      { key: "Poşet Sayısı", value: "50 bardak poşet" },
      { key: "Üretici", value: "Lipton Gıda ve Çay San. ve Tic. A.Ş." },
      { key: "Üretim Yeri", value: "İnkılap Mah. Dr. Adnan Büyükdeniz Cd. No:13-8, Ümraniye/İstanbul" },
      { key: "EAN-13", value: "5063305011466" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B0GS9NSDM4" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 158,56 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-yellow-label-bardak-50-front.jpg", alt: "Lipton Yellow Label Bardak Çay 50'li (100 g) — Ön yüz" },
      { key: "ek1", file: "lipton-yellow-label-bardak-50-ek1.jpg", alt: "Lipton Yellow Label Bardak Çay 50'li (100 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "lipton-yellow-label-bardak-50-ek2.jpg", alt: "Lipton Yellow Label Bardak Çay 50'li (100 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B0GS9VCQ9N",
    barcode: "5063305011473",
    name: "Lipton Earl Grey Bardak Çay 50'li (100 g)",
    slug: "lipton-earl-grey-bardak-50",
    size: "50 × 2 g (100 g)",
    packaging: "Karton kutu, 50 bardak poşet",
    price: 161.71,
    description: "Lipton Earl Grey 50'li bardak çay; bergamot aromalı siyah çay, 50 bardak poşet (100 g).\n\nVeri kaynağı: Amazon.com.tr (ASIN B0GS9VCQ9N) ve ürün ambalajı; barkod ambalaj görselinden okundu (5063305011473).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
      { id: 4439, name: "Bergamot Aroması" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Bir bardak poşeti fincana koyun, kaynamış su ekleyip 2-3 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Aromalı siyah çay, bardak poşet" },
      { key: "Çeşit", value: "Earl Grey (bergamot)" },
      { key: "Net Miktar", value: "100 g" },
      { key: "Poşet Sayısı", value: "50 bardak poşet" },
      { key: "EAN-13", value: "5063305011473" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B0GS9VCQ9N" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 161,71 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-earl-grey-bardak-50-front.jpg", alt: "Lipton Earl Grey Bardak Çay 50'li (100 g) — Ön yüz" },
      { key: "ek1", file: "lipton-earl-grey-bardak-50-ek1.jpg", alt: "Lipton Earl Grey Bardak Çay 50'li (100 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "lipton-earl-grey-bardak-50-ek2.jpg", alt: "Lipton Earl Grey Bardak Çay 50'li (100 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B07MF98XZ3",
    barcode: "8690637547065",
    name: "Lipton Doğu Karadeniz Bardak Poşet Çay 100'lü (330 g)",
    slug: "lipton-dogu-karadeniz-bardak-100",
    size: "100 × 3,3 g (330 g)",
    packaging: "Karton kutu, 100 bardak poşet",
    price: 188.97,
    description: "Lipton Doğu Karadeniz bardak poşet çay; bölgede yetiştirilen siyah çay yaprakları ve aroma verici (bergamot) içerir, 100 bardak poşet (330 g).\n\nVeri kaynağı: Amazon.com.tr (ASIN B07MF98XZ3) ve ürün ambalajı; ambalaj barkodu 8720608617869 görselden okundu, Türkiye barkodu 8690637547065 Amazon 'Üretici Referansı' alanından doğrulandı.",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
      { id: 4439, name: "Bergamot Aroması" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Bardak poşetini fincana koyun, kaynamış su ekleyip birkaç dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Aromalı siyah çay, bardak poşet" },
      { key: "Net Miktar", value: "330 g" },
      { key: "Poşet Sayısı", value: "100 bardak poşet (3,3 g)" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "EAN-13 (Türkiye)", value: "8690637547065" },
      { key: "Ambalaj Barkodu (İhracat)", value: "8720608617869 (paket fotoğrafında basılı)" },
      { key: "Amazon ASIN", value: "B07MF98XZ3" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 188,97 TL (20 Kasım 2026)" },
      { key: "Alerjen Notu", value: "Ambalajda 'bergamot içerir, orta miktarda kafein içerir' beyanı vardır" },
    ],
    warnings: [
      { severity: "low", text: "Ambalajda 'bergamot içerir ve orta miktarda kafein içermektedir; çocuklar ve hamile kadınlar için tavsiye edilmez' beyanı bulunur." },
    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-dogu-karadeniz-bardak-100-front.jpg", alt: "Lipton Doğu Karadeniz Bardak Poşet Çay 100'lü (330 g) — Ön yüz" },
      { key: "ek1", file: "lipton-dogu-karadeniz-bardak-100-ek1.jpg", alt: "Lipton Doğu Karadeniz Bardak Poşet Çay 100'lü (330 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "lipton-dogu-karadeniz-bardak-100-ek2.jpg", alt: "Lipton Doğu Karadeniz Bardak Poşet Çay 100'lü (330 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B07NVQCV65",
    barcode: "8720608631292",
    name: "Lipton Doğu Karadeniz Demlik Poşet Çay 100'lü (320 g)",
    slug: "lipton-dogu-karadeniz-demlik-100",
    size: "100 × 3,2 g (320 g)",
    packaging: "Karton kutu, 100 demlik poşet",
    price: 156.57,
    description: "Lipton Doğu Karadeniz demlik poşet siyah çay; bölge tarlalarından toplanan yapraklardan üretilir, 100 demlik poşet (320 g).\n\nVeri kaynağı: Amazon.com.tr (ASIN B07NVQCV65) ve ürün ambalajı; barkod ambalaj görselinden okundu (8720608631292).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Demlik poşetini demliğe koyun, kaynamış su ekleyip birkaç dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Siyah çay, demlik poşet" },
      { key: "Net Miktar", value: "320 g" },
      { key: "Poşet Sayısı", value: "100 demlik poşet (3,2 g)" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "EAN-13", value: "8720608631292" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B07NVQCV65" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 156,57 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-dogu-karadeniz-demlik-100-front.jpg", alt: "Lipton Doğu Karadeniz Demlik Poşet Çay 100'lü (320 g) — Ön yüz" },
      { key: "ek1", file: "lipton-dogu-karadeniz-demlik-100-ek1.jpg", alt: "Lipton Doğu Karadeniz Demlik Poşet Çay 100'lü (320 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "lipton-dogu-karadeniz-demlik-100-ek2.jpg", alt: "Lipton Doğu Karadeniz Demlik Poşet Çay 100'lü (320 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B08QTTJB9P",
    barcode: "8690637689826",
    name: "Lipton Extra Dem Demlik Poşet Çay 100'lü (320 g)",
    slug: "lipton-extra-dem-demlik-100",
    size: "100 × 3,2 g (320 g)",
    packaging: "Karton kutu, 100 demlik poşet",
    price: 199.77,
    description: "Lipton Extra Dem, yoğun demli siyah çay; 100 demlik süzen poşet (320 g). Ateş kırmızısı renk ve yoğun tat için Karadeniz yapraklarından üretilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08QTTJB9P) ve ürün ambalajı; ambalaj barkodu 8720608631339 görselden okundu, Türkiye barkodu 8690637689826 Amazon 'Üretici Referansı' alanından doğrulandı.",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Demlik poşetlerini demliğe koyun, kaynamış su ekleyin; her poşetten yaklaşık 3 bardak çay elde edilir (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Siyah çay, demlik poşet" },
      { key: "Seri", value: "Extra Dem" },
      { key: "Net Miktar", value: "320 g" },
      { key: "Poşet Sayısı", value: "100 demlik süzen poşet (3,2 g)" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "EAN-13 (Türkiye)", value: "8690637689826" },
      { key: "Ambalaj Barkodu (İhracat)", value: "8720608631339 (paket fotoğrafında basılı)" },
      { key: "Amazon ASIN", value: "B08QTTJB9P" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 199,77 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde okunur besin tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-extra-dem-demlik-100-front.jpg", alt: "Lipton Extra Dem Demlik Poşet Çay 100'lü (320 g) — Ön yüz" },
      { key: "ek1", file: "lipton-extra-dem-demlik-100-ek1.jpg", alt: "Lipton Extra Dem Demlik Poşet Çay 100'lü (320 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "lipton-extra-dem-demlik-100-ek2.jpg", alt: "Lipton Extra Dem Demlik Poşet Çay 100'lü (320 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B07TXGL1QH",
    barcode: "8690637639418",
    name: "Lipton Extra Dem Dökme Çay 500 g",
    slug: "lipton-extra-dem-dokme-500",
    size: "500 g",
    packaging: "Folyo iç astarlı kağıt ambalaj (dökme çay)",
    price: 234.47,
    description: "Lipton Extra Dem dökme siyah çay; yoğun dem ve ateş kırmızısı renk için Karadeniz yapraklarından harmanlanır. 500 g.\n\nVeri kaynağı: Amazon.com.tr (ASIN B07TXGL1QH) ve ürün ambalajı; ambalaj barkodu 8720608617548 görselden okundu, Türkiye barkodu 8690637639418 Amazon 'Üretici Referansı' alanından doğrulandı.",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Demliğe çay koyup kaynamış su ekleyin, 10-15 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Dökme siyah çay" },
      { key: "Seri", value: "Extra Dem" },
      { key: "Net Miktar", value: "500 g" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "EAN-13 (Türkiye)", value: "8690637639418" },
      { key: "Ambalaj Barkodu (İhracat)", value: "8720608617548 (paket fotoğrafında basılı)" },
      { key: "Amazon ASIN", value: "B07TXGL1QH" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 234,47 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-extra-dem-dokme-500-front.jpg", alt: "Lipton Extra Dem Dökme Çay 500 g — Ön yüz" },
      { key: "ek1", file: "lipton-extra-dem-dokme-500-ek1.jpg", alt: "Lipton Extra Dem Dökme Çay 500 g — Ambalaj (arka yüz)" },
      { key: "ek2", file: "lipton-extra-dem-dokme-500-ek2.jpg", alt: "Lipton Extra Dem Dökme Çay 500 g — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B07JDBSMVP",
    barcode: "8720608617487",
    name: "Lipton Doğu Karadeniz Dökme Çay 1 kg",
    slug: "lipton-dogu-karadeniz-dokme-1kg",
    size: "1000 g",
    packaging: "Folyo iç astarlı kağıt ambalaj (dökme çay)",
    price: 369.9,
    description: "Lipton Doğu Karadeniz dökme siyah çay; bölge tarlalarından toplanan yapraklardan üretilir, 1000 g. Amazon'da aynı barkodla 2'li paket (B0G1KN7Q8Z) de satılır; bu kayıt tekil 1 kg ambalaj içindir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B07JDBSMVP) ve ürün ambalajı; barkod ambalaj görselinden okundu (8720608617487).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Demliğe çay koyup kaynamış su ekleyin, 10-15 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Dökme siyah çay" },
      { key: "Net Miktar", value: "1000 g" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "Ürün Ölçüleri", value: "13,5 × 9,7 × 23 cm" },
      { key: "EAN-13", value: "8720608617487" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B07JDBSMVP" },
      { key: "Çoklu Paket Notu", value: "Amazon.com.tr'de aynı barkodla 2'li paket listelenir: B0G1KN7Q8Z — 580,00 TL (2 × 1000 g)" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 369,90 TL (tekil 1 kg, 20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-dogu-karadeniz-dokme-1kg-front.jpg", alt: "Lipton Doğu Karadeniz Dökme Çay 1 kg — Ön yüz" },
      { key: "ek1", file: "lipton-dogu-karadeniz-dokme-1kg-ek1.jpg", alt: "Lipton Doğu Karadeniz Dökme Çay 1 kg — Ambalaj (arka yüz)" },
      { key: "ek2", file: "lipton-dogu-karadeniz-dokme-1kg-ek2.jpg", alt: "Lipton Doğu Karadeniz Dökme Çay 1 kg — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B08B4Z3H6M",
    barcode: "8720608617470",
    name: "Lipton Doğu Karadeniz Dökme Çay 500 g",
    slug: "lipton-dogu-karadeniz-dokme-500",
    size: "500 g",
    packaging: "Folyo iç astarlı kağıt ambalaj (dökme çay)",
    price: 185.47,
    description: "Lipton Doğu Karadeniz dökme siyah çay; siyah çay ve aroma verici (bergamot) içerir, 500 g.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08B4Z3H6M) ve ürün ambalajı; barkod ambalaj görselinden okundu (8720608617470).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Unilever Sanayi ve Tic. Türk A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
      { id: 4439, name: "Bergamot Aroması" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Demliğe çay koyup kaynamış su ekleyin, 10-15 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Dökme siyah çay" },
      { key: "Net Miktar", value: "500 g" },
      { key: "Üretici", value: "Unilever Sanayi ve Tic. Türk A.Ş." },
      { key: "EAN-13", value: "8720608617470" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B08B4Z3H6M" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 185,47 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-dogu-karadeniz-dokme-500-front.jpg", alt: "Lipton Doğu Karadeniz Dökme Çay 500 g — Ön yüz" },
      { key: "ek1", file: "lipton-dogu-karadeniz-dokme-500-ek1.jpg", alt: "Lipton Doğu Karadeniz Dökme Çay 500 g — Ambalaj (arka yüz)" },
      { key: "ek2", file: "lipton-dogu-karadeniz-dokme-500-ek2.jpg", alt: "Lipton Doğu Karadeniz Dökme Çay 500 g — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B08R5SWSP8",
    barcode: "8720608631322",
    name: "Lipton Earl Grey Bergamot Demlik Poşet Çay 48'li (180 g)",
    slug: "lipton-earl-grey-demlik-48",
    size: "48 × 3,75 g (180 g)",
    packaging: "Karton kutu, 48 demlik poşet",
    price: 104.32,
    description: "Lipton Earl Grey bergamot aromalı demlik poşet çay; 48 poşet (180 g).\n\nVeri kaynağı: Amazon.com.tr (ASIN B08R5SWSP8) ve ürün ambalajı; barkod ambalaj görselinden okundu (8720608631322).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
      { id: 4439, name: "Bergamot Aroması" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Demlik poşetini demliğe koyun, kaynamış su ekleyip birkaç dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Aromalı siyah çay, demlik poşet" },
      { key: "Çeşit", value: "Earl Grey (bergamot)" },
      { key: "Net Miktar", value: "180 g" },
      { key: "Poşet Sayısı", value: "48 demlik poşet" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "Kafein", value: "Yarım kafeinli (Amazon ürün bilgisi)" },
      { key: "EAN-13", value: "8720608631322" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B08R5SWSP8" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 104,32 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-earl-grey-demlik-48-front.jpg", alt: "Lipton Earl Grey Bergamot Demlik Poşet Çay 48'li (180 g) — Ön yüz" },
      { key: "ek1", file: "lipton-earl-grey-demlik-48-ek1.jpg", alt: "Lipton Earl Grey Bergamot Demlik Poşet Çay 48'li (180 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "lipton-earl-grey-demlik-48-ek2.jpg", alt: "Lipton Earl Grey Bergamot Demlik Poşet Çay 48'li (180 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B00W5I2RLU",
    barcode: "0054881013666",
    name: "Ahmad Tea Detox Karışık Bitki Çayı 20'li (40 g)",
    slug: "ahmad-tea-detox-20",
    size: "20 × 2 g (40 g)",
    packaging: "Karton kutu, 20 poşet",
    price: 189.9,
    description: "Ahmad Tea Detox, otlar, kökler ve yapraklardan oluşan kafeinsiz bitki çayı karışımıdır: rezene, nane, biberiye, ısırgan yaprağı, zencefil kökü, huş yaprağı, karahindiba kökü ve tatlı böğürtlen yaprağı. 20 poşet (40 g), menşe Almanya.\n\nVeri kaynağı: Amazon.com.tr (ASIN B00W5I2RLU) ve ürün ambalajı; barkod ambalaj görselinden okundu (0054881013666).",
    brand: { id: 2086, name: "Ahmad Tea", slug: "ahmad-tea" },
    manufacturer: "Ahmad Tea",
    items: [
      { id: 1975, name: "Rezene" },
      { id: 710, name: "nane" },
      { id: 3806, name: "Biberiye" },
      { id: 4767, name: "Isırgan" },
      { id: 1561, name: "zencefil" },
      { name: "Huş ağacı yaprağı", slug: "hus-agaci-yapragi" },
      { name: "Karahindiba kökü", slug: "karahindiba-koku" },
      { name: "Karahindiba", slug: "karahindiba" },
      { name: "Tatlı böğürtlen yaprağı", slug: "tatli-bogurtlen-yapragi" },
    ],
    labels: [],
    storage: "Serin ve kuru ortamda muhafaza edin; açıldıktan sonra kapalı kapta saklayın (ambalaj).",
    usage: "Bir poşeti fincana koyup 200 ml sıcak su ekleyin, 5 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Ahmad Tea" },
      { key: "Ürün Tipi", value: "Bitki çayı karışımı, poşet" },
      { key: "Net Miktar", value: "40 g" },
      { key: "Poşet Sayısı", value: "20 poşet (2 g)" },
      { key: "Menşe", value: "Almanya (ambalaj)" },
      { key: "Kafein", value: "Kafeinsiz (ambalaj)" },
      { key: "Üretici", value: "Ahmad Tea" },
      { key: "Türkiye Distribütörü", value: "Barbaros Mah. Akzambak Sk. Uphill Towers A1 Blok No:61, Ataşehir/İstanbul" },
      { key: "Demleme", value: "5 dakika" },
      { key: "EAN-13", value: "0054881013666" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B00W5I2RLU" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 189,90 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "ahmad-tea-detox-20-front.jpg", alt: "Ahmad Tea Detox Karışık Bitki Çayı 20'li (40 g) — Ön yüz" },
      { key: "ek1", file: "ahmad-tea-detox-20-ek1.jpg", alt: "Ahmad Tea Detox Karışık Bitki Çayı 20'li (40 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "ahmad-tea-detox-20-ek2.jpg", alt: "Ahmad Tea Detox Karışık Bitki Çayı 20'li (40 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B091RGG2R6",
    barcode: "0054881021500",
    name: "Ahmad Tea Earl Grey Demlik Poşet Çay 100'lü (200 g)",
    slug: "ahmad-tea-earl-grey-demlik-100",
    size: "100 × 2 g (200 g)",
    packaging: "Karton kutu, 100 demlik poşet",
    price: 439.0,
    description: "Ahmad Tea Earl Grey demlik poşet çay; Kenya menşeli siyah çay ve bergamot aroması. 100 demlik poşet.\n\nVeri kaynağı: Amazon.com.tr (ASIN B091RGG2R6) ve ürün ambalajı; barkod ambalaj görselinden okundu (0054881021500).",
    brand: { id: 2086, name: "Ahmad Tea", slug: "ahmad-tea" },
    manufacturer: "Ahmad Tea",
    items: [
      { id: 850, name: "Siyah çay" },
      { id: 4439, name: "Bergamot Aroması" },
    ],
    labels: [],
    storage: "Serin ve kuru ortamda muhafaza edin (ambalaj).",
    usage: "Suyu kaynatıp 3-5 dakika demleyin; her bardak için bir poşet (ambalaj).",
    specifications: [
      { key: "Marka", value: "Ahmad Tea" },
      { key: "Ürün Tipi", value: "Aromalı siyah çay, demlik poşet" },
      { key: "Çeşit", value: "Earl Grey" },
      { key: "Menşe", value: "Kenya (ambalaj)" },
      { key: "Poşet Sayısı", value: "100 demlik poşet (2 g)" },
      { key: "Demleme", value: "3-5 dakika" },
      { key: "EAN-13", value: "0054881021500" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B091RGG2R6" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 439,00 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [
      { severity: "low", text: "Kafein içerir; çocuklar veya hamile kadınlar için önerilmez (ambalaj)." },
    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "ahmad-tea-earl-grey-demlik-100-front.jpg", alt: "Ahmad Tea Earl Grey Demlik Poşet Çay 100'lü (200 g) — Ön yüz" },
      { key: "ek1", file: "ahmad-tea-earl-grey-demlik-100-ek1.jpg", alt: "Ahmad Tea Earl Grey Demlik Poşet Çay 100'lü (200 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "ahmad-tea-earl-grey-demlik-100-ek2.jpg", alt: "Ahmad Tea Earl Grey Demlik Poşet Çay 100'lü (200 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B0GPX3GPWG",
    barcode: "0054881028004",
    name: "Ahmad Tea Classic Earl Grey Demlik Poşet 40'lı (80 g)",
    slug: "ahmad-tea-classic-earl-grey-40",
    size: "40 × 2 g (80 g)",
    packaging: "Karton kutu, 40 demlik poşet",
    price: 149.95,
    description: "Ahmad Tea Classic Earl Grey, ithal siyah çay ve bergamot aromasıyla hazırlanan demlik poşet çaydır; 40 poşet.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0GPX3GPWG) ve ürün ambalajı; barkod ambalaj görselinden okundu (0054881028004).",
    brand: { id: 2086, name: "Ahmad Tea", slug: "ahmad-tea" },
    manufacturer: "Ahmad Tea",
    items: [
      { id: 850, name: "Siyah çay" },
      { id: 4439, name: "Bergamot Aroması" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayınız (ambalaj).",
    usage: "Kaynamış suda 3-5 dakika demleyiniz (ambalaj).",
    specifications: [
      { key: "Marka", value: "Ahmad Tea" },
      { key: "Ürün Tipi", value: "Aromalı siyah çay, demlik poşet" },
      { key: "Çeşit", value: "Earl Grey" },
      { key: "Ana Bileşen Menşei", value: "Kenya (ürün açıklaması)" },
      { key: "Poşet Sayısı", value: "40 demlik poşet (2 g)" },
      { key: "Türkiye Distribütörü", value: "Barbaros Mah. Akzambak Sk. Uphill Towers A1 Blok No:61, Ataşehir/İstanbul" },
      { key: "Demleme", value: "3-5 dakika" },
      { key: "EAN-13", value: "0054881028004" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B0GPX3GPWG" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 149,95 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "ahmad-tea-classic-earl-grey-40-front.jpg", alt: "Ahmad Tea Classic Earl Grey Demlik Poşet 40'lı (80 g) — Ön yüz" },
      { key: "ek1", file: "ahmad-tea-classic-earl-grey-40-ek1.jpg", alt: "Ahmad Tea Classic Earl Grey Demlik Poşet 40'lı (80 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "ahmad-tea-classic-earl-grey-40-ek2.jpg", alt: "Ahmad Tea Classic Earl Grey Demlik Poşet 40'lı (80 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B0GPX8CMFN",
    barcode: "0054881027038",
    name: "Ahmad Tea Classic English Breakfast Demlik Poşet 40'lı (80 g)",
    slug: "ahmad-tea-english-breakfast-40",
    size: "40 × 2 g (80 g)",
    packaging: "Karton kutu, 40 demlik poşet",
    price: 159.9,
    description: "Ahmad Tea Classic English Breakfast demlik poşet çay; ithal siyah çay, 40 poşet.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0GPX8CMFN) ve ürün ambalajı; barkod ambalaj görselinden okundu (0054881027038). Amazon açıklaması bu ürün için de 'bergamot aromalı' şablon metnini taşıyor; ambalaj ve ürün adı sade English Breakfast'tır.",
    brand: { id: 2086, name: "Ahmad Tea", slug: "ahmad-tea" },
    manufacturer: "Ahmad Tea",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayınız (ambalaj).",
    usage: "Kaynamış suda 3-5 dakika demleyiniz (ambalaj).",
    specifications: [
      { key: "Marka", value: "Ahmad Tea" },
      { key: "Ürün Tipi", value: "Siyah çay, demlik poşet" },
      { key: "Çeşit", value: "English Breakfast" },
      { key: "Poşet Sayısı", value: "40 demlik poşet (2 g)" },
      { key: "Türkiye Distribütörü", value: "Barbaros Mah. Akzambak Sk. Uphill Towers A1 Blok No:61, Ataşehir/İstanbul" },
      { key: "Demleme", value: "3-5 dakika" },
      { key: "EAN-13", value: "0054881027038" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B0GPX8CMFN" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 159,90 TL (20 Kasım 2026)" },
      { key: "Açıklama Notu", value: "Amazon açıklamasındaki 'bergamot aromalı' ifadesi şablon metindir; ürün sade English Breakfast" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "ahmad-tea-english-breakfast-40-front.jpg", alt: "Ahmad Tea Classic English Breakfast Demlik Poşet 40'lı (80 g) — Ön yüz" },
      { key: "ek1", file: "ahmad-tea-english-breakfast-40-ek1.jpg", alt: "Ahmad Tea Classic English Breakfast Demlik Poşet 40'lı (80 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "ahmad-tea-english-breakfast-40-ek2.jpg", alt: "Ahmad Tea Classic English Breakfast Demlik Poşet 40'lı (80 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B0GPX9ZXZV",
    barcode: "0054881030526",
    name: "Ahmad Tea Classic English Tea No:1 Demlik Poşet 40'lı (80 g)",
    slug: "ahmad-tea-english-tea-no1-40",
    size: "40 × 2 g (80 g)",
    packaging: "Karton kutu, 40 demlik poşet",
    price: 214.0,
    description: "Ahmad Tea Classic English Tea No:1, hafif bergamot aromalı ithal siyah çay; 40 demlik poşet. Ana bileşen menşei Kenya.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0GPX9ZXZV) ve ürün ambalajı; barkod ambalaj görselinden okundu (0054881030526).",
    brand: { id: 2086, name: "Ahmad Tea", slug: "ahmad-tea" },
    manufacturer: "Ahmad Tea",
    items: [
      { id: 850, name: "Siyah çay" },
      { id: 4439, name: "Bergamot Aroması" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayınız (ambalaj).",
    usage: "Kaynamış suda 3-5 dakika demleyiniz (ambalaj).",
    specifications: [
      { key: "Marka", value: "Ahmad Tea" },
      { key: "Ürün Tipi", value: "Aromalı siyah çay, demlik poşet" },
      { key: "Çeşit", value: "English Tea No:1 (hafif bergamot)" },
      { key: "Ana Bileşen Menşei", value: "Kenya (ürün açıklaması)" },
      { key: "Poşet Sayısı", value: "40 demlik poşet (2 g)" },
      { key: "Demleme", value: "3-5 dakika" },
      { key: "EAN-13", value: "0054881030526" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B0GPX9ZXZV" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 214,00 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "ahmad-tea-english-tea-no1-40-front.jpg", alt: "Ahmad Tea Classic English Tea No:1 Demlik Poşet 40'lı (80 g) — Ön yüz" },
      { key: "ek1", file: "ahmad-tea-english-tea-no1-40-ek1.jpg", alt: "Ahmad Tea Classic English Tea No:1 Demlik Poşet 40'lı (80 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "ahmad-tea-english-tea-no1-40-ek2.jpg", alt: "Ahmad Tea Classic English Tea No:1 Demlik Poşet 40'lı (80 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B0GPXQHMN6",
    barcode: "0054881030519",
    name: "Ahmad Tea Classic Ceylon Demlik Poşet 40'lı (80 g)",
    slug: "ahmad-tea-classic-ceylon-40",
    size: "40 × 2 g (80 g)",
    packaging: "Karton kutu, 40 demlik poşet",
    price: 159.9,
    description: "Ahmad Tea Classic Ceylon, Sri Lanka menşeli ithal siyah çay; 40 demlik poşet.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0GPXQHMN6) ve ürün ambalajı; barkod ambalaj görselinden okundu (0054881030519).",
    brand: { id: 2086, name: "Ahmad Tea", slug: "ahmad-tea" },
    manufacturer: "Ahmad Tea",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayınız (ambalaj).",
    usage: "Kaynamış suda 3-5 dakika demleyiniz (ambalaj).",
    specifications: [
      { key: "Marka", value: "Ahmad Tea" },
      { key: "Ürün Tipi", value: "Siyah çay, demlik poşet" },
      { key: "Çeşit", value: "Ceylon" },
      { key: "Ana Bileşen Menşei", value: "Sri Lanka (ürün açıklaması)" },
      { key: "Poşet Sayısı", value: "40 demlik poşet (2 g)" },
      { key: "Demleme", value: "3-5 dakika" },
      { key: "EAN-13", value: "0054881030519" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B0GPXQHMN6" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 159,90 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "ahmad-tea-classic-ceylon-40-front.jpg", alt: "Ahmad Tea Classic Ceylon Demlik Poşet 40'lı (80 g) — Ön yüz" },
      { key: "ek1", file: "ahmad-tea-classic-ceylon-40-ek1.jpg", alt: "Ahmad Tea Classic Ceylon Demlik Poşet 40'lı (80 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "ahmad-tea-classic-ceylon-40-ek2.jpg", alt: "Ahmad Tea Classic Ceylon Demlik Poşet 40'lı (80 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B07JF1HXYQ",
    barcode: "8690637055003",
    name: "Lipton Sade Bardak Süzen Poşet Yeşil Çay 20'li (30 g)",
    slug: "lipton-yesil-cay-bardak-20",
    size: "20 × 1,5 g (30 g)",
    packaging: "Karton kutu, 20 süzen bardak poşet",
    price: 123.9,
    description: "Lipton Sade Yeşil Çay bardak poşet; 20 adet süzen bardak poşet (30 g). Sade yeşil çay.\n\nVeri kaynağı: Amazon.com.tr (ASIN B07JF1HXYQ) ve ürün ambalajı; barkod Amazon 'Üretici Referansı' alanından (8690637055003, EAN-13 kontrol hanesi doğrulandı).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 2504, name: "Yeşil çay" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Bir fincana yaklaşık 80 °C sıcak su dökün, poşeti koyup 2-3 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Yeşil çay, bardak poşet" },
      { key: "Net Miktar", value: "30 g" },
      { key: "Poşet Sayısı", value: "20 süzen bardak poşet" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "Demleme", value: "80 °C su, 2-3 dakika" },
      { key: "EAN-13", value: "8690637055003" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr urun bilgileri, Üretici Referansı" },
      { key: "Amazon ASIN", value: "B07JF1HXYQ" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 123,90 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-yesil-cay-bardak-20-front.jpg", alt: "Lipton Sade Bardak Süzen Poşet Yeşil Çay 20'li (30 g) — Ön yüz" },
      { key: "ek1", file: "lipton-yesil-cay-bardak-20-ek1.jpg", alt: "Lipton Sade Bardak Süzen Poşet Yeşil Çay 20'li (30 g) — Ambalaj (arka yüz)" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
    ],
  },
  {
    asin: "B08L9V6SZZ",
    barcode: "8690637054983",
    name: "Lipton Berrak Limonlu Yeşil Çay Bardak Poşet 20'li (30 g)",
    slug: "lipton-limonlu-yesil-cay-20",
    size: "20 × 1,5 g (30 g)",
    packaging: "Karton kutu, 20 süzen bardak poşet",
    price: 71.96,
    description: "Lipton Berrak Limonlu Yeşil Çay, limon ve yeşil çayı buluşturan bardak poşet çaydır; 20 poşet (30 g). Etikette yeşil çay (%77), doğal aroma vericiler ve limon kabuğu (%10) belirtilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08L9V6SZZ) ve ürün ambalajı; barkod Amazon 'Üretici Referansı' alanından (8690637054983).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 2504, name: "Yeşil çay" },
      { name: "Limon kabuğu", slug: "limon-kabugu" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Bir fincan suya bir poşet çay koyun; suyu 80 °C'ye ısıtıp 2-3 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Aromalı yeşil çay, bardak poşet" },
      { key: "İçindekiler (Ambalaj)", value: "Yeşil çay (%77), doğal aroma vericiler, limon kabuğu (%10)" },
      { key: "Net Miktar", value: "30 g" },
      { key: "Poşet Sayısı", value: "20 süzen bardak poşet" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "Demleme", value: "80 °C su, 2-3 dakika" },
      { key: "EAN-13", value: "8690637054983" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr urun bilgileri, Üretici Referansı" },
      { key: "Amazon ASIN", value: "B08L9V6SZZ" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 71,96 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-limonlu-yesil-cay-20-front.jpg", alt: "Lipton Berrak Limonlu Yeşil Çay Bardak Poşet 20'li (30 g) — Ön yüz" },
      { key: "ek1", file: "lipton-limonlu-yesil-cay-20-ek1.jpg", alt: "Lipton Berrak Limonlu Yeşil Çay Bardak Poşet 20'li (30 g) — Ambalaj (arka yüz)" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
    ],
  },
  {
    asin: "B08QV7P2Q7",
    barcode: "8690637019463",
    name: "Lipton Papatya Bitki Çayı 20'li (30 g)",
    slug: "lipton-papatya-20",
    size: "20 × 1,5 g (30 g)",
    packaging: "Karton kutu, 20 süzen bardak poşet",
    price: 76.89,
    description: "Lipton Papatya bitki çayı; %100 papatya içeren 20 süzen bardak poşet.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08QV7P2Q7) ve ürün ambalajı; barkod Amazon 'Üretici Referansı' alanından (8690637019463).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 1547, name: "Mayıs papatyası" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Bir fincana sıcak su doldurup poşeti koyun, 3-4 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Bitki çayı, bardak poşet" },
      { key: "İçindekiler (Ambalaj)", value: "Mayıs papatyası (%100)" },
      { key: "Net Miktar", value: "30 g" },
      { key: "Poşet Sayısı", value: "20 süzen bardak poşet" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "Kafein", value: "Kafeinsiz" },
      { key: "EAN-13", value: "8690637019463" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr urun bilgileri, Üretici Referansı" },
      { key: "Amazon ASIN", value: "B08QV7P2Q7" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 76,89 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-papatya-20-front.jpg", alt: "Lipton Papatya Bitki Çayı 20'li (30 g) — Ön yüz" },
      { key: "ek1", file: "lipton-papatya-20-ek1.jpg", alt: "Lipton Papatya Bitki Çayı 20'li (30 g) — Ambalaj (arka yüz)" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
    ],
  },
  {
    asin: "B08R6MQNB6",
    barcode: "8690637035043",
    name: "Lipton Rezene Bitki Çayı 20'li (30 g)",
    slug: "lipton-rezene-20",
    size: "20 × 1,5 g (30 g)",
    packaging: "Karton kutu, 20 süzen bardak poşet",
    price: 71.96,
    description: "Lipton Rezene bitki çayı; rezene ağırlıklı karışım, 20 süzen bardak poşet. Ürün açıklamasında rezene (%90) ve ısırgan belirtilir; ambalaj ürün bilgisinde bahçe nanesi/nane oranları da yazılıdır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08R6MQNB6) ve ürün ambalajı; barkod Amazon 'Üretici Referansı' alanından (8690637035043).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { id: 1975, name: "rezene" },
      { id: 4767, name: "Isırgan" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Bir fincana kaynar su ekleyip poşeti koyun, 3-4 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Bitki çayı, bardak poşet" },
      { key: "İçindekiler (Ürün Açıklaması)", value: "Rezene (%90), ısırgan" },
      { key: "Net Miktar", value: "30 g" },
      { key: "Poşet Sayısı", value: "20 süzen bardak poşet" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "Kafein", value: "Kafeinsiz" },
      { key: "EAN-13", value: "8690637035043" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr urun bilgileri, Üretici Referansı" },
      { key: "Amazon ASIN", value: "B08R6MQNB6" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 71,96 TL (20 Kasım 2026)" },
      { key: "İçindekiler Notu", value: "Amazon madde listesinde 'Rezene (%90), bahçe nanesi (%7), nane (%3)' yazıyor; ürün açıklamasındaki içindekiler satırı 'Rezene (%90), ısırgan' diyor. İki metin çeliştiği için ambalaj esas alınmalı" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-rezene-20-front.jpg", alt: "Lipton Rezene Bitki Çayı 20'li (30 g) — Ön yüz" },
      { key: "ek1", file: "lipton-rezene-20-ek1.jpg", alt: "Lipton Rezene Bitki Çayı 20'li (30 g) — Ambalaj (arka yüz)" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
    ],
  },
  {
    asin: "B085F2PKRR",
    barcode: "8690637983580",
    name: "Lipton Slim Plus Kirazlı Bitki Meyve Çayı 20'li (30 g)",
    slug: "lipton-slim-plus-kiraz-20",
    size: "20 × 1,5 g (30 g)",
    packaging: "Karton kutu, 20 süzen bardak poşet",
    price: 71.96,
    description: "Lipton Slim Plus Kirazlı bitki meyve çayı; sinameki yaprağı, rezene, huş ağacı yaprağı, kiraz meyve sapı, biberiye, barut ağacı kabuğu, funda otu, aroma verici, ısırgan ve mate yaprağı içeren 20 süzen bardak poşet.\n\nVeri kaynağı: Amazon.com.tr (ASIN B085F2PKRR) ve ürün ambalajı; barkod Amazon 'Üretici Referansı' alanından (8690637983580).",
    brand: { id: 152, name: "Lipton", slug: "lipton" },
    manufacturer: "Ekaterra Gıda Satış ve Pazarlama A.Ş.",
    items: [
      { name: "Sinameki yaprağı", slug: "sinameki-yapragi" },
      { id: 1975, name: "rezene" },
      { name: "Huş ağacı yaprağı", slug: "hus-agaci-yapragi" },
      { name: "Kiraz meyve sapı", slug: "kiraz-meyve-sapi" },
      { id: 3806, name: "Biberiye" },
      { name: "Barut ağacı kabuğu", slug: "barut-agaci-kabugu" },
      { name: "Funda otu", slug: "funda-otu" },
      { id: 4767, name: "Isırgan" },
      { name: "Mate yaprağı", slug: "mate-yapragi" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Kaynar su ekleyip 2-3 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Lipton" },
      { key: "Ürün Tipi", value: "Bitki-meyve çayı, bardak poşet" },
      { key: "Kiraz Sapı Oranı", value: "%8,8 (ambalaj içindekiler)" },
      { key: "Net Miktar", value: "30 g" },
      { key: "Poşet Sayısı", value: "20 süzen bardak poşet" },
      { key: "Üretici", value: "Ekaterra Gıda Satış ve Pazarlama A.Ş." },
      { key: "Demleme", value: "2-3 dakika" },
      { key: "EAN-13", value: "8690637983580" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr urun bilgileri, Üretici Referansı" },
      { key: "Amazon ASIN", value: "B085F2PKRR" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 71,96 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [
      { severity: "low", text: "Ambalajda sinameki yaprağı bulunduğu belirtilir; sinameki uyarıcı etkili bir bitkidir, 12 yaş altı çocuklarda ve hamilelikte tıbbi danışma önerilir." },
    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "lipton-slim-plus-kiraz-20-front.jpg", alt: "Lipton Slim Plus Kirazlı Bitki Meyve Çayı 20'li (30 g) — Ön yüz" },
    ],
    frontKey: "front",
    additional: [

    ],
  },
  {
    asin: "B0018Q5KW8",
    barcode: "8690105001709",
    name: "Çaykur Tomurcuk Çayı Teneke 200 g",
    slug: "caykur-tomurcuk-teneke-200",
    size: "200 g",
    packaging: "Metal teneke kutu (dökme çay)",
    price: 185.31,
    description: "Çaykur Tomurcuk Çayı, taze filiz yapraklarından üretilen ve doğal bergamot kokusu taşıyan siyah çaydır; 200 g metal teneke.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0018Q5KW8) ve ürün ambalajı; barkod ambalaj görselinden okundu (8690105001709).",
    brand: { id: 162, name: "Çaykur", slug: "caykur" },
    manufacturer: "Çay İşletmeleri Genel Müdürlüğü (Çaykur)",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Demliğe çay koyup kaynamış su ekleyin, 10-12 dakika demlendirin (ürün açıklaması).",
    specifications: [
      { key: "Marka", value: "Çaykur" },
      { key: "Ürün Tipi", value: "Siyah çay, dökme" },
      { key: "Net Miktar", value: "200 g" },
      { key: "Ambalaj", value: "Metal teneke kutu" },
      { key: "Üretici", value: "Çay İşletmeleri Genel Müdürlüğü (Çaykur)" },
      { key: "Ürün Model Numarası", value: "5676-75" },
      { key: "Ürün Ölçüleri", value: "14,9 × 10,3 × 10,3 cm" },
      { key: "EAN-13", value: "8690105001709" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B0018Q5KW8" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 185,31 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "caykur-tomurcuk-teneke-200-front.jpg", alt: "Çaykur Tomurcuk Çayı Teneke 200 g — Ön yüz" },
      { key: "ek1", file: "caykur-tomurcuk-teneke-200-ek1.jpg", alt: "Çaykur Tomurcuk Çayı Teneke 200 g — Ambalaj (arka yüz)" },
      { key: "ek2", file: "caykur-tomurcuk-teneke-200-ek2.jpg", alt: "Çaykur Tomurcuk Çayı Teneke 200 g — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B088M7386Q",
    barcode: "8690105009590",
    name: "Çaykur Organik Rize Çayı 500 g",
    slug: "caykur-organik-rize-500",
    size: "500 g",
    packaging: "Folyo iç astarlı kağıt ambalaj (dökme çay)",
    price: 380.95,
    description: "Çaykur Organik Rize Çayı, üretimden tüketime her aşaması sertifikalanmış, kimyasal kullanılmayan organik siyah çaydır; 500 g. IMO organik sertifikası taşır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B088M7386Q) ve ürün ambalajı; barkod ambalaj görselinden okundu (8690105009590).",
    brand: { id: 162, name: "Çaykur", slug: "caykur" },
    manufacturer: "Çay İşletmeleri Genel Müdürlüğü (Çaykur)",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: ["organic"],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Demliğe çay koyup kaynamış su ekleyin, 10-12 dakika demlendirin.",
    specifications: [
      { key: "Marka", value: "Çaykur" },
      { key: "Ürün Tipi", value: "Organik siyah çay, dökme" },
      { key: "Sertifika", value: "IMO organik (ürün açıklaması)" },
      { key: "Net Miktar", value: "500 g" },
      { key: "Üretici", value: "Çay İşletmeleri Genel Müdürlüğü (Çaykur)" },
      { key: "Üretici Adresi", value: "Müftü Mah. Menderes Bulvarı, 53080 Rize" },
      { key: "Telefon", value: "0464 213 02 34" },
      { key: "EAN-13", value: "8690105009590" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B088M7386Q" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 380,95 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "caykur-organik-rize-500-front.jpg", alt: "Çaykur Organik Rize Çayı 500 g — Ön yüz" },
      { key: "ek1", file: "caykur-organik-rize-500-ek1.jpg", alt: "Çaykur Organik Rize Çayı 500 g — Ambalaj (arka yüz)" },
      { key: "ek2", file: "caykur-organik-rize-500-ek2.jpg", alt: "Çaykur Organik Rize Çayı 500 g — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B08YJXP9QN",
    barcode: "8690105010077",
    name: "Çaykur Filiz Çay 1 kg (10'lu paket)",
    slug: "caykur-filiz-10x1kg",
    size: "10 × 1000 g",
    packaging: "10 adet 1 kg folyo ambalaj (koli)",
    price: 446.4,
    description: "Çaykur Filiz Çay, 1 kg'lık 10 paketten oluşan toplu tekliftir. Tek paket 1 kg'dır; fiyat ve net miktar 10 paket toplamı içindir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08YJXP9QN); barkod Amazon 'Üretici Referansı' alanından (8690105010077, tek 1 kg paketin barkodu).",
    brand: { id: 162, name: "Çaykur", slug: "caykur" },
    manufacturer: "Çaykur",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Demliğe çay koyup kaynamış su ekleyin, 10-12 dakika demlendirin (ürün açıklaması).",
    specifications: [
      { key: "Marka", value: "Çaykur" },
      { key: "Ürün Tipi", value: "Siyah çay, dökme" },
      { key: "Net Miktar", value: "10 × 1000 g (toplam 10 kg)" },
      { key: "Paket Sayısı", value: "10 adet 1 kg" },
      { key: "Üretici", value: "Çaykur" },
      { key: "EAN-13", value: "8690105010077" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr urun bilgileri, Üretici Referansı (tek 1 kg paket)" },
      { key: "Amazon ASIN", value: "B08YJXP9QN" },
      { key: "Çoklu Paket Notu", value: "Amazon listesi 10 adet 1 kg paket içerir; barkod tek 1 kg paketin EAN'idir" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 446,40 TL (10 × 1 kg, 20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "caykur-filiz-10x1kg-front.jpg", alt: "Çaykur Filiz Çay 1 kg (10'lu paket) — Ön yüz" },
    ],
    frontKey: "front",
    additional: [

    ],
  },
  {
    asin: "B0FYQYJ5LC",
    barcode: "4009300595274",
    name: "Teekanne Zencefil Mango Bitki Çayı 20'li (45 g)",
    slug: "teekanne-zencefil-mango-20",
    size: "20 × 2,25 g (45 g)",
    packaging: "Karton kutu, 20 poşet",
    price: 95.47,
    description: "Teekanne Zencefil Mango bitki çayı; zencefil, elma, mango aroma vericisi, stevya yaprakları, hindiba kökleri, asitlik düzenleyici (sitrik asit), havlıcan ve mango granülleri içeren 20 poşetlik karışım.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0FYQYJ5LC) ve ürün ambalajı; barkod ambalaj görselinden okundu (4009300595274).",
    brand: { name: "Teekanne", slug: "teekanne", country: "Almanya" },
    manufacturer: "FERSAN Fermantasyon Ürünleri San. ve Tic. A.Ş.",
    items: [
      { id: 1561, name: "zencefil" },
      { id: 1641, name: "Elma" },
      { id: 2019, name: "Stevya" },
      { name: "Hindiba kökü", slug: "hindiba-koku" },
      { id: 538, name: "Sitrik asit" },
      { name: "Havlıcan", slug: "havlican" },
    ],
    labels: [],
    storage: "Serin ve kuru yerde, ambalajı kapalı olarak saklayın (ambalaj).",
    usage: "Bir poşeti fincana koyup kaynar su ekleyin, 5-8 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Teekanne" },
      { key: "Ürün Tipi", value: "Bitki çayı, poşet" },
      { key: "Aroma", value: "Zencefil & mango" },
      { key: "İçindekiler (Ambalaj)", value: "Zencefil (%52), elma, mango aroma vericisi, stevya yaprakları, hindiba kökleri, asitlik düzenleyici (sitrik asit), havlıcan, mango granülleri (%1)" },
      { key: "Net Miktar", value: "45 g (20 poşet)" },
      { key: "Üretici / İthalatçı", value: "FERSAN Fermantasyon Ürünleri San. ve Tic. A.Ş." },
      { key: "Menşe", value: "Almanya (Teekanne)" },
      { key: "EAN-13", value: "4009300595274" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B0FYQYJ5LC" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 95,47 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "teekanne-zencefil-mango-20-front.jpg", alt: "Teekanne Zencefil Mango Bitki Çayı 20'li (45 g) — Ön yüz" },
      { key: "ek1", file: "teekanne-zencefil-mango-20-ek1.jpg", alt: "Teekanne Zencefil Mango Bitki Çayı 20'li (45 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "teekanne-zencefil-mango-20-ek2.jpg", alt: "Teekanne Zencefil Mango Bitki Çayı 20'li (45 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B0FZCXLYM6",
    barcode: "4009300595250",
    name: "Teekanne Papatya ve Ballı Bitki Çayı 20'li (30 g)",
    slug: "teekanne-papatya-balli-20",
    size: "20 × 1,5 g (30 g)",
    packaging: "Karton kutu, 20 poşet",
    price: 95.47,
    description: "Teekanne Papatya ve Ballı bitki çayı; papatya (%94), doğal bal aroma vericisi ve bal granülleri (%1) içeren 20 poşetlik karışım.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0FZCXLYM6) ve ürün ambalajı; barkod ambalaj görselinden okundu (4009300595250).",
    brand: { name: "Teekanne", slug: "teekanne", country: "Almanya" },
    manufacturer: "FERSAN Fermantasyon Ürünleri San. ve Tic. A.Ş.",
    items: [
      { id: 1547, name: "Mayıs papatyası" },
    ],
    labels: [],
    storage: "Serin ve kuru yerde, ambalajı kapalı olarak saklayın (ambalaj).",
    usage: "Bir poşeti fincana koyup kaynar su ekleyin, 5-8 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Teekanne" },
      { key: "Ürün Tipi", value: "Bitki çayı, poşet" },
      { key: "Aroma", value: "Papatya & bal" },
      { key: "İçindekiler (Ambalaj)", value: "Papatya (%94), doğal bal aroma vericisi, bal granülleri (%1)" },
      { key: "Net Miktar", value: "30 g (20 poşet)" },
      { key: "Üretici / İthalatçı", value: "FERSAN Fermantasyon Ürünleri San. ve Tic. A.Ş." },
      { key: "Menşe", value: "Almanya (Teekanne)" },
      { key: "EAN-13", value: "4009300595250" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B0FZCXLYM6" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 95,47 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "teekanne-papatya-balli-20-front.jpg", alt: "Teekanne Papatya ve Ballı Bitki Çayı 20'li (30 g) — Ön yüz" },
      { key: "ek1", file: "teekanne-papatya-balli-20-ek1.jpg", alt: "Teekanne Papatya ve Ballı Bitki Çayı 20'li (30 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "teekanne-papatya-balli-20-ek2.jpg", alt: "Teekanne Papatya ve Ballı Bitki Çayı 20'li (30 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B0FZD6W9TB",
    barcode: "4009300595311",
    name: "Teekanne Limon Meyve Çayı 20'li (40 g)",
    slug: "teekanne-limon-meyve-20",
    size: "20 × 2 g (40 g)",
    packaging: "Karton kutu, 20 poşet",
    price: 68.29,
    description: "Teekanne Limon meyve çayı; elma, kuşburnu, limon aroma vericisi, stevya yaprakları, asitlik düzenleyici (sitrik asit), bal aroma vericisi ve limon (%0,5) içeren 20 poşetlik karışım.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0FZD6W9TB) ve ürün ambalajı; barkod ambalaj görselinden okundu (4009300595311).",
    brand: { name: "Teekanne", slug: "teekanne", country: "Almanya" },
    manufacturer: "FERSAN Fermantasyon Ürünleri San. ve Tic. A.Ş.",
    items: [
      { id: 1641, name: "Elma" },
      { id: 1549, name: "kuşburnu" },
      { id: 2019, name: "Stevya" },
      { id: 538, name: "Sitrik asit" },
      { name: "Limon kabuğu", slug: "limon-kabugu" },
    ],
    labels: [],
    storage: "Serin ve kuru yerde, ambalajı kapalı olarak saklayın (ambalaj).",
    usage: "Bir poşeti fincana koyup kaynar su ekleyin, 5-8 dakika demleyin (ambalaj).",
    specifications: [
      { key: "Marka", value: "Teekanne" },
      { key: "Ürün Tipi", value: "Meyve çayı, poşet" },
      { key: "Aroma", value: "Limon" },
      { key: "İçindekiler (Ambalaj)", value: "Elma, kuşburnu, limon aroma vericisi, stevya yaprakları, asitlik düzenleyici (sitrik asit), bal aroma vericisi, limon (%0,5)" },
      { key: "Net Miktar", value: "40 g (20 poşet)" },
      { key: "Üretici / İthalatçı", value: "FERSAN Fermantasyon Ürünleri San. ve Tic. A.Ş." },
      { key: "Menşe", value: "Almanya (Teekanne)" },
      { key: "EAN-13", value: "4009300595311" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B0FZD6W9TB" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 68,29 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "teekanne-limon-meyve-20-front.jpg", alt: "Teekanne Limon Meyve Çayı 20'li (40 g) — Ön yüz" },
      { key: "ek1", file: "teekanne-limon-meyve-20-ek1.jpg", alt: "Teekanne Limon Meyve Çayı 20'li (40 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "teekanne-limon-meyve-20-ek2.jpg", alt: "Teekanne Limon Meyve Çayı 20'li (40 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B094NZ1T3P",
    barcode: "8684483120152",
    name: "Mim and More Moroccan Mint (Naneli Fas Çayı) 50 g",
    slug: "mim-and-more-moroccan-mint-50",
    size: "50 g",
    packaging: "Karton kutu, dökme çay",
    price: 249.0,
    description: "Mim and More Moroccan Mint, Fas kültüründen ilham alan yeşil çay, elma, nane ve gül karışımıdır; 50 g dökme çay. Ürün şeker ve tatlandırıcı içermez.\n\nVeri kaynağı: Amazon.com.tr (ASIN B094NZ1T3P) ve ürün ambalajı; barkod ambalaj görselinden okundu (8684483120152).",
    brand: { name: "Mim and More", slug: "mim-and-more", country: "Türkiye" },
    manufacturer: "Mim and More",
    items: [
      { id: 2504, name: "Yeşil çay" },
      { id: 1641, name: "Elma" },
      { id: 710, name: "nane" },
      { name: "Gül yaprağı", slug: "gul-yapragi" },
    ],
    labels: [],
    storage: "Serin ve kuru yerde, ambalajı kapalı olarak saklayın (ambalaj).",
    usage: "1 tatlı kaşığı çayı demliğe koyup 80-85 °C su ekleyin, 2-3 dakika demleyin.",
    specifications: [
      { key: "Marka", value: "Mim and More" },
      { key: "Ürün Tipi", value: "Yeşil çay karışımı, dökme" },
      { key: "Aroma", value: "Nane (Fas usulü)" },
      { key: "İçindekiler (Etiket)", value: "Yeşil çay, elma, nane, gül, uçucu yağ" },
      { key: "Net Miktar", value: "50 g" },
      { key: "Üretici", value: "Mim and More" },
      { key: "EAN-13", value: "8684483120152" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B094NZ1T3P" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 249,00 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "mim-and-more-moroccan-mint-50-front.jpg", alt: "Mim and More Moroccan Mint (Naneli Fas Çayı) 50 g — Ön yüz" },
      { key: "ek1", file: "mim-and-more-moroccan-mint-50-ek1.jpg", alt: "Mim and More Moroccan Mint (Naneli Fas Çayı) 50 g — Ambalaj (arka yüz)" },
      { key: "ek2", file: "mim-and-more-moroccan-mint-50-ek2.jpg", alt: "Mim and More Moroccan Mint (Naneli Fas Çayı) 50 g — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B0CWRRV8GJ",
    barcode: "8684483120442",
    name: "Mim and More Mate Çayı 50 g",
    slug: "mim-and-more-mate-50",
    size: "50 g",
    packaging: "Karton kutu, dökme çay",
    price: 249.0,
    description: "Mim and More Mate Çayı, mate bitkisinin yapraklarından elde edilen, doğal kafein içeren dökme çaydır; 50 g.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0CWRRV8GJ) ve ürün etiketi; barkod Amazon 'Ürün Model Numarası' alanından (8684483120442, EAN-13 kontrol hanesi doğrulandı).",
    brand: { name: "Mim and More", slug: "mim-and-more", country: "Türkiye" },
    manufacturer: "Mim and More",
    items: [
      { name: "Mate yaprağı", slug: "mate-yapragi" },
    ],
    labels: [],
    storage: "Serin ve kuru yerde, ambalajı kapalı olarak saklayın (ambalaj).",
    usage: "Mate kupasına çay koyup sıcak su ekleyin; sıcak veya buzlu tüketilebilir.",
    specifications: [
      { key: "Marka", value: "Mim and More" },
      { key: "Ürün Tipi", value: "Mate çayı, dökme" },
      { key: "İçindekiler (Etiket)", value: "Saf mate çayı" },
      { key: "Net Miktar", value: "50 g" },
      { key: "Kafein", value: "Doğal kafein içerir" },
      { key: "Üretici", value: "Mim and More" },
      { key: "EAN-13", value: "8684483120442" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr urun bilgileri, Ürün Model Numarası" },
      { key: "Amazon ASIN", value: "B0CWRRV8GJ" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 249,00 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "mim-and-more-mate-50-front.jpg", alt: "Mim and More Mate Çayı 50 g — Ön yüz" },
      { key: "ek1", file: "mim-and-more-mate-50-ek1.jpg", alt: "Mim and More Mate Çayı 50 g — Ambalaj (arka yüz)" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
    ],
  },
  {
    asin: "B077XDRD2K",
    barcode: "8690717643014",
    name: "Beta Champion Demlik Poşet Çay 100 x 3,2 g",
    slug: "beta-champion-demlik-100",
    size: "100 × 3,2 g (320 g)",
    packaging: "Karton kutu, 100 demlik poşet",
    price: 489.0,
    description: "Beta Tea Champion demlik poşet çay; 100 adet demlik poşet (100 × 3,2 g). Champion serisi ekonomik paket.\n\nVeri kaynağı: Amazon.com.tr (ASIN B077XDRD2K) ve ürün ambalajı; barkod ambalaj görselinden okundu (8690717643014). Amazon ürün sayfasında içindekiler ve besin tablosu metni bulunmuyor.",
    brand: { id: 1873, name: "Beta Tea", slug: "beta-tea" },
    manufacturer: "BETA GIDA SANAYİ VE TİCARET A.Ş.",
    items: [
      { id: 850, name: "Siyah çay" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Demlik poşetini demliğe koyup kaynamış su ekleyin, 3-5 dakika demleyin.",
    specifications: [
      { key: "Marka", value: "Beta Tea" },
      { key: "Ürün Tipi", value: "Siyah çay, demlik poşet" },
      { key: "Seri", value: "Champion" },
      { key: "Net Miktar", value: "320 g (100 × 3,2 g)" },
      { key: "Üretici", value: "BETA GIDA SANAYİ VE TİCARET A.Ş." },
      { key: "Üretim Yeri", value: "Fuzuli Caddesi No: 1, Sarıçam / Adana" },
      { key: "EAN-13", value: "8690717643014" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B077XDRD2K" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 489,00 TL (20 Kasım 2026)" },
      { key: "Veri Notu", value: "Amazon ürün sayfasında içindekiler listesi ve besin tablosu yok; yalnız ürün adı ve ambalaj görseli mevcut" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "beta-champion-demlik-100-front.jpg", alt: "Beta Champion Demlik Poşet Çay 100 x 3,2 g — Ön yüz" },
      { key: "ek1", file: "beta-champion-demlik-100-ek1.jpg", alt: "Beta Champion Demlik Poşet Çay 100 x 3,2 g — Ambalaj (arka yüz)" },
      { key: "ek2", file: "beta-champion-demlik-100-ek2.jpg", alt: "Beta Champion Demlik Poşet Çay 100 x 3,2 g — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B07MJ7P9MJ",
    barcode: "8699432211133",
    name: "Doğadan Böğürtlenli Karışık Meyve Çayı 20'li (38 g)",
    slug: "dogadan-bogurtlenli-meyve-20",
    size: "20 poşet (38 g)",
    packaging: "Karton kutu, 20 abaka süzen poşet",
    price: 134.95,
    description: "Doğadan Böğürtlenli Karışık Meyve Çayı; bamya çiçeği, elma, böğürtlen yaprağı, kuşburnu, böğürtlen aroma vericisi, portakal kabuğu, mürver meyvesi, böğürtlen (%1,5), stevya ve tarçın içeren 20 poşetlik karışım. Poşetler tropikal abaka ağacı lifinden üretilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B07MJ7P9MJ) ve ürün ambalajı; barkod Amazon 'Üretici Referansı' alanından (8699432211133, EAN-13 kontrol hanesi doğrulandı).",
    brand: { id: 198, name: "Doğadan", slug: "dogadan-1289" },
    manufacturer: "Doğadan Gıda Ürünleri San. ve Paz. A.Ş.",
    items: [
      { name: "Bamya çiçeği", slug: "bamya-cicegi" },
      { id: 1641, name: "Elma" },
      { name: "Böğürtlen yaprağı", slug: "bogurtlen-yapragi" },
      { id: 1549, name: "kuşburnu" },
      { id: 670, name: "Portakal kabuğu" },
      { name: "Mürver meyvesi", slug: "murver-meyvesi" },
      { id: 2537, name: "böğürtlen" },
      { id: 2019, name: "Stevya" },
      { name: "Tarçın", slug: "tarcin" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Kaynamamış sıcak suyla bir poşet çayı 250 ml suda 5-7 dakika bekletin, sonra süzün (ambalaj).",
    specifications: [
      { key: "Marka", value: "Doğadan" },
      { key: "Ürün Tipi", value: "Meyve çayı, süzen poşet" },
      { key: "Aroma", value: "Böğürtlen" },
      { key: "İçindekiler (Ambalaj)", value: "Bamya çiçeği, elma, böğürtlen yaprağı, kuşburnu, böğürtlen aroma vericisi, portakal kabuğu, mürver meyvesi, böğürtlen (%1,5), stevya, tarçın" },
      { key: "Net Miktar", value: "38 g (20 poşet)" },
      { key: "Poşet Malzemesi", value: "Abaka ağacı lifi" },
      { key: "Menşe", value: "Türkiye" },
      { key: "Üretici", value: "Doğadan Gıda Ürünleri San. ve Paz. A.Ş." },
      { key: "Tatlandırıcı", value: "Stevya (bitkisel tatlandırıcı)" },
      { key: "EAN-13", value: "8699432211133" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr ürün bilgileri, Üretici Referansı" },
      { key: "Amazon ASIN", value: "B07MJ7P9MJ" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 134,95 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "dogadan-bogurtlenli-meyve-20-front.jpg", alt: "Doğadan Böğürtlenli Karışık Meyve Çayı 20'li (38 g) — Ön yüz" },
      { key: "ek1", file: "dogadan-bogurtlenli-meyve-20-ek1.jpg", alt: "Doğadan Böğürtlenli Karışık Meyve Çayı 20'li (38 g) — Ambalaj (arka yüz)" },
      { key: "ek2", file: "dogadan-bogurtlenli-meyve-20-ek2.jpg", alt: "Doğadan Böğürtlenli Karışık Meyve Çayı 20'li (38 g) — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B00HMDA4L8",
    barcode: "8697497990611",
    name: "Green Life Melissa Bitki Çayı 20 g",
    slug: "green-life-melissa-20g",
    size: "20 g",
    packaging: "Karton kutu, poşet",
    price: 111.1,
    description: "Green Life Melissa (oğul otu) bitki çayı; 20 g poşet ambalaj. Etikette içindekiler 'melissa' olarak belirtilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B00HMDA4L8) ve ürün ambalajı; barkod ambalaj görselinden okundu (8697497990611).",
    brand: { id: 1762, name: "Greenlife", slug: "greenlife" },
    manufacturer: "Noor Asia Gıda San. ve Tic. A.Ş.",
    items: [
      { name: "Melissa", slug: "melissa" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayın (ambalaj).",
    usage: "Bir poşeti fincana koyup sıcak su ekleyin, 5-7 dakika demleyin.",
    specifications: [
      { key: "Marka", value: "Greenlife" },
      { key: "Ürün Tipi", value: "Bitki çayı, poşet" },
      { key: "Bitki", value: "Melissa (oğul otu)" },
      { key: "Net Miktar", value: "20 g" },
      { key: "Üretici", value: "Noor Asia Gıda San. ve Tic. A.Ş." },
      { key: "EAN-13", value: "8697497990611" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (görselden okundu)" },
      { key: "Amazon ASIN", value: "B00HMDA4L8" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 111,10 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "green-life-melissa-20g-front.jpg", alt: "Green Life Melissa Bitki Çayı 20 g — Ön yüz" },
      { key: "ek1", file: "green-life-melissa-20g-ek1.jpg", alt: "Green Life Melissa Bitki Çayı 20 g — Ambalaj (arka yüz)" },
      { key: "ek2", file: "green-life-melissa-20g-ek2.jpg", alt: "Green Life Melissa Bitki Çayı 20 g — Ürün görseli" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
      { key: "ek2", caption: "Ürün görseli" },
    ],
  },
  {
    asin: "B09X2BMH65",
    barcode: "0054881024846",
    name: "Ahmad Tea Kew Garden Elegant Earl Grey Dökme Çay 100 g",
    slug: "ahmad-tea-kew-garden-earl-grey-100",
    size: "100 g",
    packaging: "Karton kutu, dökme çay",
    price: 439.0,
    description: "Ahmad Tea Kew Gardens iş birliğiyle hazırlanan 'Beyond the Leaf' serisinden Elegant Earl Grey; bergamot aromalı siyah çay, 100 g dökme.\n\nVeri kaynağı: Amazon.com.tr (ASIN B09X2BMH65) ve ürün ambalajı; barkod Amazon 'Ürün Model Numarası' alanından (0054881024846, EAN-13 kontrol hanesi doğrulandı).",
    brand: { id: 2086, name: "Ahmad Tea", slug: "ahmad-tea" },
    manufacturer: "Ahmad Tea",
    items: [
      { id: 850, name: "Siyah çay" },
      { id: 4439, name: "Bergamot Aroması" },
    ],
    labels: [],
    storage: "Serin, kuru ve kokusuz yerde saklayınız (ambalaj).",
    usage: "Demliğe çay koyup kaynamış su ekleyin, 3-5 dakika demleyin.",
    specifications: [
      { key: "Marka", value: "Ahmad Tea" },
      { key: "Ürün Tipi", value: "Aromalı siyah çay, dökme" },
      { key: "Seri", value: "Kew Garden — Beyond the Leaf" },
      { key: "Çeşit", value: "Earl Grey (bergamot)" },
      { key: "Net Miktar", value: "100 g" },
      { key: "Üretici", value: "Ahmad Tea" },
      { key: "Türkiye Distribütörü", value: "Barbaros Mah. Akzambak Sk. Uphill Towers A1 Blok No:61, Ataşehir/İstanbul" },
      { key: "EAN-13", value: "0054881024846" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr ürün bilgileri, Ürün Model Numarası" },
      { key: "Amazon ASIN", value: "B09X2BMH65" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 439,00 TL (20 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    warnings: [

    ],
    nutrition: undefined,
    media: [
      { key: "front", file: "ahmad-tea-kew-garden-earl-grey-100-front.jpg", alt: "Ahmad Tea Kew Garden Elegant Earl Grey Dökme Çay 100 g — Ön yüz" },
      { key: "ek1", file: "ahmad-tea-kew-garden-earl-grey-100-ek1.jpg", alt: "Ahmad Tea Kew Garden Elegant Earl Grey Dökme Çay 100 g — Ambalaj (arka yüz)" },
    ],
    frontKey: "front",
    additional: [
      { key: "ek1", caption: "Ambalaj (arka yüz)" },
    ],
  },
]

function assertEan13(code: string): void {
  if (!/^\d{13}$/.test(code)) throw new Error(`EAN-13 13 hane olmali: ${code}`)
  const digits = code.split('').map(Number)
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0)
  const expected = (10 - (sum % 10)) % 10
  if (expected !== digits[12]) {
    throw new Error(`EAN-13 kontrol hanesi hatali: ${code} (beklenen ${expected})`)
  }
}

async function paused<T>(fn: () => Promise<T>): Promise<T> {
  await sleep(REQUEST_GAP_MS)
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const message = String(error)
      if (!/ 429:| 5\d\d:/.test(message)) throw error
      await sleep(1500 * (attempt + 1) * (attempt + 1))
    }
  }
  throw lastError
}

async function assertIngredient(client: PayloadClient, id: number, name: string) {
  const doc = await paused(() => client.find('ingredients', { where: { id: { equals: id } }, limit: 1 }))
  const found = doc.docs[0] as { name?: string } | undefined
  if (!found) throw new Error(`Icindekiler kaydi yok: ${id}`)
  if (String(found.name).toLocaleLowerCase('tr') !== name.toLocaleLowerCase('tr')) {
    throw new Error(`Icindekiler adi uyusmuyor: ${id} -> ${String(found.name)} != ${name}`)
  }
}

async function ensureBrand(client: PayloadClient, brand: BrandRef): Promise<number> {
  if (brand.id) {
    const doc = await paused(() => client.find('brands', { where: { id: { equals: brand.id } }, limit: 1 }))
    const found = doc.docs[0] as { name?: string } | undefined
    if (!found) throw new Error(`Marka kaydi yok: ${brand.id}`)
    if (String(found.name).toLocaleLowerCase('tr') !== brand.name.toLocaleLowerCase('tr')) {
      throw new Error(`Marka adi uyusmuyor: ${brand.id} -> ${String(found.name)} != ${brand.name}`)
    }
    return brand.id
  }
  const bySlug = await paused(() => client.findOne('brands', { slug: { equals: brand.slug } }))
  if (bySlug) return bySlug.id
  const byName = await paused(() => client.findOne('brands', { name: { equals: brand.name } }))
  if (byName) return byName.id
  const created = await paused(() =>
    client.create('brands', {
      name: brand.name,
      slug: brand.slug,
      country: brand.country ?? 'Türkiye',
    }),
  )
  console.log(`  + marka: ${brand.name} (${created.id})`)
  return created.id
}

async function ensureIngredient(client: PayloadClient, ref: IngredientRef): Promise<number> {
  if (ref.id) {
    await assertIngredient(client, ref.id, ref.name)
    return ref.id
  }
  const byName = await paused(() => client.findOne('ingredients', { name: { equals: ref.name } }))
  if (byName) return byName.id
  if (ref.slug) {
    const bySlug = await paused(() => client.findOne('ingredients', { slug: { equals: ref.slug } }))
    if (bySlug) return bySlug.id
  }
  const created = await paused(() =>
    client.create('ingredients', {
      name: ref.name,
      slug: ref.slug,
    }),
  )
  console.log(`  + icindekiler: ${ref.name} (${created.id})`)
  return created.id
}

async function ensureMedia(client: PayloadClient, seed: ProductSeed): Promise<Record<string, number>> {
  const ids: Record<string, number> = {}
  for (const image of seed.media) {
    const existing = await paused(() => client.findOne('media', { alt: { equals: image.alt } }))
    if (existing) {
      ids[image.key] = existing.id
      continue
    }
    const created = await paused(() =>
      client.upload('media', path.join(IMAGE_ROOT, seed.slug, image.file), {
        alt: image.alt,
      }),
    )
    console.log(`  + medya: ${image.file} (${created.id})`)
    ids[image.key] = created.id
  }
  return ids
}

async function seedProduct(client: PayloadClient, seed: ProductSeed): Promise<void> {
  assertEan13(seed.barcode)
  console.log(`\n== ${seed.name} (${seed.barcode})`)

  const brandId = await ensureBrand(client, seed.brand)
  const itemIds: number[] = []
  for (const item of seed.items) itemIds.push(await ensureIngredient(client, item))
  const media = await ensureMedia(client, seed)

  const data: Record<string, unknown> = {
    barcode: seed.barcode,
    name: seed.name,
    description: seed.description,
    brand: brandId,
    category: CATEGORY_ID,
    manufacturer: seed.manufacturer,
    country: COUNTRY_ID,
    size: seed.size,
    packaging: seed.packaging,
    items: itemIds.map((id) => ({ ingredients: id })),
    additives: [],
    labels: seed.labels,
    specifications: seed.specifications,
    warnings: seed.warnings,
    storage: seed.storage,
    usage: seed.usage,
    model: seed.asin,
    sku: `AMZ-${seed.asin}`,
    prices: [{ amount: seed.price, date: PRICE_DATE }],
    frontImage: media[seed.frontKey],
    additionalImages: seed.additional.map((entry) => ({
      image: media[entry.key],
      caption: entry.caption,
    })),
    status: 'published' as const,
  }
  if (seed.nutrition) data.nutrition = seed.nutrition

  const existing = await paused(() => client.findOne('products', { barcode: { equals: seed.barcode } }))
  const product = existing
    ? await paused(() => client.update('products', existing.id, data))
    : await paused(() => client.create('products', data))

  console.log(`  ${existing ? 'guncellendi' : 'olusturuldu'}: id ${product.id}`)
  console.log(`  https://barkoddedektifi.com/urun/${seed.barcode}`)
}

async function main(): Promise<void> {
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  let ok = 0
  const failed: string[] = []
  for (const seed of PRODUCTS) {
    try {
      await seedProduct(client, seed)
      ok++
    } catch (error) {
      failed.push(`${seed.barcode} ${seed.name}: ${String(error).slice(0, 300)}`)
      console.error(`  !! HATA: ${String(error).slice(0, 300)}`)
    }
  }
  console.log(`\nBitti: ${ok}/${PRODUCTS.length} basarili`)
  if (failed.length) {
    console.log('Basarisizlar:')
    for (const f of failed) console.log(' -', f)
    process.exitCode = 1
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
