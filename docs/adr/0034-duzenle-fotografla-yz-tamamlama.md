# ADR 0034 — Düzenle ekranında fotoğraftan YZ tamamlama

- Durum: Kabul edildi
- Tarih: 2026-11-20
- İlgili: ADR 0010 (web Ekle/Düzenle), ADR 0021 (tek YZ sağlayıcı), ADR 0027/0028 (inceleme ve
  arka plan analizi), `src/components/wizard/DuzenleScreen.tsx`, `src/lib/wizard/productDraft.ts`

## Bağlam

Düzenle ekranı yeni fotoğraf eklemeyi biliyordu ama fotoğrafları yalnız kayıtta ürüne bağlıyordu.
Kayıtlı ürünün eksik alanlarını (içindekiler, besin tablosu, üretici, etiketler…) doldurmak için
kullanıcı önce katkı akışına gidip ayrı bir taslak açmak zorundaydı. Oysa fotoğraf zaten düzenlenen
ürünün kendisine ait.

## Karar

### 1. Fotoğraf eklenince analiz kendiliğinden başlar

`PhotoTray`'e eklenen ilk fotoğraf partisi (`draft.extraction === null`) ekleme bittiğinde
`analyzeProduct` çağrısını tetikler. Aynı çağrı inceleme akışıyla ortaktır: tarayıcıda oturum
jetonuyla `/api/globals/ai-settings/chat` vekiline, mobilde aynı vekile gider; anahtar istemciye
inmez. Analiz sürerken çekmece ve kaydetme kilitlidir. "Fotoğrafları yeniden analiz et" düğmesi
elle tekrar çalıştırır.

### 2. Sonuç `fill-missing` ile birleşir

`mergeExtraction(draft, extraction, { mode: 'fill-missing' })`:

- Metin alanları yalnız boşsa dolar; dolu değer, eşleme (`brand`/`category`) ve barkod korunur.
- İçindekiler, katkı maddeleri, alerjenler, besin tablosu ve uyarılar yalnız liste boşsa dolar.
- Etiketler ve teknik özellikler küme gibi birleşir: aynı etiket/anahtar tekrar yazılmaz, eksik
  olan eklenir.
- Fotoğraf rolleri yalnız `unknown` olan fotoğraflara yazılır; kullanıcının seçtiği rol korunur.

İnceleme akışı `overwrite` (varsayılan) davranışını korur; orada form katkı taslağına aittir.

### 3. Kayıt semantiği değişmez

Analiz yalnız formu doldurur. Ürüne yazma yine "Değişiklikleri kaydet" ile, mevcut `complete`
gövdesiyle yapılır; yeni fotoğraflar ancak rolu bilinen fotoğraflar olarak kayıtta yüklenir.

## Sonuç

- Kayıtlı ürünü zenginleştirmek için ayrı katkı açmak gerekmez.
- İlk fotoğraf partisinde bir analiz çağrısı (token) harcanır; kullanıcı sonucu kaydetmeden önce
  görür.
- Düzenle'nin "boş bırakılan alan silinir" sözleşmesi korunur: analiz doldurmadığı boş alan yine
  boş kalır.
