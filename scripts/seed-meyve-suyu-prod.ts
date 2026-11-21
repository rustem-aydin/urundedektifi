import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Amazon.com.tr "Meyve Suları" kategorisinden (node 22380531031) barkodu
 * doğrulanmış ürünleri UZAK Payload REST API'sine yazar.
 *
 * Barkod kaynağı: ambalaj görselinden ZXing ile okunan EAN-13 ya da Amazon ürün
 * bilgilerindeki "Üretici Referansı" / "Ürün Model Numarası" alanı. Her barkodun
 * kontrol hanesi doğrulandı; 2xx (restricted distribution) prefix'li kodlar
 * tüketici barkodu sayılmadı.
 *
 * Idempotent: ürün barkod ile, marka/içindekiler kimlik ile, medya dosya adı ile
 * upsert edilir. Var olan kayıt güncellenir, ikinci kayıt açılmaz. Boş diziler
 * gönderilmez (mevcut içindekiler/sertifika verisi silinmesin).
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-meyve-suyu-prod.ts
 *   SEED_ONLY=B0XXXXXXXX,B0YYYYYYYY ... (tek ürün yeniden deneme)
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
const ONLY = (process.env.SEED_ONLY ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const CATEGORY_ID = 18 // Meyve Suyu
const PRICE_DATE = '2026-11-21T00:00:00.000Z'

type IngredientRef = { id: number; name: string; percent?: number }
type BrandRef = { id: number; name: string }
type MediaFile = [key: string, caption: string, file: string]

type ProductSeed = {
  asin: string
  /** Medya dosya adı öneki (ürün slug'ı); Payload'da dosya adı çakışmasını önler. */
  slug: string
  /** [anahtar, açıklama, kaynak dosya] — ilki ön yüz. Boşsa mevcut medya korunur. */
  mediaFiles: MediaFile[]
  barcode: string
  name: string
  size: string | null
  packaging: string | null
  price: number | null
  brand: BrandRef
  category: number
  country: number | null
  manufacturer: string | null
  description: string
  items: IngredientRef[]
  labels: string[]
  storage: string | null
  usage: string | null
  specifications: { key: string; value: string }[]
  warnings: { severity: 'low' | 'medium' | 'high'; text: string }[]
  allergens: number[]
  nutrition: {
    per: '100g' | '100ml' | 'serving'
    items: { nutrient: number; amount: number; unit: string }[]
  } | null
}

const PRODUCTS: ProductSeed[] = [
  {
    "asin": "B004DP2IFS",
    "slug": "dimes-seftali-nektar-1-l",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ]
    ],
    "barcode": "8690558010020",
    "name": "Dimes Şeftali Nektarı 1 L",
    "size": "1000 ml",
    "packaging": "Tetra Pak karton kutu",
    "price": 70.0,
    "brand": {
      "id": 50,
      "name": "Dimes"
    },
    "category": 18,
    "country": 1,
    "manufacturer": "DİMES Gıda Sanayi ve Ticaret A.Ş.",
    "description": "Dimes şeftali nektarı, 1 litrelik Tetra Pak ambalajda. Etiketinde nektar (meyve oranı %100 meyve suyu değil) ibaresi yer alır.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B004DP2IFS) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Dimes"
      },
      {
        "key": "Net Miktar",
        "value": "1000 ml"
      },
      {
        "key": "Ambalaj",
        "value": "Tetra Pak karton kutu"
      },
      {
        "key": "Üretici",
        "value": "DİMES Gıda Sanayi ve Ticaret A.Ş."
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "EAN-13",
        "value": "8690558010020"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Amazon 'Üretici Referansı' / 'Ürün Model Numarası'"
      },
      {
        "key": "Amazon ASIN",
        "value": "B004DP2IFS"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj galerisinde besin değerleri tablosu yok"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B007023KA8",
    "slug": "uludag-efsane-gazoz-6-250-ml",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ]
    ],
    "barcode": "8690723101836",
    "name": "Uludağ Efsane Gazoz 6 × 250 ml",
    "size": "6 × 250 ml",
    "packaging": "Cam şişe",
    "price": 159.0,
    "brand": {
      "id": 488,
      "name": "Uludağ"
    },
    "category": 36,
    "country": 1,
    "manufacturer": "Uludağ İçecek Sanayi ve Ticaret A.Ş.",
    "description": "Uludağ Efsane gazoz, 6'lı cam şişe koli. Sade gazoz.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B007023KA8) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Uludağ"
      },
      {
        "key": "Net Miktar",
        "value": "6 × 250 ml"
      },
      {
        "key": "Ambalaj",
        "value": "Cam şişe"
      },
      {
        "key": "Üretici",
        "value": "Uludağ İçecek Sanayi ve Ticaret A.Ş."
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "EAN-13",
        "value": "8690723101836"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Amazon 'Üretici Referansı' / 'Ürün Model Numarası'"
      },
      {
        "key": "Amazon ASIN",
        "value": "B007023KA8"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj galerisinde besin değerleri tablosu yok"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B008BRXT6Q",
    "slug": "tamek-kays-nektar-1-l",
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
    "barcode": "8690575871710",
    "name": "Tamek Kayısı Nektarı 1 L",
    "size": "1000 ml",
    "packaging": "Tetra Pak karton kutu",
    "price": 75.0,
    "brand": {
      "id": 40,
      "name": "Tamek"
    },
    "category": 18,
    "country": 1,
    "manufacturer": "Tamek Grup Gıda Üretim A.Ş.",
    "description": "Tamek kayısı nektarı, 1 litrelik karton ambalaj.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B008BRXT6Q) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Tamek"
      },
      {
        "key": "Net Miktar",
        "value": "1000 ml"
      },
      {
        "key": "Ambalaj",
        "value": "Tetra Pak karton kutu"
      },
      {
        "key": "Üretici",
        "value": "Tamek Grup Gıda Üretim A.Ş."
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "EAN-13",
        "value": "8690575871710"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Amazon 'Üretici Referansı' / 'Ürün Model Numarası'"
      },
      {
        "key": "Amazon ASIN",
        "value": "B008BRXT6Q"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj galerisinde besin değerleri tablosu yok"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B01AUG89E2",
    "slug": "dimes-100-portakal-suyu-1-l",
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
    "barcode": "8690558018057",
    "name": "Dimes %100 Portakal Suyu 1 L",
    "size": "1000 ml",
    "packaging": "Tetra Pak karton kutu",
    "price": 145.0,
    "brand": {
      "id": 50,
      "name": "Dimes"
    },
    "category": 18,
    "country": 1,
    "manufacturer": "DİMES Gıda Sanayi ve Ticaret A.Ş.",
    "description": "Dimes %100 portakal suyu, 1 litrelik Tetra Pak ambalaj. Katkısız meyve suyu.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B01AUG89E2) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Dimes"
      },
      {
        "key": "Net Miktar",
        "value": "1000 ml"
      },
      {
        "key": "Ambalaj",
        "value": "Tetra Pak karton kutu"
      },
      {
        "key": "Üretici",
        "value": "DİMES Gıda Sanayi ve Ticaret A.Ş."
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "EAN-13",
        "value": "8690558018057"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Amazon 'Üretici Referansı' / 'Ürün Model Numarası'"
      },
      {
        "key": "Amazon ASIN",
        "value": "B01AUG89E2"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj galerisinde besin değerleri tablosu yok"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B07FDG6RZ8",
    "slug": "arifoglu-kekik-suyu-500-ml",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ]
    ],
    "barcode": "8691530927855",
    "name": "Arifoğlu Kekik Suyu 500 ml",
    "size": "500 ml",
    "packaging": "Cam şişe",
    "price": 345.0,
    "brand": {
      "id": 2279,
      "name": "Arifoğlu"
    },
    "category": 26,
    "country": 1,
    "manufacturer": "Arifoğlu Baharat Gıda San. ve Tic. A.Ş.",
    "description": "Arifoğlu kekik suyu, 500 ml cam şişe. Kekik distilatı; gıda/kozmetik amaçlı kullanılır.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B07FDG6RZ8) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Arifoğlu"
      },
      {
        "key": "Net Miktar",
        "value": "500 ml"
      },
      {
        "key": "Ambalaj",
        "value": "Cam şişe"
      },
      {
        "key": "Üretici",
        "value": "Arifoğlu Baharat Gıda San. ve Tic. A.Ş."
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "EAN-13",
        "value": "8691530927855"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Amazon 'Üretici Referansı' / 'Ürün Model Numarası'"
      },
      {
        "key": "Amazon ASIN",
        "value": "B07FDG6RZ8"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj galerisinde besin değerleri tablosu yok"
      }
    ],
    "warnings": [
      {
        "severity": "low",
        "text": "Kekik suyu gıda ile temas edecek yüzeylerde seyreltilerek kullanılır; doğrudan içme suyu değildir."
      }
    ],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B07HK69NXY",
    "slug": "hipp-organik-erik-puresi-125-g",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ]
    ],
    "barcode": "9062300116950",
    "name": "HiPP Organik Erik Püresi 125 g",
    "size": "125 g",
    "packaging": "Cam kavanoz",
    "price": 85.38,
    "brand": {
      "id": 451,
      "name": "Hipp"
    },
    "category": 61,
    "country": 1,
    "manufacturer": "HiPP GmbH & Co. Vertrieb KG, Almanya",
    "description": "HiPP organik erik püresi, 125 g cam kavanoz. 4. aydan itibaren, gluten içermez.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B07HK69NXY) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [
      "organic",
      "gluten-free"
    ],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Hipp"
      },
      {
        "key": "Net Miktar",
        "value": "125 g"
      },
      {
        "key": "Ambalaj",
        "value": "Cam kavanoz"
      },
      {
        "key": "Üretici",
        "value": "HiPP GmbH & Co. Vertrieb KG, Almanya"
      },
      {
        "key": "Menşe",
        "value": "Almanya"
      },
      {
        "key": "EAN-13",
        "value": "9062300116950"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Amazon 'Üretici Referansı' / 'Ürün Model Numarası'"
      },
      {
        "key": "Amazon ASIN",
        "value": "B07HK69NXY"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj galerisinde besin değerleri tablosu yok"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B097Q4R2NG",
    "slug": "fresa-premium-yesil-elma-gazl-icecek-6-250-ml",
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
    "barcode": "8693855004532",
    "name": "Freşa Premium Yeşil Elma Gazlı İçecek 6 × 250 ml",
    "size": "6 × 250 ml",
    "packaging": "Cam şişe",
    "price": 654.56,
    "brand": {
      "id": 3316,
      "name": "Freşa"
    },
    "category": 36,
    "country": 1,
    "manufacturer": "Bursa Fabrika (Gıda İşletmecisi: Çakmaklıoğlu Madencilik…); İşletme Kayıt No TR-16-K-000289 ve TR-28-K-000041 (Phs-Ghn)",
    "description": "Freşa Premium yeşil elmalı doğal zengin mineralli gazlı içecek, 6 × 250 ml cam şişe. Helal sertifikalı.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B097Q4R2NG) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 3,
        "name": "Doğal maden suyu"
      },
      {
        "id": 5,
        "name": "Şeker"
      },
      {
        "id": 538,
        "name": "Asitlik düzenleyici (sitrik asit)"
      },
      {
        "id": 4694,
        "name": "Aroma verici (yeşil elma)"
      }
    ],
    "labels": [
      "halal-certified"
    ],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Freşa"
      },
      {
        "key": "Net Miktar",
        "value": "6 × 250 ml"
      },
      {
        "key": "Ambalaj",
        "value": "Cam şişe"
      },
      {
        "key": "Üretici",
        "value": "Bursa Fabrika (Gıda İşletmecisi: Çakmaklıoğlu Madencilik…); İşletme Kayıt No TR-16-K-000289 ve TR-28-K-000041 (Phs-Ghn)"
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "EAN-13",
        "value": "8693855004532"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B097Q4R2NG"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "İçindekiler (etiket)",
        "value": "Doğal maden suyu, Şeker, Yeşil elma suyu (konsantreden), Asitlik düzenleyici (sitrik asit), Aroma verici (yeşil elma), Koruyucu (potasyum sorbat, sodyum benzoat), Renklendirici (karamel), Vitaminler (niasin, pantotenik asit, B6, folik asit, biotin, B12)"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": {
      "per": "100ml",
      "items": [
        {
          "nutrient": 1,
          "amount": 168,
          "unit": "kJ"
        },
        {
          "nutrient": 2,
          "amount": 40,
          "unit": "kcal"
        },
        {
          "nutrient": 4,
          "amount": 0,
          "unit": "g"
        },
        {
          "nutrient": 5,
          "amount": 0,
          "unit": "g"
        },
        {
          "nutrient": 7,
          "amount": 10.0,
          "unit": "g"
        },
        {
          "nutrient": 8,
          "amount": 10.0,
          "unit": "g"
        },
        {
          "nutrient": 19,
          "amount": 0.01,
          "unit": "g"
        },
        {
          "nutrient": 20,
          "amount": 0.025,
          "unit": "g"
        }
      ]
    }
  },
  {
    "asin": "B09ML26FMS",
    "slug": "beyorganik-organik-bey-tonik-zerdecall-zencefilli-185-g",
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
    "barcode": "8682125482408",
    "name": "Beyorganik Organik Bey-Tonik (Zerdeçallı-Zencefilli) 185 g",
    "size": "185 g",
    "packaging": "Cam kavanoz",
    "price": 599.0,
    "brand": {
      "id": 5577,
      "name": "Beyorganik"
    },
    "category": 26,
    "country": 1,
    "manufacturer": "Beyorganik",
    "description": "Beyorganik organik bey-tonik: günlük doğal fermentasyonlu, katkısız ve şeker ilavesiz içilebilir sirke. 185 g cam kavanoz.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B09ML26FMS) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [
      "organic",
      "no-additives",
      "sugar-free"
    ],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Beyorganik"
      },
      {
        "key": "Net Miktar",
        "value": "185 g"
      },
      {
        "key": "Ambalaj",
        "value": "Cam kavanoz"
      },
      {
        "key": "Üretici",
        "value": "Beyorganik"
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "EAN-13",
        "value": "8682125482408"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B09ML26FMS"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj galerisinde besin değerleri tablosu yok"
      }
    ],
    "warnings": [
      {
        "severity": "medium",
        "text": "3 yaş altı bebeklere ve hamilelere kullanmadan önce hekime danışılması önerilir (etiket)."
      }
    ],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0BGL8KQMX",
    "slug": "tamek-mango-aromal-meyve-icecegi-1-l",
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
    "barcode": "8690575871321",
    "name": "Tamek Mango Aromalı Meyve İçeceği 1 L",
    "size": "1000 ml",
    "packaging": "Tetra Pak karton kutu",
    "price": 99.08,
    "brand": {
      "id": 40,
      "name": "Tamek"
    },
    "category": 18,
    "country": 1,
    "manufacturer": "Tamek Grup Gıda Üretim A.Ş.",
    "description": "Tamek mango aromalı meyve içeceği, 1 litrelik karton ambalaj.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0BGL8KQMX) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Tamek"
      },
      {
        "key": "Net Miktar",
        "value": "1000 ml"
      },
      {
        "key": "Ambalaj",
        "value": "Tetra Pak karton kutu"
      },
      {
        "key": "Üretici",
        "value": "Tamek Grup Gıda Üretim A.Ş."
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "EAN-13",
        "value": "8690575871321"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Amazon 'Üretici Referansı' / 'Ürün Model Numarası'"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0BGL8KQMX"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": {
      "per": "100ml",
      "items": [
        {
          "nutrient": 1,
          "amount": 213.6,
          "unit": "kJ"
        },
        {
          "nutrient": 2,
          "amount": 50.2,
          "unit": "kcal"
        },
        {
          "nutrient": 4,
          "amount": 0,
          "unit": "g"
        },
        {
          "nutrient": 5,
          "amount": 0,
          "unit": "g"
        },
        {
          "nutrient": 7,
          "amount": 12.33,
          "unit": "g"
        },
        {
          "nutrient": 8,
          "amount": 12.33,
          "unit": "g"
        },
        {
          "nutrient": 18,
          "amount": 0,
          "unit": "g"
        },
        {
          "nutrient": 19,
          "amount": 0,
          "unit": "g"
        },
        {
          "nutrient": 20,
          "amount": 0,
          "unit": "g"
        }
      ]
    }
  },
  {
    "asin": "B0FNDVHC9F",
    "slug": "hipp-organik-kays-puresi-125-g-2-li",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ]
    ],
    "barcode": "9062300116929",
    "name": "HiPP Organik Kayısı Püresi 125 g (2'li)",
    "size": "2 × 125 g",
    "packaging": "Cam kavanoz",
    "price": 125.6,
    "brand": {
      "id": 451,
      "name": "Hipp"
    },
    "category": 61,
    "country": 1,
    "manufacturer": "HiPP GmbH & Co. Vertrieb KG, Almanya",
    "description": "HiPP organik kayısı püresi, 125 g cam kavanoz, 2'li paket. 4. aydan itibaren, gluten içermez.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0FNDVHC9F) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [
      "organic",
      "gluten-free"
    ],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Hipp"
      },
      {
        "key": "Net Miktar",
        "value": "2 × 125 g"
      },
      {
        "key": "Ambalaj",
        "value": "Cam kavanoz"
      },
      {
        "key": "Üretici",
        "value": "HiPP GmbH & Co. Vertrieb KG, Almanya"
      },
      {
        "key": "Menşe",
        "value": "Almanya"
      },
      {
        "key": "EAN-13",
        "value": "9062300116929"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Amazon 'Üretici Referansı' / 'Ürün Model Numarası'"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0FNDVHC9F"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj galerisinde besin değerleri tablosu yok"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0FNX3H9BV",
    "slug": "gerber-organik-yulafl-elma-ve-mango-puresi-110-g-2-li",
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
    "barcode": "8445290494573",
    "name": "Gerber Organik Yulaflı Elma ve Mango Püresi 110 g (2'li)",
    "size": "2 × 110 g",
    "packaging": "Kapaklı poşet (spout pouch)",
    "price": 212.9,
    "brand": {
      "id": 1694,
      "name": "Gerber"
    },
    "category": 61,
    "country": 1,
    "manufacturer": "Nestlé España S.A., Barcelona (Türkiye ithalatçısı: Nestlé Türkiye Gıda Sanayi A.Ş.)",
    "description": "Gerber Organik 2'li yulaflı elma-mango püresi, 110 g kapaklı poşet. 6. aydan itibaren, ilave şeker içermez, tam tahıllı, yüksek C vitamini.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0FNX3H9BV) ve ürün ambalajı görselleri.",
    "items": [
      {
        "id": 450,
        "name": "Organik elma (su ilave edilmiş)",
        "percent": 44.9
      },
      {
        "id": 924,
        "name": "Organik yulaf (pişirilmiş)",
        "percent": 15
      },
      {
        "id": 663,
        "name": "Organik mango",
        "percent": 5
      },
      {
        "id": 939,
        "name": "Organik tam tahıl yulaf unu",
        "percent": 1.6
      },
      {
        "id": 301,
        "name": "Organik limon suyu konsantresi"
      },
      {
        "id": 3976,
        "name": "Vitamin C (L-askorbik asit)"
      }
    ],
    "labels": [
      "organic",
      "no-additives"
    ],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Gerber"
      },
      {
        "key": "Net Miktar",
        "value": "2 × 110 g"
      },
      {
        "key": "Ambalaj",
        "value": "Kapaklı poşet (spout pouch)"
      },
      {
        "key": "Üretici",
        "value": "Nestlé España S.A., Barcelona (Türkiye ithalatçısı: Nestlé Türkiye Gıda Sanayi A.Ş.)"
      },
      {
        "key": "Menşe",
        "value": "İspanya"
      },
      {
        "key": "EAN-13",
        "value": "8445290494573"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Ambalaj görselinden ZXing okuma"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0FNX3H9BV"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "İçindekiler (etiket)",
        "value": "Organik elma (su ilave edilmiş), Organik yulaf (pişirilmiş), Organik mango, Organik tam tahıl yulaf unu, Organik limon suyu konsantresi, Vitamin C (L-askorbik asit)"
      }
    ],
    "warnings": [],
    "allergens": [
      1
    ],
    "nutrition": {
      "per": "100g",
      "items": [
        {
          "nutrient": 1,
          "amount": 234,
          "unit": "kJ"
        },
        {
          "nutrient": 2,
          "amount": 56,
          "unit": "kcal"
        },
        {
          "nutrient": 4,
          "amount": 0.5,
          "unit": "g"
        },
        {
          "nutrient": 5,
          "amount": 0.1,
          "unit": "g"
        },
        {
          "nutrient": 7,
          "amount": 11,
          "unit": "g"
        },
        {
          "nutrient": 8,
          "amount": 7,
          "unit": "g"
        },
        {
          "nutrient": 18,
          "amount": 1.7,
          "unit": "g"
        },
        {
          "nutrient": 19,
          "amount": 1.0,
          "unit": "g"
        },
        {
          "nutrient": 20,
          "amount": 0.001,
          "unit": "g"
        }
      ]
    }
  },
  {
    "asin": "B0H6MRN3Q6",
    "slug": "organuca-organik-s8-meyve-sebze-suyu-250-ml",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ]
    ],
    "barcode": "8684483387623",
    "name": "Organuca Organik S8 Meyve & Sebze Suyu 250 ml",
    "size": "250 ml",
    "packaging": "Cam şişe",
    "price": 159.0,
    "brand": {
      "id": 1592,
      "name": "Organuca"
    },
    "category": 18,
    "country": 1,
    "manufacturer": "Organuca",
    "description": "Organuca Organik S8: domates, havuç, salatalık, ıspanak, maydanoz, marul, turp ve pancardan oluşan organik 8'li sebze-meyve suyu, 250 ml cam şişe.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0H6MRN3Q6) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [
      "organic"
    ],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Organuca"
      },
      {
        "key": "Net Miktar",
        "value": "250 ml"
      },
      {
        "key": "Ambalaj",
        "value": "Cam şişe"
      },
      {
        "key": "Üretici",
        "value": "Organuca"
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "EAN-13",
        "value": "8684483387623"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Amazon 'Üretici Referansı' / 'Ürün Model Numarası'"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0H6MRN3Q6"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj galerisinde besin değerleri tablosu yok"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0H6MVQ73W",
    "slug": "elite-organic-shot-1-daily-40-ml",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ]
    ],
    "barcode": "8697404769125",
    "name": "Elite Organic Shot 1-Daily 40 ml",
    "size": "40 ml",
    "packaging": "Cam şişe",
    "price": 305.0,
    "brand": {
      "id": 470,
      "name": "Elite"
    },
    "category": 26,
    "country": 1,
    "manufacturer": "Elite Naturel",
    "description": "Elite Organic Shot 1-Daily: 1'i 1 arada organik shot; zerdeçal, zencefil, yeşil çay, magnezyum, folik asit ve selenyum içerir. 40 ml.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0H6MVQ73W) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [
      "organic"
    ],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Elite"
      },
      {
        "key": "Net Miktar",
        "value": "40 ml"
      },
      {
        "key": "Ambalaj",
        "value": "Cam şişe"
      },
      {
        "key": "Üretici",
        "value": "Elite Naturel"
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "EAN-13",
        "value": "8697404769125"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Amazon 'Üretici Referansı' / 'Ürün Model Numarası'"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0H6MVQ73W"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj galerisinde besin değerleri tablosu yok"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0H6MW6CJ7",
    "slug": "elite-naturel-100-ananas-suyu-700-ml-6-l",
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
    "barcode": "8697404769736",
    "name": "Elite Naturel %100 Ananas Suyu 700 ml (6'lı)",
    "size": "6 × 700 ml",
    "packaging": "Cam şişe",
    "price": 1285.3,
    "brand": {
      "id": 470,
      "name": "Elite"
    },
    "category": 18,
    "country": 1,
    "manufacturer": "Elite Naturel",
    "description": "Elite Naturel %100 ananas suyu, 700 ml cam şişe, 6'lı paket.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0H6MW6CJ7) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Elite"
      },
      {
        "key": "Net Miktar",
        "value": "6 × 700 ml"
      },
      {
        "key": "Ambalaj",
        "value": "Cam şişe"
      },
      {
        "key": "Üretici",
        "value": "Elite Naturel"
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "EAN-13",
        "value": "8697404769736"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Amazon 'Üretici Referansı' / 'Ürün Model Numarası'"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0H6MW6CJ7"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj galerisinde besin değerleri tablosu yok"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
  },
  {
    "asin": "B0H6MZTHXD",
    "slug": "elite-organic-shot-defence-40-ml",
    "mediaFiles": [
      [
        "front",
        "Ön yüz",
        "00.jpg"
      ]
    ],
    "barcode": "8697404769101",
    "name": "Elite Organic Shot Defence 40 ml",
    "size": "40 ml",
    "packaging": "Cam şişe",
    "price": 305.0,
    "brand": {
      "id": 470,
      "name": "Elite"
    },
    "category": 26,
    "country": 1,
    "manufacturer": "Elite Naturel",
    "description": "Elite Organic Shot Defence: zerdeçal ve zencefil baharatlı meyveli içecek; magnezyum, çinko ve C vitamini içerir. 40 ml.\n\nVeri kaynağı: Amazon.com.tr ürün sayfası (ASIN B0H6MZTHXD) ve ürün ambalajı görselleri.",
    "items": [],
    "labels": [
      "organic"
    ],
    "storage": null,
    "usage": null,
    "specifications": [
      {
        "key": "Marka",
        "value": "Elite"
      },
      {
        "key": "Net Miktar",
        "value": "40 ml"
      },
      {
        "key": "Ambalaj",
        "value": "Cam şişe"
      },
      {
        "key": "Üretici",
        "value": "Elite Naturel"
      },
      {
        "key": "Menşe",
        "value": "Türkiye"
      },
      {
        "key": "EAN-13",
        "value": "8697404769101"
      },
      {
        "key": "Barkod Kaynağı",
        "value": "Amazon 'Üretici Referansı' / 'Ürün Model Numarası'"
      },
      {
        "key": "Amazon ASIN",
        "value": "B0H6MZTHXD"
      },
      {
        "key": "Fiyat Kaynağı",
        "value": "Amazon.com.tr — 21 Kasım 2026"
      },
      {
        "key": "Besin Tablosu",
        "value": "Ambalaj galerisinde besin değerleri tablosu yok"
      }
    ],
    "warnings": [],
    "allergens": [],
    "nutrition": null
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
    category: seed.category,
    country: seed.country ?? undefined,
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
  if (itemIds.length) {
    data.items = seed.items.map((item, index) => ({
      ingredients: itemIds[index],
      ...(item.percent != null ? { percent_estimate: item.percent } : {}),
    }))
  }
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
