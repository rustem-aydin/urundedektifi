import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Amazon.com.tr "İçecek Şurupları ve Konsantre İçecekler" kategorisinden
 * (node 28055479031) barkodu doğrulanmış ürünleri UZAK Payload REST API'sine yazar.
 *
 * Kapsam: popülerlik sıralamasında ilk 8 sayfa (192 ASIN) tarandı; 702 galeri
 * görseli ZXing ile katmanlı okundu ve tüm ürün bilgisi metinlerinde 13 hane
 * arandı. Yalnızca EAN-13'ü ambalajdan veya Amazon ürün bilgilerinden doğrulanan
 * gıda ürünleri yazılır; takviye edici gıdalar ve aksesuarlar kapsam dışıdır.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-surup-kategori-prod.ts
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
const PRICE_DATE = '2026-11-21T00:00:00.000Z'
const REQUEST_GAP_MS = Number(process.env.SEED_GAP_MS ?? 450)
const MAX_RETRIES = 4
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
  countryId: number
  categoryId: number
  items: IngredientRef[]
  additives: number[]
  labels: string[]
  nutrition?: { per: '100g' | '100ml' | 'serving'; items: { nutrient: number; amount: number; unit: string }[] }
  storage: string
  usage: string
  specifications: { key: string; value: string }[]
  media: { key: string; file: string; alt: string }[]
  additional: { key: string; caption: string }[]
}

const PRODUCTS: ProductSeed[] = [
  {
    asin: "B00LASOUAM",
    barcode: "3052910041168",
    name: "Monin Şekersiz Karamel Aromalı Şurup 700 ml",
    slug: "monin-sekersiz-karamel-700ml",
    size: "700 ml",
    packaging: "Cam şişe",
    price: 671.38,
    description: "Monin Şekersiz Karamel, kahve ve kokteyllerde kullanılan şekersiz aromalı şurupdur. 700 ml cam şişe; 1'e 8 oranında seyreltilebilir, vegandır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B00LASOUAM); EAN-13 3052910041168 Amazon 'Üretici Referansı' alanından alındı ve kontrol hanesi doğrulandı. Galeride yalnız şişe ön yüzü ve tanıtım görselleri bulunduğu için içindekiler listesi ve besin tablosu yazılmadı.",
    brand: { id: 29, name: "Monin", slug: "monin" },
    manufacturer: "GEORGES MONIN SAS",
    countryId: 57,
    categoryId: 15,
    items: [

    ],
    additives: [],
    labels: [],
    nutrition: undefined,
    storage: "Serin ve kuru yerde, güneş ışığından uzak saklayın.",
    usage: "Kahve ve kokteyllerde aroma vermek için kullanılır; 1'e 8 oranında seyreltilebilir (ürün bilgisi).",
    specifications: [
      { key: "Marka", value: "Monin" },
      { key: "Ürün Tipi", value: "Aromalı şurup (şekersiz)" },
      { key: "Aroma", value: "Karamel" },
      { key: "Net Miktar", value: "700 ml" },
      { key: "Ambalaj", value: "Cam şişe" },
      { key: "Üretici", value: "GEORGES MONIN SAS (Fransa)" },
      { key: "Seyreltme", value: "1'e 8" },
      { key: "Vegan", value: "Evet (ürün bilgisi)" },
      { key: "EAN-13", value: "3052910041168" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr ürün bilgileri, Üretici Referansı" },
      { key: "Amazon ASIN", value: "B00LASOUAM" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 671,38 TL (21 Kasım 2026)" },
      { key: "Etiket Notu", value: "Galeride arka panel (içindekiler/besin tablosu) yok; alanlar boş bırakıldı" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    media: [
      { key: "front", file: "monin-sekersiz-karamel-700ml-front.jpg", alt: "Monin Şekersiz Karamel Aromalı Şurup 700 ml — Ön yüz (700 ml şişe)" },
    ],
    additional: [

    ],
  },
  {
    asin: "B0046HOWX4",
    barcode: "3052910041175",
    name: "Monin Şekersiz Fındık Aromalı Şurup 700 ml",
    slug: "monin-sekersiz-findik-700ml",
    size: "700 ml",
    packaging: "Cam şişe",
    price: 713.35,
    description: "Monin Şekersiz Fındık, kalorisiz tatlandırıcı sukraloz kullanılarak üretilen aromalı şurupdur; hafif badem ve vanilya notalarıyla yoğun fındık tadı verir. 700 ml, 1'e 8 oranında seyreltilebilir, vegandır.\n\nİçindekiler (ambalaj): su, polidekstroz, doğal fındık aroma vericisi (%2,219) ve diğer doğal aroma vericiler, selüloz gam, tartarik asit (L(+)-), tatlandırıcılar (sukraloz, asesülfam K), koruyucular (potasyum sorbat, sodyum benzoat).\n\nVeri kaynağı: Amazon.com.tr (ASIN B0046HOWX4); EAN-13 3052910041175 Amazon 'Üretici Referansı' alanından alındı ve kontrol hanesi doğrulandı.",
    brand: { id: 29, name: "Monin", slug: "monin" },
    manufacturer: "GEORGES MONIN SAS",
    countryId: 57,
    categoryId: 15,
    items: [
      { id: 278, name: "Su" },
      { id: 331, name: "Polidekstroz" },
      { name: "Selüloz gam", slug: "seluloz-gam" },
      { name: "Tartarik asit", slug: "tartarik-asit" },
      { id: 533, name: "Sukraloz" },
      { id: 534, name: "Asesülfam K" },
      { id: 4943, name: "Potasyum sorbat" },
      { name: "Sodyum benzoat", slug: "sodyum-benzoat" },
    ],
    additives: [16, 17, 533, 534],
    labels: [],
    nutrition: undefined,
    storage: "Serin ve kuru yerde, güneş ışığından uzak saklayın.",
    usage: "Kahve ve kokteyllerde aroma vermek için kullanılır; 1'e 8 oranında seyreltilebilir (ürün bilgisi).",
    specifications: [
      { key: "Marka", value: "Monin" },
      { key: "Ürün Tipi", value: "Aromalı şurup (şekersiz)" },
      { key: "Aroma", value: "Fındık" },
      { key: "Net Miktar", value: "700 ml" },
      { key: "Ambalaj", value: "Cam şişe" },
      { key: "Üretici", value: "GEORGES MONIN SAS (Fransa)" },
      { key: "Seyreltme", value: "1'e 8" },
      { key: "Vegan", value: "Evet (ürün bilgisi)" },
      { key: "İçindekiler (Ambalaj)", value: "Su, polidekstroz, doğal fındık aroma vericisi (%2,219) ve diğer doğal aroma vericiler, selüloz gam, tartarik asit, tatlandırıcılar (sukraloz, asesülfam K), koruyucular (potasyum sorbat, sodyum benzoat)" },
      { key: "EAN-13", value: "3052910041175" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr ürün bilgileri, Üretici Referansı" },
      { key: "Amazon ASIN", value: "B0046HOWX4" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 713,35 TL (21 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    media: [
      { key: "front", file: "monin-sekersiz-findik-700ml-front.jpg", alt: "Monin Şekersiz Fındık Aromalı Şurup 700 ml — Ön yüz (700 ml şişe)" },
    ],
    additional: [

    ],
  },
  {
    asin: "B0D37G2J2J",
    barcode: "8682279230399",
    name: "Nish Irish Krema Aromalı Şurup 700 ml",
    slug: "nish-irish-krema-surup-700ml",
    size: "700 ml (70 cl)",
    packaging: "PET şişe",
    price: 359.0,
    description: "Nish Irish Krema Aromalı Şurup, sıcak-soğuk içeceklerde, tatlılarda ve kokteyllerde kullanılan aromalı şurupdur. 700 ml PET şişe.\n\nİçindekiler (etiket): şeker, su, doğala özdeş Irish Cream aroması, kıvam arttırıcı (ksantan gam E415), asitlik düzenleyici (sitrik asit E330), koruyucular (potasyum sorbat E202, sodyum benzoat E211), tatlandırıcılar (sodyum sakarin E954, sodyum siklamat E952), renklendirici (karamel E150d), toz bulanıklık verici, köpük oluşturucu madde.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0D37G2J2J) ve ürün etiketi; EAN-13 8682279230399 etiketin alt kısmındaki barkoddan okundu (8 682279 230399) ve kontrol hanesi doğrulandı.",
    brand: { name: "Nish", slug: "nish", country: "Türkiye" },
    manufacturer: "Akyıldız Kahve Gıda İhracat",
    countryId: 1,
    categoryId: 15,
    items: [
      { id: 186, name: "Şeker" },
      { id: 278, name: "Su" },
      { id: 4942, name: "Ksantan gam" },
      { id: 538, name: "Sitrik asit" },
      { id: 4943, name: "Potasyum sorbat" },
      { name: "Sodyum benzoat", slug: "sodyum-benzoat" },
      { name: "Sodyum sakarin", slug: "sodyum-sakarin" },
      { name: "Sodyum siklamat", slug: "sodyum-siklamat" },
      { name: "Karamel", slug: "karamel" },
    ],
    additives: [18, 1, 16, 17, 177, 176, 13],
    labels: [],
    nutrition: undefined,
    storage: "Serin ve kuru yerde, güneş ışığından uzak saklayın.",
    usage: "Kahve, krema, kek ve kokteyllerde aroma vermek için kullanılır (etiket).",
    specifications: [
      { key: "Marka", value: "Nish" },
      { key: "Ürün Tipi", value: "Aromalı şurup" },
      { key: "Aroma", value: "Irish Cream" },
      { key: "Net Miktar", value: "700 ml (70 cl)" },
      { key: "Ambalaj", value: "PET şişe" },
      { key: "Üretici", value: "Akyıldız Kahve Gıda İhracat" },
      { key: "Menşe", value: "Türkiye" },
      { key: "İçindekiler (Etiket)", value: "Şeker, su, doğala özdeş Irish Cream aroması, kıvam arttırıcı (ksantan gam E415), asitlik düzenleyici (sitrik asit E330), koruyucular (potasyum sorbat E202, sodyum benzoat E211), tatlandırıcılar (sodyum sakarin E954, sodyum siklamat E952), renklendirici (karamel E150d), toz bulanıklık verici, köpük oluşturucu madde" },
      { key: "EAN-13", value: "8682279230399" },
      { key: "Barkod Kaynağı", value: "Ürün etiketi (barkod görselden okundu)" },
      { key: "Amazon ASIN", value: "B0D37G2J2J" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 359,00 TL (21 Kasım 2026)" },
      { key: "Ambalaj Notu", value: "Aynı etikette 'NET: 700ML - 70CL / 23.7 FL OZ e' basılıdır" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    media: [
      { key: "front", file: "nish-irish-krema-surup-700ml-front.jpg", alt: "Nish Irish Krema Aromalı Şurup 700 ml — Ön yüz (700 ml şişe)" },
      { key: "ek1", file: "nish-irish-krema-surup-700ml-ek1.jpg", alt: "Nish Irish Krema Aromalı Şurup 700 ml — Arka yüz / etiket" },
    ],
    additional: [
      { key: "ek1", caption: "Nish Irish Krema Aromalı Şurup 700 ml — Arka yüz / etiket" },
    ],
  },
  {
    asin: "B08BKVDX54",
    barcode: "8682279233758",
    name: "Nish Beyaz Çikolata Aromalı Şurup 700 ml",
    slug: "nish-beyaz-cikolata-surup-700ml",
    size: "700 ml",
    packaging: "PET şişe",
    price: 329.18,
    description: "Nish Beyaz Çikolata Aromalı Şurup, sıcak-soğuk içeceklerde ve tatlılarda kullanılan aromalı şurupdur. 700 ml PET şişe.\n\nİçindekiler (etiket): şeker, su, doğala özdeş beyaz çikolata aroması, kıvam arttırıcı (ksantan gam E415), asitlik düzenleyici (sitrik asit E330), koruyucular (potasyum sorbat E202, sodyum benzoat E211), tatlandırıcılar (sodyum sakarin E954, sodyum siklamat E952), sıvı bulanıklık verici. Menşei: Türkiye.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08BKVDX54) ve ürün etiketi; EAN-13 8682279233758 etiket barkodundan okundu (8 682279 233758) ve kontrol hanesi doğrulandı.",
    brand: { name: "Nish", slug: "nish", country: "Türkiye" },
    manufacturer: "Akyıldız Kahve Gıda İhracat",
    countryId: 1,
    categoryId: 15,
    items: [
      { id: 186, name: "Şeker" },
      { id: 278, name: "Su" },
      { id: 4942, name: "Ksantan gam" },
      { id: 538, name: "Sitrik asit" },
      { id: 4943, name: "Potasyum sorbat" },
      { name: "Sodyum benzoat", slug: "sodyum-benzoat" },
      { name: "Sodyum sakarin", slug: "sodyum-sakarin" },
      { name: "Sodyum siklamat", slug: "sodyum-siklamat" },
    ],
    additives: [18, 1, 16, 17, 177, 176],
    labels: [],
    nutrition: undefined,
    storage: "Serin ve kuru yerde, güneş ışığından uzak saklayın.",
    usage: "Kahve, krema, kek ve kokteyllerde aroma vermek için kullanılır (etiket).",
    specifications: [
      { key: "Marka", value: "Nish" },
      { key: "Ürün Tipi", value: "Aromalı şurup" },
      { key: "Aroma", value: "Beyaz çikolata" },
      { key: "Net Miktar", value: "700 ml" },
      { key: "Ambalaj", value: "PET şişe" },
      { key: "Üretici", value: "Akyıldız Kahve Gıda İhracat" },
      { key: "Menşe", value: "Türkiye" },
      { key: "İçindekiler (Etiket)", value: "Şeker, su, doğala özdeş beyaz çikolata aroması, kıvam arttırıcı (ksantan gam E415), asitlik düzenleyici (sitrik asit E330), koruyucular (potasyum sorbat E202, sodyum benzoat E211), tatlandırıcılar (sodyum sakarin E954, sodyum siklamat E952), sıvı bulanıklık verici" },
      { key: "EAN-13", value: "8682279233758" },
      { key: "Barkod Kaynağı", value: "Ürün etiketi (barkod görselden okundu)" },
      { key: "Amazon ASIN", value: "B08BKVDX54" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 329,18 TL (21 Kasım 2026)" },
      { key: "Beyan Çelişkisi", value: "Amazon açıklaması 'yapay tatlandırıcı içermez' diyor; etikette tatlandırıcı olarak sodyum sakarin (E954) ve sodyum siklamat (E952) basılıdır. Etiket esas alındı" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    media: [
      { key: "front", file: "nish-beyaz-cikolata-surup-700ml-front.jpg", alt: "Nish Beyaz Çikolata Aromalı Şurup 700 ml — Ön yüz (700 ml şişe)" },
      { key: "ek1", file: "nish-beyaz-cikolata-surup-700ml-ek1.jpg", alt: "Nish Beyaz Çikolata Aromalı Şurup 700 ml — Arka yüz / etiket" },
    ],
    additional: [
      { key: "ek1", caption: "Nish Beyaz Çikolata Aromalı Şurup 700 ml — Arka yüz / etiket" },
    ],
  },
  {
    asin: "B0B6VP43DT",
    barcode: "8682704904499",
    name: "Simonelli Çikolatalı Kurabiye Aromalı Kahve Şurubu 700 ml",
    slug: "simonelli-kurabiye-surup-700ml",
    size: "700 ml",
    packaging: "Cam şişe + şurup pompası",
    price: 370.0,
    description: "Simonelli Chocolate Cookie Syrup, çikolatalı kurabiye aromalı kahve şurubudur; şurup pompası dahildir. 700 ml cam şişe, alkol içermez, 1'e 8 oranında kullanılması tavsiye edilir.\n\nİçindekiler (etiket): glikoz şurubu/mısır şurubu, su, şeker, aroma verici (çikolatalı kurabiye), asitlik düzenleyici (E330), koruyucular (E202, E211), renklendirici (E150a).\n\nVeri kaynağı: Amazon.com.tr (ASIN B0B6VP43DT) ve ürün etiketi; EAN-13 8682704904499 etiket barkodundan okundu (8 682704 904499) ve kontrol hanesi doğrulandı.",
    brand: { name: "Simonelli", slug: "simonelli", country: "Türkiye" },
    manufacturer: "FM Kahve Sanayi ve Dış Tic. Ltd. Şti.",
    countryId: 1,
    categoryId: 15,
    items: [
      { name: "Glikoz şurubu", slug: "glikoz-surubu" },
      { id: 278, name: "Su" },
      { id: 186, name: "Şeker" },
      { id: 538, name: "Sitrik asit" },
      { id: 4943, name: "Potasyum sorbat" },
      { name: "Sodyum benzoat", slug: "sodyum-benzoat" },
      { name: "Karamel", slug: "karamel" },
    ],
    additives: [1, 16, 17, 95],
    labels: [],
    nutrition: undefined,
    storage: "Serin ve kuru yerde, güneş ışığından uzak saklayın.",
    usage: "Kahvelerde, kremalarda, tatlılarda ve kokteyllerde 1'e 8 oranında kullanılır (etiket).",
    specifications: [
      { key: "Marka", value: "Simonelli" },
      { key: "Ürün Tipi", value: "Aromalı kahve şurubu" },
      { key: "Aroma", value: "Çikolatalı kurabiye" },
      { key: "Net Miktar", value: "700 ml" },
      { key: "Ambalaj", value: "Cam şişe, şurup pompası dahil" },
      { key: "Üretici", value: "FM Kahve Sanayi ve Dış Tic. Ltd. Şti. (İstanbul)" },
      { key: "İşletme Kayıt No", value: "TR-34-K-130131" },
      { key: "Sertifika", value: "ISO 22000, ISO 9001 (etiket)" },
      { key: "İçindekiler (Etiket)", value: "Glikoz şurubu/mısır şurubu, su, şeker, aroma verici (çikolatalı kurabiye), asitlik düzenleyici (E330), koruyucular (E202, E211), renklendirici (E150a)" },
      { key: "Kullanım Oranı", value: "1'e 8 (etiket)" },
      { key: "Alkol", value: "İçermez" },
      { key: "EAN-13", value: "8682704904499" },
      { key: "Barkod Kaynağı", value: "Ürün etiketi (barkod görselden okundu)" },
      { key: "Amazon ASIN", value: "B0B6VP43DT" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 370,00 TL (21 Kasım 2026)" },
      { key: "Ambalaj Notu", value: "Amazon başlığında '70 cl' yazıyor; etikette NET: 700 ML basılıdır (aynı miktar)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    media: [
      { key: "front", file: "simonelli-kurabiye-surup-700ml-front.jpg", alt: "Simonelli Çikolatalı Kurabiye Aromalı Kahve Şurubu 700 ml — Ön yüz (şişe ve pompa)" },
      { key: "ek1", file: "simonelli-kurabiye-surup-700ml-ek1.jpg", alt: "Simonelli Çikolatalı Kurabiye Aromalı Kahve Şurubu 700 ml — Etiket (içindekiler ve üretici)" },
    ],
    additional: [
      { key: "ek1", caption: "Simonelli Çikolatalı Kurabiye Aromalı Kahve Şurubu 700 ml — Etiket (içindekiler ve üretici)" },
    ],
  },
  {
    asin: "B0HGRSYVKQ",
    barcode: "8682125480091",
    name: "Beyorganik Organik İçilebilir Çikolata 170 g",
    slug: "beyorganik-icilebilir-cikolata-170g",
    size: "170 g",
    packaging: "Poşet / kutu",
    price: 545.94,
    description: "BEYORGANİK Organik İçilebilir Çikolata, süt ile hazırlanan organik içecek tozudur. 170 g.\n\nBileşim (ürün bilgisi): %56 organik hurma tozu, %40 organik keçiboynuzu unu, %4 organik kakao. Pestisit analizi yapılmıştır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0HGRSYVKQ); EAN-13 8682125480091 Amazon 'Üretici Referansı' alanından alındı ve kontrol hanesi doğrulandı.",
    brand: { id: 5577, name: "Beyorganik", slug: "beyorganik" },
    manufacturer: "BEYORGANIK",
    countryId: 1,
    categoryId: 16,
    items: [
      { name: "Hurma tozu", slug: "hurma-tozu" },
      { name: "Keçiboynuzu unu", slug: "keciboynuzu-unu" },
      { name: "Kakao tozu", slug: "kakao-tozu" },
    ],
    additives: [],
    labels: ["organic"],
    nutrition: undefined,
    storage: "Serin ve kuru yerde saklayın; ambalajı açıldıktan sonra kapalı tutun.",
    usage: "Bir su bardağı (200 ml) soğuk veya sıcak süte iki tatlı kaşığı karışım ekleyip karıştırın (ürün bilgisi).",
    specifications: [
      { key: "Marka", value: "Beyorganik" },
      { key: "Ürün Tipi", value: "İçilebilir çikolata tozu (içecek)" },
      { key: "Net Miktar", value: "170 g" },
      { key: "Bileşim", value: "Organik hurma tozu %56, organik keçiboynuzu unu %40, organik kakao %4" },
      { key: "Sertifika", value: "Organik, pestisit analizli (ürün bilgisi)" },
      { key: "Üretici", value: "BEYORGANIK" },
      { key: "Hazırlanış", value: "200 ml soğuk veya sıcak süte 2 tatlı kaşığı karışım (ürün bilgisi)" },
      { key: "EAN-13", value: "8682125480091" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr ürün bilgileri, Üretici Referansı" },
      { key: "Amazon ASIN", value: "B0HGRSYVKQ" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 545,94 TL (21 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    media: [
      { key: "front", file: "beyorganik-icilebilir-cikolata-170g-front.jpg", alt: "Beyorganik Organik İçilebilir Çikolata 170 g — Ön yüz (170 g ambalaj)" },
    ],
    additional: [

    ],
  },
  {
    asin: "B0H8QFTP62",
    barcode: "8684501096117",
    name: "Naturetime Premium Kızılcık Özü 700 g",
    slug: "naturetime-kizilcik-ozu-700g",
    size: "700 g",
    packaging: "Cam kavanoz",
    price: 269.0,
    description: "Naturetime Premium Kızılcık Özü, kızılcık meyvesinden elde edilen konsantre meyve özüdür. 700 g; glütensiz, katkısız ve koruyucu içermez.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0H8QFTP62); EAN-13 8684501096117 Amazon 'Üretici Referansı' alanından alındı ve kontrol hanesi doğrulandı. Galeride içindekiler/besin tablosu paneli bulunmadığı için bu alanlar boş bırakıldı.",
    brand: { name: "Naturetime", slug: "naturetime", country: "Türkiye" },
    manufacturer: "Naturetime Premium",
    countryId: 1,
    categoryId: 16,
    items: [
      { name: "Kızılcık", slug: "kizilcik" },
    ],
    additives: [],
    labels: ["gluten-free", "no-additives"],
    nutrition: undefined,
    storage: "Serin ve kuru yerde saklayın; açıldıktan sonra buzdolabında muhafaza edin.",
    usage: "Kullanım önerisi ambalajda belirtilmemiştir (ürün bilgisi).",
    specifications: [
      { key: "Marka", value: "Naturetime" },
      { key: "Ürün Tipi", value: "Meyve özü (konsantre)" },
      { key: "Meyve", value: "Kızılcık" },
      { key: "Net Miktar", value: "700 g" },
      { key: "Ambalaj", value: "Cam kavanoz" },
      { key: "Üretici", value: "Naturetime Premium" },
      { key: "Beyan", value: "Glütensiz, katkısız, koruyucu içermez (ürün bilgisi)" },
      { key: "EAN-13", value: "8684501096117" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr ürün bilgileri, Üretici Referansı" },
      { key: "Amazon ASIN", value: "B0H8QFTP62" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 269,00 TL (21 Kasım 2026)" },
      { key: "Etiket Notu", value: "Galeride içindekiler ve besin tablosu paneli yok; alanlar boş bırakıldı" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    media: [
      { key: "front", file: "naturetime-kizilcik-ozu-700g-front.jpg", alt: "Naturetime Premium Kızılcık Özü 700 g — Ön yüz (700 g kavanoz)" },
    ],
    additional: [

    ],
  },
  {
    asin: "B0HMCHYT5J",
    barcode: "8690178001798",
    name: "Hayfene Pumpkin Spice Ekstraktı 100 ml",
    slug: "hayfene-pumpkin-spice-ekstrakt-100ml",
    size: "100 ml",
    packaging: "Cam şişe (damlalıklı)",
    price: 350.55,
    description: "Hayfene Pumpkin Spice Ekstraktı, balkabağı ve baharat karışımından hazırlanan, kahve ve tatlı içeceklerde kullanılan aromalı ekstrakttır. 100 ml.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0HMCHYT5J); EAN-13 8690178001798 Amazon 'Üretici Referansı' alanından alındı ve kontrol hanesi doğrulandı. Galeride içindekiler/besin tablosu paneli bulunmadığı için bu alanlar boş bırakıldı.",
    brand: { id: 1959, name: "Hayfene", slug: "hayfene" },
    manufacturer: "Hayfene",
    countryId: 1,
    categoryId: 15,
    items: [

    ],
    additives: [],
    labels: [],
    nutrition: undefined,
    storage: "Serin ve kuru yerde, güneş ışığından uzak saklayın.",
    usage: "Kahve, tatlı ve içeceklere aroma vermek için kullanılır (ürün bilgisi).",
    specifications: [
      { key: "Marka", value: "Hayfene" },
      { key: "Ürün Tipi", value: "Aromalı ekstrakt" },
      { key: "Aroma", value: "Pumpkin spice (balkabağı-baharat)" },
      { key: "Net Miktar", value: "100 ml" },
      { key: "Ambalaj", value: "Cam şişe" },
      { key: "Üretici", value: "Hayfene" },
      { key: "EAN-13", value: "8690178001798" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr ürün bilgileri, Üretici Referansı" },
      { key: "Amazon ASIN", value: "B0HMCHYT5J" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 350,55 TL (21 Kasım 2026)" },
      { key: "Etiket Notu", value: "Galeride içindekiler ve besin tablosu paneli yok; alanlar boş bırakıldı" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    media: [
      { key: "front", file: "hayfene-pumpkin-spice-ekstrakt-100ml-front.jpg", alt: "Hayfene Pumpkin Spice Ekstraktı 100 ml — Ön yüz (100 ml şişe)" },
    ],
    additional: [

    ],
  },
  {
    asin: "B0DPT5L614",
    barcode: "8683717903226",
    name: "Hanzade Bitkisel Gilaburu Suyu Nektarı 1 L",
    slug: "hanzade-gilaburu-nektari-1l",
    size: "1 L",
    packaging: "Cam şişe",
    price: 479.0,
    description: "Hanzade Bitkisel Gilaburu Suyu Nektarı, gilaburu meyvesinden üretilen, şeker ilavesiz nektardır. 1 L cam şişe; meyve pulpu en az %40.\n\nİçindekiler (etiket): su, gilaburu meyvesi (Viburnum opulus), kırmızı pancar (Beta vulgaris L.) %0,01.\n\nBesin öğeleri (etiket, 100 ml): C vitamini 26,80 mg, demir 10,83 mg, sodyum 15,20 mg, çinko 6,48 mg.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0DPT5L614) ve ürün etiketi; EAN-13 8683717903226 etiket barkodundan okundu ve kontrol hanesi doğrulandı. Gıda işletmecisi: Lokman Hekim Salih Yıldırım, Aydar Mah. 1009. Cad. No:16/A Yenimahalle/Ankara; işletme kayıt no TR-42-K-000054.",
    brand: { name: "Hanzade Bitkisel", slug: "hanzade-bitkisel", country: "Türkiye" },
    manufacturer: "Lokman Hekim Salih Yıldırım",
    countryId: 1,
    categoryId: 16,
    items: [
      { id: 278, name: "Su" },
      { name: "Gilaburu", slug: "gilaburu" },
      { name: "Kırmızı pancar", slug: "kirmizi-pancar" },
    ],
    additives: [],
    labels: ["vegan"],
    nutrition: {
        per: "100ml" as const,
        items: [
          { nutrient: 27, amount: 26.8, unit: "mg" },
          { nutrient: 39, amount: 10.83, unit: "mg" },
          { nutrient: 21, amount: 15.2, unit: "mg" },
          { nutrient: 41, amount: 6.48, unit: "mg" },
        ],
      },
    storage: "Serin ve kuru yerde saklayın; açıldıktan sonra buzdolabında muhafaza edin.",
    usage: "Şeker ilavesiz nektar; soğuk servis edilir (ürün bilgisi).",
    specifications: [
      { key: "Marka", value: "Hanzade Bitkisel" },
      { key: "Ürün Tipi", value: "Meyve nektarı (şeker ilavesiz)" },
      { key: "Meyve", value: "Gilaburu (Viburnum opulus)" },
      { key: "Net Miktar", value: "1 L" },
      { key: "Ambalaj", value: "Cam şişe" },
      { key: "Meyve Pulpu", value: "En az %40 (etiket)" },
      { key: "İçindekiler (Etiket)", value: "Su, gilaburu meyvesi (Viburnum opulus), kırmızı pancar (Beta vulgaris L.) %0,01" },
      { key: "Gıda İşletmecisi", value: "Lokman Hekim Salih Yıldırım, Aydar Mah. 1009. Cad. No:16/A Yenimahalle/Ankara" },
      { key: "İşletme Kayıt No", value: "TR-42-K-000054" },
      { key: "Menşe", value: "Türkiye" },
      { key: "Vegan", value: "Evet (etiket logosu)" },
      { key: "EAN-13", value: "8683717903226" },
      { key: "Barkod Kaynağı", value: "Ürün etiketi (barkod görselden okundu)" },
      { key: "Amazon ASIN", value: "B0DPT5L614" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 479,00 TL (21 Kasım 2026)" },
      { key: "Besin Verisi Notu", value: "Etikette tam besin tablosu yok; yalnız C vitamini, demir, sodyum ve çinko miktarları 100 ml için basılıdır. Bunlar 'Besin Öğeleri' olarak işlendi, enerji/makro değerler yazılmadı" },
    ],
    media: [
      { key: "front", file: "hanzade-gilaburu-nektari-1l-front.jpg", alt: "Hanzade Bitkisel Gilaburu Suyu Nektarı 1 L — Ön yüz (1 L şişe)" },
      { key: "ek1", file: "hanzade-gilaburu-nektari-1l-ek1.jpg", alt: "Hanzade Bitkisel Gilaburu Suyu Nektarı 1 L — Etiket (içindekiler, besin öğeleri, barkod)" },
    ],
    additional: [
      { key: "ek1", caption: "Hanzade Bitkisel Gilaburu Suyu Nektarı 1 L — Etiket (içindekiler, besin öğeleri, barkod)" },
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
      if (!/ 429:| 5\d\d:/.test(String(error))) throw error
      await sleep(1500 * (attempt + 1) * (attempt + 1))
    }
  }
  throw lastError
}

async function assertIngredient(client: PayloadClient, id: number, name: string) {
  const doc = await paused(() =>
    client.find('ingredients', { where: { id: { equals: id } }, limit: 1 }),
  )
  const found = doc.docs[0] as { name?: string } | undefined
  if (!found) throw new Error(`Icindekiler kaydi yok: ${id}`)
  if (String(found.name).toLocaleLowerCase('tr') !== name.toLocaleLowerCase('tr')) {
    throw new Error(`Icindekiler adi uyusmuyor: ${id} -> ${String(found.name)} != ${name}`)
  }
}

async function ensureBrand(client: PayloadClient, brand: BrandRef): Promise<number> {
  if (brand.id) {
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
    const bySlug = await paused(() =>
      client.findOne('ingredients', { slug: { equals: ref.slug } }),
    )
    if (bySlug) return bySlug.id
  }
  const created = await paused(() => client.create('ingredients', { name: ref.name, slug: ref.slug }))
  console.log(`  + icindekiler: ${ref.name} (${created.id})`)
  return created.id
}

async function ensureMedia(
  client: PayloadClient,
  seed: ProductSeed,
): Promise<Record<string, number>> {
  const ids: Record<string, number> = {}
  for (const image of seed.media) {
    const existing = await paused(() => client.findOne('media', { alt: { equals: image.alt } }))
    if (existing) {
      ids[image.key] = existing.id
      continue
    }
    const created = await paused(() =>
      client.upload('media', path.join(IMAGE_ROOT, seed.slug, image.file), { alt: image.alt }),
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
    category: seed.categoryId,
    manufacturer: seed.manufacturer,
    country: seed.countryId,
    size: seed.size,
    packaging: seed.packaging,
    items: itemIds.map((id) => ({ ingredients: id })),
    additives: seed.additives,
    labels: seed.labels,
    specifications: seed.specifications,
    warnings: [],
    storage: seed.storage,
    usage: seed.usage,
    model: seed.asin,
    sku: `AMZ-${seed.asin}`,
    prices: [{ amount: seed.price, date: PRICE_DATE }],
    frontImage: media.front,
    additionalImages: seed.additional.map((entry) => ({
      image: media[entry.key],
      caption: entry.caption,
    })),
    status: 'published' as const,
  }
  if (seed.nutrition) data.nutrition = seed.nutrition

  const existing = await paused(() =>
    client.findOne('products', { barcode: { equals: seed.barcode } }),
  )
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
