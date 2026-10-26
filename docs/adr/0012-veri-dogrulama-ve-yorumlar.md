# ADR 0012 — Ürün verisi doğrulaması ve yorumlar

- Durum: Kabul edildi
- Tarih: 2026-10-25
- İlgili: ADR 0011 (tüketici hesapları, takip), mobil ADR 0013, `GLOSSARY.md`/`CONTEXT.md`

## Bağlam

Site bugüne kadar ürün verisini yalnız kurumsal rollerin yazdığı bir dosya olarak sundu. Tüketici
hesabı açabiliyor ve uzman takip edebiliyor, ama ürün verisinin doğruluğuna katkı veremiyordu.
İstenen özellik üç parçalıydı:

- Her oturum sahibi ürüne **yorum** yazabilsin.
- Ürün dosyasındaki veri bölümlerinin başlığında **Doğrula** dursun; yanında **doğruluk yüzdesi**
  ve **kaç kişinin doğruladığı** yazsın.
- Doğrulama da bir yorumdur: "doğru" için varsayılan metin, "doğru değil" için
  `Doğru olmadığını bildiriyorum çünkü …` ifadesi eklenir. Kişi isterse yalnız yorum yazar.

Tasarım oturumu (grilling) sınırları şöyle çizdi: doğrulama birimi **bölüm**dür (satır satır
değil); oy iki durumludur; yazmak için giriş zorunludur; ön moderasyon yoktur; hem web hem mobil
aynı ucu kullanır.

## Karar

- **Tek koleksiyon: `product-feedback`.** Alanlar: `product` (→ products, zorunlu), `target`
  (select, altı bölüm), `kind` (`vote` | `comment`), `verdict` (`confirm` | `refute`, yalnız
  oylarda), `text` (≤500), `author` (→ users). Ayrı `votes` ve `comments` koleksiyonu yok:
  doğrulama oyu kendi yorum metnini taşır, yorum listesinde tek satır olarak görünür.
- **Doğrulama birimleri sabit enum'dur:** `uyarilar`, `icindekiler`, `besin-degerleri`,
  `genel-bilgiler`, `teknik-ozellikler`, `aciklama`. **Dosya 01** (uzman hükümleri) uzman
  içeriğidir; **Dosya 08** (fiyat kayıtları) tarih damgalı kayıtlardır — ikisi de oya kapalıdır.
- **Kullanıcı + ürün + bölüm başına tek oy.** Tekrar oy ikinci satır açmaz; aynı dokümanın
  `verdict`/`text` alanı güncellenir. Yarış koşuluna karşı veritabanında kısmi tekil indeks
  vardır: `(product_id, target, author_id) WHERE kind = 'vote'`.
- **Yüzde** = `round(confirm * 100 / (confirm + refute))`; hiç oy yoksa `percent: null`
  döner. Bölüm başlığının karşısında (sağa yaslı) hiç oy yokken yalnız **Doğrula** düğmesi
  durur; oy varsa `%86 · 12` rozeti (yüzde + kişi ikonu + onay sayısı) ve varsa `N itiraz`
  basılır. "Henüz doğrulanmadı", "12 doğrulama" ve "Oyunu değiştir" metinleri yoktur: rozetin
  kendisi tıklanır ve doğrulama diyaloğunu (kullanıcının oyu varsa o oyla) açar. Aynı yüzey
  yorum ekleme/düzenleme diyaloğudur ve paneli düz beyaz değil, arkasındaki sayfayı
  bulanıklaştıran yarı saydam karttır (`bg-card/85` + `backdrop-blur`).
- **Metinler sunucuda yazılır.** Onayda boş metin → `Verilerin doğruluğunu teyit ediyorum.`;
  itirazda neden zorunludur ve metin `Doğru olmadığını bildiriyorum çünkü ` ile başlar. Kural
  istemciye bırakılmaz: aynı işi yapan iki istemci iki farklı metin üretmesin.
- **Uçlar ürün koleksiyonunda** (mevcut `case`/`verdict`/`match-counts` deseniyle aynı yerde):
  - `GET /api/products/feedback/:barcode?page&limit` — özet + yorumlar + `myVotes`;
    misafir sayaçları ve yorumları görür, `myVotes` boş döner.
  - `POST /api/products/feedback/:barcode/vote` — `{ target, verdict, note? }`; giriş zorunlu.
  - `POST /api/products/feedback/:barcode/comment` — `{ text }`; giriş zorunlu.
  - `DELETE /api/products/feedback/:barcode/comment/:id` — yazar ya da admin/editör.
  Yazma yanıtı taze özetin tamamıdır; istemci tek istekte ekranı günceller.
- **Ham koleksiyon kapalı.** `product-feedback` için `read/create/update` yalnız panele açıktır
  (`read`: admin/editör, `create/update`: false). Sebep: ilişki derinliği yazarın e-posta
  adresini sızdırırdı; yazma semantiği (tek oy, varsayılan metin) uçlarda yaşar. Panelde
  inceleme/silme yapılır, yazar adı yanıt üretilirken `users.name`'den çözülür (e-posta asla).
- **Yorum yapısı düzdür.** Ürün geneli tek liste, en yeni üstte, 20'lik sayfalama
  (`hasMore`); yanıt/thread yok. Doğrulama yorumları bölüm etiketiyle (ör. "İçindekiler") ve
  `Doğruladı`/`İtiraz` damgasıyla aynı listede görünür.
- **Yazma sonrası önbellek.** `getProductCase` gibi süreç içi LRU (30 sn) vardır; tüm yazma
  yolları ve panel hook'ları `invalidateProductFeedbackCache(productId)` çağırır. TTL yalnız
  başka süreçten (script) yapılan yazmalar içindir.
- **Ön moderasyon yok.** Yorum yayınlanır, admin panelden siler; metin ≤500 karakterle sınırlı,
  HTML yok (düz metin). Serbest yorumlar hesap başına 30 sn'de birdir (oylar sınırlı değil:
  bölüm başına tek kayıt, ürün başına en fazla altı oy). "Bildir" akışı bilinçli olarak yok:
  kullanıcı sayısı ve şikâyet hacmi gelmeden moderasyon kuyruğu kurmak boş bir yüzey üretir.

## Consequences

- Ürün verisi artık iki kaynaklı görünür: CMS'in yazdığı değer + kullanıcıların doğrulama
  sayısı. Doğrulama **veriyi değiştirmez**; yalnız sinyal üretir. Uzman kural motoru bu
  koleksiyonu okumaz.
- Yüzde, bölüm başına oy sayısı düşükken dalgalanır ("1 oy = %100"). Bu bilinçli: sayı ve
  itiraz adedi her zaman yüzdenin yanında gösterilir.
- Yorum silme sert silmedir; yazarın oyu da silinir (oy ve yorum aynı kayıttır).
- Mobil istemci girişsiz kullanıcıyı `/profil`'e yönlendirir; web `/giris?next=…` bağlantısı verir.
- Üretime çıkışta `product-feedback` tablosu + kısmi tekil indeks migration ile gelir
  (`src/migrations/20261025_061858.ts`). Geliştirmede şema `push` ile kurulur.
