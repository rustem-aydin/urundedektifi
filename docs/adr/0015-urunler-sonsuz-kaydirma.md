# ADR 0015 — Ürünler sayfasında sonsuz kaydırma ve karttan kanıt no kaldırılması

- Durum: Kabul edildi
- Tarih: 2026-10-26
- İlgili: ADR 0009 (ürün dosyası), ADR 0013 (görüntülenme sayacı), `src/app/(frontend)/urunler/page.tsx`,
  `src/app/(frontend)/urunler/akis/route.ts`, `src/components/InfiniteProductGrid.tsx`

## Bağlam

`/urunler` tek istekte 48 ürün basıyordu; katalog binlerce ürüne çıktığı için liste "hepsi" değildi
ve sayfada sonraki ürünlere ulaşmanın yolu yoktu. Kullanıcı "daha fazla yükle" düğmesi istemiyor:
kaydırdıkça gelmeli. Aynı turda ürün kartlarında **KANIT NO** (barkod) satırının gösterilmemesi
istendi; kartın işi ürünü tanıtmak, barkod detay dosyasının künyesidir.

Sayfa bir sunucu bileşeni: ilk tur Payload Local API + `listProductCases` ile üretiliyor, kural
motoru sunucuda çalışıyor. Tarayıcıdan sonraki sayfaları aynı sözleşmeyle almak gerekiyordu.

## Karar

- **İlk sayfa sunucuda, devamı uçtan.** `listProductCases` artık `page` alır; `/urunler` ilk
  `PRODUCT_PAGE_SIZE = 24` kartı sunucuda render eder, aşağısı `GET /urunler/akis?sayfa=N`
  (route handler, `src/app/(frontend)/urunler/akis/route.ts`) ile istenir. Uç, sayfanın URL
  parametreleriyle (`q`, `kategori`, `marka`, `etiket`) birebir aynı sözleşmeyi kullanır ve
  `{ products, totalDocs, page, pageSize }` döner.
- **Kart verisi tek yerde eşlenir.** `src/lib/productCardData.ts`: `ProductCardData` tipi,
  `PRODUCT_PAGE_SIZE` ve `toProductCardData(ProductCase)`. Sunucu sayfası ile akış ucu aynı
  dönüşümü kullanır; kart alanları iki yerde ayrışamaz. Tam `ProductCase` istemciye gitmez.
- **Tetikleyici IntersectionObserver.** `InfiniteProductGrid` ızgaranın altına 1 px'lik bir
  sentinel koyar; `rootMargin: '400px 0px'` ile görüş alanına girdiğinde sıradaki sayfa istenir.
  Sentinel görünür kalırsa (uzun ekran) sayfalar zincirleme istenir; hata zinciri durdurur ve
  yalnız "Tekrar dene" bağlantısı gösterir. "Daha fazla yükle" düğmesi yoktur. Filtre değişiminde
  bileşen `key` ile yeniden kurulur, böylece birikmiş kartlar sıfırlanır.
- **Kart künyesi.** `ProductCard` artık `barcode` prop'u almaz; alt şeritte yalnız kategori kalır
  (kategori yoksa şerit çizilmez). Görüntülenme sayısı ve "N kural eşleşti" rozeti korunur.
  KANIT NO yalnız ürün detay sayfasının künyesinde (barkod + etiket) kalır.
- **Rozet verisi değişmez.** `ProductGrid` takip edilen uzmanların eşleşme sayılarını barkodla
  sorgulamaya devam eder; barkod kartta gösterilmez ama veri anahtarı olarak kalır.

## Sonuçlar

- Yerel üretim derlemesi + 35 yayında ürün: `/urunler` 24 kart bastı; sayfa sonuna kaydırınca
  `/urunler/akis?sayfa=2` istendi ve DOM'daki kart sayısı 24 → 35 oldu; kartlarda "KANIT NO" yok.
- İlk yükte fazladan istek yok: sentinel görüş alanı dışındayken hiçbir istek atılmaz; 24'ten az
  ürün varsa `exhausted` baştan doğrudur ve uç hiç çağrılmaz.
- Kart yüksekliği kartın kendi içeriğinden gelir (grid hücreleri eşit); kanıt no satırının
  kalkması kartı bir satır kısaltır.
