# Ürün Dedektifi

Barkodla sorgulanan ürünlerin güvenilirliğini (boykot, sağlık, helal, içerik) uzman kurallarına göre değerlendiren, "delil dosyası" anlatısıyla sunan bir tüketici uygulaması.

## Language

### Ürün & Barkod

**Barkod**:
GS1/EAN-13 (veya UPC/EAN-8) ürün kimliği. Hem okutma hem sorgulama anahtarıdır; aynı barkodla ikinci ürün kaydı olmaz.
_Avoid_: ürün kodu, SKU (farklı şey)

**Ürün Dosyası**:
Bir barkoda ait derin, sunuma hazır paket: çözümlenmiş ürün + hükümler + galeri + fiyat özeti + etiket çevirileri. Web sayfası da mobil API de bu tek nesneyi tüketir.
_Avoid_: ürün detayı, ürün sayfası, detail DTO

**Ürün**:
Payload'da `products` koleksiyonu dokümanı. Ham veri; Dosya'ya dönüşmeden dışarı sunulmaz.

### Değerlendirme

**Konu**:
Değerlendirme ekseni (Helal, Vegan, Çevre, Boykot, Katkı vb.). Uzman kuralları bir konuya bağlıdır.
_Avoid_: kategori (ürün kategorisi ayrı şey)

**Uzman**:
Kuralları yazan, her biri kendi derecelendirme ölçeğine sahip değerlendirici profil.

**Uzman Kuralı**:
Bir uzmana ve bir konuya ait tek eşleşme kuralı. 12 kural tipi (içindekiler/katkı/alerjen/ülke/marka/boykot/kategori/besin min-max/etiket) destekler.
_Avoid_: politika, kontrol

**Delil**:
Bir ürünle **eşleşmiş** bir kuraldır (matched rules). Ürün sayfasında "delil" olarak sunulur; yakalanan `matchedValue` kullanıcıya eşleşme nedenini açıklar.
_Avoid_: eşleşme (teknik), sonuç

**Hüküm / Karar**:
Uzmanın bir ürün hakkındaki nihai değerlendirmesi (yenilebilir / boykot / riskli vb.). Birden çok Delil'den ve her uzmanın Derecelendirmesinden türer.
_Avoid_: skor, puan

**Derecelendirme / Derece**:
Bir uzmanın kendi ölçeğindeki tek bir seviye (örn: "Helal", "Riskli", "Boykot"). Renk + sıra (`rating-scales`) ile CMS'ten gelir.
_Avoid_: rozet, kötü/iyi

### Alan Yapısı (dikkat çekenler)

**Besinler / items**:
`products.items[]` — `{ ingredient: relationship, percent_estimate }` dizisi. İçindekiler listesini taşır; "Besinler" adı aldatıcıdır, besin değeri değildir.
_Avoid_: content, nutrition (bunlar diski karıştırır)

**Besin Değerleri / nutrition**:
`products.nutrition` — `{ per: '100g'|'100ml'|'serving', items: [{ nutrient, amount, unit }] }`. Gerçek gıda değerleri tablosu.
_Avoid_: besinler (bununla karıştırma)

**Boykotlu**:
Bir markanın `isBoycotted` flag'tir işaretli olması. Ürün Dosyasında üst seviye damga olarak gösterilir.

**Boykot Durumu**:
"Boykot Dedektifi" uzmanının altı seviyeli ölçeği: **Boykot** · **İkincil Boykot** · **Ahlaken Boykot** · **Şüpheli** · **Araştırılıyor** · **Uygun** (renk/sıra `rating-scales`). Her marka kendi durumuyla bir Uzman Kuralı olarak kayıtlıdır (ADR 0016); `isBoycotted` yalnız ilk üç durumda işaretlenir.
_Avoid_: skor, puan, "İsrail malı" (ölçek adı değildir)

### Tüketici Hesabı, Takip ve Yazılar

**Tüketici Hesabı**:
`users` koleksiyonunda `role: 'user'` olan üyelik. Açık kayıtla (`POST /api/users`) oluşturulur; rol istemciden bağımsız olarak hook'ta `user`'a sabitlenir ve admin paneline giremez (`access.admin`).
_Avoid_: üye, abone, müşteri

**Takip**:
Bir Tüketici Hesabının bir Uzmanı izlemesi: `users.following` (hasMany → `experts`). Takip bir **kapıdır**: Ürün Dosyasında yalnız takip edilen uzmanların Hükümleri görünür, ürün kartlarındaki "N kural eşleşti" rozeti de yalnız takip edilen uzmanların eşleşen kurallarını sayar.
_Avoid_: abonelik, favori

**Kişisel Hüküm**:
Oturum sahibinin takip listesine göre süzülmüş hüküm (`GET /api/products/verdict/:barcode`). Misafir ya da hiç takip etmeyen kullanıcı boş liste alır; `totalMatched` kalan uzmanların eşleşen kurallarından yeniden hesaplanır.
_Avoid_: herkese açık hüküm, genel hüküm

**Takipçi**:
Bir Uzmanı takip eden Tüketici Hesabı sayısı. Anonim istemci `users` okuyamadığı için `GET /api/experts/:id/stats` ucundan servis edilir.
_Avoid_: hayran, follower

**Uzman Yazısı**:
Bir Uzmanın paylaştığı yazı (`posts` koleksiyonu). Gövde Lexical JSON'dur; yayın modeli ürünlerdeki gibi `status: draft|published`.
_Avoid_: blog yazısı, makale, post

**Markdown Sürümü**:
`posts.bodyMarkdown`: Lexical gövdeden `beforeChange` hook'unda türetilen gizli metin alanıdır; API tüketicileri ve SEO için hazırdır, elle düzenlenemez. Kanonik biçim her zaman Lexical'dır.
_Avoid_: markdown gövde, kaynak metin

**Hikâye Rayı**:
Anasayfada Takip edilen uzmanların son 14 gündeki yazılarını yuvarlak avatar olarak gösteren yatay şerit. Uzman başına tek avatar (en yeni yazı); "okundu" bilgisi cihazda tutulur, sunucuya yazılmaz ve 24 saatte silinmez.
_Avoid_: story, hikâye (tek başına), akış

### Doğrulama ve Yorumlar

**Ürün Geri Bildirimi**:
`product-feedback` koleksiyonundaki tek kayıt: bir Tüketici Hesabının bir ürün bölümü hakkındaki doğrulama oyu ya da serbest yorumu. Ham REST'i kapalıdır; yalnız ürün uçlarından yazılır, panelde inceleme/silme yapılır.
_Avoid_: geri bildirim formu, ticket

**Doğrulama Oyu**:
Bir Hesabın Ürün Dosyasındaki tek bir veri bölümünü (`uyarilar`, `icindekiler`, `besin-degerleri`, `genel-bilgiler`, `teknik-ozellikler`, `aciklama`) `confirm` ya da `refute` işaretlemesi. Hesap + ürün + bölüm başına tek kayıttır; tekrar oy aynı satırı günceller. Dosya 01 (uzman hükümleri) ve Dosya 08 (fiyat kayıtları) kapsam dışıdır.
_Avoid_: puan, rating, anket

**Doğrulama Oranı**:
Bölüm başına `round(confirm × 100 / (confirm + refute))`. Hiç oy yoksa yalnız **Doğrula** düğmesi basılır; oy varsa rozet `%86 · 12` biçiminde yüzdeyi ve onay sayısını (kişi ikonuyla) verir, varsa itiraz sayısı yanında durur. Rozet tıklanınca doğrulama diyaloğu açılır.
_Avoid_: güven skoru, doğruluk puanı

**Yorum**:
`kind: 'comment'` olan Ürün Geri Bildirimi: ürün geneli serbest metin (≤500 karakter, düz metin). Doğrulama oyları da yorum listesinde görünür; ayrı liste yoktur, thread yoktur.
_Avoid_: değerlendirme, inceleme, review

### Görüntülenme

**Görüntülenme Sayacı**:
Bir Ürün Dosyasının kaç kez açıldığı (`products.goruntulenme`). Yalnız `POST /api/products/:id/goruntulenme` ucundan artar; alan düzeyi erişim kapalı olduğu için panelden veya REST yazmasıyla değiştirilemez, taslak/arşiv ürün sayılmaz. Detay ekranında göz ikonu + `1.234 görüntülenme` olarak görünür; liste kartları saymaz.
_Avoid_: tıklanma, hit, ziyaret, popülerlik, izlenme
