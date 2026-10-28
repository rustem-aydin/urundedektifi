# ADR 0017 — Ülke master listesinin BM üyesi 193 ülkeye tamamlanması

- Durum: Kabul edildi
- Tarih: 2026-10-28
- İlgili: `src/lib/seed/unCountries.ts`, `src/lib/seed/countries.ts`,
  `src/lib/barcodePrefixes.ts`, `src/collections/Countries.ts`,
  `scripts/seed-countries.ts`, `scripts/seed-countries-prod.ts`

## Bağlam

"Ülkeler" koleksiyonu üretimde yalnız 2 (İsrail, Türkiye), yerelde 7 kayıt taşıyordu.
Ürün formundaki üretim yeri seçimi ve uzman kurallarının ülke koşulu bu listeye bağlı;
liste eksikken kullanıcı ülke bulamıyor, ülke kuralı yazamıyordu. Elle ekleme 193 kayıtta
sürdürülemez ve ad tutarsızlığı barkod → ülke otomasyonunu (ad eşleşmesi) sessizce kırar.

GS1 prefix tablosu da tam değildi: 20'den fazla ülke hiç yoktu (İsveç, Venezuela, Fas,
Nijerya, Kenya, Tanzanya, Ürdün, Kuzey Makedonya, Malta, İrlanda, Pakistan…) ve bazı
aralıklar yanlış ülkeye bağlıydı (730–739 Meksika yazıyordu, doğrusu İsveç; 622–623
Ürdün yazıyordu, doğrusu 622 Mısır / 623 Brunei; 740–746 Orta Amerika aralığı bir
kaymıştı). Bu hatalar yeni ülkelere yanlış `code` yazacaktı.

## Karar

- **Tek veri kaynağı kod içinde.** BM üyesi 193 ülke, Türkçe ad + ISO 3166-1 alpha-2
  olarak `src/lib/seed/unCountries.ts` içinde tutulur. BM gözlemci devletleri (Filistin,
  Vatikan) listeye dahil değildir.
- **Adlar GS1 tablosuyla birebir.** `PREFIX_RULES` içindeki ülke adlarıyla aynı yazım
  kullanılır (`Amerika Birleşik Devletleri`, `Bosna Hersek`, `Çek Cumhuriyeti`, `Kıbrıs`,
  `Güney Kore`, `Kuzey Kore`). Ürün oluştururken barkod prefix'inden bulunan ad
  `countries.name` ile eşleştiği için bu zorunludur.
- **GS1 verisi ülkeye bağlanır, elle yazılmaz.** `buildCountrySeed()` ülke kayıtlarını
  `getAllCountries()` (prefix tablosundan türetilen ana prefix + ek prefixler) ile
  birleştirir. 109 ülke GS1 kodlu gelir; kalan 84 ülke kodsuz kaydedilir (GS1 aralığı yok).
- **Prefix tablosu düzeltildi ve genişletildi.** Yukarıdaki hatalı aralıklar doğru
  ülkelere bağlandı, eksik ülkeler eklendi. Tabloda kalan GS1 bölgeleri (Tayvan,
  Hong Kong, Makao, GS1 Küresel, ISBN/ISSN, kupon) yalnız barkod tespiti için tutulur,
  "Ülkeler" listesine yazılmaz.
- **Seed idempotent ve iki ortak.** `planCountrySeed()` mevcut kayıtları ISO (yoksa ad)
  ile eşler; yalnız farklı alanları günceller, elle girilmiş GS1 kodunu (GS1 aralığı
  olmayan ülkede) korur, slug'a dokunmaz. `pnpm seed:countries` yerel Local API'ye,
  `pnpm seed:countries:prod` uzak REST API'ye aynı planı yazar.
- **Slug varsayılanı kaldırıldı.** `Countries.slug` alanındaki `defaultValue: 'turkey'`
  yüzünden varsayılan değer hook'tan önce uygulanıyor, her yeni ülke `turkey` slug'ıyla
  yaratılıyordu; ikinci ülkede benzersizlik hatası veriyordu. Slug artık `slugify()` ile
  addan üretilir (diğer koleksiyonlarla aynı kaynak).

## Sonuçlar

- Yerel veritabanı: 193 ülke, 430 ek prefix satırı; mevcut 7 kaydın kimliği/slug'ı korundu,
  ISO ve kodları tamamlandı.
- Üretim veritabanı: aynı seed `pnpm seed:countries:prod` ile yazıldı (193 ülke, 109 GS1
  kodlu, 9.4 bin ürüne dokunmadan). Tekrar çalıştırma 0 yazar; betik yönetici kimliği
  (`SEED_EMAIL`, `SEED_PASSWORD`) ister.
- Barkod otomasyonu yalnız GS1'i olan 109 ülkeyi doldurabilir; kodsuz ülkelerde kullanıcı
  seçimi gerekir. GS1 aralığı olan ama BM üyesi olmayan bölgelerde (ör. Tayvan) ülke
  atanmaz — kayıt listede yok.
- Düzeltilmiş prefix tablosu üretime ancak derleme yayınlandığında yansır: yeni derleme öncesi
  üretimde `731…` barkodu "Meksika" atıyordu; yayından sonra "İsveç" atıyor.

## Ürünlerin ülke ile eşleştirilmesi

`scripts/fill-product-countries.ts` (`pnpm products:countries`) mevcut ürünleri tarar ve
`Üretim Yeri Ülke` alanını barkodun GS1 prefix'inden doldurur. Kuru çalışma varsayılandır;
`--apply` yazar, dolu ama farklı kayıtlar yalnız `--overwrite` ile düzeltilir.

- 10.244 ürün tarandı: 8.341'i zaten barkoduyla tutarlıydı, 1.716 ülkesiz ürün dolduruldu,
  4 hatalı kayıt (3 Birleşik Krallık, 1 Avusturya barkodu "Türkiye" işaretliydi) düzeltildi.
- GTIN-14 barkodlarda ambalaj göstergesi atlanarak ikinci haneden prefix aranır
  (6 + 869… → Türkiye); bu kural 7 ürünü daha çözdü ve yeni ürünlerde de geçerli.
- 174 ürün eşleşmedi: barkodları GS1 ülke aralığı taşımıyor (150/169/200/251/668 gibi
  atanmamış prefixler, kısa/hatalı kodlar) veya GS1 bölgesi (ISBN, Tayvan, Makao).
  Bu kayıtlar için ülke uydurulmadı; liste `scripts/.off-cache/product-country-leftovers.json`
  dosyasına yazıldı (yeniden üretilebilir, depoya girmez).
- Üretim sonucu: 10.070/10.244 ürünün üretim ülkesi dolu.
