import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Amazon.com.tr "Kahve" kategorisinden (node 22380611031) barkodu doğrulanmış
 * ürünleri UZAK Payload REST API'sine yazar.
 *
 * Barkod kaynağı: ambalaj görselinden ZXing ile okunan EAN-13 ya da Amazon ürün
 * bilgilerindeki "Üretici Referansı" / "Ürün Model Numarası" alanı. Her barkodun
 * kontrol hanesi doğrulandı; görsel okuma ile metin referansı çeliştiğinde
 * (Nescafé Gold 600 g) ambalajda basılı olan değer esas alındı.
 *
 * Idempotent: ürün barkod ile, marka/içindekiler kimlik ile, medya alt metni ile
 * upsert edilir. Var olan kayıt güncellenir, ikinci kayıt açılmaz.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-kahve-kategori-prod.ts
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
const REQUEST_GAP_MS = Number(process.env.SEED_GAP_MS ?? 450)
const MAX_RETRIES = 4
/** Yalniz bu ASIN'leri isle (yeniden deneme icin): SEED_ONLY=B0...,B0... */
const ONLY = (process.env.SEED_ONLY ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const CATEGORY_ID = 13 // Kahve & Çay
const COUNTRY_ID = 1 // Türkiye
const PRICE_DATE = '2026-11-21T00:00:00.000Z'

type IngredientRef = { id: number; name: string }
type BrandRef = { id: number; name: string }
type Specification = { key: string; value: string }
type Warning = { severity: 'low' | 'medium' | 'high'; text: string }
type Nutrition = {
  per: '100g' | '100ml' | 'serving'
  items: { nutrient: number; amount: number; unit: string }[]
}
type MediaFile = [key: string, caption: string, file: string]

type ProductSeed = {
  asin: string
  /** Medya dosya adı öneki (slug-ASIN); Payload'da dosya adı çakışmasını önler. */
  slug: string
  /** [anahtar, açıklama, kaynak dosya] — ilki ön yüz. Boşsa medya korunur. */
  mediaFiles: MediaFile[]
  /** Doğrudan panelden eklenmiş kayıt: medya/alanlar ezilmez. */
  legacyMedia?: boolean
  barcode: string
  name: string
  size: string | null
  packaging: string | null
  price: number | null
  brand: BrandRef
  manufacturer: string | null
  description: string
  items: IngredientRef[]
  labels: string[]
  storage: string | null
  usage: string | null
  specifications: Specification[]
  warnings: Warning[]
  allergens: number[]
  /** Payload'da 'allergens' tek ilişki: yalnız ilki yazılabilir, tamamı specifications'ta. */
  nutrition: Nutrition | null
}

const PRODUCTS: ProductSeed[] = [
  {
    "asin": "B007RM1QT8",
    "slug": "lavazza-espresso-barista-gran-crema-1-kg-b007rm1qt8",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ]
    ],
    "barcode": "8000070024854",
    "name": "Lavazza Espresso Barista Gran Crema 1 KG",
    "size": "1000 g",
    "packaging": "Folyo ambalaj",
    "price": 1636.41,
    "brand": {
      "id": 3901,
      "name": "Lavazza"
    },
    "manufacturer": null,
    "description": "Espresso Barista Gran Crema 1 kg — Lavazza ürünü.\n\nÜrün Tipi: Espresso Barista Gran Crema. Kavurma: Orta (Medium). Harman: Arabica ve Robusta.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B007RM1QT8) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Lavazza"
      },
      {
        "key": "Ürün Tipi",
        "value": "Espresso Barista Gran Crema"
      },
      {
        "key": "Kavurma",
        "value": "Orta (Medium)"
      },
      {
        "key": "Harman",
        "value": "Arabica ve Robusta"
      },
      {
        "key": "Net Miktar",
        "value": "1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Yoğunluk",
        "value": "7/10"
      },
      {
        "key": "Hazırlama",
        "value": "Espresso makinesi (espresso, cappuccino & latte için ideal)"
      },
      {
        "key": "Aroma Notları",
        "value": "Bal ve kavrulmuş kahve"
      },
      {
        "key": "Marka Merkezi",
        "value": "Torino, İtalya (1895)"
      },
      {
        "key": "EAN-13",
        "value": "8000070024854"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B007RM1QT8"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeride yalnızca ön yüz ve ürün özellik grafiği var; arka/yan panel fotoğraflanmamış. Net ağırlık (1 kg başlık dışı), içindekiler, besin tablosu, üretici adres, saklama koşulları, sertifika logoları okunamadı. Amazon başlığı 1 kg diyor ancak ambalaj üzerinde ağırlık doğrulanamadı."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B009PIIMXA",
    "slug": "julius-meinl-president-cekirdek-kahve-orta-kavrulmus-classic-b009piimxa",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "04.jpg"
      ]
    ],
    "barcode": "9000400003077",
    "name": "Julius Meinl President Çekirdek Kahve, Orta Kavrulmuş, Classic Aromalı, 500 g",
    "size": "500 g",
    "packaging": "Folyo ambalaj",
    "price": 568.0,
    "brand": {
      "id": 5587,
      "name": "Julius Meinl"
    },
    "manufacturer": "Üretici: Julius Meinl Italia S.p.A., Via Verona 70, 36077 Altavilla Vicentina, İtalya; İthalatçı: Julius Meinl Gıda San. ve Tic. Ltd. Şti., Kemankeş Karamustafapaşa Mah. Karaali Kaptan Sokak No:5 Merkez, Beyoğlu, İstanbul",
    "description": "President Çekirdek Kahve 500 g — Julius Meinl ürünü.\n\nÜrün Tipi: Çekirdek kahve (ganze Bohne / whole bean). Üretim yeri: İtalya (Türkçe etikette menşei İtalya beyan edilmiş; ambalaj üzerinde 'Made in Austria' / Hergestellt in Österreich da yazıyor). İçindekiler: %100 kavrulmuş çekirdek kahve.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B009PIIMXA) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "%100 kavrulmuş çekirdek kahve"
      }
    ],
    "labels": [],
    "storage": "Serin ve kuru yerde muhafaza ediniz (kuru, ısıdan uzak yerde saklayınız).",
    "usage": "Kahve çekirdeklerini öğütün. Öğütülmüş kahveyi demlemek için 1 lt su içine 60-80 gram (8 yemek kaşığı) kahve kullanınız.",
    "specifications": [
      {
        "key": "Marka",
        "value": "Julius Meinl"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve (ganze Bohne / whole bean)"
      },
      {
        "key": "Net Miktar",
        "value": "500 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Üretici",
        "value": "Üretici: Julius Meinl Italia S.p.A., Via Verona 70, 36077 Altavilla Vicentina, İtalya; İthalatçı: Julius Meinl Gıda San. ve Tic. Ltd. Şti., Kemankeş Karamustafapaşa Mah. Karaali Kaptan Sokak No:5 Merkez, Beyoğlu, İstanbul"
      },
      {
        "key": "Üretim Yeri",
        "value": "İtalya (Türkçe etikette menşei İtalya beyan edilmiş; ambalaj üzerinde 'Made in Austria' / Hergestellt in Österreich da yazıyor)"
      },
      {
        "key": "Seri",
        "value": "JM Classic Collection Präsident"
      },
      {
        "key": "Yoğunluk",
        "value": "5/10"
      },
      {
        "key": "Marka Merkezi",
        "value": "Julius Meinl, Viyana 1862 (kuruluş)"
      },
      {
        "key": "GTIN (ambalaj)",
        "value": "9000400003077"
      },
      {
        "key": "Ek Logolar",
        "value": "EAC, Triman, Möbius geri dönüşüm, Yeşil Nokta"
      },
      {
        "key": "EAN-13",
        "value": "9000400003077"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B009PIIMXA"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Besin tablosu hiçbir panelde yok (kahve için muafiyet normal). Türkçe ithalat etiketi 'MENŞEİ: İTALYA' diyor, İngilizce/Almanca baskı 'Made in Austria' diyor — çelişki kaydedildi. Üretici Julius Meinl Italia (Altavilla Vicentina, İtalya), ihracatçı Julius Meinl Austria GmbH (Viyana) olarak ayrılmış. 02.jpg arka etiketinde çok dilli dağıtıcı adresleri (UK, RU, LT, LV, SK, RO) var."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B00K1VTTHS",
    "slug": "nescafe-gold-cozunebilir-kahve-ekopaket-200-g-b00k1vtths",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ]
    ],
    "barcode": "8690632032108",
    "name": "Nescafé Gold Çözünebilir Kahve Ekopaket, 200 g",
    "size": "200 g",
    "packaging": "Folyo ambalaj",
    "price": 389.9,
    "brand": {
      "id": 139,
      "name": "Nescafe"
    },
    "manufacturer": null,
    "description": "Gold Ekopaket 200 g — Nescafe ürünü.\n\nÜrün Tipi: Suda çözünür kahve (Nescafé Gold). Kavurma: Altın oranda kavrulmuş Arabica çekirdekleri ile.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B00K1VTTHS) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Nescafe"
      },
      {
        "key": "Ürün Tipi",
        "value": "Suda çözünür kahve (Nescafé Gold)"
      },
      {
        "key": "Kavurma",
        "value": "Altın oranda kavrulmuş Arabica çekirdekleri ile"
      },
      {
        "key": "Net Miktar",
        "value": "200 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Yoğunluk",
        "value": "7"
      },
      {
        "key": "Bardak Sayısı",
        "value": "Yaklaşık 100 bardak"
      },
      {
        "key": "Tedarik Beyanı",
        "value": "%100 sorumlu kaynaklardan kahve"
      },
      {
        "key": "Aroma",
        "value": "Zengin aroma ve yumuşak içim"
      },
      {
        "key": "EAN-13",
        "value": "8690632032108"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B00K1VTTHS"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeride yalnızca ön yüz var; arka panel (içindekiler, besin tablosu, üretici adres, saklama) fotoğraflanmamış. '%100 sorumlu kaynaklardan kahve**' dipnotu ambalajda görünüyor ancak sertifika logosu (Rainforest Alliance vb.) ön yüzde yok."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B00T41Y1NS",
    "slug": "lavazza-crema-e-gusto-classico-ogutulmus-filtre-kahve-250-g-b00t41y1ns",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ]
    ],
    "barcode": "8000070038769",
    "name": "Lavazza Crema e Gusto Classico Öğütülmüş Filtre Kahve 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 388.95,
    "brand": {
      "id": 3901,
      "name": "Lavazza"
    },
    "manufacturer": null,
    "description": "Crema e Gusto Classico Filtre Kahve 250 g — Lavazza ürünü.\n\nÜrün Tipi: Öğütülmüş kahve (crema e gusto Classico).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B00T41Y1NS) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Lavazza"
      },
      {
        "key": "Ürün Tipi",
        "value": "Öğütülmüş kahve (crema e gusto Classico)"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Yoğunluk",
        "value": "7/10"
      },
      {
        "key": "Kullanım Önerisi",
        "value": "Filtre kahve, French press, moka pot, bean-to-cup makineler için ideal (siyah kahve & latte)"
      },
      {
        "key": "Marka Merkezi",
        "value": "Torino, İtalya (1895)"
      },
      {
        "key": "EAN-13",
        "value": "8000070038769"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B00T41Y1NS"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeri yalnızca ön yüz + 3/4 açı fotoğrafları; arka panel (içindekiler, üretici adres, saklama, besin) yok. Yan panelde barkod görünüyor ama rakamlar okunamıyor. Amazon başlığı 'Filtre Kahve' diyor; ambalaj 'GROUND COFFEE' ve moka pot/French press kullanım ikonları gösteriyor."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B010KORBQQ",
    "slug": "nescafe-gold-cozunebilir-kahve-kavanoz-200-g-b010korbqq",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ]
    ],
    "barcode": "7610100026126",
    "name": "Nescafé Gold Çözünebilir Kahve, Kavanoz, 200 g",
    "size": "200 g",
    "packaging": "Cam kavanoz",
    "price": 520.0,
    "brand": {
      "id": 139,
      "name": "Nescafe"
    },
    "manufacturer": "İthalatçı: Nestlé Türkiye Gıda Sanayi A.Ş., Maslak Mah. Bilim Sokak No:5 Ayazağa, 34460 Sarıyer/İstanbul, Türkiye",
    "description": "Gold Kavanoz 200 g — Nescafe ürünü.\n\nÜrün Tipi: Suda çözünebilir kahve (Nescafé Gold kavanoz). Kavurma: Alto Ora — NESCAFÉ uzmanlarının özel kavurma süreci. Üretim yeri: Menşe: İsviçre. İçindekiler: %100 çözünebilir kahve (Arabica ve Robusta çekirdeklerinin özel harmanı).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B010KORBQQ) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 1265,
        "name": "%100 çözünebilir kahve (Arabica ve Robusta çekirdeklerinin özel harmanı)"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Nescafe"
      },
      {
        "key": "Ürün Tipi",
        "value": "Suda çözünebilir kahve (Nescafé Gold kavanoz)"
      },
      {
        "key": "Kavurma",
        "value": "Alto Ora — NESCAFÉ uzmanlarının özel kavurma süreci"
      },
      {
        "key": "Net Miktar",
        "value": "200 g"
      },
      {
        "key": "Ambalaj",
        "value": "Cam kavanoz"
      },
      {
        "key": "Üretici",
        "value": "İthalatçı: Nestlé Türkiye Gıda Sanayi A.Ş., Maslak Mah. Bilim Sokak No:5 Ayazağa, 34460 Sarıyer/İstanbul, Türkiye"
      },
      {
        "key": "Üretim Yeri",
        "value": "Menşe: İsviçre"
      },
      {
        "key": "Yoğunluk",
        "value": "7"
      },
      {
        "key": "Bardak Sayısı",
        "value": "Yaklaşık 100 bardak"
      },
      {
        "key": "Tedarik Beyanı",
        "value": "Sorumlu kaynaklardan kahve (sorumlu kalkınma)"
      },
      {
        "key": "İletişim",
        "value": "www.nestle.com.tr, 0800 211 02 18 / 444 3 160"
      },
      {
        "key": "Marka Sahibi",
        "value": "Société des Produits Nestlé S.A. (tescilli marka sahibi)"
      },
      {
        "key": "EAN-13",
        "value": "7610100026126"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B010KORBQQ"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Arka yüzde içindekiler listesi ayrı satır olarak değil '%100 Çözünebilir Kahve' beyanı şeklinde; bileşen detayı yok. Besin tablosu ve saklama talimatı görünür yüzlerde yok. Kavanoz atığı/geri dönüşüm dipnotu kısmen kesik."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0190KXUCU",
    "slug": "kurukahveci-mehmet-efendi-turk-kahvesi-100-g-b0190kxucu",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "04.jpg"
      ]
    ],
    "barcode": "8690627121206",
    "name": "Kurukahveci Mehmet Efendi Türk Kahvesi 100 g",
    "size": "100 g",
    "packaging": "Karton kutu",
    "price": 94.0,
    "brand": {
      "id": 201,
      "name": "Kurukahveci-Mehmet-Efendi"
    },
    "manufacturer": "Kurukahveci Mehmet Efendi Mahdulları Gıda Sanayi ve Ticaret A.Ş., Dudullu OSB Mahallesi 1. Cadde No: 22-24, Ümraniye 34775 İstanbul, Türkiye; Tel: +90 212 444 22 00; AB dağıtıcısı: Vintage Food Corp., 849 Newark Tpke, Kearny, NJ 07032 USA",
    "description": "Türk Kahvesi 100 g — Kurukahveci-Mehmet-Efendi ürünü.\n\nÜrün Tipi: Öğütülmüş Türk kahvesi. Üretim yeri: Türkiye'de üretilmiştir (TÜRK MALI / Produced in Türkiye). İçindekiler: %100 öğütülmüş Türk kahvesi (saf Arabica).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0190KXUCU) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4949,
        "name": "%100 öğütülmüş Türk kahvesi (saf Arabica)"
      }
    ],
    "labels": [],
    "storage": "Kahveyi sıkıca kapatılmış kapta, kuru ve serin yerde muhafaza ediniz.",
    "usage": "Cezvede hazırlanır: her fincan (65 ml su) için 1 tatlı kaşığı (6 g) kahve kullanılır; şekeri isteğe göre ekleyin, kısık ateşte karıştırarak pişirin; köpüğü fincanlara paylaştırıp tekrar ısıttıktan sonra dökün. Servis sonrası karıştırmayın.",
    "specifications": [
      {
        "key": "Marka",
        "value": "Kurukahveci-Mehmet-Efendi"
      },
      {
        "key": "Ürün Tipi",
        "value": "Öğütülmüş Türk kahvesi"
      },
      {
        "key": "Net Miktar",
        "value": "100 g"
      },
      {
        "key": "Ambalaj",
        "value": "Karton kutu"
      },
      {
        "key": "Üretici",
        "value": "Kurukahveci Mehmet Efendi Mahdulları Gıda Sanayi ve Ticaret A.Ş., Dudullu OSB Mahallesi 1. Cadde No: 22-24, Ümraniye 34775 İstanbul, Türkiye; Tel: +90 212 444 22 00; AB dağıtıcısı: Vintage Food Corp., 849 Newark Tpke, Kearny, NJ 07032 USA"
      },
      {
        "key": "Üretim Yeri",
        "value": "Türkiye'de üretilmiştir (TÜRK MALI / Produced in Türkiye)"
      },
      {
        "key": "Çekirdek",
        "value": "%100 Arabica"
      },
      {
        "key": "Porsiyon",
        "value": "6 g kahve / 65 ml su; ambalajda ~16 porsiyon"
      },
      {
        "key": "İşletme Kayıt No",
        "value": "TR-34-K-004732"
      },
      {
        "key": "Marka Tescili",
        "value": "Marka 2008/44375 no ile Sanayi ve Ticaret Bakanlığınca tescilli"
      },
      {
        "key": "GTIN (ambalaj)",
        "value": "8690627121206"
      },
      {
        "key": "Kanada Kayıt No",
        "value": "928751"
      },
      {
        "key": "Ambalaj Üreticisi",
        "value": "ProPak Ambalaj (İşletme Kayıt No: TR-81-K-000465)"
      },
      {
        "key": "Kuruluş",
        "value": "1871"
      },
      {
        "key": "Besin Tablosu",
        "value": "ABD ihracat baskısında 6 g porsiyon için tüm değerler 0 g/0 kcal olarak yuvarlanmış; 100 g karşılığı verilmediği için tablo kaydedilmedi"
      },
      {
        "key": "EAN-13",
        "value": "8690627121206"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0190KXUCU"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Etiket ABD ihracat baskısı: besin tablosu Amerikan formatında (Calories 0, Fat 0g, Sodium 0mg, Carbohydrate 0g, Protein 0g; 6 g porsiyon başına) ve 'kaynak değil' dipnotu içeriyor — 100 g başına değer verilmiyor, kJ/sat/tuz/shaft sütunları yok. Türkçe mevzuat başlıkları (İçindekiler/Muhafaza) bu baskıda İngilizce. Galeri 250 g teneke ve 12'li tek fincanlık gibi diğer boyutların fotoğraflarını da içeriyor; bu kayıt 100 g poşete aittir."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B06XD6YRNZ",
    "slug": "l-or-supremo-intensity-10-nespresso-uyumlu-aluminyum-kapsul--b06xd6yrnz",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "04.jpg"
      ]
    ],
    "barcode": "8711000360521",
    "name": "L'OR Supremo Intensity 10 Nespresso Uyumlu Alüminyum Kapsül Kahve 10 Adet",
    "size": "10 × 5,3 g (53 g)",
    "packaging": "Alüminyum kapsül",
    "price": 196.9,
    "brand": {
      "id": 5588,
      "name": "L'OR"
    },
    "manufacturer": null,
    "description": "Supremo Intensity 10 Kapsül Kahve 10'lu — L'OR ürünü.\n\nÜrün Tipi: Espresso kapsül (L'OR Supremo).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B06XD6YRNZ) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [
      "recyclable"
    ],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "L'OR"
      },
      {
        "key": "Ürün Tipi",
        "value": "Espresso kapsül (L'OR Supremo)"
      },
      {
        "key": "Net Miktar",
        "value": "10 × 5,3 g (53 g)"
      },
      {
        "key": "Ambalaj",
        "value": "Alüminyum kapsül"
      },
      {
        "key": "Yoğunluk",
        "value": "10"
      },
      {
        "key": "Uyumluluk",
        "value": "Nespresso® kahve makineleri ile uyumludur (*Nespresso, Jacobs Douwe Egberts ile ilgisi olmayan üçüncü taraf ticari markası)"
      },
      {
        "key": "Kapsül Malzemesi",
        "value": "Alüminyum"
      },
      {
        "key": "Profil",
        "value": "Zengin, baharatlı, güçlü; yoğun kavrulmuş ve meyvemsi notalar"
      },
      {
        "key": "EAN-13",
        "value": "8711000360521"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B06XD6YRNZ"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeride kutu ön yüzü ve reklam görselleri var; kutunun arka/yan yüzü (net ağırlık, kapsül sayısı, içindekiler, ithalatçı, barkod) fotoğraflanmamış. Amazon başlığı 10'lu diyor, ambalajdan doğrulanamadı. Reklam görselinde ORGANIC yazılı yeşil kapsül var ancak bu Supremo ürünüyle eşleşmiyor olabilir — sertifika olarak sayılmadı."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B07D3PJCJT",
    "slug": "kahve-dunyas-damla-sakzl-turk-kahvesi-250-g-b07d3pjcjt",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ]
    ],
    "barcode": "8697447042025",
    "name": "Kahve Dünyası Damla Sakızlı Türk Kahvesi 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 259.9,
    "brand": {
      "id": 3716,
      "name": "Kahve Dünyası"
    },
    "manufacturer": null,
    "description": "Damla Sakızlı Türk Kahvesi 250 g — Kahve Dünyası ürünü.\n\nÜrün Tipi: Damla sakızlı Türk kahvesi (aromalı).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B07D3PJCJT) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Kahve Dünyası"
      },
      {
        "key": "Ürün Tipi",
        "value": "Damla sakızlı Türk kahvesi (aromalı)"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Çekirdek",
        "value": "%100 Arabica"
      },
      {
        "key": "EAN-13",
        "value": "8697447042025"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B07D3PJCJT"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeride yalnızca teneke ön yüzü var; arka/yan etiket (içindekiler — damla sakızı aroması bileşeni dahil —, üretici adres, işletme kayıt no, besin tablosu, muhafaza, barkod) fotoğraflanmamış. Aroma bileşenin tam adı (doğal aroma mı, sakız parçası mı) okunamadı."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B07P9852BH",
    "slug": "kurukahveci-mehmet-efendi-kakao-250-g-teneke-b07p9852bh",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ]
    ],
    "barcode": "8690627313809",
    "name": "Kurukahveci Mehmet Efendi Kakao 250 g Teneke",
    "size": "250 g",
    "packaging": "Teneke kutu",
    "price": 346.77,
    "brand": {
      "id": 201,
      "name": "Kurukahveci-Mehmet-Efendi"
    },
    "manufacturer": "Kurukahveci Mehmet Efendi Mahdulları Limited Şirketi, Organize Sanayi Bölgesi 1. Cadde No: 22, Y. Dudullu 34776 İstanbul; Tel: +90 212 444 22 00; www.mehmetefendi.com",
    "description": "Kakao 250 g Teneke — Kurukahveci-Mehmet-Efendi ürünü.\n\nÜrün Tipi: Kakao tozu, koyu renkli tip. Üretim yeri: Türk malı (ana bileşenin menşei ülkesi farklıdır — kakao çekirdeği ithal).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B07P9852BH) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": "Kapalı olarak kuru ortamda muhafaza ediniz.",
    "usage": "Pastane tipi: pasta, kek, dondurma ve her türlü tatlı yapımında kullanılabilir; sıcak süt veya su ile karıştırılarak içilebilir.",
    "specifications": [
      {
        "key": "Marka",
        "value": "Kurukahveci-Mehmet-Efendi"
      },
      {
        "key": "Ürün Tipi",
        "value": "Kakao tozu, koyu renkli tip"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Teneke kutu"
      },
      {
        "key": "Üretici",
        "value": "Kurukahveci Mehmet Efendi Mahdulları Limited Şirketi, Organize Sanayi Bölgesi 1. Cadde No: 22, Y. Dudullu 34776 İstanbul; Tel: +90 212 444 22 00; www.mehmetefendi.com"
      },
      {
        "key": "Üretim Yeri",
        "value": "Türk malı (ana bileşenin menşei ülkesi farklıdır — kakao çekirdeği ithal)"
      },
      {
        "key": "İşlem",
        "value": "Alkalize işlem görmüştür"
      },
      {
        "key": "Uyum",
        "value": "Türk Gıda Kodeksi Kakao ve Çikolata Ürünleri Tebliğine uygundur"
      },
      {
        "key": "İşletme Kayıt No",
        "value": "TR-34-K-004732"
      },
      {
        "key": "Marka Tescili",
        "value": "Marka 2008/44375 no ile Sanayi ve Ticaret Bakanlığınca tescilli"
      },
      {
        "key": "GTIN (ambalaj)",
        "value": "8690627313809"
      },
      {
        "key": "Ambalaj Üreticisi",
        "value": "Sarten Ambalaj Sanayi ve Ticaret A.Ş. (İşletme Kayıt No: TR-41-K-004501)"
      },
      {
        "key": "EAN-13",
        "value": "8690627313809"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B07P9852BH"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "İçindekiler listesi, besin tablosu ve alerjen beyanı görünür yüzlerde yok (teneke yan paneli fotoğraflanmamış). Türk Gıda Kodeksi normalde içindekiler ister; etiketin eksik yüzü kayıt altına alındı."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B07RFD8YZJ",
    "slug": "starbucks-single-origin-colombia-ogutulmus-kahve-200-g-b07rfd8yzj",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "04.jpg"
      ]
    ],
    "barcode": "7613036963039",
    "name": "Starbucks Single-Origin Colombia Öğütülmüş Kahve 200 g",
    "size": "200 g",
    "packaging": "Folyo ambalaj",
    "price": 472.39,
    "brand": {
      "id": 12,
      "name": "Starbucks"
    },
    "manufacturer": "Starbucks Corporation markası; AB'de Nestlé tarafından paketlenir — UK & IRE: Nestlé House, 3030 Lake Drive, Citywest Business Campus, Dublin 24, İrlanda (UK: PO Box 202, York, YO91 1XX); FR: Nestlé France SAS, 34-40 rue Guynemer, 92130 Issy-les-Moulineaux; NL: Nestlé Nederland B.V., PO Box 134, 1180 AC Amstelveen; DE: Nestlé Deutschland AG, 60523 Frankfurt am Main. © 2020 Starbucks Corporation",
    "description": "Single-Origin Colombia Öğütülmüş 200 g — Starbucks ürünü.\n\nÜrün Tipi: Öğütülmüş kahve (single-origin Colombia). Kavurma: Orta (medium roast). Üretim yeri: Tek menşe: Kolombiya; AB'de kavrulmuş ve paketlenmiştir (Roasted in the EU, Packed in the EU). İçindekiler: %100 Arabica kahve (öğütülmüş kavruk kahve).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B07RFD8YZJ) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4058,
        "name": "%100 Arabica kahve (öğütülmüş kavruk kahve)"
      }
    ],
    "labels": [],
    "storage": "Temiz, serin ve kuru yerde saklayınız. (Çok dilli baskı: 'Store in a clean, cool and dry place')",
    "usage": "Harika kahve demleyin: filtrelenmiş su kullanın; 1 fincan için 10 g kahve + 180 ml su. Coffee press (french press) ve filtre makinesi ikonları ile işaretli.",
    "specifications": [
      {
        "key": "Marka",
        "value": "Starbucks"
      },
      {
        "key": "Ürün Tipi",
        "value": "Öğütülmüş kahve (single-origin Colombia)"
      },
      {
        "key": "Kavurma",
        "value": "Orta (medium roast)"
      },
      {
        "key": "Net Miktar",
        "value": "200 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Üretici",
        "value": "Starbucks Corporation markası; AB'de Nestlé tarafından paketlenir — UK & IRE: Nestlé House, 3030 Lake Drive, Citywest Business Campus, Dublin 24, İrlanda (UK: PO Box 202, York, YO91 1XX); FR: Nestlé France SAS, 34-40 rue Guynemer, 92130 Issy-les-Moulineaux; NL: Nestlé Nederland B.V., PO Box 134, 1180 AC Amstelveen; DE: Nestlé Deutschland AG, 60523 Frankfurt am Main. © 2020 Starbucks Corporation"
      },
      {
        "key": "Üretim Yeri",
        "value": "Tek menşe: Kolombiya; AB'de kavrulmuş ve paketlenmiştir (Roasted in the EU, Packed in the EU)"
      },
      {
        "key": "Yoğunluk",
        "value": "7 (Starbucks ölçeği: blonde 4-6, medium 7-9, dark 10-12)"
      },
      {
        "key": "Çekirdek",
        "value": "%100 Arabica"
      },
      {
        "key": "Tat Notları",
        "value": "Dengeli, fındıksı notalar"
      },
      {
        "key": "GTIN (ambalaj)",
        "value": "7613036963059"
      },
      {
        "key": "Tarih Başvurusu",
        "value": "© 2020 Starbucks Corporation"
      },
      {
        "key": "EAN-13",
        "value": "7613036963039"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B07RFD8YZJ"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Arka panelin üst hukuki metin bloğu ve alt kısım (hikaye + demleme + barkod) okundu; ancak besin tablosu hiçbir görünür yüzde yok. Bir lifestyle görselinin (05.jpg) ön alt küçük puntusunda besin değeri gibi bir satır seçildi (271 kcal, 13.1 g yağ, 0 g karbonhidrat) fakat okuma düşük güvenliydi: öğütülmüş kahve için 0 g karbonhidrat implausibldı ve kcal aritmetik doğrulaması başarısızdı (4×17.3 + 9×13.1 = 187 ≠ 271) → besin değeri null bırakıldı. Aynı görselde '226g (8 oz)' okunmuştu; ön panel ve tema sayfası net 200 g gösterdiği için 200 g esas alındı. Barkod 7613036963059 ambalajda okundu (metadata 7613036963039'dan farklı — ambalajdaki esas alındı, metadata değeri sorgulanmalı)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B07TC6JW15",
    "slug": "nestle-starbucks-by-nespresso-pike-place-kapsul-kahve-10-lu-b07tc6jw15",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "04.jpg"
      ]
    ],
    "barcode": "7613036961783",
    "name": "Nestlé Starbucks By Nespresso Pike Place Kapsül Kahve 10'lu",
    "size": "10 × 5,3 g (53 g)",
    "packaging": "Alüminyum kapsül",
    "price": 529.0,
    "brand": {
      "id": 12,
      "name": "Starbucks"
    },
    "manufacturer": null,
    "description": "By Nespresso Pike Place Kapsül 10'lu — Starbucks ürünü.\n\nÜrün Tipi: Kapsül kahve (Starbucks by Nespresso, Pike Place Roast). Kavurma: Orta (medium roast).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B07TC6JW15) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Starbucks"
      },
      {
        "key": "Ürün Tipi",
        "value": "Kapsül kahve (Starbucks by Nespresso, Pike Place Roast)"
      },
      {
        "key": "Kavurma",
        "value": "Orta (medium roast)"
      },
      {
        "key": "Net Miktar",
        "value": "10 × 5,3 g (53 g)"
      },
      {
        "key": "Ambalaj",
        "value": "Alüminyum kapsül"
      },
      {
        "key": "Yoğunluk",
        "value": "7"
      },
      {
        "key": "Uyumluluk",
        "value": "Nespresso sistem kapsülü"
      },
      {
        "key": "EAN-13",
        "value": "7613036961783"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B07TC6JW15"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış. Net ağırlık gram olarak ambalajda okunamadı; kutu ön yüzünde 10 kapsül sayısı baskılı."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B07VVFYWLM",
    "slug": "nestle-coffee-mate-kahve-beyazlatc-400-g-b07vvfywlm",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ]
    ],
    "barcode": "8850124020321",
    "name": "Nestlé Coffee Mate Kahve Beyazlatıcı 400 g",
    "size": "400 g",
    "packaging": "Cam kavanoz",
    "price": 159.9,
    "brand": {
      "id": 2779,
      "name": "Coffee Mate"
    },
    "manufacturer": null,
    "description": "Coffee Mate 400 g — Coffee Mate ürünü.\n\nÜrün Tipi: Kahve beyazlatıcı.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B07VVFYWLM) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Coffee Mate"
      },
      {
        "key": "Ürün Tipi",
        "value": "Kahve beyazlatıcı"
      },
      {
        "key": "Net Miktar",
        "value": "400 g"
      },
      {
        "key": "Ambalaj",
        "value": "Cam kavanoz"
      },
      {
        "key": "Marka Sahibi",
        "value": "Nestlé"
      },
      {
        "key": "Ön Yüz Beyanı",
        "value": "Yenilenen tadıyla — yumuşak kahve keyfiniz için"
      },
      {
        "key": "EAN-13",
        "value": "8850124020321"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B07VVFYWLM"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeride yalnız ön yüz var (iki ölçekli aynı ön yüz render'ı); arka panel (içindekiler, besin tablosu, üretici adresi, saklama) fotoğraflanmamış. Ön yüzde okunabilenler: Nestlé, Coffee mate, 'Net: 400 g', 'Yenilenen Tadıyla', 'Yumuşak Kahve Keyfiniz için'."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B088T3VT6Y",
    "slug": "tchibo-privat-kaffee-latin-grande-cekirdek-kahve-500-g-b088t3vt6y",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "4006067081088",
    "name": "Tchibo Privat Kaffee Latin Grande Çekirdek Kahve 500 g",
    "size": "500 g",
    "packaging": "Folyo ambalaj",
    "price": 819.0,
    "brand": {
      "id": 208,
      "name": "Tchibo"
    },
    "manufacturer": null,
    "description": "Privat Kaffee Latin Grande Çekirdek 500 g — Tchibo ürünü.\n\nÜrün Tipi: Çekirdek kahve.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B088T3VT6Y) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [
      "fair-trade"
    ],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Tchibo"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve"
      },
      {
        "key": "Net Miktar",
        "value": "500 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Çekirdek Menşei",
        "value": "Guatemala"
      },
      {
        "key": "Kahve Türü",
        "value": "%100 Tchibo Arabica"
      },
      {
        "key": "Tat Profili",
        "value": "Dengeli, hassas çikolata notaları (Ausgewogen – zart schokoladig)"
      },
      {
        "key": "Lezzet Profili",
        "value": "Yoğunluk/Asidite/Gövde/Kavurma fasulye ikonlarıyla puanlanmış (sayısal değerler okunamadı)"
      },
      {
        "key": "EAN-13",
        "value": "4006067081088"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B088T3VT6Y"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeri: Almanca ön yüz + Türkçe lezzet profili paneli + Türkçe Rainforest Alliance paneli. Arka/yan küçük baskı (Zutaten, Nährwerte, üretici adresi, saklama) hiçbir görüntüde okunamadı. ÇELİŞKİ: contact sheet ön yüzünde 'Inhalt: 250 g' okundu (küçük puntolu, ham görüntüde okunamıyor); liste başlığı ve EAN 500 g belirtiyor — 500 g kaydedildi, doğrulama gerekir. Yoğunluk ikon sayısı okumalar arasında tutarsız (2/6 ile 4/5 arası)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08BG4X55B",
    "slug": "nescafe-gold-cozunebilir-kahve-kavanoz-50-g-b08bg4x55b",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ]
    ],
    "barcode": "7610100026591",
    "name": "Nescafé Gold Çözünebilir Kahve Kavanoz 50 g",
    "size": "50 g",
    "packaging": "Cam kavanoz",
    "price": 187.9,
    "brand": {
      "id": 139,
      "name": "Nescafe"
    },
    "manufacturer": "İthalatçı: Nestlé Türkiye Gıda Sanayi A.Ş., Maslak Mah. Eski Büyükdere Cad. Orjin Maslak İş Merkezi Sitesi No: 27 İç Kapı No: 58, Sarıyer / İstanbul",
    "description": "Gold Kavanoz 50 g — Nescafe ürünü.\n\nÜrün Tipi: Çözünebilir kahve. Üretim yeri: İsviçre. İçindekiler: %100 çözünebilir kahve.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08BG4X55B) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 1265,
        "name": "%100 çözünebilir kahve"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": "1 tatlı kaşığı (1 tk) kahveyi 200 ml sıcak su ile hazırlayın.",
    "specifications": [
      {
        "key": "Marka",
        "value": "Nescafe"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çözünebilir kahve"
      },
      {
        "key": "Net Miktar",
        "value": "50 g"
      },
      {
        "key": "Ambalaj",
        "value": "Cam kavanoz"
      },
      {
        "key": "Üretici",
        "value": "İthalatçı: Nestlé Türkiye Gıda Sanayi A.Ş., Maslak Mah. Eski Büyükdere Cad. Orjin Maslak İş Merkezi Sitesi No: 27 İç Kapı No: 58, Sarıyer / İstanbul"
      },
      {
        "key": "Üretim Yeri",
        "value": "İsviçre"
      },
      {
        "key": "Paketleme",
        "value": "Koruyucu atmosferde paketlenmiştir"
      },
      {
        "key": "Fincan Verimi",
        "value": "Yaklaşık 25 fincan (ön yüz ikonu)"
      },
      {
        "key": "İletişim",
        "value": "www.nescafe.com.tr — 0800 211 02 18 / 444 3 160"
      },
      {
        "key": "EAN-13",
        "value": "7610100026591"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08BG4X55B"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Arka etikette içindekiler listesi, besin tablosu ve saklama koşulları görünmüyor; içerik, ön yüzdeki '%100 ÇÖZÜNEBİLİR KAHVE' beyanından tek bileşen olarak kaydedildi. Menşe iki okumada farklı çıktı (ham görüntü: 'Menşei: İsviçre'; contact sheet: 'Mensei: İngiltere') — ham görüntü okuması esas alındı, doğrulama gerekir. İthalatçı adresi de okumalar arasında farklıydı (sheet: 'Çınar Mah. B Blok No: 55-56 Sarıyer'); ham görüntü okuması kaydedildi."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08BMW81WK",
    "slug": "tchibo-privat-kaffee-brazil-mild-cekirdek-kahve-500-g-b08bmw81wk",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ]
    ],
    "barcode": "4061445353522",
    "name": "Tchibo Privat Kaffee Brazil Mild Çekirdek Kahve 500 g",
    "size": "500 g",
    "packaging": "Folyo ambalaj",
    "price": 835.0,
    "brand": {
      "id": 208,
      "name": "Tchibo"
    },
    "manufacturer": null,
    "description": "Privat Kaffee Brazil Mild Çekirdek 500 g — Tchibo ürünü.\n\nÜrün Tipi: Çekirdek kahve.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08BMW81WK) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": "Dozaj önerisi (125 ml başına): moka pot için 1x, French press için 1,5x; 1 tepeleme yemek kaşığı ≈ 7-8 g.",
    "specifications": [
      {
        "key": "Marka",
        "value": "Tchibo"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve"
      },
      {
        "key": "Net Miktar",
        "value": "500 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Çekirdek Menşei",
        "value": "Brezilya"
      },
      {
        "key": "Kahve Türü",
        "value": "%100 Tchibo Arabica"
      },
      {
        "key": "Tat Profili",
        "value": "Harmonisch – leicht nussig (harmonik, hafif fındıksı)"
      },
      {
        "key": "Ambalaj Malzemesi",
        "value": "C/PPE (geri dönüşüm işareti)"
      },
      {
        "key": "EAN-13",
        "value": "4061445353522"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08BMW81WK"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Yan panelde dozaj önerisi (İngilizce) okundu; yoğunluk ikonları farklı görüntülerde 1/6-2/6 okundu (belirsiz). Zutaten, Nährwerte, üretici adresi ve saklama bilgisi içeren sol yan küçük baskı bloğu aşırı açılı/piksel altı olduğu için hiçbir görüntüden okunamadı — besin tablosu pakette VAR ama değerler okunamıyor. Geri dönüşüm sembolleri ve barkod var, barkod rakamları okunamadı."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08C8Z8CRW",
    "slug": "nescafe-xpress-black-roast-soguk-kahve-250-ml-b08c8z8crw",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8717405003629",
    "name": "Nescafé Xpress Black Roast Soğuk Kahve 250 ml",
    "size": "250 ml",
    "packaging": "Alüminyum kutu (içecek)",
    "price": 59.5,
    "brand": {
      "id": 139,
      "name": "Nescafe"
    },
    "manufacturer": "Nestlé Türkiye Gıda Sanayi A.Ş., Yıldız Plaza No: 12 Kat: 13, 34349 Beşiktaş / İstanbul",
    "description": "Xpress Black Roast Soğuk Kahve 250 ml — Nescafe ürünü.\n\nÜrün Tipi: Soğuk kahve içeceği (Black Roast). Üretim yeri: Türkiye. İçindekiler: Kahve (su, kahve), Süt, Şeker, Asitlik düzenleyici (sodyum bikarbonat), Doğal aroma vericiler.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08C8Z8CRW) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4058,
        "name": "Kahve (su, kahve)"
      },
      {
        "id": 5,
        "name": "Şeker"
      },
      {
        "id": 4694,
        "name": "Doğal aroma vericiler"
      }
    ],
    "labels": [],
    "storage": "Kuru ve serin yerde muhafaza ediniz. Açıldıktan sonra buzdolabında saklayınız ve 2 gün içinde tüketiniz.",
    "usage": "Soğuk içiniz.",
    "specifications": [
      {
        "key": "Marka",
        "value": "Nescafe"
      },
      {
        "key": "Ürün Tipi",
        "value": "Soğuk kahve içeceği (Black Roast)"
      },
      {
        "key": "Net Miktar",
        "value": "250 ml"
      },
      {
        "key": "Ambalaj",
        "value": "Alüminyum kutu (içecek)"
      },
      {
        "key": "Üretici",
        "value": "Nestlé Türkiye Gıda Sanayi A.Ş., Yıldız Plaza No: 12 Kat: 13, 34349 Beşiktaş / İstanbul"
      },
      {
        "key": "Üretim Yeri",
        "value": "Türkiye"
      },
      {
        "key": "Kod",
        "value": "TÜR 12-148"
      },
      {
        "key": "Tüketici Danışma Hattı",
        "value": "0800 211 21 60"
      },
      {
        "key": "İletişim",
        "value": "www.nescafe.com.tr"
      },
      {
        "key": "TETT ve Parti No",
        "value": "Kutunun altlığında"
      },
      {
        "key": "EAN-13",
        "value": "8717405003629"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08C8Z8CRW"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Etiket okuma sınırları: 'İçindekiler' başlığında 'Black.' alt başlığı ve bileşen sırası okunamadıysa da süt içeriyor (alerjen süt; içindekilerde 'süt' ve besin tablosundaki yağ/protein tutarlı). Enerji satırı '10 kJ / 2,4 kcal (100 ml)' okundu — ARİTMETİK UYUŞMAZ: 0,3 g protein + 0,4 g şeker yalnızca ~2,8 kcal verir; basılı 2,4 kcal makrolarla düşük-farkla uyumlu ama 10 kJ ile tam tutmuyor — değerler basıldığı gibi kaydedildi. Lif değeri tabloda yok (null). Barkod iki okumada farklı: sheet 8 690405 006327, ham 8 6977405 003629 — metadata'daki EAN 8717405003629 ile ikisi de eşleşmiyor; doğrulama gerekir. 'Box: Dorom 080 - 211 21 60' satırı kısmi/bozuk okuma."
      }
    ],
    "warnings": [],
    "allergens": [
      3
    ],
    "nutrition": {
      "per": "100g",
      "items": [
        {
          "nutrient": 1,
          "amount": 10.0,
          "unit": "kJ"
        },
        {
          "nutrient": 2,
          "amount": 2.4,
          "unit": "kcal"
        },
        {
          "nutrient": 4,
          "amount": 0.2,
          "unit": "g"
        },
        {
          "nutrient": 5,
          "amount": 0.1,
          "unit": "g"
        },
        {
          "nutrient": 7,
          "amount": 0.4,
          "unit": "g"
        },
        {
          "nutrient": 8,
          "amount": 0.4,
          "unit": "g"
        },
        {
          "nutrient": 19,
          "amount": 0.3,
          "unit": "g"
        },
        {
          "nutrient": 20,
          "amount": 0.05,
          "unit": "g"
        }
      ]
    }
  },
  {
    "asin": "B08QNSS3F1",
    "slug": "julius-meinl-lungo-classico-kapsul-kahve-1-paket-10-adet-bio-b08qnss3f1",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "04.jpg"
      ]
    ],
    "barcode": "9000403940317",
    "name": "Julius Meinl Lungo Classico Kapsül Kahve - 1 paket 10 Adet Biodegradable",
    "size": "10 × 5 g (50 g)",
    "packaging": "Alüminyum kapsül",
    "price": 208.6,
    "brand": {
      "id": 5587,
      "name": "Julius Meinl"
    },
    "manufacturer": null,
    "description": "Lungo Classico Kapsül Kahve 10'lu — Julius Meinl ürünü.\n\nÜrün Tipi: Kapsül kahve.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08QNSS3F1) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [
      "fair-trade"
    ],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Julius Meinl"
      },
      {
        "key": "Ürün Tipi",
        "value": "Kapsül kahve"
      },
      {
        "key": "Net Miktar",
        "value": "10 × 5 g (50 g)"
      },
      {
        "key": "Ambalaj",
        "value": "Alüminyum kapsül"
      },
      {
        "key": "Yoğunluk",
        "value": "6 (kutu ön yüzü)"
      },
      {
        "key": "Kapsül Malzemesi",
        "value": "100% biyobazlı malzeme — 'One of first home-compostable capsules on the market'"
      },
      {
        "key": "Slogan",
        "value": "Zero Waste. Maximum Taste."
      },
      {
        "key": "EAN-13",
        "value": "9000403940317"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08QNSS3F1"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeri: ön yüz + tanıtım grafikleri + kapsül yakını + marka logosu; içindekiler, besin tablosu, üretici adresi, saklama, uyumluluk (Nespresso vb.) ve gramaj içeren arka panel fotoğraflanmamış. Kapsül üzerindeki TÜV işareti 'OK compost INDUSTRIAL' olarak okundu; pazarlama metni 'home-compostable' diyor — endüstriyel mi ev mi bozunur olduğu okumalar arasında net değil. '10' adet kutu önünde net; kapsül başı gramaj okunamadı."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08QWRZ5XG",
    "slug": "nescafe-3-u-1-arada-sutlu-kopuklu-cozunebilir-kahve-karsm-10-b08qwrz5xg",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8690632038391",
    "name": "Nescafé 3'ü 1 Arada Sütlü Köpüklü Çözünebilir Kahve Karışımı 10'lu, 17,4 g",
    "size": "10 × 17,4 g (174 g)",
    "packaging": "Karton kutu",
    "price": 95.9,
    "brand": {
      "id": 139,
      "name": "Nescafe"
    },
    "manufacturer": "Nestlé Türkiye Gıda A.Ş., Nenehatun Cd. No: 25/A Blok A Kat: 6, 34398 Maslak / İstanbul",
    "description": "3'ü 1 Arada Sütlü Köpüklü 10'lu — Nescafe ürünü.\n\nÜrün Tipi: 3'ü 1 arada süt köpüklü hazır kahve karışımı. Üretim yeri: Türkiye'de üretilmiştir. İçindekiler: Şeker, Kahve beyazlatıcısı (%35) [glukoz şurubu, tam hidrojenize bitkisel yağ (palm çekirdeği), asitlik düzenleyiciler (dipotasyum fosfat, sodyum polifosfat, trisodyum sitrat, pentasodyum trifosfat), süt proteini, topaklanmayı önleyici (kalsiyum karbonat), emülgatörler (yağ asitlerinin mono ve digliseritleri, yağ asitlerinin mono ve digliseritlerinin mono ve diasetil tartarik asit esterleri), tuz, aroma vericiler], Yağsız süttozu (%6,6), Çözünebilir kahve (%4,9), Aroma verici, Kıvam arttırıcı (selüloz gam), Tuz.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08QWRZ5XG) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 5,
        "name": "Şeker"
      },
      {
        "id": 4058,
        "name": "Kahve beyazlatıcısı (%35) [glukoz şurubu, tam hidrojenize bitkisel yağ (palm çekirdeği), asitlik düzenleyiciler (dipotasyum fosfat, sodyum polifosfat, trisodyum sitrat, pentasodyum trifosfat), süt proteini, topaklanmayı önleyici (kalsiyum karbonat), emülgatörler (yağ asitlerinin mono ve digliseritleri, yağ asitlerinin mono ve digliseritlerinin mono ve diasetil tartarik asit esterleri), tuz, aroma vericiler]"
      },
      {
        "id": 229,
        "name": "Yağsız süttozu (%6,6)"
      },
      {
        "id": 1265,
        "name": "Çözünebilir kahve (%4,9)"
      },
      {
        "id": 4694,
        "name": "Aroma verici"
      },
      {
        "id": 137,
        "name": "Tuz"
      }
    ],
    "labels": [],
    "storage": "Kuru ve serin yerde muhafaza ediniz.",
    "usage": "1) 17,4 g paketin tamamını fincana boşaltın. 2) Kaynatılıp 1 dk bekletilmiş 200 ml sıcak su ilave edin. 3) Karıştırın.",
    "specifications": [
      {
        "key": "Marka",
        "value": "Nescafe"
      },
      {
        "key": "Ürün Tipi",
        "value": "3'ü 1 arada süt köpüklü hazır kahve karışımı"
      },
      {
        "key": "Net Miktar",
        "value": "10 × 17,4 g (174 g)"
      },
      {
        "key": "Ambalaj",
        "value": "Karton kutu"
      },
      {
        "key": "Üretici",
        "value": "Nestlé Türkiye Gıda A.Ş., Nenehatun Cd. No: 25/A Blok A Kat: 6, 34398 Maslak / İstanbul"
      },
      {
        "key": "Üretim Yeri",
        "value": "Türkiye'de üretilmiştir"
      },
      {
        "key": "İşletme Kayıt No",
        "value": "TR-16-K-000243 (ikinci okumada TR-34-K-000587 ve TR-19-K-000434 de geçti — birden fazla tesis numarası basılı olabilir)"
      },
      {
        "key": "Tüketici Hattı",
        "value": "0800 211 02 18 / 444 31 60"
      },
      {
        "key": "İletişim",
        "value": "www.nescafe.com.tr"
      },
      {
        "key": "Sürdürülebilirlik",
        "value": "NESCAFÉ Plan / Türkiye'de üretilmiştir"
      },
      {
        "key": "EAN-13",
        "value": "8690632038391"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08QWRZ5XG"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Ambalaj Notu",
        "value": "İKİ FARKLI OKUMA VAR: contact sheet besin tablosu (100 ml: 157 kJ/38 kcal, yağ 0,9, doymuş 1,0, karb 6,8, şeker 5,3, protein 0,2, tuz 0,3) ile ham görüntü okuması (100 ml: 162 kJ/38 kcal, yağ 1,1, doymuş 1,0, karb 6,8, şeker 5,2, lif 0,2, protein 0,3, tuz 0,13) farklı; ham görüntü okuması (porsiyon 200 ml, lif satırı var, tuz 0,26/200ml ile 0,13/100ml tutarlı, RIA yüzdeleri makrolarla uyumlu) esas alındı — contact sheet okumasında porsiyon 206 ml ve tuz 0,3/0,6 aritmetik olarak tutarsızdı. İçindekiler iki okumada da farklı derinlikte geldi (sheet: süttozu + kazeinat + E471, ham: uzun asitlik düzenleyici listesi) — ham görüntü okuması kaydedildi. ARİTMETİK KONTROL (kayıtlı set): 4×0,3 + 4×0,3 + 9×1,1 + 2×0,2 ≈ 15 kcal ≈ basılı 38 kcal DEĞİL — bu ürün toz + su ile 'hazırlanmış içecek' tablosu olabileceğinden veya okuma hatası olabilir; değerler basıldığı gibi kaydedildi, doğrulama önerilir. Porsiyon (200 ml): 324 kJ/77 kcal, yağ 2,2, doymuş 2,0, karb 14, şeker 10, lif 0,4, protein 0,6, tuz 0,26. İçerik beyanı: 'Ürünlerimizin hiçbirinde domuz yağı ve katkıları yoktur.'"
      }
    ],
    "warnings": [
      {
        "severity": "medium",
        "text": "Buğday içerebilir (içindekiler listesindeki alerjen beyanı)."
      }
    ],
    "allergens": [
      3
    ],
    "nutrition": {
      "per": "100g",
      "items": [
        {
          "nutrient": 1,
          "amount": 162.0,
          "unit": "kJ"
        },
        {
          "nutrient": 2,
          "amount": 38.0,
          "unit": "kcal"
        },
        {
          "nutrient": 4,
          "amount": 1.1,
          "unit": "g"
        },
        {
          "nutrient": 5,
          "amount": 1.0,
          "unit": "g"
        },
        {
          "nutrient": 7,
          "amount": 6.8,
          "unit": "g"
        },
        {
          "nutrient": 8,
          "amount": 5.2,
          "unit": "g"
        },
        {
          "nutrient": 18,
          "amount": 0.2,
          "unit": "g"
        },
        {
          "nutrient": 19,
          "amount": 0.3,
          "unit": "g"
        },
        {
          "nutrient": 20,
          "amount": 0.13,
          "unit": "g"
        }
      ]
    }
  },
  {
    "asin": "B08QYG2GZ5",
    "slug": "kurukahveci-mehmet-efendi-brazil-filtre-kahve-250-g-b08qyg2gz5",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "04.jpg"
      ]
    ],
    "barcode": "8690627000921",
    "name": "Kurukahveci Mehmet Efendi Brazil Filtre Kahve 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 274.0,
    "brand": {
      "id": 201,
      "name": "Kurukahveci-Mehmet-Efendi"
    },
    "manufacturer": null,
    "description": "Brazil Filtre Kahve 250 g — Kurukahveci-Mehmet-Efendi ürünü.\n\nÜrün Tipi: Öğütülmüş filtre kahve.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08QYG2GZ5) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Kurukahveci-Mehmet-Efendi"
      },
      {
        "key": "Ürün Tipi",
        "value": "Öğütülmüş filtre kahve"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Çekirdek Menşei",
        "value": "Brezilya (ön yüz 'BRAZILIAN')"
      },
      {
        "key": "Ön Yüz Beyanı",
        "value": "Freshly Ground (taze öğütülmüş)"
      },
      {
        "key": "EAN-13",
        "value": "8690627000921"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08QYG2GZ5"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış. Geri kalan 6 görüntü yaşam tarzı fotoğrafları (bardak, termos, Chemex). Ön yüzde okunanlar: KURUKAHVECİ MEHMET EFENDİ, BRAZILIAN FILTER COFFEE, Freshly Ground, NET WT 8,8 OZ - 250 g e."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08WJRL3WV",
    "slug": "moliendo-finest-coffee-guatemala-antigua-shb-yoresel-kahve-o-b08wjrl3wv",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190850393",
    "name": "Moliendo Finest Coffee Guatemala Antigua SHB Yöresel Kahve (Öğütülmüş Filtre Kahve) 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 351.75,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": "Özmola Gıda Turizm İnşaat San. ve Tic. Ltd. Şti. (adres okunamadı)",
    "description": "Guatemala Antigua SHB Öğütülmüş 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Öğütülmüş filtre kahve (ÖĞÜTÜLMÜŞ bandrolü). Üretim yeri: Guatemala. İçindekiler: Kahve çekirdeği (içindekiler: kahve çekirdeği — küçük baskıdan kısmen okundu).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08WJRL3WV) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kahve çekirdeği (içindekiler: kahve çekirdeği — küçük baskıdan kısmen okundu)"
      }
    ],
    "labels": [],
    "storage": "Serin ve kuru yerde muhafaza ediniz.",
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Öğütülmüş filtre kahve (ÖĞÜTÜLMÜŞ bandrolü)"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Üretici",
        "value": "Özmola Gıda Turizm İnşaat San. ve Tic. Ltd. Şti. (adres okunamadı)"
      },
      {
        "key": "Üretim Yeri",
        "value": "Guatemala"
      },
      {
        "key": "Menşei",
        "value": "Guatemala (Antigua SHB)"
      },
      {
        "key": "Tadım Notaları",
        "value": "Tatlı çikolata"
      },
      {
        "key": "Tat Profili",
        "value": "Asidite: Orta — Gövde: Tam — İçim/Sertlik: Dengeli"
      },
      {
        "key": "Barkod",
        "value": "8 682190 850393 (etiket üzerinde basılı)"
      },
      {
        "key": "EAN-13",
        "value": "8682190850393"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08WJRL3WV"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Asma etiketin ön yüzü ve tanıtım kartı tam okundu; poşet üzerindeki küçük baskı bloğu (üretici tam adres, işletme kayıt no, gramaj, varsa sertifikalar) okunamadı. Şirket adı (Özmola Gıda Turizm İnşaat San. ve Tic. Ltd. Şti.) contact sheet'ten kısmen okundu. İçindekiler/saklama satırları contact sheet küçük baskısından 'partially legible' okundu — poşet üzerinde VAR ama tek başına doğrulanamadı."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZJMHP4",
    "slug": "kahve-dunyas-3-u-1-arada-klasik-hazr-kahve-40-l-b08xzjmhp4",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "04.jpg"
      ]
    ],
    "barcode": "8697447043534",
    "name": "Kahve Dünyası 3'ü 1 Arada Klasik Hazır Kahve 40'lı",
    "size": "40 × 18 g (720 g)",
    "packaging": "Karton kutu",
    "price": 300.0,
    "brand": {
      "id": 3716,
      "name": "Kahve Dünyası"
    },
    "manufacturer": null,
    "description": "3'ü 1 Arada Klasik Hazır Kahve 40'lı — Kahve Dünyası ürünü.\n\nÜrün Tipi: 3'ü 1 arada klasik hazır kahve karışımı.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZJMHP4) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Kahve Dünyası"
      },
      {
        "key": "Ürün Tipi",
        "value": "3'ü 1 arada klasik hazır kahve karışımı"
      },
      {
        "key": "Net Miktar",
        "value": "40 × 18 g (720 g)"
      },
      {
        "key": "Ambalaj",
        "value": "Karton kutu"
      },
      {
        "key": "Adet",
        "value": "40'lı (liste başlığından; ambalaj ön yüzünden doğrulanmadı)"
      },
      {
        "key": "EAN-13",
        "value": "8697447043534"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZJMHP4"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış. Zaman sınırı nedeniyle görüntüler incelenmedi; kayıttaki bilgiler ürün başlığından (Kahve Dünyası 3'ü 1 Arada Klasik Hazır Kahve 40'lı) türetildi, ambalajdan okunmadı."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZN1J23",
    "slug": "moliendo-finest-coffee-brasil-bossa-nova-yoresel-kahve-cekir-b08xzn1j23",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190852717",
    "name": "Moliendo Finest Coffee Brasil Bossa Nova Yöresel Kahve (Çekirdek) 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 319.25,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Brasil Bossa Nova Çekirdek 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Çekirdek kahve.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZN1J23) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Seriler",
        "value": "Brasil Bossa Nova (liste başlığından; ambalaj ön yüzünden doğrulanmadı)"
      },
      {
        "key": "EAN-13",
        "value": "8682190852717"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZN1J23"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış. Zaman sınırı nedeniyle görüntüler incelenmedi; size (250 g) ürün başlığından türetildi, ambalajdan okunmadı."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZNYD5Q",
    "slug": "moliendo-finest-coffee-salerno-espresso-blend-kahve-cekirdek-b08xznyd5q",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190854117",
    "name": "Moliendo Finest Coffee Salerno Espresso Blend Kahve (Çekirdek) 1000 g",
    "size": "1000 g",
    "packaging": "Folyo ambalaj",
    "price": 1274.0,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Salerno Espresso Çekirdek 1000 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Çekirdek kahve (espresso blend). İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZNYD5Q) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve (espresso blend)"
      },
      {
        "key": "Net Miktar",
        "value": "1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notaları",
        "value": "Çikolata, Vanilya, Karamel, Koyu Renk Çekirdekli Meyveler"
      },
      {
        "key": "Asidite",
        "value": "Orta"
      },
      {
        "key": "Gövde",
        "value": "Orta"
      },
      {
        "key": "İçim Sertlik",
        "value": "Dengeli"
      },
      {
        "key": "Kilitli Poşet",
        "value": "Açmak için kenardan çekiniz, tekrar kapatmak için bastırınız"
      },
      {
        "key": "EAN-13",
        "value": "8682190854117"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZNYD5Q"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeri yalnızca ön yüz + yan panel + pazarlama kartı; içerik/saklama/üretici bilgi paneli okunamıyor (yan panel metni çözünürlük altı). Barkod etiket üzerinde 8682190854117 (grup metaverisi ile eşleşiyor). Yan panelde İspanyolca pazarlama metni blokları var; şirket adresi/web sitesi okunamadı. Kahve için besin tablosu basılmamış görünüyor."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZPRVS9",
    "slug": "moliendo-finest-coffee-colombia-supremo-decaf-kafeinsiz-yore-b08xzprvs9",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190852496",
    "name": "Moliendo Finest Coffee Colombia Supremo Decaf (Kafeinsiz) Yöresel Kahve (Çekirdek) 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 481.25,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Colombia Supremo Decaf Çekirdek 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Kafeinsiz (decaf) çekirdek kahve. Menşe: Kolombiya (Colombia Supremo). İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZPRVS9) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Kafeinsiz (decaf) çekirdek kahve"
      },
      {
        "key": "Menşe",
        "value": "Kolombiya (Colombia Supremo)"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notaları",
        "value": "Zencefil, Bitter Çikolata, Karanfil, Şarapsı"
      },
      {
        "key": "Asidite",
        "value": "Düşük"
      },
      {
        "key": "Gövde",
        "value": "Tam"
      },
      {
        "key": "İçim Sertlik",
        "value": "Güçlü"
      },
      {
        "key": "Kilitli Poşet",
        "value": "Açmak için kenarıdan çekiniz (etikette böyle basılı), tekrar kapatmak için bastırınız"
      },
      {
        "key": "EAN-13",
        "value": "8682190852496"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZPRVS9"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Decaf ürünü ama kafeinsizleştirme yöntemi (CO2/su vb.) ambalajda okunamadı. Besin tablosu yok. Barkod etiket üzerinde 8682190852496 (grup metaverisiyle eşleşiyor). Etikette tadım notası 3 madde (Zencefil, Bitter Çikolata, Karanfil), pazarlama kartında 4. madde Şarapsı da var."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZPV5Q9",
    "slug": "moliendo-finest-coffee-breakfast-blend-filtre-kahve-cekirdek-b08xzpv5q9",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190854629",
    "name": "Moliendo Finest Coffee Breakfast Blend Filtre Kahve (Çekirdek) 1000 g",
    "size": "1000 g",
    "packaging": "Folyo ambalaj",
    "price": 1283.0,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Breakfast Blend Çekirdek 1000 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Filtre kahve çekirdeği (breakfast blend). İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZPV5Q9) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Filtre kahve çekirdeği (breakfast blend)"
      },
      {
        "key": "Net Miktar",
        "value": "1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notaları",
        "value": "Tütünsü, Kakao, Fındık"
      },
      {
        "key": "Asidite",
        "value": "Orta"
      },
      {
        "key": "Gövde",
        "value": "Tam"
      },
      {
        "key": "İçim Sertlik",
        "value": "Güçlü"
      },
      {
        "key": "Kilitli Poşet",
        "value": "Tekrar kapatılabilir zip"
      },
      {
        "key": "EAN-13",
        "value": "8682190854629"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZPV5Q9"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Etikette tadım notu ilk maddesi TÜTÜSÜ olarak basılı (yazım hatası; doğrusu Tütünsü). Besin tablosu yok. Barkod etiket üzerinde 8682190854629 (grup metaverisiyle eşleşiyor)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZQ4L22",
    "slug": "moliendo-finest-coffee-ravello-espresso-blend-kahve-cekirdek-b08xzq4l22",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190852120",
    "name": "Moliendo Finest Coffee Ravello Espresso Blend Kahve (Çekirdek) 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 351.75,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Ravello Espresso Çekirdek 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Çekirdek kahve (espresso blend). İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZQ4L22) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve (espresso blend)"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notaları",
        "value": "Kakao, Kahverengi Şeker"
      },
      {
        "key": "Asidite",
        "value": "Orta"
      },
      {
        "key": "Gövde",
        "value": "Tam"
      },
      {
        "key": "İçim Sertlik",
        "value": "Güçlü"
      },
      {
        "key": "Kilitli Poşet",
        "value": "Açmak için kenardan çekiniz, tekrar kapatmak için bastırınız"
      },
      {
        "key": "EAN-13",
        "value": "8682190852120"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZQ4L22"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Besin tablosu yok. Barkod etiket üzerinde 8682190852120 (grup metaverisiyle eşleşiyor). Ön yüzde İtalyan temalı pazarlama metni var (İtalyan Kahvesi Gibi...)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZQGT7G",
    "slug": "moliendo-finest-coffee-ethiopia-yirgacheffe-yoresel-kahve-ce-b08xzqgt7g",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190852359",
    "name": "Moliendo Finest Coffee Ethiopia Yirgacheffe Yöresel Kahve (Çekirdek) 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 351.75,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Ethiopia Yirgacheffe Çekirdek 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Çekirdek kahve (single origin). Menşe: Etiyopya (Yirgacheffe). İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZQGT7G) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve (single origin)"
      },
      {
        "key": "Menşe",
        "value": "Etiyopya (Yirgacheffe)"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notaları",
        "value": "Karışık Meyvemsi, Sütlü Çikolata, Tatlı Limon"
      },
      {
        "key": "Asidite",
        "value": "Orta"
      },
      {
        "key": "Gövde",
        "value": "Tam"
      },
      {
        "key": "İçim Sertlik",
        "value": "Dengeli"
      },
      {
        "key": "Kilitli Poşet",
        "value": "Açmak için kenardan çekiniz, tekrar kapatmak için bastırınız"
      },
      {
        "key": "EAN-13",
        "value": "8682190852359"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZQGT7G"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Besin tablosu yok. Barkod etiket üzerinde 8682190852359 (grup metaverisiyle eşleşiyor)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZQPFH3",
    "slug": "moliendo-finest-coffee-amalfi-espresso-blend-kahve-cekirdek--b08xzqpfh3",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190854568",
    "name": "Moliendo Finest Coffee Amalfi Espresso Blend Kahve (Çekirdek) 1000 g",
    "size": "1000 g",
    "packaging": "Folyo ambalaj",
    "price": 1158.0,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Amalfi Espresso Çekirdek 1000 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Çekirdek kahve (espresso blend). İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZQPFH3) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve (espresso blend)"
      },
      {
        "key": "Net Miktar",
        "value": "1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notaları",
        "value": "Fındık, Odunsu, Topraksı"
      },
      {
        "key": "Asidite",
        "value": "Düşük"
      },
      {
        "key": "Gövde",
        "value": "Orta"
      },
      {
        "key": "İçim Sertlik",
        "value": "Hafif"
      },
      {
        "key": "Kilitli Poşet",
        "value": "Tekrar kapatılabilir zip"
      },
      {
        "key": "EAN-13",
        "value": "8682190854568"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZQPFH3"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Etikette tadım notaları Fındık & Odunsu & Topraksı biçiminde basılı. Besin tablosu yok. Barkod etiket üzerinde 8682190854568 (grup metaverisiyle eşleşiyor). Ön yüz fotoğrafında okunan 8 690550 500131 düşük çözünürlük yanılgısı; etiket karesinden okunan 8682190854568 esas alındı."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZRG436",
    "slug": "moliendo-finest-coffee-guatemala-antigua-shb-yoresel-kahve-c-b08xzrg436",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190854322",
    "name": "Moliendo Finest Coffee Guatemala Antigua SHB Yöresel Kahve (Çekirdek) 1000 g",
    "size": "1000 g",
    "packaging": "Folyo ambalaj",
    "price": 1274.0,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Guatemala Antigua SHB Çekirdek 1000 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Çekirdek kahve (single origin). Menşe: Guatemala (Antigua SHB). İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZRG436) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve (single origin)"
      },
      {
        "key": "Menşe",
        "value": "Guatemala (Antigua SHB)"
      },
      {
        "key": "Net Miktar",
        "value": "1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notaları",
        "value": "Tatlı Çikolata"
      },
      {
        "key": "Asidite",
        "value": "Orta"
      },
      {
        "key": "Gövde",
        "value": "Tam"
      },
      {
        "key": "İçim Sertlik",
        "value": "Dengeli"
      },
      {
        "key": "Kilitli Poşet",
        "value": "Açmak için kenarından çekiniz, tekrar kapatmak için bastırınız"
      },
      {
        "key": "EAN-13",
        "value": "8682190854322"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZRG436"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Besin tablosu yok. Barkod etiket üzerinde 8682190854322 (grup metaverisiyle eşleşiyor)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZRLRSM",
    "slug": "moliendo-finest-coffee-colombia-medellin-supremo-yoresel-kah-b08xzrlrsm",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190854476",
    "name": "Moliendo Finest Coffee Colombia Medellin Supremo Yöresel Kahve (Çekirdek) 1000 g",
    "size": "1000 g",
    "packaging": "Folyo ambalaj",
    "price": 1543.75,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Colombia Medellin Supremo Çekirdek 1000 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Çekirdek kahve (single origin). Menşe: Kolombiya (Medellin Supremo). İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZRLRSM) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve (single origin)"
      },
      {
        "key": "Menşe",
        "value": "Kolombiya (Medellin Supremo)"
      },
      {
        "key": "Net Miktar",
        "value": "1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notaları",
        "value": "Tatlı Çikolata, Fındık"
      },
      {
        "key": "Asidite",
        "value": "Düşük"
      },
      {
        "key": "Gövde",
        "value": "Orta"
      },
      {
        "key": "İçim Sertlik",
        "value": "Dengeli"
      },
      {
        "key": "Kilitli Poşet",
        "value": "Açmak için kenarından çekiniz, tekrar kapatmak için bastırınız"
      },
      {
        "key": "EAN-13",
        "value": "8682190854476"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZRLRSM"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Besin tablosu yok. Barkod etiket üzerinde 8682190854476 (grup metaverisiyle eşleşiyor)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZRTKYX",
    "slug": "moliendo-finest-coffee-kenya-aa-muranga-yoresel-kahve-cekird-b08xzrtkyx",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190852212",
    "name": "Moliendo Finest Coffee Kenya Aa Muranga Yöresel Kahve (Çekirdek) 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 322.5,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Kenya AA Muranga Çekirdek 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Çekirdek kahve (single origin). Menşe: Kenya (AA Muranga). İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZRTKYX) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve (single origin)"
      },
      {
        "key": "Menşe",
        "value": "Kenya (AA Muranga)"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notaları",
        "value": "Şekerleme, Limon, Badem"
      },
      {
        "key": "Asidite",
        "value": "Orta"
      },
      {
        "key": "Gövde",
        "value": "Orta"
      },
      {
        "key": "İçim Sertlik",
        "value": "Dengeli"
      },
      {
        "key": "Kilitli Poşet",
        "value": "Açmak için kenardan çekiniz, tekrar kapatmak için bastırınız"
      },
      {
        "key": "EAN-13",
        "value": "8682190852212"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZRTKYX"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Besin tablosu yok. Barkod etiket üzerinde 8682190852212 (grup metaverisiyle eşleşiyor)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZRV7TX",
    "slug": "moliendo-finest-coffee-blonde-blend-cekirdek-1000-gr-b08xzrv7tx",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190854612",
    "name": "Moliendo Finest Coffee Blonde Blend (Çekirdek) 1000 gr",
    "size": "1000 g",
    "packaging": "Folyo ambalaj",
    "price": 1543.75,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Blonde Blend Çekirdek 1000 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Çekirdek kahve (blonde roast blend). İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZRV7TX) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve (blonde roast blend)"
      },
      {
        "key": "Net Miktar",
        "value": "1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notaları",
        "value": "Çikolata, Fındık"
      },
      {
        "key": "Asidite",
        "value": "Orta"
      },
      {
        "key": "Gövde",
        "value": "Orta"
      },
      {
        "key": "İçim Sertlik",
        "value": "Dengeli"
      },
      {
        "key": "Kilitli Poşet",
        "value": "Açmak için kenarından çekiniz, tekrar kapatmak için bastırınız"
      },
      {
        "key": "EAN-13",
        "value": "8682190854612"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZRV7TX"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ön yüzde Seçkin Yöresel Çekirdek Tadı sloganı var. Besin tablosu yok. Barkod etiket üzerinde 8682190854612 (grup metaverisiyle eşleşiyor)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZRX5WW",
    "slug": "moliendo-finest-coffee-house-blend-filtre-kahve-cekirdek-100-b08xzrx5ww",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190854575",
    "name": "Moliendo Finest Coffee House Blend Filtre Kahve (Çekirdek) 1000 g",
    "size": "1000 g",
    "packaging": "Folyo ambalaj",
    "price": 1297.0,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "House Blend Filtre Çekirdek 1000 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Filtre kahve çekirdeği. Harman: House Blend. İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZRX5WW) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Filtre kahve çekirdeği"
      },
      {
        "key": "Harman",
        "value": "House Blend"
      },
      {
        "key": "Net Miktar",
        "value": "1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notları",
        "value": "Çikolata, Vanilya, Elma, Marmelat"
      },
      {
        "key": "Asidite",
        "value": "Düşük"
      },
      {
        "key": "Gövde",
        "value": "Tam"
      },
      {
        "key": "İçim Sertliği",
        "value": "Dengeli"
      },
      {
        "key": "Etiket Barkodu",
        "value": "8682190854575"
      },
      {
        "key": "EAN-13",
        "value": "8682190854575"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZRX5WW"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeride okunabilir arka/yan panel yok; torba yan yüzünde 3 paragraflık mikro metin bloğu mevcut ama çözünürlük yetersiz (üretici/adres/saklama/kullanım okunamadı). Ürün tanım bandı: 'Roasted Coffee Beans / Kavrulmuş Kahve Çekirdeği' — içindekiler bu banttan alındı, formal İçindekiler listesi görünmüyor. Etiket barkodu 8 682190 854575 = metadata EAN-13 8682190854575 (checksum geçerli). Ön yüz dikey baskı '1000 g e / 35 oz'; zip bandı 'Açmak için kenardan çekiniz / PRESS TO RESEAL'. İlk torba okuması tadım notlarını 'Çikolata, Vanilya, Fındık, Karanfil' okudu; etiket yakın planı ve profil kartı 'Çikolata, Vanilya, Elma, Marmelat' diyor (3 okumadan 2'si)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZS2B5V",
    "slug": "moliendo-finest-coffee-amalfi-espresso-blend-kahve-cekirdek--b08xzs2b5v",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ]
    ],
    "barcode": "8682190852670",
    "name": "Moliendo Finest Coffee Amalfi Espresso Blend Kahve (Çekirdek) 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 319.25,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Amalfi Espresso Çekirdek 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Espresso çekirdek kahve. Harman: Amalfi Espresso Blend. İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZS2B5V) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Espresso çekirdek kahve"
      },
      {
        "key": "Harman",
        "value": "Amalfi Espresso Blend"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notları",
        "value": "Fındık, Odunsu, Topraksı"
      },
      {
        "key": "Asidite",
        "value": "Düşük"
      },
      {
        "key": "Gövde",
        "value": "Orta"
      },
      {
        "key": "İçim Sertliği",
        "value": "Hafif"
      },
      {
        "key": "Etiket Barkodu",
        "value": "8682190852670"
      },
      {
        "key": "EAN-13",
        "value": "8682190852670"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZS2B5V"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeride arka panel yok; yan yüz mikro metni okunamıyor (üretici/saklama/kullanım bilgisine ulaşılamadı). Ürün tanım bandı: 'Roasted Coffee Beans / Kavrulmuş Kahve Çekirdeği'. Etiket barkodu 8 682190 852670 = metadata EAN-13 8682190852670 (checksum geçerli). Ön yüz/yan ağırlık baskısı '250 g e / 8,75 oz'. Galeri tanıtım görseli de içeriyor ('Haftalık kavrulur, siparişe özel paketlenir'). İlk torba okuması tadım notlarını 'Zencefil, Çikolata & Fındıklar' okudu; etiket yakın planı ve profil kartı 'Fındık, Odunsu, Topraksı' diyor (3 okumadan 2'si)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZS2LB5",
    "slug": "moliendo-finest-coffee-positano-espresso-blend-kahve-cekirde-b08xzs2lb5",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190852137",
    "name": "Moliendo Finest Coffee Positano Espresso Blend Kahve (Çekirdek) 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 417.0,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Positano Espresso Çekirdek 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Espresso çekirdek kahve. Harman: Positano Espresso Blend. İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZS2LB5) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": "Serin ve kuru yerde saklayınız",
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Espresso çekirdek kahve"
      },
      {
        "key": "Harman",
        "value": "Positano Espresso Blend"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notları",
        "value": "Odunsu, Bitkisel, Tütün, Karamel"
      },
      {
        "key": "Asidite",
        "value": "Orta"
      },
      {
        "key": "Gövde",
        "value": "Orta"
      },
      {
        "key": "İçim Sertliği",
        "value": "Dengeli"
      },
      {
        "key": "Etiket Barkodu",
        "value": "8682190852137"
      },
      {
        "key": "EAN-13",
        "value": "8682190852137"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZS2LB5"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeri torba fotoğrafının alt sol bloğunda üretici/adres mikro metni var ama okunamıyor; yalnızca bloğun sonundaki 'TÜRKİYE' kelimesi ve 'Serin ve kuru yerde saklayınız' satırı seçilebildi. Ürün tanım bandı: 'Roasted Coffee Beans / Kavrulmuş Kahve Çekirdeği'. Etiket barkodu 8 682190 852137 = metadata EAN-13 8682190852137 (checksum geçerli). Ağırlık: ön yüz etiket yanında dikey '250 g' ve torba yanında 'NET 250 G / 8,75 oz'. İlk torba okuması tadım notlarını 'Çikolata, Bisküvi, Tatlı, Fındık' okudu; etiket yakın planı ve profil kartı net biçimde 'Odunsu, Bitkisel, Tütün, Karamel' diyor (3 okumadan 2'si)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08XZSQNSF",
    "slug": "moliendo-finest-coffee-ravello-espresso-blend-kahve-cekirdek-b08xzsqnsf",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190854124",
    "name": "Moliendo Finest Coffee Ravello Espresso Blend Kahve (Çekirdek) 1000 g",
    "size": "1000 g",
    "packaging": "Folyo ambalaj",
    "price": 1229.0,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Ravello Espresso Çekirdek 1000 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Espresso çekirdek kahve. Kavurma: Orta (Medium Roast rozeti). Harman: Ravello Espresso Blend. İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08XZSQNSF) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Espresso çekirdek kahve"
      },
      {
        "key": "Kavurma",
        "value": "Orta (Medium Roast rozeti)"
      },
      {
        "key": "Harman",
        "value": "Ravello Espresso Blend"
      },
      {
        "key": "Net Miktar",
        "value": "1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notları",
        "value": "Kakao, Kahverengi Şeker"
      },
      {
        "key": "Asidite",
        "value": "Orta"
      },
      {
        "key": "Gövde",
        "value": "Tam"
      },
      {
        "key": "İçim Sertliği",
        "value": "Güçlü"
      },
      {
        "key": "Etiket Barkodu",
        "value": "8682190854124"
      },
      {
        "key": "EAN-13",
        "value": "8682190854124"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08XZSQNSF"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeride arka panel yok; yan yüz mikro metni okunamıyor, yalnızca 'www.moliendo.com' kısmen seçiliyor. Ürün tanım bandı: 'Roasted Coffee Beans / Kavrulmuş Kahve Çekirdeği'; etiket üzerinde 'Özel Harman Kahve Çekirdekleri' ibaresi ve 100% / MEDIUM ROAST / 1000 G rozet sırası okundu (rozet metinleri ilk okumada; ikinci yakın plan okuma yalnız tat profili rozetlerini doğruladı). Etiket barkodu 8 682190 854124 = metadata EAN-13 8682190854124 (checksum geçerli). Ağırlık: ön yüz dikey baskı '1000 g e / 35 oz'."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B08Y9LMZR1",
    "slug": "kahve-dunyas-cok-kavrulmus-turk-kahvesi-100-g-b08y9lmzr1",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ]
    ],
    "barcode": "8697447040748",
    "name": "Kahve Dünyası Çok Kavrulmuş Türk Kahvesi 100 g",
    "size": "100 g",
    "packaging": "Folyo ambalaj",
    "price": 110.0,
    "brand": {
      "id": 3716,
      "name": "Kahve Dünyası"
    },
    "manufacturer": "Gıda İşletmecisi: Altınkılıçlar Kahve Kakao Ürünleri Tic. ve San. A.Ş., Ömer Avni Mah. Meclisi Mebusan Cad. İnönü Sok. Ekemen Han No: 1 Kat: 4 Kabataş, Beyoğlu, İstanbul — Üretici: Detay Kahve San. ve Tic. A.Ş., Osmangazi Mah. 2585. Sok. No: 6 Esenyurt, İstanbul, Türkiye",
    "description": "Çok Kavrulmuş Türk Kahvesi 100 g — Kahve Dünyası ürünü.\n\nÜrün Tipi: Öğütülmüş Türk kahvesi. Kavurma: Çok kavrulmuş. Üretim yeri: Brezilya'dan ithal edilen kahve çekirdekleri kullanılarak Türkiye'de üretilmiştir. İçindekiler: Öğütülmüş Türk kahvesi (Coffea Arabica, yeni mahsul çiğ çekirdek kahveden mamul).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B08Y9LMZR1) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Öğütülmüş Türk kahvesi (Coffea Arabica, yeni mahsul çiğ çekirdek kahveden mamul)"
      }
    ],
    "labels": [],
    "storage": "Kahvenin tadı ve kokusuyla tazeliğini daha uzun süre koruyabilmek için içeriği bir kavanoza boşaltın veya ambalajı açtıktan sonra sıkıca kapatarak serin ve kuru yerde saklayın.",
    "usage": "Cezveye her fincan için 1 fincan (7,5 cl) soğuk içme suyu konur. Her fincan için 2 çay kaşığı Kahve Dünyası Türk Kahvesi ve istenilen kadar şeker eklenip karıştırılır. Cezve kısık ateşte üzerinde köpük oluşuncaya kadar yavaşça karıştırılarak kaynama derecesine getirilir. Kaynamaya başlayınca kahve köpüğü fincanlara eşit miktarda pay edilir. Cezvede kalan kahve bir taşım daha kaynatıldıktan sonra fincanlara paylaştırılır.",
    "specifications": [
      {
        "key": "Marka",
        "value": "Kahve Dünyası"
      },
      {
        "key": "Ürün Tipi",
        "value": "Öğütülmüş Türk kahvesi"
      },
      {
        "key": "Kavurma",
        "value": "Çok kavrulmuş"
      },
      {
        "key": "Net Miktar",
        "value": "100 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Üretici",
        "value": "Gıda İşletmecisi: Altınkılıçlar Kahve Kakao Ürünleri Tic. ve San. A.Ş., Ömer Avni Mah. Meclisi Mebusan Cad. İnönü Sok. Ekemen Han No: 1 Kat: 4 Kabataş, Beyoğlu, İstanbul — Üretici: Detay Kahve San. ve Tic. A.Ş., Osmangazi Mah. 2585. Sok. No: 6 Esenyurt, İstanbul, Türkiye"
      },
      {
        "key": "Üretim Yeri",
        "value": "Brezilya'dan ithal edilen kahve çekirdekleri kullanılarak Türkiye'de üretilmiştir"
      },
      {
        "key": "Öğütme Derecesi",
        "value": "İnce çekilmiş"
      },
      {
        "key": "Çekirdek Türü",
        "value": "Coffea Arabica (%100 Arabica Rio Minas)"
      },
      {
        "key": "Menşe Ülke",
        "value": "Brezilya (çekirdek)"
      },
      {
        "key": "İşletme Kayıt No",
        "value": "TR-34-K-011982"
      },
      {
        "key": "Uygunluk",
        "value": "Türk Gıda Kodeksi Kahve ve Kahve Ekstraktları Tebliği'ne uygundur"
      },
      {
        "key": "EAN-13",
        "value": "8697447040748"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B08Y9LMZR1"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Besin tablosu 01 no.lu tam boy fotoğraftan iki kez okundu (1588 kJ/380 kcal, yağ 16,6; doymuş 7,2; karb 18,9; şeker 1,6; lif 50,5; protein 13,4; tuz 0 g) — aritmetik çapraz kontrol: 4×18,9+4×13,4+9×16,6+2×50,5 = 379,6 ≈ 380 kcal, okuma tutarlı. İlk yaprak okuması yağı 16,8 / şekeri 1,8 / lifi 50,8 okumuştu; tam boy okuma iki kez 16,6/1,6/50,5 verdiği için o değerler alındı. Barkod rakamları hiçbir fotoğrafta okunabilir değil (metadata EAN 8697447040748). İki farklı üretici adresi okuması sokak numarası farkı verdi (2585 vs 2685, Kat: 4 vs Kat: 2); ilk tam boy okuma 2 kez tekrarlandığı için 2585/Kat: 4 alındı — tam emin olunamaz. Paket 4 dilli (TR/EN/RO/AR). Ön yüzde 'GMO' / 'ARABICA' kutucukları var; GMO kutucuğu muhtemelen 'GMO içermez' türü bir rozet ama metin okunamadığı için labels'a eklenmedi."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": {
      "per": "100g",
      "items": [
        {
          "nutrient": 1,
          "amount": 1588.0,
          "unit": "kJ"
        },
        {
          "nutrient": 2,
          "amount": 380.0,
          "unit": "kcal"
        },
        {
          "nutrient": 4,
          "amount": 16.6,
          "unit": "g"
        },
        {
          "nutrient": 5,
          "amount": 7.2,
          "unit": "g"
        },
        {
          "nutrient": 7,
          "amount": 18.9,
          "unit": "g"
        },
        {
          "nutrient": 8,
          "amount": 1.6,
          "unit": "g"
        },
        {
          "nutrient": 18,
          "amount": 50.5,
          "unit": "g"
        },
        {
          "nutrient": 19,
          "amount": 13.4,
          "unit": "g"
        },
        {
          "nutrient": 20,
          "amount": 0.0,
          "unit": "g"
        }
      ]
    }
  },
  {
    "asin": "B094DW6NNN",
    "slug": "julius-meinl-espresso-crema-kapsul-kahve-100-adet-biodegrada-b094dw6nnn",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "04.jpg"
      ]
    ],
    "barcode": "9000404940293",
    "name": "Julius Meinl Espresso Crema Kapsül Kahve 100 Adet Biodegradable",
    "size": "100 × 5,3 g (530 g)",
    "packaging": "Alüminyum kapsül",
    "price": 2086.51,
    "brand": {
      "id": 5587,
      "name": "Julius Meinl"
    },
    "manufacturer": null,
    "description": "Espresso Crema Kapsül Kahve 100'lü — Julius Meinl ürünü.\n\nÜrün Tipi: Espresso kapsül kahve. Üretim yeri: İtalya'da üretilmiştir (Made in Italy).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B094DW6NNN) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [
      "recyclable"
    ],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Julius Meinl"
      },
      {
        "key": "Ürün Tipi",
        "value": "Espresso kapsül kahve"
      },
      {
        "key": "Net Miktar",
        "value": "100 × 5,3 g (530 g)"
      },
      {
        "key": "Ambalaj",
        "value": "Alüminyum kapsül"
      },
      {
        "key": "Üretim Yeri",
        "value": "İtalya'da üretilmiştir (Made in Italy)"
      },
      {
        "key": "Ürün Adı",
        "value": "Espresso Crema"
      },
      {
        "key": "Yoğunluk",
        "value": "8"
      },
      {
        "key": "Uyumluluk",
        "value": "Nespresso® uyumlu"
      },
      {
        "key": "Kapsül Sayısı",
        "value": "100 (10 adet × 10'lu kutu)"
      },
      {
        "key": "Kapsül Başına Kahve",
        "value": "5,5 g"
      },
      {
        "key": "EAN-13",
        "value": "9000404940293"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B094DW6NNN"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Amazon başlığı 100'lü multipack; galerideki kutular 10 kapsüllük perakende kutuları ve 100 kapsüllük sever paket. Yan panel okuması: NET WT. 1.94 OZ (55 g) / EACH CAPSULE CONTAINS 5.5g OF COFFEE / 10 CAPSULES / MADE IN ITALY / 100% RECYCLABLE CARTON — bu 10'lu kutu için; 100'lü sever için gramaj yan panelde okunamadı, 10 × 55 g = 550 g olduğu varsayımı YAPILMADI (size alanına kutu içeriği yazılmadı, kapsül sayısı ve kapsül başı gram verildi). Barkod rakamları okunamıyor (metadata EAN 9000404940293). İçindekiler, saklama, üretici firma bilgisi ve besin tablosu galeride okunabilir değil — kutu yan yüzleri perspektif nedeniyle okunamıyor. Not: 10'lu kutunun bazı baskılarında '100% ARABICA' ibaresi görünüyordu (05 no.lu stok fotoğraf), ana galeri görsellerinde bu ibare yok — doğrulanamadığı için specs'e eklenmedi. Rozet farklı baskılarda '100% HOME COMPOSTABLE' ve '100% BIODEGRADABLE' olarak değişiyor (Back to Nature serisi)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B09WNH4YLD",
    "slug": "nescafe-forte-filtre-kahve-500-g-b09wnh4yld",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ]
    ],
    "barcode": "7613039576458",
    "name": "NESCAFÉ Forte Filtre kahve 500 g",
    "size": "500 g",
    "packaging": "Folyo ambalaj",
    "price": 451.02,
    "brand": {
      "id": 139,
      "name": "Nescafe"
    },
    "manufacturer": null,
    "description": "Forte Filtre Kahve 500 g — Nescafe ürünü.\n\nÜrün Tipi: Öğütülmüş filtre kahve (ground coffee blend). Kavurma: 5/5 (çok koyu).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B09WNH4YLD) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Nescafe"
      },
      {
        "key": "Ürün Tipi",
        "value": "Öğütülmüş filtre kahve (ground coffee blend)"
      },
      {
        "key": "Kavurma",
        "value": "5/5 (çok koyu)"
      },
      {
        "key": "Net Miktar",
        "value": "500 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Marka Hattı",
        "value": "NESCAFÉ Professional"
      },
      {
        "key": "Tat Yoğunluğu",
        "value": "5/5"
      },
      {
        "key": "Gövde",
        "value": "5/5"
      },
      {
        "key": "Tat Notları",
        "value": "Fındıksı ve odunsu (Nutty and Woody)"
      },
      {
        "key": "Türkiye İletişim",
        "value": "0800 211 02 18, 444 3 160 — www.nestleprofessional.com.tr"
      },
      {
        "key": "EAN-13",
        "value": "7613039576458"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B09WNH4YLD"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeri çok dilli Avrupa baskısı paketi gösteriyor (EN/DE/FR vb.); Türkçe yalnızca 'Bize Danışın' iletişim bloğu. İçindekiler, saklama, besin tablosu, üretici adresi ve barkod rakamları fotoğraflanmış yüzlerde yok. Kavurma/yoğunluk/gövde 5/5 ve 'Nutty and Woody' notu ön yüzden. Barkod rakamları okunamıyor (metadata EAN 7613039576458)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0B6L36MPL",
    "slug": "kahve-dunyas-fndk-aromal-filtre-kahve-cekirdek-1-kg-b0b6l36mpl",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ]
    ],
    "barcode": "8697447040106",
    "name": "Kahve Dünyası Fındık Aromalı Filtre Kahve Çekirdek 1 kg",
    "size": "1000 g",
    "packaging": "Folyo ambalaj",
    "price": 809.9,
    "brand": {
      "id": 3716,
      "name": "Kahve Dünyası"
    },
    "manufacturer": null,
    "description": "Fındık Aromalı Filtre Kahve Çekirdek 1 kg — Kahve Dünyası ürünü.\n\nÜrün Tipi: Fındık aromalı filtre kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0B6L36MPL) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Kahve Dünyası"
      },
      {
        "key": "Ürün Tipi",
        "value": "Fındık aromalı filtre kahve çekirdeği"
      },
      {
        "key": "Net Miktar",
        "value": "1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "EAN-13",
        "value": "8697447040106"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0B6L36MPL"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış. Boyut 1 kg Amazon başlığından; ön yüzde baskılı gramaj doğrulanamadı. Aromalı ürün olduğu için içindekiler listesi (aroma bileşenleri) özellikle önemli ama okunamadı — etiket fotoğrafı gelmeden Payload'a 'Kavrulmuş kahve çekirdeği + aroma' gibi varsayımsal içindekiler yazılmamalı."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0B7XL1MFY",
    "slug": "moliendo-finest-coffee-house-blend-filtre-kahve-ogutulmus-fi-b0b7xl1mfy",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190850287",
    "name": "Moliendo Finest Coffee House Blend Filtre Kahve (Öğütülmüş Filtre Kahve) 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 319.25,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "House Blend Öğütülmüş 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Öğütülmüş filtre kahve. Harman: House Blend.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0B7XL1MFY) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Öğütülmüş filtre kahve"
      },
      {
        "key": "Harman",
        "value": "House Blend"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "EAN-13",
        "value": "8682190850287"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0B7XL1MFY"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış. Boyut 250 g Amazon başlığından; ön yüzde baskılı gramaj doğrulanamadı. Aynı markanın çekirdek versiyonunun (B08XZRX5WW) etiket tasarımıyla aynı seri olduğu görülüyor ama bu ASIN'in kendi etiketi incelenmedi."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0B7XL8BCM",
    "slug": "moliendo-finest-coffee-colombia-supremo-decaf-kafeinsiz-yore-b0b7xl8bcm",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190850447",
    "name": "Moliendo Finest Coffee Colombia Supremo Decaf (Kafeinsiz) Yöresel Kahve (Öğütülmüş Filtre Kahve) 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 481.25,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Colombia Supremo Decaf Öğütülmüş 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Kafeinsiz öğütülmüş kahve. Harman: Colombia Supremo Decaf.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0B7XL8BCM) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Kafeinsiz öğütülmüş kahve"
      },
      {
        "key": "Harman",
        "value": "Colombia Supremo Decaf"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "EAN-13",
        "value": "8682190850447"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0B7XL8BCM"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış. Boyut 250 g Amazon başlığından; ön yüzde baskılı gramaj doğrulanamadı. Decaf ürünü — kafeinsizleştirme yöntemi (özellikle metilen klorür vs. su/CO2) etiket incelenmeden yazılmamalı."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0B7XLFQTP",
    "slug": "moliendo-finest-coffee-colombia-medellin-supremo-yoresel-kah-b0b7xlfqtp",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190850430",
    "name": "Moliendo Finest Coffee Colombia Medellin Supremo Yöresel Kahve (Öğütülmüş Filtre Kahve) 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 351.75,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Colombia Medellin Supremo Öğütülmüş 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Öğütülmüş kahve. Harman: Colombia Medellin Supremo.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0B7XLFQTP) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Öğütülmüş kahve"
      },
      {
        "key": "Harman",
        "value": "Colombia Medellin Supremo"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "EAN-13",
        "value": "8682190850430"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0B7XLFQTP"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış. Boyut 250 g Amazon başlığından; ön yüzde baskılı gramaj doğrulanamadı."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0B7XLYR79",
    "slug": "moliendo-finest-coffee-brasil-bossa-nova-yoresel-kahve-ogutu-b0b7xlyr79",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190850461",
    "name": "Moliendo Finest Coffee Brasil Bossa Nova Yöresel Kahve (Öğütülmüş Filtre Kahve) 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 319.25,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Brasil Bossa Nova Öğütülmüş 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Öğütülmüş filtre kahve. Menşe: Brezilya. Üretim yeri: Brezilya. İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0B7XLYR79) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Öğütülmüş filtre kahve"
      },
      {
        "key": "Menşe",
        "value": "Brezilya"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Üretim Yeri",
        "value": "Brezilya"
      },
      {
        "key": "Tadım Notaları",
        "value": "Çekirdekli koyu meyveler, bitter çikolata, ceviz"
      },
      {
        "key": "Asidite",
        "value": "Düşük"
      },
      {
        "key": "Gövde",
        "value": "Orta"
      },
      {
        "key": "İçim Sertliği",
        "value": "Hafif"
      },
      {
        "key": "EAN-13",
        "value": "8682190850461"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0B7XLYR79"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeri ön yüz/etiket grafiklerinden oluşuyor; arka yüz fotoğrafı yok. İçindekiler listesi, besin tablosu, üretici adresi, saklama koşulları ve sertifikalar ambalaj üzerinde okunamıyor. 00.jpg üzerinde barkod 8682190694401 olarak da okunuyor (8682190850461 ile çelişiyor; 01.jpg ve metaveri 8682190850461 diyor). Menşe 'Brasil' yazısından; net ağırlık 250 g e / 8,75 OZ."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0B7XMHQ96",
    "slug": "moliendo-finest-coffee-breakfast-blend-filtre-kahve-ogutulmu-b0b7xmhq96",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190850270",
    "name": "Moliendo Finest Coffee Breakfast Blend Filtre Kahve (Öğütülmüş Filtre Kahve) 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 351.75,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Breakfast Blend Öğütülmüş 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Öğütülmüş filtre kahve. İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0B7XMHQ96) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Öğütülmüş filtre kahve"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notaları",
        "value": "Tütün, kakao, fındık"
      },
      {
        "key": "Asidite",
        "value": "Orta"
      },
      {
        "key": "Gövde",
        "value": "Tam"
      },
      {
        "key": "İçim Sertliği",
        "value": "Güçlü"
      },
      {
        "key": "EAN-13",
        "value": "8682190850270"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0B7XMHQ96"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeri ön yüz/etiket grafiklerinden oluşuyor; arka yüz fotoğrafı yok. İçindekiler, besin tablosu, üretici adresi, menşe ve saklama koşulları okunamıyor. 00.jpg barkodu 8582190650270, 01.jpg 8682190850270 okuyor (metaveri 8682190850270). Net ağırlık 250 g e / 8,75 OZ (00.jpg); kontakt sayfasında 200 g geçmesi olası okuma hatası."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0B7XPM81Y",
    "slug": "moliendo-finest-coffee-house-blend-filtre-kahve-ogutulmus-fi-b0b7xpm81y",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8682190855046",
    "name": "Moliendo Finest Coffee House Blend Filtre Kahve (Öğütülmüş Filtre Kahve) 1000 g",
    "size": "1000 g",
    "packaging": "Folyo ambalaj",
    "price": 1174.0,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "House Blend Öğütülmüş 1000 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Öğütülmüş filtre kahve. İçindekiler: Kavrulmuş kahve çekirdeği.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0B7XPM81Y) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Öğütülmüş filtre kahve"
      },
      {
        "key": "Net Miktar",
        "value": "1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Tadım Notaları",
        "value": "Çikolata, vanilya, elma, marmelat"
      },
      {
        "key": "Asidite",
        "value": "Düşük"
      },
      {
        "key": "Gövde",
        "value": "Tam"
      },
      {
        "key": "İçim Sertliği",
        "value": "Dengeli"
      },
      {
        "key": "EAN-13",
        "value": "8682190855046"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0B7XPM81Y"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeri ön yüz/etiket grafiklerinden oluşuyor; arka yüz fotoğrafı yok. İçindekiler listesi, besin tablosu, üretici adresi, menşe ve saklama koşulları okunamıyor (yan panel fotoğrafta flu). Net ağırlık 1000 g e / 35 OZ; barkod 8682190855046."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0B88G3SKD",
    "slug": "anisah-coffee-bolivar-espresso-cekirdek-kahve-1000gr-b0b88g3skd",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ]
    ],
    "barcode": "8682005321063",
    "name": "Anisah Coffee Bolivar Espresso Çekirdek Kahve 1000gr",
    "size": "1000 g",
    "packaging": "Folyo ambalaj",
    "price": 700.0,
    "brand": {
      "id": 2227,
      "name": "Anisah Kahve"
    },
    "manufacturer": "ANISAH GIDA SAN. VE TİC. LTD. ŞTİ. (TR-34-K-173639)",
    "description": "BOLIVAR ESPRESSO ÇEKİRDEK 1000 g — Anisah Kahve ürünü.\n\nÜrün Tipi: Espresso çekirdek kahve. Kavurma: Koyu (roast profili 5/5). Üretim yeri: İthal edilen kahve çekirdekleri kullanılarak Türkiye'de üretilmiştir. İçindekiler: Kavrulmuş kahve çekirdekleri (%60 Arabica, %40 Robusta).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0B88G3SKD) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4058,
        "name": "Kavrulmuş kahve çekirdekleri (%60 Arabica, %40 Robusta)"
      }
    ],
    "labels": [
      "halal-certified",
      "gluten-free",
      "vegan",
      "recyclable"
    ],
    "storage": "Serin ve kuru yerde saklayınız. Tüketim tarihi ve parti numarası ambalaj üzerindedir.",
    "usage": "Espresso hazırlama önerisi: 7 g (tek) / 14 g (çift) doz, 9 bar, 92 °C ±2 °C, 25-30 saniye",
    "specifications": [
      {
        "key": "Marka",
        "value": "Anisah Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Espresso çekirdek kahve"
      },
      {
        "key": "Kavurma",
        "value": "Koyu (roast profili 5/5)"
      },
      {
        "key": "Net Miktar",
        "value": "1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Üretici",
        "value": "ANISAH GIDA SAN. VE TİC. LTD. ŞTİ. (TR-34-K-173639)"
      },
      {
        "key": "Üretim Yeri",
        "value": "İthal edilen kahve çekirdekleri kullanılarak Türkiye'de üretilmiştir"
      },
      {
        "key": "Asidite",
        "value": "2/5"
      },
      {
        "key": "Gövde",
        "value": "4/5"
      },
      {
        "key": "Karışım",
        "value": "%60 Arabica, %40 Robusta"
      },
      {
        "key": "Tadım Notaları",
        "value": "Bitter çikolata, kavrulmuş fındık, hafif meyvemsi, topraksı"
      },
      {
        "key": "İşletme Kayıt No",
        "value": "TR-34-K-173639"
      },
      {
        "key": "EAN-13",
        "value": "8682005321063"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0B88G3SKD"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Besin tablosu 100 g ve 1×14 g porsiyon sütunlarıyla basılı; aritmetik tutarlı (4*26,7+4*15,3+9*13,8+2*38,8 ≈ 364 kcal ≈ 369 basılı). Kontakt sayfası 36,6 g yağ / 43,6 g karb / 15,1 g protein okudu, ham görüntüden okunan 13,8 / 26,7 / 15,3 (kcal ile tutarlı olan) esas alındı; kontakt sayfası okuması hatalı. Üretici tam sokak adresi fotoğrafta okunamadı (yalnız şirket adı, TR-34-K-173639, anisacoffee.com net). Önceki okumada TR-34-K-176639 görüldüyse de zoomlu doğrulamada 173639 net okundu. Sertifikalar (Helal, Glutensiz, Vegan, geri dönüşüm) ön yüz ikonlarından."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": {
      "per": "100g",
      "items": [
        {
          "nutrient": 1,
          "amount": 1546.0,
          "unit": "kJ"
        },
        {
          "nutrient": 2,
          "amount": 369.0,
          "unit": "kcal"
        },
        {
          "nutrient": 4,
          "amount": 13.8,
          "unit": "g"
        },
        {
          "nutrient": 5,
          "amount": 6.94,
          "unit": "g"
        },
        {
          "nutrient": 7,
          "amount": 26.7,
          "unit": "g"
        },
        {
          "nutrient": 8,
          "amount": 1.3,
          "unit": "g"
        },
        {
          "nutrient": 18,
          "amount": 38.8,
          "unit": "g"
        },
        {
          "nutrient": 19,
          "amount": 15.3,
          "unit": "g"
        },
        {
          "nutrient": 20,
          "amount": 0.0,
          "unit": "g"
        }
      ]
    }
  },
  {
    "asin": "B0BL89269N",
    "slug": "kahve-dunyas-kolombiya-kavrulmus-cekirdek-kahve-1-kg-b0bl89269n",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ]
    ],
    "barcode": "8697447040632",
    "name": "Kahve Dünyası Kolombiya Kavrulmuş Çekirdek Kahve 1 kg",
    "size": "1000 g",
    "packaging": "Folyo ambalaj",
    "price": 839.9,
    "brand": {
      "id": 3716,
      "name": "Kahve Dünyası"
    },
    "manufacturer": null,
    "description": "Kolombiya Kavrulmuş Çekirdek 1 kg — Kahve Dünyası ürünü.\n\nÜrün Tipi: Kavrulmuş çekirdek kahve. Menşe: Kolombiya. Üretim yeri: Kolombiya.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0BL89269N) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Kahve Dünyası"
      },
      {
        "key": "Ürün Tipi",
        "value": "Kavrulmuş çekirdek kahve"
      },
      {
        "key": "Menşe",
        "value": "Kolombiya"
      },
      {
        "key": "Net Miktar",
        "value": "1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Üretim Yeri",
        "value": "Kolombiya"
      },
      {
        "key": "Profil",
        "value": "Zengin aromalı, ağır kıvamlı, dengeli-yumuşak içimli"
      },
      {
        "key": "EAN-13",
        "value": "8697447040632"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0BL89269N"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeri yalnızca ön yüz fotoğrafları; barkod, net ağırlık baskısı, içindekiler, üretici adresi, besin tablosu, saklama ve demleme bilgileri ambalaj galerisinde görünmüyor. Net ağırlık 1 kg metaveri/ürün adından. Not: Kahve Dünyası'nın 'Yöresel' serisi farklı ürünlerde baharatlı Türk kahvesi içerir, ancak bu ASIN 'Kavrulmuş Çekirdek' adlı; baharatlı içindekiler listesi bu ambalajda okunamadı, tahmin edilmedi."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0BW3Q3RKZ",
    "slug": "nescafe-gold-100-cozunebilir-kahve-600-g-b0bw3q3rkz",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ]
    ],
    "barcode": "8690632763064",
    "name": "Nescafé Gold %100 Çözünebilir Kahve 600 g",
    "size": "600 g",
    "packaging": "Folyo ambalaj",
    "price": 1155.95,
    "brand": {
      "id": 139,
      "name": "Nescafe"
    },
    "manufacturer": "Nestlé PROFESSIONAL (TR) — www.nestleprofessional.com.tr, 0 800 211 02 18 / 444 3 160",
    "description": "Gold 600 g — Nescafe ürünü.\n\nÜrün Tipi: Suda çözünebilir granül kahve (instant).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0BW3Q3RKZ) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 1265,
        "name": "Çözünebilir kahve"
      }
    ],
    "labels": [],
    "storage": "Kuru ve serin yerde muhafaza ediniz.",
    "usage": "Bir tatlı kaşığı (2 g) kahve + 80 °C su = 200 ml fincan",
    "specifications": [
      {
        "key": "Marka",
        "value": "Nescafe"
      },
      {
        "key": "Ürün Tipi",
        "value": "Suda çözünebilir granül kahve (instant)"
      },
      {
        "key": "Net Miktar",
        "value": "600 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Üretici",
        "value": "Nestlé PROFESSIONAL (TR) — www.nestleprofessional.com.tr, 0 800 211 02 18 / 444 3 160"
      },
      {
        "key": "Yoğunluk",
        "value": "7/10"
      },
      {
        "key": "Tedarik",
        "value": "%100 sorumlu kaynaklardan tedarik edilen kahve (şirket beyanı)"
      },
      {
        "key": "EAN-13",
        "value": "8690632763064"
      },
      {
        "key": "Amazon Üretici Referansı",
        "value": "8690632021072 (ambalajda basılı barkod 8690632763064 esas alındı)"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0BW3Q3RKZ"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeride ön + arka yüz var; içindekiler listesi ve besin tablosu ambalajda okunamadı (muhtemelen yan/alt panelde, fotoğraflanmamış). Arka yüzden okunanlar: saklama, hazırlama (2 g / 80 °C / 200 ml), yoğunluk 7/10, Nestlé Professional iletişim, tüketim tarihi/parti no alanı. Barkod metaveri 8690632021072; arka yüz görselinde 8690632763064 okunuyor (farklı ambalaj baskısı olabilir)."
      },
      {
        "key": "İçindekiler Kaynağı",
        "value": "Ambalaj ön/arka yüz beyanı: %100 çözünebilir kahve"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0BYDC151W",
    "barcode": "8690632018904",
    "name": "NESCAFÉ 2'si 1 Arada Çözünebilir Kahve Karışımı 120 Adet (10 x 10 g) x 12",
    "slug": "nescaf-2-si-1-arada-cozunebilir-kahve-karisimi-120-adet-10-x-10-g-x-12",
    "size": "120 adet x 10 g (10 x 12 paket)",
    "packaging": "Poşet",
    "price": 1077,
    "description": "Amazon TR (B0BYDC151W) listesi ve ambalaj görselinden derlenmiştir.\n\nÜrün Açıklaması Türkiye’nin en sevilen kahvesi ve hazır karışım kahve kategorisinin ilk markası Nescafe 2'si 1 Arada ile güne güzel bir başlangıç yaparken, ders çalışırken ya da işlerine bir mola verdiğinde keyif yapabilirsin. Kahveseverlere kokusu, kıvamı ve tadıyla ilk yudumdan son y",
    "manufacturer": "Nestlé Türkiye Gıda Sanayi A.Ş.",
    "storage": null,
    "usage": null,
    "brand": {
      "id": 139,
      "name": "Nescafe"
    },
    "items": [
      {
        "id": 186,
        "name": "Şeker"
      },
      {
        "id": 1265,
        "name": "Çözünebilir kahve"
      }
    ],
    "specifications": [
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "ASIN",
        "value": "B0BYDC151W"
      },
      {
        "key": "Marka",
        "value": "Nescafe"
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "Üretici",
        "value": "Nestlé Türkiye Gıda Sanayi A.Ş."
      },
      {
        "key": "Etiket Notu",
        "value": "Barkod ambalajdan: 8690632018904. Çoklu paket (10 x 10'lu)."
      },
      {
        "key": "Fiyat (Amazon TR, 2026-11)",
        "value": "1077.9 TL"
      }
    ],
    "labels": [],
    "warnings": [],
    "allergens": [],
    "nutrition": null,
    "mediaFiles": [],
    "legacyMedia": true
  },
  {
    "asin": "B0C69XDVBS",
    "slug": "starbucks-house-blend-ogutulmus-kahve-200-g-b0c69xdvbs",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "04.jpg"
      ]
    ],
    "barcode": "8445290595867",
    "name": "Starbucks House Blend Öğütülmüş Kahve 200 g",
    "size": "200 g",
    "packaging": "Folyo ambalaj",
    "price": 544.9,
    "brand": {
      "id": 12,
      "name": "Starbucks"
    },
    "manufacturer": null,
    "description": "House Blend Öğütülmüş 200 g — Starbucks ürünü.\n\nÜrün Tipi: Öğütülmüş kahve. Kavurma: Orta (Medium Roast). İçindekiler: Kavrulmuş kahve çekirdeği (%100 Arabica).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0C69XDVBS) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği (%100 Arabica)"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": "10 g (2 yemek kaşığı) kahve + 180 ml (6 fl oz) su = 1 fincan; Coffee Press, Pour Over, Drip yöntemleri uygundur",
    "specifications": [
      {
        "key": "Marka",
        "value": "Starbucks"
      },
      {
        "key": "Ürün Tipi",
        "value": "Öğütülmüş kahve"
      },
      {
        "key": "Kavurma",
        "value": "Orta (Medium Roast)"
      },
      {
        "key": "Net Miktar",
        "value": "200 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Yoğunluk",
        "value": "8"
      },
      {
        "key": "Karışım",
        "value": "%100 Arabica"
      },
      {
        "key": "Tadım Notaları",
        "value": "Toffee (şekerleme) notalı, zengin ve dengeli"
      },
      {
        "key": "EAN-13",
        "value": "8445290595867"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0C69XDVBS"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Arka yüzde besin tablosu ve ayrık içindekiler listesi yok (ABD pazarı kökenli ambalaj). Üretici/ithalatçı adres bloğu fotoğraflarda okunamadı. Barkod 8445290595867. Ön yüz altında Guatemala, Sumatra, Kolombiya geçiyor (dekoratif). Arka yüz hikâye metni Latın Amerika çekirdekleri diye tanımlıyor."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0C6TLRHLF",
    "slug": "kahve-dunyas-ozel-seri-scak-vanilyal-aromal-caffe-latte-10-l-b0c6tlrhlf",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "04.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "07.jpg"
      ]
    ],
    "barcode": "8683302500465",
    "name": "Kahve Dünyası Özel Seri Sıcak Vanilyalı Aromalı Caffe Latte, 10'lu",
    "size": "10 × 20 g (200 g)",
    "packaging": "Karton kutu",
    "price": 119.9,
    "brand": {
      "id": 3716,
      "name": "Kahve Dünyası"
    },
    "manufacturer": "Gıda İşletmesi: Altınkılıçlı Kahve Kahve Ürünleri Tic. ve San. A.Ş., Ömer Avni Mah. Medis-i Mebusan Cad. İnönü Sok. Ekmen Han No: 3 Kat: 4 Kabataş, Beyoğlu, İstanbul; Üretici: D'elay Kahve San. ve Tic. A.Ş., Orhangazi Mah. 2655. Sok. No: 6 Esenyurt, İstanbul (İşletme Kayıt No: TR-34-K-01992)",
    "description": "Özel Seri Sıcak Vanilyalı Caffe Latte 10'lu — Kahve Dünyası ürünü.\n\nÜrün Tipi: Sütlü ve vanilya aromalı çözünebilir kahve karışımı. Üretim yeri: İthal kahve katkılarıyla Türkiye'de üretilmiştir. İçindekiler: Şeker, Kahve beyazlatıcısı (glikoz şurubu, rafine edilmiş tam hidrojenize hindistancevizi yağı, süt proteini, stabilizatör (dipotasyum fosfat), emülgatör (mono- ve digliseritlerin yağ asitleri)), Yağsız süt tozu, Kahve, Aroma vericiler (vanilya, krema), Sodyum karbonat, Tuz, Topaklanmayı önleyici (kalsiyum karbonat).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0C6TLRHLF) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 5,
        "name": "Şeker"
      },
      {
        "id": 4058,
        "name": "Kahve beyazlatıcısı (glikoz şurubu, rafine edilmiş tam hidrojenize hindistancevizi yağı, süt proteini, stabilizatör (dipotasyum fosfat), emülgatör (mono- ve digliseritlerin yağ asitleri))"
      },
      {
        "id": 229,
        "name": "Yağsız süt tozu"
      },
      {
        "id": 4058,
        "name": "Kahve"
      },
      {
        "id": 4694,
        "name": "Aroma vericiler (vanilya, krema)"
      },
      {
        "id": 137,
        "name": "Tuz"
      }
    ],
    "labels": [],
    "storage": "Serin ve kuru yerde saklayınız. Tüketim tarihi ve parti no kutu üzerindedir.",
    "usage": "Poşetin tamamını bir fincana boşaltın, üzerine 180 ml sıcak su ilave ediniz, karıştırdıktan sonra içiniz.",
    "specifications": [
      {
        "key": "Marka",
        "value": "Kahve Dünyası"
      },
      {
        "key": "Ürün Tipi",
        "value": "Sütlü ve vanilya aromalı çözünebilir kahve karışımı"
      },
      {
        "key": "Net Miktar",
        "value": "10 × 20 g (200 g)"
      },
      {
        "key": "Ambalaj",
        "value": "Karton kutu"
      },
      {
        "key": "Üretici",
        "value": "Gıda İşletmesi: Altınkılıçlı Kahve Kahve Ürünleri Tic. ve San. A.Ş., Ömer Avni Mah. Medis-i Mebusan Cad. İnönü Sok. Ekmen Han No: 3 Kat: 4 Kabataş, Beyoğlu, İstanbul; Üretici: D'elay Kahve San. ve Tic. A.Ş., Orhangazi Mah. 2655. Sok. No: 6 Esenyurt, İstanbul (İşletme Kayıt No: TR-34-K-01992)"
      },
      {
        "key": "Üretim Yeri",
        "value": "İthal kahve katkılarıyla Türkiye'de üretilmiştir"
      },
      {
        "key": "Form",
        "value": "10 tek kullanımlık poşet × 20 g"
      },
      {
        "key": "İşletme Kayıt No",
        "value": "TR-34-K-01992"
      },
      {
        "key": "Beyan",
        "value": "Ürünlerin hiçbir çeşidinde domuz yağı ve katkıları yoktur (şirket beyanı)"
      },
      {
        "key": "EAN-13",
        "value": "8683302500465"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0C6TLRHLF"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Besin tablosu aritmetikle tutarlı (4×70,1+4×6,2+9×16,9+2×0,9 ≈ 459 kcal ≈ 455 basılı). İçindekiler TR baskıda düzensiz (tuz ve stabilizatör iki kez, 'aroma arttırıcı (sodyum karbonat)' gibi karışıklar); İngilizce sütunla çapraz doğrulanarak temizlendi. Üretici/işletme adları düşük çözünürlükte okundu, birebir doğrulanamadı."
      }
    ],
    "warnings": [
      {
        "severity": "medium",
        "text": "Eser miktarda soya ve fındık ürünü içerebilir."
      }
    ],
    "allergens": [
      3
    ],
    "nutrition": {
      "per": "100g",
      "items": [
        {
          "nutrient": 1,
          "amount": 1901.0,
          "unit": "kJ"
        },
        {
          "nutrient": 2,
          "amount": 455.0,
          "unit": "kcal"
        },
        {
          "nutrient": 4,
          "amount": 16.9,
          "unit": "g"
        },
        {
          "nutrient": 5,
          "amount": 15.7,
          "unit": "g"
        },
        {
          "nutrient": 7,
          "amount": 70.1,
          "unit": "g"
        },
        {
          "nutrient": 8,
          "amount": 62.8,
          "unit": "g"
        },
        {
          "nutrient": 18,
          "amount": 0.9,
          "unit": "g"
        },
        {
          "nutrient": 19,
          "amount": 6.2,
          "unit": "g"
        },
        {
          "nutrient": 20,
          "amount": 0.73,
          "unit": "g"
        }
      ]
    }
  },
  {
    "asin": "B0C7CLFFWM",
    "slug": "starbucks-veranda-blend-ogutulmus-kahve-200-g-b0c7clffwm",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "04.jpg"
      ]
    ],
    "barcode": "8445290595850",
    "name": "Starbucks Veranda Blend Öğütülmüş Kahve 200 g",
    "size": "200 g",
    "packaging": "Folyo ambalaj",
    "price": 299.0,
    "brand": {
      "id": 12,
      "name": "Starbucks"
    },
    "manufacturer": null,
    "description": "Veranda Blend Öğütülmüş 200 g — Starbucks ürünü.\n\nÜrün Tipi: Öğütülmüş kahve.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0C7CLFFWM) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Starbucks"
      },
      {
        "key": "Ürün Tipi",
        "value": "Öğütülmüş kahve"
      },
      {
        "key": "Net Miktar",
        "value": "200 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "EAN-13",
        "value": "8445290595850"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0C7CLFFWM"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0CJ5H2CVN",
    "slug": "no-33-filtre-250-g-ogutulmus-b0cj5h2cvn",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8683574800027",
    "name": "No:33 Filtre 250 G Öğütülmüş",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 377.0,
    "brand": {
      "id": 5191,
      "name": "The Whirl"
    },
    "manufacturer": null,
    "description": "No:33 Filtre Kahve 250 g — The Whirl ürünü.\n\nÜrün Tipi: Filtre kahve (öğütülmüş).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0CJ5H2CVN) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "The Whirl"
      },
      {
        "key": "Ürün Tipi",
        "value": "Filtre kahve (öğütülmüş)"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "EAN-13",
        "value": "8683574800027"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0CJ5H2CVN"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0CS6GXNYD",
    "barcode": "8690632042145",
    "name": "Nescafe, Mocha Çikolatalı Ve Köpüklü Çözünebilir Kahve Karışımı, 17 Gram x 9 Adet",
    "slug": "nescafe-mocha-cikolatali-ve-kopuklu-cozunebilir-kahve-karisimi-17-gram-x-9-adet",
    "size": "17 g (x9 adet)",
    "packaging": "Poşet",
    "price": 98,
    "description": "Amazon TR (B0CS6GXNYD) listesi ve ambalaj görselinden derlenmiştir.\n\nÜrün Açıklaması 17 g poşetin tamamını bir fincana boşaltın ve kaynatılıp 1 dakika bekletilmiş sıcak suyu (150 mL) karıştırarak ilave edin. Nescafé Mocha’nızın keyfini çıkarın. Kuru ve serin yerde muhafaza ediniz. Ürünlerimizin hiçbirinde domuz yağı ve katkıları yoktur.",
    "manufacturer": "Nestlé Türkiye Gıda Sanayi A.Ş., Büyükdere Cad. No:255/A Blok 34398 Maslak İstanbul (TR-16-K-000243)",
    "storage": "Kuru ve serin yerde muhafaza ediniz.",
    "usage": "17 g poşet + 150 ml sıcak su, karıştırılır.",
    "brand": {
      "id": 139,
      "name": "Nescafe"
    },
    "items": [
      {
        "id": 373,
        "name": "Glukoz şurubu"
      },
      {
        "id": 1816,
        "name": "Tam hidrojenize bitkisel yağ"
      },
      {
        "id": 805,
        "name": "Süt proteini"
      },
      {
        "id": 4694,
        "name": "Aroma verici"
      },
      {
        "id": 186,
        "name": "Şeker"
      },
      {
        "id": 594,
        "name": "Kakao"
      }
    ],
    "specifications": [
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "ASIN",
        "value": "B0CS6GXNYD"
      },
      {
        "key": "Marka",
        "value": "Nescafe"
      },
      {
        "key": "Üretici",
        "value": "Nestlé Türkiye Gıda Sanayi A.Ş., Büyükdere Cad. No:255/A Blok 34398 Maslak İstanbul (TR-16-K-000243)"
      },
      {
        "key": "Besin Tablosu Notu",
        "value": "Tablo 100 mL hazırlanmış içecek için (54 kcal/229 kJ, yağ 2,1 g, doymuş 2,0 g, karb 8,0 g, şeker 6,5 g, lif 0,6 g, protein 0,5 g, tuz 0,27 g); 100 g toz sütunu yok."
      },
      {
        "key": "Fiyat (Amazon TR, 2026-11)",
        "value": "98.9 TL"
      }
    ],
    "labels": [],
    "warnings": [],
    "allergens": [],
    "nutrition": null,
    "mediaFiles": [],
    "legacyMedia": true
  },
  {
    "asin": "B0CT94DXLD",
    "slug": "starbucks-by-nespresso-vanilya-aromal-kapsul-kahve-1-x-10-ad-b0ct94dxld",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8445290156075",
    "name": "STARBUCKS By Nespresso Vanilya Aromalı Kapsül Kahve 1 X 10 Adet",
    "size": "10 × 5,3 g (53 g)",
    "packaging": "Alüminyum kapsül",
    "price": 274.95,
    "brand": {
      "id": 12,
      "name": "Starbucks"
    },
    "manufacturer": null,
    "description": "By Nespresso Vanilya Kapsül 10'lu — Starbucks ürünü.\n\nÜrün Tipi: Vanilya aromalı kapsül kahve (Nespresso uyumlu).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0CT94DXLD) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Starbucks"
      },
      {
        "key": "Ürün Tipi",
        "value": "Vanilya aromalı kapsül kahve (Nespresso uyumlu)"
      },
      {
        "key": "Net Miktar",
        "value": "10 × 5,3 g (53 g)"
      },
      {
        "key": "Ambalaj",
        "value": "Alüminyum kapsül"
      },
      {
        "key": "EAN-13",
        "value": "8445290156075"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0CT94DXLD"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0D49BZ2K1",
    "slug": "moliendo-ethiopia-djimmah-yoresel-kahve-cekirdek-kahve-250-g-b0d49bz2k1",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ]
    ],
    "barcode": "8682190852427",
    "name": "Moliendo Ethiopia Djimmah Yöresel Kahve (Çekirdek Kahve) 250 g",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 386.75,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Ethiopia Djimmah Çekirdek 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Çekirdek kahve (kavrulmuş). Menşe: Etiyopya Djimmah. İçindekiler: Kavrulmuş kahve çekirdeği (100% Arabica).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0D49BZ2K1) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği (100% Arabica)"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve (kavrulmuş)"
      },
      {
        "key": "Menşe",
        "value": "Etiyopya Djimmah"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Kahve Türü",
        "value": "100% Arabica"
      },
      {
        "key": "Tadım Notaları",
        "value": "Tatlı ve Hafif Limon"
      },
      {
        "key": "Asidite",
        "value": "Düşük"
      },
      {
        "key": "Gövde",
        "value": "Orta"
      },
      {
        "key": "İçim-Sertlik",
        "value": "Dengeli"
      },
      {
        "key": "EAN-13",
        "value": "8682190852427"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0D49BZ2K1"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalajda içindekiler/storage/üretici ince yazısı var ama galerideki çözünürlükte okunamıyor (beyaz mikro yazı, lacivert zemin). '100% Arabica' ibaresi alt bantta çok dilli olarak basılı ('100% Arabica Coffee Beans / Hochwertige Arabica Kaffeebohnen'). Besin tablosu ve sertifikasyon logosu görünmüyor; iki dairesel mühür var ama içerikleri okunamıyor (sertifika olduğu doğrulanamadı). Barkod ambalajda dikey basılı: 8682190852427 (Amazon Üretici Referansı ile uyumlu). Tat profili kartında nokta skalası: Asidite ~1/5, Sertlik ~3/5, Gövde ~2/5."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0D4F5GF8Z",
    "slug": "moliendo-peru-chanchamayo-yoresel-kahve-b0d4f5gf8z",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ]
    ],
    "barcode": "8682190852076",
    "name": "Moliendo Peru Chanchamayo Yöresel Kahve",
    "size": "250 g",
    "packaging": "Folyo ambalaj",
    "price": 341.25,
    "brand": {
      "id": 4209,
      "name": "Moliendo Kahve"
    },
    "manufacturer": null,
    "description": "Peru Chanchamayo Çekirdek 250 g — Moliendo Kahve ürünü.\n\nÜrün Tipi: Çekirdek kahve (kavrulmuş). Menşe: Peru Chanchamayo. İçindekiler: Kavrulmuş kahve çekirdeği (100% Arabica).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0D4F5GF8Z) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4948,
        "name": "Kavrulmuş kahve çekirdeği (100% Arabica)"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Moliendo Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve (kavrulmuş)"
      },
      {
        "key": "Menşe",
        "value": "Peru Chanchamayo"
      },
      {
        "key": "Net Miktar",
        "value": "250 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Kahve Türü",
        "value": "100% Arabica"
      },
      {
        "key": "Tadım Notaları",
        "value": "Çiçeksi, Tatlı, Karamel ve Tarçın"
      },
      {
        "key": "Asidite",
        "value": "Orta"
      },
      {
        "key": "Gövde",
        "value": "Orta"
      },
      {
        "key": "İçim-Sertlik",
        "value": "Hafif"
      },
      {
        "key": "EAN-13",
        "value": "8682190852076"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0D4F5GF8Z"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Etiyopya kardeş ürünüyle aynı ambalaj ailesi; yan panel ince yazısı (üretici/storage) okunamıyor. Etikette tadım notları iki varyant basılı: arka etikette 'Çiçeksi, Tatlı, Karamel ve Tarçın', bilgi kartında aynısı. Kardeş ürünün ön yüzünde 'Çilek, Tatlı...' okunmuştu ama en net kaynak (arka etiket 02.jpg) 'Çiçeksi' diyor — Çiçeksi esas alındı. Besin tablosu ve okunabilir sertifika logosu yok. Barkod: 8682190852076. Tat profili kartı nokta skalası: Asidite 4/5, Sertlik 2/5, Gövde 3/5."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0D8BVTPNF",
    "slug": "nescafe-gold-teneke-cozunebilir-kahve-900-gram-b0d8bvtpnf",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8690632041063",
    "name": "NESCAFÉ Gold Teneke Çözünebilir Kahve, 900 Gram",
    "size": "900 g",
    "packaging": "Teneke kutu",
    "price": 1819.65,
    "brand": {
      "id": 139,
      "name": "Nescafe"
    },
    "manufacturer": "Nestlé Türkiye Gıda Sanayi A.Ş. (adres satırları galeride okunamıyor)",
    "description": "Gold Teneke 900 g — Nescafe ürünü.\n\nÜrün Tipi: Granül/suda çözünür kahve (teneke).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0D8BVTPNF) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": "1 tatlı kaşığı (2 g) + 80°C sıcak su = 200 ml fincan",
    "specifications": [
      {
        "key": "Marka",
        "value": "Nescafe"
      },
      {
        "key": "Ürün Tipi",
        "value": "Granül/suda çözünür kahve (teneke)"
      },
      {
        "key": "Net Miktar",
        "value": "900 g"
      },
      {
        "key": "Ambalaj",
        "value": "Teneke kutu"
      },
      {
        "key": "Üretici",
        "value": "Nestlé Türkiye Gıda Sanayi A.Ş. (adres satırları galeride okunamıyor)"
      },
      {
        "key": "Yoğunluk",
        "value": "7/10"
      },
      {
        "key": "İletişim",
        "value": "0850 211 32 16 / 444 6 540"
      },
      {
        "key": "Web",
        "value": "www.nescafe.com.tr"
      },
      {
        "key": "Not",
        "value": "Nescafé Gold Avrupa bölgesi için üretilir"
      },
      {
        "key": "EAN-13",
        "value": "8690632041063"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0D8BVTPNF"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeride yalnızca ön yüz + arka panelin bir kısmı var; İçindekiler, Besin Değerleri tablosu ve Saklama Koşulları bölümleri görünmüyor (teneke yan panelleri fotoğraflanmamış). Arka panel metni: 'Sadece tadıyla değil, aynı zamanda yaptıklarıyla da fark yaratan kahve' + %100 sorumlu kaynak/4C sertifikasyonu/Nescafé Tarım Girişimi açıklaması. Hazırlanışı ikonları: 2 g kahve + 80°C su = 200 ml. İki farklı telefon numarası okunuyor (0850 211 32 16 ve 0 800 211 02 18 / 444 6 540 - 444 8 160 karışık okumalar, düşük güven). Besin tablosu ambalajda vardır ama galeride yok → nutrition null."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0DCBJCCTD",
    "slug": "nescafe-xpress-vanilla-soguk-kahve-24-250-ml-b0dcbjcctd",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8690632762883",
    "name": "Nescafé Xpress Vanilla Soğuk Kahve 24 × 250 ml",
    "size": "24 × 250 ml (6000 ml)",
    "packaging": "Alüminyum kutu (içecek)",
    "price": 1213.9,
    "brand": {
      "id": 139,
      "name": "Nescafe"
    },
    "manufacturer": null,
    "description": "Xpress Vanilla Soğuk Kahve 24x250 ml — Nescafe ürünü.\n\nÜrün Tipi: Hazır içilebilir soğuk kahve.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0DCBJCCTD) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Nescafe"
      },
      {
        "key": "Ürün Tipi",
        "value": "Hazır içilebilir soğuk kahve"
      },
      {
        "key": "Net Miktar",
        "value": "24 × 250 ml (6000 ml)"
      },
      {
        "key": "Ambalaj",
        "value": "Alüminyum kutu (içecek)"
      },
      {
        "key": "Aroma",
        "value": "Vanilya"
      },
      {
        "key": "Koli İçeriği",
        "value": "24 kutu × 250 ml"
      },
      {
        "key": "EAN-13",
        "value": "8690632762883"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0DCBJCCTD"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeri yalnızca kutu ön yüzü + satış kolisi fotoğrafları: içindekiler, besin değerleri, saklama, üretici bilgileri kutunun arka yüzünde olmalı ama fotoğraflanmamış. Vanilyalı aromalı süt bazlı hazır kahve olduğu ürün adından biliniyor ancak ambalaj metni okunamadığı için ingredients/nutrition null bırakıldı (varsayım yazılmadı). Koli yan panelinde 'DEĞİŞİK BİR KAHVE KEYFİ' sloganı var."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0DCW6P5FG",
    "slug": "jacobs-monarch-gold-granul-kahve-150-g-b0dcw6p5fg",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "04.jpg"
      ]
    ],
    "barcode": "8714599611081",
    "name": "Jacobs Monarch Gold Granül Kahve 150 g",
    "size": "150 g",
    "packaging": "Folyo ambalaj",
    "price": null,
    "brand": {
      "id": 86,
      "name": "Jacobs"
    },
    "manufacturer": null,
    "description": "Monarch Gold Granül Kahve 150 g — Jacobs ürünü.\n\nÜrün Tipi: Granül kahve.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0DCW6P5FG) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 4625,
        "name": "Granül kahve"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Jacobs"
      },
      {
        "key": "Ürün Tipi",
        "value": "Granül kahve"
      },
      {
        "key": "Net Miktar",
        "value": "150 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "Ön Yüz İddiaları",
        "value": "Zengin Aroma, Yoğun Tat"
      },
      {
        "key": "Marka Sloganı",
        "value": "SEIT 1895"
      },
      {
        "key": "Promosyon",
        "value": "%20 Avantajlı Paket"
      },
      {
        "key": "EAN-13",
        "value": "8714599611081"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0DCW6P5FG"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Galeride yalnızca poşet ön yüzü + yaşam tarzı reklam görselleri var; arka/yan panel (içindekiler, besin tablosu, üretici, barkod) fotoğraflanmamış. Ön yüzde 'KAVANOZUNUZU DOLDURUN' küçük kavanoz illüstrasyonu ve kırmızı 'Wunderbar' etiketi var. '75 ₺' tokenu fiyat bilgisi olabilir, etiket verisi değil."
      },
      {
        "key": "İçindekiler Kaynağı",
        "value": "Ambalaj ön yüz ürün tipi beyanı: Jacobs Monarch Gold granül kahve"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0DFHKSLLP",
    "slug": "l-or-advent-takvimi-2026-nespresso-uyumlu-aluminyum-kapsul-k-b0dfhksllp",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "04.jpg"
      ]
    ],
    "barcode": "8711000604069",
    "name": "L'OR Advent Takvimi 2026 Nespresso Uyumlu Alüminyum Kapsül Kahve 24 Adet",
    "size": "24 × 5,3 g (127 g)",
    "packaging": "Karton kutu",
    "price": 649.9,
    "brand": {
      "id": 5588,
      "name": "L'OR"
    },
    "manufacturer": null,
    "description": "Advent Takvimi 2026 Kapsül Kahve 24 Adet — L'OR ürünü.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0DFHKSLLP) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "L'OR"
      },
      {
        "key": "Net Miktar",
        "value": "24 × 5,3 g (127 g)"
      },
      {
        "key": "Ambalaj",
        "value": "Karton kutu"
      },
      {
        "key": "EAN-13",
        "value": "8711000604069"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0DFHKSLLP"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış. Boyut/adet bilgisi ürün başlığından (Advent Takvimi 2026 Kapsül Kahve 24 Adet)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0DT72H6PM",
    "slug": "starbucks-dark-espresso-roast-cekirdek-kahve-200g-b0dt72h6pm",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ]
    ],
    "barcode": "8445290595881",
    "name": "Starbucks Dark Espresso Roast Çekirdek Kahve 200g",
    "size": "200 g",
    "packaging": "Folyo ambalaj",
    "price": 529.0,
    "brand": {
      "id": 12,
      "name": "Starbucks"
    },
    "manufacturer": null,
    "description": "Dark Espresso Roast Çekirdek 200 g — Starbucks ürünü.\n\nÜrün Tipi: Çekirdek kahve (Dark Espresso Roast).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0DT72H6PM) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Starbucks"
      },
      {
        "key": "Ürün Tipi",
        "value": "Çekirdek kahve (Dark Espresso Roast)"
      },
      {
        "key": "Net Miktar",
        "value": "200 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "EAN-13",
        "value": "8445290595881"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0DT72H6PM"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış. Boyut ürün başlığından (Dark Espresso Roast Çekirdek 200 g)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0DYF2PPKW",
    "barcode": "4006067943676",
    "name": "Tchibo Gold Selection Öğütülmüş Filtre Kahve 4X250 Gr",
    "slug": "tchibo-gold-selection-ogutulmus-filtre-kahve-4x250-gr",
    "size": "250 g (x4)",
    "packaging": "Poşet",
    "price": 499,
    "description": "Amazon TR (B0DYF2PPKW) listesi ve ambalaj görselinden derlenmiştir.\n\nGold Selection Öğütülmüş Filtre Kahve 4x250g Gold Selection Öğütülmüş Filtre Kahve, günün çok özel anlarına uygun eşsiz bir filtre kahve denyimi sunar. ; Tchibo, en verimli bölgelerin, yüksek kaliteli kahve çekirdeklerini seçer. ; Bu çekirdekleri, yüksek kalitesi ve tazeliği bozulmadan kavurarak, öz",
    "manufacturer": "Tchibo",
    "storage": null,
    "usage": null,
    "brand": {
      "id": 208,
      "name": "Tchibo"
    },
    "items": [
      {
        "id": 2031,
        "name": "Öğütülmüş kahve"
      }
    ],
    "specifications": [
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "ASIN",
        "value": "B0DYF2PPKW"
      },
      {
        "key": "Marka",
        "value": "Tchibo"
      },
      {
        "key": "Etiket Notu",
        "value": "Galeri yan panel metni okunamıyor. Tchibo Gold Selection öğütülmüş filtre kahve."
      },
      {
        "key": "Fiyat (Amazon TR, 2026-11)",
        "value": "499.9 TL"
      }
    ],
    "labels": [],
    "warnings": [],
    "allergens": [],
    "nutrition": null,
    "mediaFiles": [],
    "legacyMedia": true
  },
  {
    "asin": "B0F1TX24R8",
    "slug": "the-whirl-espresso-limited-edition-espresso-1-kg-cekirdek-b0f1tx24r8",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ]
    ],
    "barcode": "8683574800041",
    "name": "THE WHIRL Espresso Limited Edition Espresso 1 kg Çekirdek",
    "size": "1000 g",
    "packaging": "Folyo ambalaj",
    "price": 1999.92,
    "brand": {
      "id": 5191,
      "name": "The Whirl"
    },
    "manufacturer": null,
    "description": "Espresso Limited Edition 1 kg — The Whirl ürünü.\n\nÜrün Tipi: Espresso çekirdek kahve (Limited Edition).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0F1TX24R8) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "The Whirl"
      },
      {
        "key": "Ürün Tipi",
        "value": "Espresso çekirdek kahve (Limited Edition)"
      },
      {
        "key": "Net Miktar",
        "value": "1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "EAN-13",
        "value": "8683574800041"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0F1TX24R8"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış. Boyut ürün başlığından (Espresso Limited Edition 1 kg)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0FM25YD76",
    "barcode": "8683181946606",
    "name": "Servet Alâ Türk Kahvesi 100 gr 3'lü Paket (300 gr)",
    "slug": "servet-ala-turk-kahvesi-100-gr-3-lu-paket-300-gr",
    "size": "100 g (x3, 300 g toplam)",
    "packaging": "Ambalaj",
    "price": 388,
    "description": "Amazon TR (B0FM25YD76) listesi ve ambalaj görselinden derlenmiştir.\n\nÜrün Açıklaması Kahvenin Alâ’sı Servet’ten Alâ Türk Kahvesi. İçimi keyifli, köpüğü bol, telvesi ağıza gelmeyen bir Türk Kahvesi. Servet Alâ Türk Kahvesini içince bir tane daha içmek istersiniz. Orta kavrulmuş, taş değirmende çekilmiş Servet Alâ Türk Kahvesini denemenizi tavsiye ediyoru",
    "manufacturer": "Servet Şekerleme",
    "storage": null,
    "usage": null,
    "brand": {
      "id": 5590,
      "name": "Bercekiz"
    },
    "items": [],
    "specifications": [
      {
        "key": "Barkod Kaynağı",
        "value": "Amazon ürün bilgileri"
      },
      {
        "key": "ASIN",
        "value": "B0FM25YD76"
      },
      {
        "key": "Marka",
        "value": "Bercekiz"
      },
      {
        "key": "Etiket Notu",
        "value": "Bercekiz Servet Alâ (Fethiye). Galeri yalnız ön yüz; arka panel yok. Taze çekilmiş orta kavrulmuş Türk kahvesi."
      },
      {
        "key": "Fiyat (Amazon TR, 2026-11)",
        "value": "388.0 TL"
      }
    ],
    "labels": [],
    "warnings": [],
    "allergens": [],
    "nutrition": null,
    "mediaFiles": [],
    "legacyMedia": true
  },
  {
    "asin": "B0G4DBS8NV",
    "slug": "nescafe-classic-teneke-kutu-1000-g-2-li-b0g4dbs8nv",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ]
    ],
    "barcode": "8690632031316",
    "name": "Nescafé Classic Teneke Kutu 1000 g (2'li)",
    "size": "2 × 1000 g",
    "packaging": "Teneke kutu",
    "price": 2885.78,
    "brand": {
      "id": 139,
      "name": "Nescafe"
    },
    "manufacturer": null,
    "description": "Classic Teneke 1000 g (2'li) — Nescafe ürünü.\n\nÜrün Tipi: Granül kahve (Classic).\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0G4DBS8NV) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 1265,
        "name": "Çözünebilir kahve"
      }
    ],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Nescafe"
      },
      {
        "key": "Ürün Tipi",
        "value": "Granül kahve (Classic)"
      },
      {
        "key": "Net Miktar",
        "value": "2 × 1000 g"
      },
      {
        "key": "Ambalaj",
        "value": "Teneke kutu"
      },
      {
        "key": "Koli İçeriği",
        "value": "2 × 1000 g teneke"
      },
      {
        "key": "EAN-13",
        "value": "8690632031316"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0G4DBS8NV"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış. Boyut ve 2'li format ürün başlığından (Classic Teneke 1000 g (2'li))."
      },
      {
        "key": "İçindekiler Kaynağı",
        "value": "Ambalaj ön yüz ürün tipi beyanı: Nescafé Classic granül kahve"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0GGHGY29W",
    "slug": "anisah-coffee-prebiyotikli-hindiba-kahvesi-150gr-lif-kaynag-b0gghgy29w",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ],
      [
        "ek1",
        "Ek görsel 1",
        "01.jpg"
      ],
      [
        "ek2",
        "Ek görsel 2",
        "02.jpg"
      ],
      [
        "ek3",
        "Ek görsel 3",
        "03.jpg"
      ],
      [
        "ek4",
        "Ek görsel 4",
        "04.jpg"
      ]
    ],
    "barcode": "8682005321827",
    "name": "Anisah Coffee Prebiyotikli Hindiba Kahvesi 150gr Lif Kaynağı",
    "size": "150 g",
    "packaging": "Folyo ambalaj",
    "price": 205.75,
    "brand": {
      "id": 2227,
      "name": "Anisah Kahve"
    },
    "manufacturer": null,
    "description": "Prebiyotikli Hindiba Kahvesi 150 g — Anisah Kahve ürünü.\n\nÜrün Tipi: Prebiyotikli hindiba kahvesi.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0GGHGY29W) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Anisah Kahve"
      },
      {
        "key": "Ürün Tipi",
        "value": "Prebiyotikli hindiba kahvesi"
      },
      {
        "key": "Net Miktar",
        "value": "150 g"
      },
      {
        "key": "Ambalaj",
        "value": "Folyo ambalaj"
      },
      {
        "key": "EAN-13",
        "value": "8682005321827"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0GGHGY29W"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj görsellerinde besin değerleri tablosu yok"
      },
      {
        "key": "Ambalaj Notu",
        "value": "Ambalaj galerisinde yalnız ön yüz var; arka panel fotoğraflanmamış. Boyut ürün başlığından (Prebiyotikli Hindiba Kahvesi 150 g)."
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0GGHNZS3G",
    "barcode": "8682005321834",
    "name": "Anisah Coffee Kolajenli Hindiba Kahvesi | 150gr | Lif Kaynağı",
    "slug": "anisah-coffee-kolajenli-hindiba-kahvesi-150gr-lif-kaynagi",
    "size": "150 g",
    "packaging": "Ambalaj",
    "price": 185,
    "description": "Amazon TR (B0GGHNZS3G) listesi ve ambalaj görselinden derlenmiştir.\n\nÜrün Açıklaması Lif Kaynağı Anisah Coffee Kolajenli Hindiba Kahvesi – Güzellik & Sağlık İçin Fonksiyonel Bir Kahve Anisah Coffee tarafından geliştirilen Kolajenli Hindiba Kahvesi, prebiyotik hindiba lifi, çözünebilir kahve ve yüksek kaliteli tip 1 & 3 hidrolize sığır kolajeni ile bir araya getirilm",
    "manufacturer": "Anisah Gıda San. ve Tic. Ltd. Şti., Zafer Mah. Adile Naşit Bulvarı 177. Sk. No:2 Kat:1 Esenyurt İstanbul",
    "storage": null,
    "usage": "1 tatlı kaşığı (6 g) + 180 ml sıcak su; süt veya bitkisel içecekle de hazırlanabilir. Günde 1-2 kez yemek sonrası.",
    "brand": {
      "id": 2227,
      "name": "Anisah Kahve"
    },
    "items": [
      {
        "id": 4064,
        "name": "Hindiba"
      },
      {
        "id": 1265,
        "name": "Çözünebilir kahve"
      },
      {
        "id": 4027,
        "name": "Kolajen"
      },
      {
        "id": 2503,
        "name": "Vanilya aroması"
      }
    ],
    "specifications": [
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "ASIN",
        "value": "B0GGHNZS3G"
      },
      {
        "key": "Marka",
        "value": "Anisah Kahve"
      },
      {
        "key": "Menşe",
        "value": "İthal ve yerli hammaddeler kullanılarak Türkiye'de üretilmiştir"
      },
      {
        "key": "Üretici",
        "value": "Anisah Gıda San. ve Tic. Ltd. Şti., Zafer Mah. Adile Naşit Bulvarı 177. Sk. No:2 Kat:1 Esenyurt İstanbul"
      },
      {
        "key": "Etiket Notu",
        "value": "Lif kaynağı; sığır kolajeni içerir."
      },
      {
        "key": "Fiyat (Amazon TR, 2026-11)",
        "value": "185.0 TL"
      }
    ],
    "labels": [],
    "warnings": [],
    "allergens": [],
    "nutrition": null,
    "mediaFiles": [],
    "legacyMedia": true
  },
  {
    "asin": "B0GSRK9DF6",
    "barcode": "8690632765372",
    "name": "Nestle Nescafe 3ü1 Arada Gold Yumuşak 10'lu Çoklu Paket 10x 17,5 g",
    "slug": "nestle-nescafe-3u1-arada-gold-yumusak-10-lu-coklu-paket-10x-17-5-g",
    "size": "175 g (10 x 17,5 g)",
    "packaging": "Poşet",
    "price": 89,
    "description": "Amazon TR (B0GSRK9DF6) listesi ve ambalaj görselinden derlenmiştir.\n\nÜrün Açıklaması 17,5 g poşetin tamamını bir fincana boşaltın. Kaynatılıp 1 dakika bekletilmiş sıcak su 200 mL ilave edin. Karıştırın. Kuru ve serin yerde muhafaza ediniz. İçindekiler Şeker, kahve beyazlatıcısı (%30,3) [glukoz şurubu, tam hidrojenize bitkisel yağ (palm çekirdeği), asitlik düzenley",
    "manufacturer": "Nestlé Türkiye Gıda Sanayi A.Ş.",
    "storage": null,
    "usage": null,
    "brand": {
      "id": 139,
      "name": "Nescafe"
    },
    "items": [
      {
        "id": 186,
        "name": "Şeker"
      },
      {
        "id": 373,
        "name": "Glukoz şurubu"
      },
      {
        "id": 1816,
        "name": "Tam hidrojenize bitkisel yağ"
      },
      {
        "id": 805,
        "name": "Süt proteini"
      },
      {
        "id": 1265,
        "name": "Çözünebilir kahve"
      },
      {
        "id": 4694,
        "name": "Aroma verici"
      }
    ],
    "specifications": [
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "ASIN",
        "value": "B0GSRK9DF6"
      },
      {
        "key": "Ambalaj Barkodu (İhracat/Poşet)",
        "value": "8690632765365"
      },
      {
        "key": "Marka",
        "value": "Nescafe"
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "Üretici",
        "value": "Nestlé Türkiye Gıda Sanayi A.Ş."
      },
      {
        "key": "Etiket Notu",
        "value": "Kutu EAN 8690632765372, tekil poşet EAN 8690632765365 (ambalaj görselinden doğrulandı)."
      },
      {
        "key": "Fiyat (Amazon TR, 2026-11)",
        "value": "89.9 TL"
      }
    ],
    "labels": [],
    "warnings": [],
    "allergens": [],
    "nutrition": null,
    "mediaFiles": [],
    "legacyMedia": true
  },
  {
    "asin": "B0GSRQ78CB",
    "barcode": "8690632765396",
    "name": "Nestle Nescafe 3ü1 Arada Gold Yoğun 10'lu Çoklu Paket 10x 17,6 g",
    "slug": "nestle-nescafe-3u1-arada-gold-yogun-10-lu-coklu-paket-10x-17-6-g",
    "size": "176 g (10 x 17,6 g)",
    "packaging": "Poşet",
    "price": 89,
    "description": "Amazon TR (B0GSRQ78CB) listesi ve ambalaj görselinden derlenmiştir.\n\nÜrün Açıklaması 17,5 g poşetin tamamını bir fincana boşaltın. Kaynatılıp 1 dakika bekletilmiş sıcak su 200 mL ilave edin. Karıştırın. Kuru ve serin yerde muhafaza ediniz. İçindekiler Şeker, kahve beyazlatıcısı (%29,6) [glukoz şurubu, tam hidrojenize bitkisel yağ (palm çekirdeği), asitlik düzenley",
    "manufacturer": "Nestlé Türkiye Gıda Sanayi A.Ş.",
    "storage": null,
    "usage": null,
    "brand": {
      "id": 139,
      "name": "Nescafe"
    },
    "items": [
      {
        "id": 186,
        "name": "Şeker"
      },
      {
        "id": 373,
        "name": "Glukoz şurubu"
      },
      {
        "id": 1816,
        "name": "Tam hidrojenize bitkisel yağ"
      },
      {
        "id": 805,
        "name": "Süt proteini"
      },
      {
        "id": 1265,
        "name": "Çözünebilir kahve"
      },
      {
        "id": 4694,
        "name": "Aroma verici"
      }
    ],
    "specifications": [
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "ASIN",
        "value": "B0GSRQ78CB"
      },
      {
        "key": "Ambalaj Barkodu (İhracat/Poşet)",
        "value": "8690632765402"
      },
      {
        "key": "Marka",
        "value": "Nescafe"
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "Üretici",
        "value": "Nestlé Türkiye Gıda Sanayi A.Ş."
      },
      {
        "key": "Etiket Notu",
        "value": "Kutu EAN 8690632765396, tekil poşet EAN 8690632765402 (ambalaj görselinden doğrulandı). 2'li paket listing B0GTWCG7JV aynı ürün."
      },
      {
        "key": "Fiyat (Amazon TR, 2026-11)",
        "value": "89.9 TL"
      }
    ],
    "labels": [],
    "warnings": [],
    "allergens": [],
    "nutrition": null,
    "mediaFiles": [],
    "legacyMedia": true
  }
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

async function assertBrand(client: PayloadClient, brand: BrandRef): Promise<number> {
  const doc = await paused(() =>
    client.find('brands', { where: { id: { equals: brand.id } }, limit: 1 }),
  )
  const found = doc.docs[0] as { name?: string } | undefined
  if (!found) throw new Error(`Marka kaydi yok: ${brand.id}`)
  if (String(found.name).toLocaleLowerCase('tr') !== brand.name.toLocaleLowerCase('tr')) {
    throw new Error(`Marka adi uyusmuyor: ${brand.id} -> ${String(found.name)} != ${brand.name}`)
  }
  return brand.id
}

async function assertIngredients(client: PayloadClient, items: IngredientRef[]): Promise<number[]> {
  const ids: number[] = []
  for (const item of items) {
    const doc = await paused(() =>
      client.find('ingredients', { where: { id: { equals: item.id } }, limit: 1 }),
    )
    const found = doc.docs[0] as { name?: string } | undefined
    if (!found) throw new Error(`Icindekiler kaydi yok: ${item.id} (${item.name})`)
    ids.push(item.id)
  }
  return ids
}

/**
 * Medya dosya adı öneki. Kayıt prod'da zaten varsa önceki çalıştırmadan kalan
 * öneki korur; böylece isim düzeltmesi aynı görseli ikinci kez yüklemez.
 */
async function mediaPrefix(client: PayloadClient, seed: ProductSeed): Promise<string> {
  const existing = await client.find('products', {
    where: { barcode: { equals: seed.barcode } },
    limit: 1,
    depth: 1,
  })
  const doc = existing.docs[0] as { frontImage?: { filename?: string } } | undefined
  const filename = doc?.frontImage?.filename
  if (filename && filename.endsWith('-front.jpg')) {
    // Ürün adı sonradan düzeltildiyse eski dosya öneki korunur: aynı bayt yeniden yüklenmez.
    return filename.slice(0, -'-front.jpg'.length)
  }
  return seed.slug
}

async function ensureMedia(
  client: PayloadClient,
  seed: ProductSeed,
  prefix: string,
): Promise<Record<string, number>> {
  const ids: Record<string, number> = {}
  for (const [key, caption] of seed.mediaFiles) {
    const fileName = `${prefix}-${key}.jpg`
    const byFile = await paused(() => client.findOne('media', { filename: { equals: fileName } }))
    if (byFile) {
      ids[key] = byFile.id
      continue
    }
    const alt = `${seed.name} — ${caption}`
    const created = await paused(() =>
      client.upload('media', path.join(IMAGE_ROOT, prefix, fileName), { alt }),
    )
    console.log(`  + medya: ${fileName} (${created.id})`)
    ids[key] = created.id
  }
  return ids
}

async function seedProduct(client: PayloadClient, seed: ProductSeed): Promise<void> {
  assertEan13(seed.barcode)
  console.log(`\n== ${seed.name} (${seed.barcode})`)

  const brandId = await assertBrand(client, seed.brand)
  const itemIds = await assertIngredients(client, seed.items)
  const prefix = await mediaPrefix(client, seed)
  const media = seed.mediaFiles.length ? await ensureMedia(client, seed, prefix) : {}
  const frontImage = seed.mediaFiles.length ? media[seed.mediaFiles[0][0]] : undefined
  if (seed.mediaFiles.length && !frontImage) {
    throw new Error(`On yuz medyasi yuklenemedi: ${seed.barcode}`)
  }
  const additionalImages = seed.mediaFiles
    .slice(1)
    .filter(([key]) => media[key])
    .map(([key, caption]) => ({ image: media[key], caption }))

  const data: Record<string, unknown> = {
    barcode: seed.barcode,
    name: seed.name,
    description: seed.description,
    brand: brandId,
    category: CATEGORY_ID,
    country: COUNTRY_ID,
    size: seed.size ?? undefined,
    packaging: seed.packaging ?? undefined,
    manufacturer: seed.manufacturer ?? undefined,
    // Bos diziler gonderilmez: var olan kayittaki icindekiler/sertifika verisini silmesin.
    specifications: seed.specifications,
    storage: seed.storage ?? undefined,
    usage: seed.usage ?? undefined,
    model: seed.asin,
    sku: `AMZ-${seed.asin}`,
    ...(frontImage ? { frontImage, additionalImages } : {}),
    status: 'published' as const,
  }
  if (itemIds.length) data.items = itemIds.map((id) => ({ ingredients: id }))
  if (seed.allergens.length) data.allergens = seed.allergens[0]
  if (seed.labels.length) data.labels = seed.labels
  if (seed.warnings.length) data.warnings = seed.warnings
  if (seed.nutrition) data.nutrition = seed.nutrition
  if (seed.price != null) data.prices = [{ amount: seed.price, date: PRICE_DATE }]

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

  const targets = ONLY.length ? PRODUCTS.filter((seed) => ONLY.includes(seed.asin)) : PRODUCTS
  let ok = 0
  const failed: string[] = []
  for (const seed of targets) {
    try {
      await seedProduct(client, seed)
      ok++
    } catch (error) {
      failed.push(`${seed.barcode} ${seed.name}: ${String(error).slice(0, 300)}`)
      console.error(`  !! HATA: ${String(error).slice(0, 300)}`)
    }
  }
  console.log(`\nBitti: ${ok}/${targets.length} basarili`)
  if (failed.length) {
    console.log('Basarisizlar:')
    for (const failure of failed) console.log(' -', failure)
    process.exitCode = 1
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
