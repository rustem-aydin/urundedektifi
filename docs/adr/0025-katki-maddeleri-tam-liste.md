# ADR 0025 — Katkı maddeleri master listesinin tamamlanması ve adlandırma standardı

- Durum: Kabul edildi
- Tarih: 2026-11-01
- İlgili: ADR 0019 (E-kodu opsiyonel), `src/collections/Additives.ts`,
  `src/lib/seed/data/additives-world.json`, `scripts/seed-additives-prod.ts`

## Bağlam

`additives` listesi 196 kayıttı ve çoğu kaydın adı E-kodunun kendisiydi (`E621` kaydının adı
"E621"). Open Food Facts aktarımı (`scripts/lib/off-import.ts`) katkıyı yalnız `en:e621` etiketiyle
görünce `name: ADDITIVE_NAMES[code] ?? code` yazdığı için ad alanı koda düşmüştü; aynı kodun
Türkçe/İngilizce adı hiç yazılmadı. Ayrıca kod alanına ham OFF etiketi sızmış beş kayıt vardı
(`MONO-AND-DIGLYCERIDES-OF-VEGETABLE-FATTY-ACIDS`, `CA:CARBONAT-…`, `XX:E386`) ve üç ayrı
kodsuz kayıt aynı kimyasalların Türkçe adlarıyla duruyordu (Soya Lesitini, Sodyum Hidrojen
Karbonat, Amonyum Hidrojen Karbonat). Sonuç: ürün dosyası "E621 içeriyor" diyor, panelde
arama yapılamıyor, kural eklerken hangi katkının seçildiği anlaşılmıyordu.

## Karar

- **Katalog tek dosyada ve koddan ayrı:** `src/lib/seed/data/additives-world.json`
  (`additives`: E-kodlu satırlar, `groups`: E-kodu olmayan ortak kayıtlar). Veri güncellemesi
  kod değişikliği gerektirmez.
- **Kaynak:** Türk Gıda Kodeksi Gıda Katkı Maddeleri Yönetmeliği (RG 13.10.2023/32338) ve
  AB Katkı Maddeleri Veritabanı'nın kapsadığı E100–E1521 aralığı, Open Food Facts
  `additives` taksonomisiyle (766 kayıt, 728'i E-kodlu) çaprazlandı. OFF'ta yalnız yer tutucu
  adı olan 57 satır (ör. "E450viii") katalog dışı bırakıldı; gerçek adı olan **673** satır alındı.
- **Türkçe ad zorunlu:** Her kaydın `name` alanı Türkçe kimyasal adıdır; İngilizce ad ve OFF'un
  Türkçe etiketi `aliases[]` alanına yazılır (`alias` satırı). `title` (otomatik) `E330 · Sitrik Asit`.
  Adlar Türkçe başlık kuralına uyar: küçük harfli bağlaçlar (`ve`, `ile`, `veya`), kısaltmalar
  (`MSG`, `BHA`, `DATEM`, `EDTA`) ve ölçü/kod parçaları (`C30`, `N2O`) büyük kalır.
- **Fonksiyon, risk, helal, vegan alanları doldurulur.** `function` OFF sınıfları + E-kod
  aralığı kuralıyla (E100–199 renklendirici, E200–299 koruyucu, E620–699 aroma arttırıcı,
  E1400–1452 kıvam arttırıcı, asit/tuz aralıkları asitlik düzenleyici), `riskLevel` yalnız
  belgelenmiş sağlık endişesi olan kayıtlarda (13 `high`, 36 `medium`; ör. Southampton
  boyaları, E171, nitritler, IARC 2B sınıfı BHA/aspartam), `halalStatus`/`isVegan` OFF vegan
  verisi + hayvansal kaynak incelemesiyle. Boş alan "değerlendirilmedi" demektir; uydurma
  değer yazılmaz.
- **Açıklama:** Bilinen kayıtlarda (E330, E322, E621, E250, E120, E951, E960, E171…) elde
  yazılmış açıklama; kalanlarda fonksiyondan türetilmiş tek cümle. Risk notu ve helal gerekçesi
  açıklamanın sonuna eklenir.
- **Kodsuz ortak kayıtlar:** "Modifiye Nişastalar" (E1400–E1452 grubu) ve "Sodyum Hidrojen
  Karbonat ve Disodyum Difosfat" kodsuz kayıt olarak durur; ADR 0019'un "kod opsiyonel, ad
  zorunlu" kuralı bu sayede grup etiketlerini de taşıyabilir.
- **Üretim onarımı betikle:** `scripts/seed-additives-prod.ts` idempotent upsert yapar ve
  artık satırları hedefe birleştirir: ürün ilişkileri taşınır, sonra satır silinir. Betik
  ikinci çalıştırmada `Yeni: 0 · güncellenen: 0` demelidir; Payload dizi satırlarına kendi
  `id`'sini eklediği için karşılaştırma yalnız `alias`/`title`+`url` değerlerine bakar.

## Sonuçlar

- Üretim listesi 196 → **675** kayıt (673 kodlu + 2 kodsuz). Beş artık satır birleştirildi:
  `MONO-AND-DIGLYCERIDES…`→E471 (6 ürün), `XX:E386`→E386, `CA:CARBONAT…` ve
  `Sodyum Hidrojen Karbonat Ve…`→kodsuz doğru ad, `Soya Lesitini`→E322I, `E14XX`→Modifiye
  Nişastalar; `Sodyum/Amonyum Hidrojen Karbonat`→E500II/E503II. Ürün ilişkileri taşındı,
  eski kimliklere referans kalmadı.
- Panelde ve Ekle sihirbazında katkı artık adıyla okunur (`E621 · Monosodyum Glutamat (MSG)`),
  arama ad/alias üzerinden yapılabilir; kural eklerken `additive_code` seçimi anlamlıdır.
- Ürün dosyası katkıyı `kod · ad` olarak basar; kodsuz kayıtta yalnız ad görünür (ADR 0019).
- Doğrulama: seed iki kez çalıştırıldı (ikinci tur 0/0), `GET /api/additives?limit=1000`
  → 675 kayıt, kod formatı bozuk kayıt yok, `name == code` yok, tekrar eden ad yok, açıklama
  ve kaynak eksik kayıt yok; `/urun/8698881884394` katkıları `E322I · Lesitin`,
  `E500II · Sodyum Hidrojen Karbonat (Yemek Sodası)`, `E503II · Amonyum Hidrojen Karbonat`
  olarak bastı. `npx tsc --noEmit` ve `pnpm test:int` (18 test) temiz.
