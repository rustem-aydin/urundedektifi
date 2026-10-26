# ADR 0014 — Open Food Facts kataloğunun toplu aktarımı

- Durum: Kabul edildi
- Tarih: 2026-10-25
- İlgili: ADR 0009 (ürün dosyası), ADR 0012 (veri doğrulama), `scripts/off-bulk-import.ts`,
  `scripts/lib/off-import.ts`

## Bağlam

Katalog elle seçilmiş birkaç düzine üründen oluşuyordu; istenen, Türkiye pazarındaki tüm
Open Food Facts (OFF) kayıtlarının sisteme alınması. OFF'un Türkiye görünümü
(`countries_tags_en=turkey`) **11.532 ürün / 231 sayfa × 50 ürün** döndürüyor.

Kısıtlar:

- OFF site sayfaları (`tr.openfoodfacts.org/2` … `/231`) ürünleri **JS ile** basıyor; HTML
  gövdesinde `<ul class="products"></ul>` boş gelir.
- `api/v2/search` ve facet uçları anonim trafiğe kapatıldı:
  `401 — "Due to heavy abuse from robots, we are unable to serve this page to unidentified
  users. Please create a free Open Food Facts account."` Hesap açma yolu da bu ağdan kapalı:
  `/cgi/login.pl` POST'u üç hostta, tarayıcı UA'sı ve çerezle de **403** dönüyor.
- `api/v2/product/<barkod>` ve `images.openfoodfacts.org` anonim çalışıyor; görsel CDN'i zaman
  zaman 200 + 0 bayt / zaman aşımı veriyor.
- Ürün dosyası kurallı: içindekiler/alerjen/katkı/besin alanları **master listelere** bağlanır,
  uzman hükümleri yalnız kurallarla üretilir. Toplu aktarım hüküm uydurmamalı.
- Mevcut ürünlerin bir kısmı elle zenginleştirilmişti; üzerine yazmak veri kaybı olur.

## Karar

- **Veri kaynağı: resmî tam döküm.** `static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz`
  (13,2 GB, 4,83 M ürün) indirilir, `scripts/off-dump-filter.ts` satırları JSON'a çevirmeden
  `"en:turkey"` ile süzer, ardından `countries_tags` alanı `en:turkey` olan **11.528** kayıt
  ayrılır (arama API'sinin saydığı 11.532 ile aynı; fark canlı veri kayması).
- **Dökümden görsel URL'i üretilir:** dökümde hazır URL yok. Barkod 13 haneye tamamlanıp
  3/3/3/4 bölünür (`8690526001135` → `869/052/600/1135`), dosya adı
  `front_<dil>.<rev>.full.jpg`. `rev`, `images.selected.<tür>.<dil>.rev` alanından gelir
  (`imgid` değil). 12/12 örnekte üretilen URL, ürün API'sinin `image_front_url`'ü ile aynı
  görseli 200 döndürdü.

- **Tek dönüşüm katmanı:** `scripts/lib/off-import.ts`. Tek ürün aktarımı
  (`seed-products-prod.ts`, var olan kaydı günceller) ve toplu aktarım aynı kodu kullanır.
  Kurallar: master kayıtlar slug ile eşlenir ve eksikse oluşturulur (marka, kategori,
  içindekiler, katkı, alerjen); besin değerleri `NUTRIENT_MAP` üzerinden bağlanır; sıvı/katı
  ayrımı `isLiquid` ile `100ml` ya da `100g` olarak yazılır.
- **Toplu aktarım var olan barkodu atlar** (varsayılan `existing: 'skip'`); ürün verisi
  ezilmez.
- **Sayfa bazlı, yeniden başlatılabilir akış:** OFF yanıtları `.off-cache/pages/page-N.json`
  altında önbelleklenir; ilerleme `.off-cache/state.json` içinde tutulur. Biten sayfa atlanır,
  hatalı barkod sonraki turda denenir. Bu dizin sürüm kontrolüne girmez.
- **Görseller ayrı fazda onarılır:** `--backfill-images` yalnız eksik ön yüz görselini
  tamamlar ve `hiResImageUrl` ile `.full.jpg` varyantını kullanır (arama API'si 400 px URL
  verir). 600 px'in altındaki eski görseller de tam çözünürlükle değiştirilir. Görsel
  indirme/yükleme bir semaforla (varsayılan 2) sınırlanır.
- **Kural eşleştirmesi tüm kataloğu tarar:** `listProductsMatchingRule` /
  `listProductsForRules` tek istekte ilk 500 ürünü alıp kesiyordu; katalog on binlere çıktığında
  eşleşmeler sessizce kaybolurdu. Artık 500'lük sayfalarla tüm yayındaki ürünler taranır,
  eşleşen kimlikler ikinci aşamada (depth 2) çekilip tarama sırası korunur.

## Alternatifler

- **Arama API'si + OFF hesabı:** en hızlı yol olurdu; ancak login POST'u bu ağdan 403.
- **Hugging Face `openfoodfacts/product-database` parquet:** 23 GB ve görsel URL'i yok.
- **HTML kazıma:** ürünler sunucu tarafında basılmıyor, kazınacak veri yok.
- **Toplu aktarımda var olan ürünü güncelleme:** elle düzeltilmiş kayıtları bozar.

## Sonuçlar

- Katalog OFF'un Türkiye kapsamıyla aynı büyüklüğe çıkar; kalite farkı veri kaynağından gelir
  (adsız ürün atlanır, görselsiz ürün görsel onarımına düşer).
- Akış iki fazlıdır: önce veri (`--images=none`), sonra görseller
  (`--backfill-images --images=all`). Görsel CDN'i kesildiğinde veri aktarımı durmaz, eksik
  görseller sonraki turda tamamlanır.
- OFF kesintisi/döküm tazeliği aktarımı durdurmaz; aynı komut yeniden çalıştırılabilir
  (var olan barkod atlanır).
- `/urunler` gibi liste sayfaları sayfalandığı için katalog büyümesi sayfa yükünü artırmaz;
  marka filtresi `limit: 100` ile sınırlı olduğundan marka sayısı arttıkça filtre eksik kalır.
  Bu, aktarımın kapsamı dışında bırakılan ayrı bir iyileştirmedir.
