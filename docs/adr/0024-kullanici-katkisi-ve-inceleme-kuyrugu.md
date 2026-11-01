# ADR 0024 — Kullanıcı katkısı: fotoğrafla taslak açma ve inceleme kuyruğu

- Durum: Kabul edildi
- Tarih: 2026-10-31
- İlgili: ADR 0002 (ürün ekleme yetkisi), ADR 0008 (Ekle sihirbazı), ADR 0009 (Düzenle),
  ADR 0020 (profil ve katkıda bulunanlar), `src/lib/contributionFlow.ts`,
  `src/components/ContributionForm.tsx`, `src/components/ReviewQueue.tsx`

## Bağlam

Bugün taramada bulunamayan barkod için tek yol `/ekle` sihirbazıdır ve o ekran yalnız
`admin`/`editor` rollerine açıktır. Sonuç: katalogda olmayan ürünü elinde tutan son kullanıcı
hiçbir şey yapamıyor; "ürün bulunamadı" ekranı çıkmaza dönüşüyor. Aynı zamanda
`products.read: () => true` olduğu için taslak kayıtlar da herkese açıktı: tarama anonim
istekte taslağı bulup "bulunamadı" demiyordu.

## Karar

### 1. Taslak ürün "yok" sayılır

`products.read` koşullu: `status = published` herkese açık; taslak/arşiv yalnız
`submittedBy` sahibine ve `admin`/`editor`/`expert` rollerine. Bu, katkı akışının ön koşuludur:
anonim barkod sorgusu taslağı görmez. Tarama sunucu eylemi (`getProduct`) de `published`
süzgeciyle sorgular — yerel API erişimi atladığı için süzgeç açıkça yazılır.

### 2. Katkı gönderimi: `/api/products/contribute`

- Giriş zorunlu. Barkod 8–14 hane, fotoğraf 1–6 (sıra = ön yüz + ek görseller).
- Fotoğraflar önce `/api/media`'ya yüklenir, sonra id'leri bu uca gelir; ürün `status: draft`
  olarak açılır ve `submittedBy` katkı sahibini işaretler. `afterChange` kancası
  `product-contributions` satırını (`create`) kendiliğinden yazar.
- İlk fotoğraf `frontImage`, kalanlar `additionalImages[]`. Ayrı bir "katkı fotoğrafları"
  alanı yok: editör analiz ederken fotoğraflar yerinde olur.
- Aynı barkod yayındaysa 409 ("zaten kayıtlı"), incelemedeyse 409 ("zaten incelemede").
  İkinci katkı sahibi için ayrı taslak açılmaz — barkod tekil.
- Kullanıcı başına en fazla **50** açık taslak (`status: draft`, `submittedBy = me`).
  Reddedilen/yayınlanan katkı sayılmaz.

### 2b. Giriş noktaları role göre ayrılır

Sihirbaz (`/ekle`, mobil `ekle`) panel rollerine kapalı kalır; ama artık **çıkmaz sokak değil**:
panel dışı bir kullanıcı buraya geldiğinde "rolüne kapalı" ekranı yerine katkı çağrısı görür.
Barkod bağlantıdaysa (`/ekle?barcode=…`) doğrudan `/katki/<barkod>`'a taşınır.

- Web başlık menüsü: `admin`/`editor` → `Ekle` + `İnceleme`; diğer oturumlar → `Katkı` (`/katki`,
  barkod elle girişi + kamera bağlantısı). Misafir de menüde `Katkı` görür; form giriş ister.
- Ana sayfadaki barkod sorgusu ve `/tara` taraması: ürün yoksa panel rollerini sihirbaza,
  herkesi `/katki/<barkod>`'a yönlendirir. Ürün sayfası da aynı katkı formunu gömer.
- Mobil: `ekle` ekranı panel dışı kullanıcıya katkı çağrısı gösterir (yetki kontrolü `loaded`
  kapısından önce gelir, aksi hâlde taslak yüklenmediği için ekran yükleniyor durumunda kalır).

### 3. İnceleme kuyruğu: `/inceleme` (web) ve `inceleme` sekmesi (mobil)

- Yalnız `admin`/`editor`. `GET /api/products/review` taslakları döner (görülmemiş önce, eski önce).
- **Red yok, silme var.** Kabul edilmeyen katkı silinir; katkı satırları `beforeDelete`
  kancasıyla temizlendiği için katkı sahibinin profilinde hiç görünmez. Ayrı `rejected`
  durumu ve ret notu yoktur.
- "Baktım" işareti mevcut `is_submit` alanıdır (yeni durum alanı eklenmedi).
- "Analiz et" mevcut Ekle sihirbazını **inceleme modunda** açar: taslak doküman `depth=2`
  okunur, mevcut görseller fotoğraf tepsisine yüklenir, `Analiz et` aynı YZ akışını çalıştırır,
  kayıt `update` modunda gider. Böylece ikinci bir analiz yüzeyi yazılmaz (web
  `EkleWizard reviewProductId`, mobil `ekle?reviewId=`).
- İnceleme modunda kayıt editörün kendi Ekle taslağını silmez; `media-*` kimlikli fotoğraflar
  yeniden yüklenmez (medya zaten ürüne bağlı).

### 4. Profilde "Katkılarım"

`GET /api/products/mine` oturum sahibinin katkılarını (`incelemede` / `yayında`) döner.
Web `/profil/[id]` ve mobil `profil` ekranında yalnız profil sahibi giriş yaptığında görünür.
Katkı sahibi ürün sayfasında ifşa edilmez; kimlik ayrı bir ürün alanı değil, mevcut
`submittedBy` + `product-contributions` çiftidir.

### 5. Gizlilik: yüklenen fotoğraflar

`media.read` herkese açıktır ve S3 bucket public'tir; katkı fotoğrafının URL'i bilinirse
taslak haldeyken de açılır. **Kabul edilmiş risk:** URL'ler rastgele üretilir ve listeleme
yoktur. Özel bucket + presigned URL, `next/image` proxy'sini ve mobil `RemoteImage`
katmanını birlikte değiştirirdi; kazanç maliyeti karşılamıyor.

## Sonuçlar

- Son kullanıcı taramada "ürün yok" gördüğünde fotoğrafla dosya açabilir; katkı profilde
  izlenebilir.
- Kimlik doğrulanmamış görseller yayına girmeden editörden geçer; master kayıt açma ve
  yayınlama yetkisi değişmedi.
- Silinen katkının medya kayıtları sahipsiz kalır (mevcut davranış; ayrı temizlik işi).
