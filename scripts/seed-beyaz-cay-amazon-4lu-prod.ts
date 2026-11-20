import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Amazon.com.tr "Beyaz Çaylar" kategorisinden barkodu doğrulanmış 4 ürünü
 * UZAK Payload REST API'sine yazar.
 *
 * Kaynaklar (20 Kasım 2026):
 *  - Doğadan Beyaz Çay Sade 18'li — ASIN B095B7MPN5, EAN 8699432214851 (Üretici Referansı)
 *  - Beta Tea Yasemin Oolong 50 g — ASIN B07VYHV3WY, EAN 8690717014166 (ambalaj barkodu)
 *  - Beta Tea Earl Grey Bai Mu Dan 50 g — ASIN B0BG31V7Q5, EAN 8690717019017 (ambalaj barkodu)
 *  - Botaniksan Beyaz Çay 50 g — ASIN B09PC99D4P, EAN 8680782043444 (ambalaj barkodu)
 *
 * Idempotent: marka/içindekiler ad+slug ile, medya alt metni ile, ürün barkod ile upsert edilir.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-beyaz-cay-amazon-4lu-prod.ts
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
const CATEGORY_ID = 13 // Kahve & Çay
const COUNTRY_ID = 1 // Türkiye
const PRICE_DATE = '2026-11-20T00:00:00.000Z'

const NUTRIENT_IDS = {
  energyKj: 1,
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  carbohydrate: 7,
  sugars: 8,
  fiber: 18,
  protein: 19,
  salt: 20,
}

type IngredientRef = {
  id?: number
  name: string
  slug: string
  aliases?: readonly string[]
  description?: string
}

const ING = {
  beyazCay: {
    name: 'Beyaz çay',
    slug: 'beyaz-cay',
    aliases: ['White tea', 'Camellia sinensis', 'Beyaz çay yaprağı'],
    description:
      'Camellia sinensis bitkisinin tomurcuk ve genç yapraklarından üretilen, en az işlem gören çay türü.',
  },
  oolong: {
    name: 'Oolong çayı',
    slug: 'oolong-cayi',
    aliases: ['Oolong', 'Oolong tea', 'Yarı okside çay', 'Mavi çay'],
    description:
      'Camellia sinensis yapraklarının kısmen okside edilmesiyle üretilen, yeşil ve siyah çay arasında konumlanan çay türü.',
  },
  yasemin: {
    name: 'Yasemin çiçeği',
    slug: 'yasemin-cicegi',
    aliases: ['Jasmine', 'Jasmine flower', 'Yasemin'],
    description: 'Jasminum cinsi bitkilerin çiçeği; çaylarda aroma ve görünüm için kullanılır.',
  },
  peygamber: {
    name: 'Peygamber çiçeği',
    slug: 'peygamber-cicegi',
    aliases: ['Cornflower', 'Centaurea cyanus', 'Peygamber çiçeği yaprakları'],
    description:
      'Centaurea cyanus bitkisinin mavi-mor çiçek yaprakları; çay harmanlarında görünüm ve hafif aroma için kullanılır.',
  },
  bergamot: {
    name: 'Bergamot Aroması',
    slug: 'bergamot-aromasi',
    id: 4439,
  },
} as const

type ProductSeed = {
  barcode: string
  asin: string
  name: string
  directory: string
  description: string
  brand: { id?: number; name: string; slug: string; country?: string }
  manufacturer: string
  size: string
  packaging: string
  items: { ref: IngredientRef; percent?: number }[]
  labels: string[]
  storage?: string
  usage?: string
  specifications: { key: string; value: string }[]
  warnings: { severity: 'low' | 'medium' | 'high'; text: string }[]
  price: number
  media: {
    key: string
    file: string
    alt: string
  }[]
  frontKey: string
  ingredientsKey?: string
  additionalKeys: { key: string; caption: string }[]
}

const PRODUCTS: ProductSeed[] = [
  {
    barcode: '8699432214851',
    asin: 'B095B7MPN5',
    name: "Doğadan Beyaz Çay Sade 18'li",
    directory: 'dogadan-beyaz-cay-sade-18li',
    description:
      "Doğadan Beyaz Çay Sade, abaka ağacı liflerinden üretilmiş 18 süzen poşette sunulan sade beyaz çaydır (net 23,4 g). Beyaz çay, Camellia sinensis bitkisinin tomurcuk ve genç yapraklarından üretilen, en az işlem gören çay türüdür.\n\nDemleme önerisi: 2-3 dk / 80-90 °C. Ambalajda %100 geri dönüştürülebilir ambalaj beyanı bulunur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B095B7MPN5) ürün bilgileri ve Doğadan'ın resmî ambalaj görseli; barkod, Amazon 'Üretici Referansı' alanından (EAN-13 8699432214851, kontrol hanesi doğrulandı). Ambalajın arka yüzünde besin değerleri tablosu bulunmuyor.",
    brand: { id: 198, name: 'Doğadan', slug: 'dogadan-1289' },
    manufacturer: 'Doğadan Gıda Ürünleri San. ve Paz. A.Ş.',
    size: '23,4 g (18 × 1,3 g süzen poşet)',
    packaging: 'Karton kutu; abaka ağacı lifinden süzen poşet (18 adet)',
    items: [{ ref: ING.beyazCay }],
    labels: ['recyclable'],
    usage:
      'Bir poşet çayı fincana koyun; üzerine 80-90 °C sıcak su ekleyip 2-3 dakika demleyin (demleme önerisi ambalaj tanıtım görselinde).',
    specifications: [
      { key: 'Marka', value: 'Doğadan' },
      { key: 'Ürün Tipi', value: 'Sade beyaz çay, süzen poşet' },
      { key: 'Çeşit', value: 'Beyaz çay (Camellia sinensis)' },
      { key: 'Net Miktar', value: '23,4 g' },
      { key: 'Poşet Sayısı', value: '18 süzen poşet (poşet başına 1,3 g)' },
      { key: 'Poşet Malzemesi', value: 'Abaka ağacı lifi' },
      { key: 'Ambalaj Beyanı', value: '%100 geri dönüştürülebilir ambalaj' },
      { key: 'Demleme Önerisi', value: '2-3 dk / 80-90 °C' },
      { key: 'Menşe', value: 'Türkiye (Amazon.com.tr ürün açıklaması)' },
      { key: 'Üretici', value: 'Doğadan Gıda Ürünleri San. ve Paz. A.Ş.' },
      { key: 'Besin Tablosu', value: 'Ambalaj görsellerinde besin değerleri tablosu yok' },
      { key: 'EAN-13', value: '8699432214851' },
      { key: 'Barkod Kaynağı', value: 'Amazon.com.tr ürün bilgileri → Üretici Referansı' },
      { key: 'Amazon ASIN', value: 'B095B7MPN5' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 134,95 TL (20 Kasım 2026, satıcı Amazon.com.tr)',
      },
      {
        key: 'Ambalaj Notu',
        value:
          "Amazon galerisindeki kutu görseli ile Doğadan'ın resmî packshot'ı aynı ürünü gösterir; gramaj (23,4 g) resmî görselde basılıdır.",
      },
    ],
    warnings: [
      {
        severity: 'low',
        text: 'Tavsiye edilen tüketim tarihi (TETT) geçmiş ürün tüketilmemelidir; çayı kuru ve kokusuz ortamda saklayın.',
      },
    ],
    price: 134.95,
    media: [
      {
        key: 'front',
        file: 'dogadan-beyaz-cay-sade-front.jpg',
        alt: "Doğadan Beyaz Çay Sade 18'li ön yüz (23,4 g, 18 süzen poşet)",
      },
      {
        key: 'ambalaj',
        file: 'dogadan-beyaz-cay-sade-ambalaj.jpg',
        alt: "Doğadan Beyaz Çay Sade 18'li kutu görseli (Amazon, %100 geri dönüştürülebilir ambalaj)",
      },
      {
        key: 'demleme',
        file: 'dogadan-beyaz-cay-sade-demleme.jpg',
        alt: 'Doğadan Beyaz Çay Sade demleme önerisi görseli (2-3 dk / 80-90 °C)',
      },
      {
        key: 'bilgi',
        file: 'dogadan-beyaz-cay-sade-geri-donusum.jpg',
        alt: 'Doğadan Beyaz Çay tanıtım görseli (beyaz çay bilgisi)',
      },
    ],
    frontKey: 'front',
    additionalKeys: [
      { key: 'ambalaj', caption: 'Ambalaj (kutu)' },
      { key: 'demleme', caption: 'Demleme önerisi' },
      { key: 'bilgi', caption: 'Beyaz çay bilgisi' },
    ],
  },
  {
    barcode: '8690717014166',
    asin: 'B07VYHV3WY',
    name: 'Beta Tea Yasemin Oolong 50 g',
    directory: 'beta-yasemin-oolong-50g',
    description:
      'Beta Tea Yasemin Oolong (B.330), oolong çayı ve yasemin çiçeğinden oluşan 50 g dökme çaydır. Ambalajda menşe ülke Çin olarak belirtilir.\n\nDemleme önerisi: 1-2 çay kaşığı çayın üzerine 85-90 °C sıcaklıkta 180 ml su ekleyip 2-3 dakika demleyin. Ürün helal belgelidir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B07VYHV3WY) ve ürün ambalajının arka yüzü; barkod ambalajdan okundu (EAN-13 8690717014166). Ambalajda besin değerleri tablosu bulunmuyor.',
    brand: { id: 1873, name: 'Beta Tea', slug: 'beta-tea' },
    manufacturer: 'BETA GIDA SANAYİ VE TİCARET A.Ş.',
    size: '50 g',
    packaging: 'Poşet ambalaj, dökme çay',
    items: [{ ref: ING.oolong }, { ref: ING.yasemin }],
    labels: ['halal-certified'],
    storage:
      'Ürünü kuru, ışık almayan ve rutubetsiz ortamda muhafaza ediniz (ambalaj).',
    usage:
      '1-2 çay kaşığı çayın üzerine 85-90 °C sıcaklıktaki 180 ml su eklenerek 2-3 dk demlenmesi önerilir (ambalaj).',
    specifications: [
      { key: 'Marka', value: 'Beta Tea' },
      { key: 'Ürün Tipi', value: 'Aromalı oolong çay, dökme' },
      { key: 'Seri / Kod', value: 'B.330 Yasemin Oolong' },
      { key: 'İçindekiler (Ambalaj)', value: 'Oolong, yasemin çiçeği' },
      { key: 'Net Miktar', value: '50 g' },
      { key: 'Menşe Ülke', value: 'Çin (ambalaj)' },
      { key: 'Üretici', value: 'BETA GIDA SANAYİ VE TİCARET A.Ş.' },
      {
        key: 'Üretim Yeri',
        value: 'Acıdere OSB Mah. Fuzuli Caddesi No: 1 Sarıçam / Adana',
      },
      { key: 'İşletme Kayıt No', value: 'TR-01-K-000319' },
      { key: 'Web', value: 'www.beta.com.tr — betateashop.com' },
      { key: 'Telefon', value: '0322 457 72 07' },
      { key: 'Sertifika Beyanı', value: 'Ürün helal belgelidir (ambalaj)' },
      { key: 'Demleme', value: '85-90 °C, 180 ml su, 2-3 dk' },
      { key: 'Saklama', value: 'Kuru, ışık almayan, rutubetsiz ortam' },
      { key: 'Besin Tablosu', value: 'Ambalajda besin değerleri tablosu yok' },
      { key: 'EAN-13', value: '8690717014166' },
      { key: 'Barkod Kaynağı', value: 'Ürün ambalajı (arka yüz barkodu, görselden okundu)' },
      { key: 'Amazon ASIN', value: 'B07VYHV3WY' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 242,85 TL (20 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'low',
        text: 'Tavsiye edilen tüketim tarihi geçmiş ürün tüketilmemelidir. Parti numarası paketleme tarihidir (ambalaj).',
      },
    ],
    price: 242.85,
    media: [
      {
        key: 'ambalaj',
        file: 'beta-yasemin-oolong-ambalaj.jpg',
        alt: 'Beta Tea Yasemin Oolong 50 g ambalaj arka yüzü (içindekiler, üretici, barkod)',
      },
      {
        key: 'icindekiler',
        file: 'beta-yasemin-oolong-icindekiler.jpg',
        alt: 'Beta Tea Yasemin Oolong 50 g içindekiler ve menşe (Oolong, yasemin çiçeği, Çin)',
      },
      {
        key: 'barkod',
        file: 'beta-yasemin-oolong-barkod.jpg',
        alt: 'Beta Tea Yasemin Oolong 50 g barkod 8690717014166',
      },
      {
        key: 'demleme',
        file: 'beta-yasemin-oolong-demleme.jpg',
        alt: 'Beta Tea Yasemin Oolong demleme görseli (dökme oolong çayı ve demlik)',
      },
    ],
    frontKey: 'ambalaj',
    ingredientsKey: 'icindekiler',
    additionalKeys: [
      { key: 'barkod', caption: 'Barkod 8690717014166' },
      { key: 'demleme', caption: 'Demleme görseli' },
    ],
  },
  {
    barcode: '8690717019017',
    asin: 'B0BG31V7Q5',
    name: 'Beta Tea Earl Grey Bai Mu Dan 50 g',
    directory: 'beta-earl-grey-bai-mu-dan-50g',
    description:
      'Beta Tea Earl Grey Bai Mu Dan (B.1050), beyaz çay (Bai Mu Dan), peygamber çiçeği ve bergamot aromasından oluşan 50 g dökme çaydır. Ambalajda menşe ülke Türkiye olarak belirtilir.\n\nDemleme önerisi: 1-2 çay kaşığı çayın üzerine 95-100 °C sıcaklıkta 180 ml su ekleyip 3-5 dakika demleyin. Ürün helal belgelidir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0BG31V7Q5) ve ürün ambalajının arka yüzü; barkod ambalajdan okundu (EAN-13 8690717019017). Ambalajda besin değerleri tablosu bulunmuyor.',
    brand: { id: 1873, name: 'Beta Tea', slug: 'beta-tea' },
    manufacturer: 'BETA GIDA SANAYİ VE TİCARET A.Ş.',
    size: '50 g',
    packaging: 'Poşet ambalaj, dökme çay',
    items: [{ ref: ING.beyazCay }, { ref: ING.peygamber }, { ref: ING.bergamot }],
    labels: ['halal-certified'],
    storage:
      'Ürünü kuru, ışık almayan ve rutubetsiz ortamda muhafaza ediniz (ambalaj).',
    usage:
      '1-2 çay kaşığı çayın üzerine 95-100 °C sıcaklıktaki 180 ml su eklenerek 3-5 dk demlenmesi önerilir (ambalaj).',
    specifications: [
      { key: 'Marka', value: 'Beta Tea' },
      { key: 'Ürün Tipi', value: 'Aromalı beyaz çay (Earl Grey), dökme' },
      { key: 'Seri / Kod', value: 'B.1050 Earl Grey Bai Mu Dan' },
      {
        key: 'İçindekiler (Ambalaj)',
        value: 'Beyaz çay, peygamber çiçeği, aroma verici (bergamot)',
      },
      { key: 'Net Miktar', value: '50 g' },
      { key: 'Menşe Ülke', value: 'Türkiye (ambalaj)' },
      { key: 'Üretici', value: 'BETA GIDA SANAYİ VE TİCARET A.Ş.' },
      {
        key: 'Üretim Yeri',
        value: 'Adana Hacı Sabancı OSB, Fuzuli Caddesi No: 1 Sarıçam / Adana',
      },
      { key: 'İşletme Kayıt No', value: 'TR-01-K-000319' },
      { key: 'Web', value: 'www.beta.com.tr' },
      { key: 'Telefon', value: '0322 457 72 07' },
      {
        key: 'Kalite Belgeleri (Ambalaj)',
        value: 'BRC, IFS, ISO 22000, ISO 9001, ISO 14001, ISO 10002, OHSAS 18001',
      },
      { key: 'Sertifika Beyanı', value: 'Ürün helal belgelidir (ambalaj)' },
      { key: 'Demleme', value: '95-100 °C, 180 ml su, 3-5 dk' },
      { key: 'Saklama', value: 'Kuru, ışık almayan, rutubetsiz ortam' },
      { key: 'Besin Tablosu', value: 'Ambalajda besin değerleri tablosu yok' },
      { key: 'EAN-13', value: '8690717019017' },
      { key: 'Barkod Kaynağı', value: 'Ürün ambalajı (arka yüz barkodu, görselden okundu)' },
      { key: 'Amazon ASIN', value: 'B0BG31V7Q5' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 145,59 TL (20 Kasım 2026)',
      },
      {
        key: 'Ad Notu',
        value:
          "Amazon başlığı 'Earl Grey Bai Mu Dan'; ambalajda seri kodu B.1050 ve içindekiler 'beyaz çay, peygamber çiçeği, aroma verici (bergamot)' basılıdır.",
      },
    ],
    warnings: [
      {
        severity: 'low',
        text: 'Tavsiye edilen tüketim tarihi geçmiş ürün tüketilmemelidir. Parti numarası paketleme tarihidir (ambalaj).',
      },
    ],
    price: 145.59,
    media: [
      {
        key: 'ambalaj',
        file: 'beta-earl-grey-ambalaj.jpg',
        alt: 'Beta Tea Earl Grey Bai Mu Dan 50 g ambalaj arka yüzü (içindekiler, üretici, barkod)',
      },
      {
        key: 'icindekiler',
        file: 'beta-earl-grey-icindekiler.jpg',
        alt: 'Beta Tea Earl Grey Bai Mu Dan 50 g içindekiler (beyaz çay, peygamber çiçeği, bergamot aroması)',
      },
      {
        key: 'barkod',
        file: 'beta-earl-grey-barkod.jpg',
        alt: 'Beta Tea Earl Grey Bai Mu Dan 50 g barkod 8690717019017',
      },
      {
        key: 'demleme',
        file: 'beta-earl-grey-demleme.jpg',
        alt: 'Beta Tea Earl Grey Bai Mu Dan demleme görseli (dökme çay ve fincan)',
      },
    ],
    frontKey: 'ambalaj',
    ingredientsKey: 'icindekiler',
    additionalKeys: [
      { key: 'barkod', caption: 'Barkod 8690717019017' },
      { key: 'demleme', caption: 'Demleme görseli' },
    ],
  },
  {
    barcode: '8680782043444',
    asin: 'B09PC99D4P',
    name: 'Botaniksan Beyaz Çay 50 g',
    directory: 'botaniksan-beyaz-cay-50g',
    description:
      'Botaniksan Beyaz Çay, Camellia sinensis bitkisinin beyaz çay yapraklarından oluşan 50 g dökme çaydır. Etikette üretici firma Hayat Aktar (Isparta) olarak belirtilir; ISO, BRC ve helal logoları ile "Yerli Üretim" ibaresi bulunur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B09PC99D4P) ve ürün etiketi; barkod etiketten okundu (EAN-13 8680782043444). Etikette besin değerleri tablosu bulunmuyor.',
    brand: { name: 'Botaniksan', slug: 'botaniksan', country: 'Türkiye' },
    manufacturer: 'Hayat Aktar (Botaniksan)',
    size: '50 g',
    packaging: 'Şeffaf poşet ambalaj, dökme çay',
    items: [{ ref: ING.beyazCay }],
    labels: ['halal-certified'],
    storage: 'Serin ve kuru yerde muhafaza ediniz (etiket).',
    specifications: [
      { key: 'Marka', value: 'Botaniksan' },
      { key: 'Ürün Tipi', value: 'Beyaz çay, dökme' },
      { key: 'Çeşit', value: 'Camellia sinensis (beyaz çay yaprağı)' },
      { key: 'Net Miktar', value: '50 g' },
      { key: 'Menşe', value: 'Türkiye (Yerli Üretim, etiket)' },
      { key: 'Üretici', value: 'Hayat Aktar' },
      {
        key: 'Üretici Adresi',
        value: 'Bahçeli Mah. 5746 Sok. No: 23, 32100 Isparta / Türkiye',
      },
      { key: 'Telefon', value: '+90 539 873 94 95' },
      { key: 'Faks', value: '+90 246 218 35 34' },
      { key: 'Web', value: 'www.botaniksan.com — www.hayataktar.com' },
      { key: 'E-posta', value: 'info@botaniksan.com' },
      { key: 'İşletme Kayıt No', value: 'TR-32-K-002013' },
      { key: 'Ambalajdaki TETT', value: '02.11.2022 (galerideki etiket fotoğrafı)' },
      { key: 'Besin Tablosu', value: 'Etikette besin değerleri tablosu yok' },
      { key: 'EAN-13', value: '8680782043444' },
      { key: 'Barkod Kaynağı', value: 'Ürün etiketi (dikey barkod, görselden okundu)' },
      { key: 'Amazon ASIN', value: 'B09PC99D4P' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 180,00 TL (20 Kasım 2026)',
      },
      {
        key: 'Etiket Notu',
        value:
          'Galerideki etiket fotoğrafı 2022 partisine ait (TETT 02.11.2022); satın alınan partide tarih farklıdır. Etiketin arkasındaki baskı şeffaf poşetten görünür.',
      },
    ],
    warnings: [
      {
        severity: 'low',
        text: 'Tavsiye edilen tüketim tarihi (TETT) geçmiş ürün tüketilmemelidir; serin ve kuru yerde saklayın.',
      },
    ],
    price: 180,
    media: [
      {
        key: 'front',
        file: 'botaniksan-beyaz-cay-front.jpg',
        alt: 'Botaniksan Beyaz Çay 50 g ön yüz etiketi (Camellia sinensis)',
      },
      {
        key: 'etiket',
        file: 'botaniksan-beyaz-cay-etiket.jpg',
        alt: 'Botaniksan Beyaz Çay 50 g etiket detayı (üretici Hayat Aktar, TR-32-K-002013)',
      },
      {
        key: 'barkod',
        file: 'botaniksan-beyaz-cay-barkod.jpg',
        alt: 'Botaniksan Beyaz Çay 50 g barkod 8680782043444',
      },
      {
        key: 'yaprak',
        file: 'botaniksan-beyaz-cay-yaprak.jpg',
        alt: 'Botaniksan Beyaz Çay 50 g beyaz çay yaprakları',
      },
    ],
    frontKey: 'front',
    additionalKeys: [
      { key: 'etiket', caption: 'Etiket detayı (üretici bilgileri)' },
      { key: 'barkod', caption: 'Barkod 8680782043444' },
      { key: 'yaprak', caption: 'Ürün görseli (beyaz çay yaprakları)' },
    ],
  },
]

function assertEan13(code: string): void {
  if (!/^\d{13}$/.test(code)) throw new Error(`EAN-13 13 hane olmalı: ${code}`)
  const digits = code.split('').map(Number)
  const sum = digits
    .slice(0, 12)
    .reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0)
  const expected = (10 - (sum % 10)) % 10
  if (expected !== digits[12]) {
    throw new Error(`EAN-13 kontrol hanesi hatalı: ${code} (beklenen ${expected})`)
  }
}

async function assertIngredient(client: PayloadClient, id: number, name: string) {
  const doc = await client.find('ingredients', { where: { id: { equals: id } }, limit: 1 })
  const found = doc.docs[0] as { name?: string } | undefined
  if (!found) throw new Error(`İçindekiler kaydı yok: ${id}`)
  if (String(found.name).toLocaleLowerCase('tr') !== name.toLocaleLowerCase('tr')) {
    throw new Error(`İçindekiler adı uyuşmuyor: ${id} → ${String(found.name)} ≠ ${name}`)
  }
}

async function ensureBrand(client: PayloadClient, brand: ProductSeed['brand']): Promise<number> {
  if (brand.id) {
    const doc = await client.find('brands', { where: { id: { equals: brand.id } }, limit: 1 })
    const found = doc.docs[0] as { name?: string } | undefined
    if (!found) throw new Error(`Marka kaydı yok: ${brand.id}`)
    if (String(found.name).toLocaleLowerCase('tr') !== brand.name.toLocaleLowerCase('tr')) {
      throw new Error(`Marka adı uyuşmuyor: ${brand.id} → ${String(found.name)} ≠ ${brand.name}`)
    }
    return brand.id
  }
  const bySlug = await client.findOne('brands', { slug: { equals: brand.slug } })
  if (bySlug) return bySlug.id
  const byName = await client.findOne('brands', { name: { equals: brand.name } })
  if (byName) return byName.id
  const created = await client.create('brands', {
    name: brand.name,
    slug: brand.slug,
    country: brand.country ?? 'Türkiye',
  })
  console.log(`  + marka: ${brand.name} (${created.id})`)
  return created.id
}

async function ensureIngredient(client: PayloadClient, ref: IngredientRef): Promise<number> {
  if (ref.id) {
    await assertIngredient(client, ref.id, ref.name)
    return ref.id
  }
  const bySlug = await client.findOne('ingredients', { slug: { equals: ref.slug } })
  if (bySlug) {
    await assertIngredient(client, bySlug.id, ref.name)
    return bySlug.id
  }
  const byName = await client.findOne('ingredients', { name: { equals: ref.name } })
  if (byName) return byName.id
  const created = await client.create('ingredients', {
    name: ref.name,
    slug: ref.slug,
    aliases: (ref.aliases ?? []).map((alias) => ({ alias })),
    description: ref.description,
  })
  console.log(`  + içindekiler: ${ref.name} (${created.id})`)
  return created.id
}

async function ensureMedia(
  client: PayloadClient,
  seed: ProductSeed,
): Promise<Record<string, number>> {
  const ids: Record<string, number> = {}
  for (const image of seed.media) {
    const existing = await client.findOne('media', { alt: { equals: image.alt } })
    if (existing) {
      ids[image.key] = existing.id
      continue
    }
    const created = await client.upload('media', path.join(IMAGE_ROOT, seed.directory, image.file), {
      alt: image.alt,
    })
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
  for (const item of seed.items) itemIds.push(await ensureIngredient(client, item.ref))
  const media = await ensureMedia(client, seed)

  const data = {
    barcode: seed.barcode,
    name: seed.name,
    description: seed.description,
    brand: brandId,
    category: CATEGORY_ID,
    manufacturer: seed.manufacturer,
    country: COUNTRY_ID,
    size: seed.size,
    packaging: seed.packaging,
    items: seed.items.map((item, index) =>
      item.percent === undefined
        ? { ingredients: itemIds[index] }
        : { ingredients: itemIds[index], percent_estimate: item.percent },
    ),
    additives: [] as number[],
    labels: seed.labels,
    specifications: seed.specifications,
    warnings: seed.warnings,
    storage: seed.storage,
    usage: seed.usage,
    model: seed.asin,
    sku: `AMZ-${seed.asin}`,
    prices: [{ amount: seed.price, date: PRICE_DATE }],
    frontImage: media[seed.frontKey],
    ingredientsImage: seed.ingredientsKey ? media[seed.ingredientsKey] : undefined,
    additionalImages: seed.additionalKeys.map((entry) => ({
      image: media[entry.key],
      caption: entry.caption,
    })),
    status: 'published' as const,
  }

  const existing = await client.findOne('products', { barcode: { equals: seed.barcode } })
  const product = existing
    ? await client.update('products', existing.id, data)
    : await client.create('products', data)

  console.log(`  ${existing ? 'güncellendi' : 'oluşturuldu'}: id ${product.id}`)
  console.log(`  https://barkoddedektifi.com/urun/${seed.barcode}`)
}

async function main(): Promise<void> {
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  // Ortak master doğrulaması: besin kimlikleri mevcut mu?
  for (const [key, id] of Object.entries(NUTRIENT_IDS)) {
    const doc = await client.find('nutrients', { where: { id: { equals: id } }, limit: 1 })
    if (!doc.docs[0]) throw new Error(`Besin kaydı yok: ${key} (${id})`)
  }

  for (const seed of PRODUCTS) await seedProduct(client, seed)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
