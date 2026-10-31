# ADR 0022 — Ürün kategorilerinde üst/alt taksonomi

- Durum: Kabul edildi
- Tarih: 2026-10-31
- İlgili: `src/lib/categoryTree.ts`, `scripts/lib/category-taxonomy.ts`, `scripts/seed-categories*.ts`

## Bağlam

Open Food Facts içe aktarıcısı (`scripts/lib/off-import.ts`) kategori etiketlerini tek
düzeyli bir listeye indiriyordu: 30+ kategori yan yana duruyor, aynı tür birden çok kayıtta
tekrarlanıyordu (`i-cecekler`/`icecekler`, `caylar`/`kahve-cay`, `meyve-nektari`/`meyve-suyu`).
CMS'te `categories.parent` alanı zaten vardı ama hiç bağ kurulmamıştı; web `/kategoriler`
sayfası yalnız kök kartları gösteriyordu. Sonuç: kullanıcı için gezilemez, kural yazımı için
belirsiz bir ağaç.

## Karar

- **Tek kaynak: `scripts/lib/category-taxonomy.ts`.** Ağaç (13 üst + alt kategoriler) ve
  slug'lar `slugify(name)` ile orada tanımlıdır; yerel (`seed-categories.ts`, Local API) ve
  uzak (`seed-categories-prod.ts`, REST) betikleri aynı listeyi uygular. Slug üretimi içe
  aktarıcıyla aynı fonksiyona dayandığı için OFF aktarımı mevcut kayıtları günceller,
  kopya üretmez.
- **İki düzey yeterli.** Ürün ↔ kategori ilişkisi tek olduğundan daha derin ağaç yalnız
  gezinme karmaşıklığı getirir; `loadCategoryTree` yine de sınırsız derinliği destekler
  (döngü korumalı), sayfa bugünkü çıktıyı üç düzeye kadar girintiler.
- **Yinelenen kategoriler birleştirilir.** `DUPLICATE_CATEGORY_MERGES` ürünleri, uzman
  kuralı `productType` referanslarını ve alt kategorileri hedefe taşır, kaynak kaydı siler.
  Betik idempotent: ikinci çalıştırma hiçbir şey yazmaz.
- **`/kategoriler` üst-alt düzen.** Üst kategori bir bölüm (başlık + açıklama + ürün/alt
  kategori sayacı), alt kategoriler üç sütunlu bağlantı ızgarası. Üst kategori adı ayrı bir
  `Link`, alt kategoriler ayrı `Link` (iç içe bağlantı yok).
- **Sayımlar tek SQL turunda kalır.** Alt kategori ürünleri üst kategoriye toplanır
  (`productCount`), kart başına ayrı `count` sorgusu açılmaz.

## Sonuçlar

- Üretimde 33 → 75 kategori; 14 üst kategori, 61 alt kategori, 3 kopya kayıt birleştirildi
  (8 + 1 + 1 ürün taşındı, kural referansı yoktu).
- Yeni kategori eklemek tek yerde yapılır: taksonomi dosyasına düğüm ekle, iki betikten
  birini çalıştır.
- Mobil uygulama aynı ağacı `/categories?depth=1` üzerinden okur; şema değişmedi.
