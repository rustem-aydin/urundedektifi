# Markadaki genel boykot bayrağı kaldırıldı

## Durum

Kabul edildi — 2026-10-31

## Bağlam

`brands` koleksiyonunda `isBoycotted` (checkbox) + `boycottReason` (textarea) alanları vardı. Bayrak
iki şeyi besliyordu:

1. Ürün Dosyası başlığında üst seviye **"Boykotlu marka"** damgası
   (`src/app/(frontend)/urun/[barcode]/page.tsx`).
2. `brand_boycotted` kural tipi: "marka boykotlu işaretliyse eşleş" kuralı
   (`src/lib/verdictEngine.ts`, `SCAN_FIELDS_BY_RULE_TYPE`).

ADR 0016 ile boykot bilgisi zaten marka başına bir **uzman kuralı** olarak yazılıyor: her marka
kendi durumuyla (`Boykot` · `İkincil Boykot` · `Ahlaken Boykot` · Şüpheli · Araştırılıyor · Uygun)
tek bir `brand` kuralına sahip ve hüküm oradan geliyor. Bu yüzden bayrak ikinci bir doğruluk kaynağı
hâline gelmişti:

- Aynı gerçeği iki yerde tutuyordu (bayrak + marka kuralı); kural güncellenip bayrak unutulunca ürün
  dosyası damgası ile hüküm çelişebiliyordu.
- "Genel olarak boykotlu" bir marka kararı, ürün kategorisine/ülkesine göre değişebilen uzman
  değerlendirmesini gölgeliyordu.
- `brand_boycotted` kural tipi, ADR 0016'nın genel `brand_boycotted` kuralını kaldırmasından sonra
  yalnız elle kurulmuş eski kayıtlarda yaşıyordu; yeni akışta üretilmiyordu.

Karar mercii tek olmalı: **Boykot Dedektifi uzmanı** (ileride başka uzmanlar da) marka hakkındaki
hükmü kuralıyla verir.

## Karar

`brands.is_boycotted` ve `brands.boycott_reason` alanları kaldırıldı; onlara bağlı tüm tüketiciler
de temizlendi.

### Şema

Migration `20261031_120000_drop_brand_boycott_fields` (idempotent DDL):

- `ALTER TABLE brands DROP COLUMN is_boycotted / boycott_reason`.
- `expert_rules` içinden `rule_type = 'brand_boycotted'` satırları **silinir** — bayrak kalkınca bu
  tür kurallar hiçbir zaman eşleşmez, yani ölü kayıttır.
- `enum_expert_rules_rule_type` yeniden oluşturulup `brand_boycotted` değeri çıkarılır (Postgres tek
  enum değeri silemez; tip yeniden yaratılır, sütun `USING` ile taşınır, eski tip düşürülür).

### Kod

| Yer | Değişiklik |
|---|---|
| `src/collections/Brands.ts` | İki alan silindi; panel açıklaması "hükümler uzman kurallarından gelir" oldu; `defaultColumns` → `['name', 'country']` |
| `src/collections/ExpertRules.ts` | `brand_boycotted` kural tipi seçenekten çıktı |
| `src/lib/verdictEngine.ts` | `case 'brand_boycotted'` değerlendirmesi silindi |
| `src/lib/productCase.ts` | `ProductCase.brand` artık `{ id, name }`; tarama select'inden `brand_boycotted` çıktı |
| `src/lib/ruleLabels.ts` | Etiket silindi |
| `src/app/(frontend)/urun/[barcode]/page.tsx` | "Boykotlu marka" damgası ve kullanılmayan `VerdictStamp` import'u silindi |
| `src/lib/seed/boykotDedektifi.ts` | `BrandSeedData` yalnız `name/slug/country/description`; derece tanımlarında `boycotted` bayrağı ve `buildBrandReason` kaldırıldı |

### Sonuç

- Marka hakkındaki hüküm (boykot dahil) **tek kaynaktan**, uzman kuralından gelir; marka üzerinde
  karar tutulmaz.
- Ürün dosyasında üst seviye "Boykotlu marka" damgası yok; boykot sonucu uzman kuralının hükmü
  olarak, gerekçesiyle birlikte görünür.
- Bayrak ile kural arasındaki çelişki olasılığı ortadan kalktı; panelde marka formu kısaldı.

## Değerlendirilen seçenekler

- **Bayrağı bırakıp yalnız `brand_boycotted` kural tipini kaldırmak**: damga kalır, iki kaynak
  sürer; reddedildi.
- **Bayrağı salt "hızlı işaretleme" olarak tutup periyodik kurala senkronize etmek**: senkron işi ve
  çelişki penceresi getirir, kazanç yok; reddedildi.
- **Bayrağı silmeden gizlemek (`admin.hidden`)**: sütunlar ve API alanı yaşamaya devam eder, veri
  iki yerde kalır; reddedildi.

## İlgili

- ADR 0016 — Boykot Dedektifi veri setinin tamamının uzman kuralı olarak alınması (marka başına bir
  `brand` kuralı; `isBoycotted` yalnız ilk üç durumda işaretleniyordu).
- `CONTEXT.md` — **Boykotlu** sözlük maddesi kaldırıldı, **Boykot Durumu** tek karar kaynağı olarak
  güncellendi.
