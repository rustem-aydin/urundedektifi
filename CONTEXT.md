# Barkod Dedektifi

Barkodla sorgulanan ürünlerin güvenilirliğini (boykot, sağlık, helal, içerik) uzman kurallarına göre değerlendiren, "delil dosyası" anlatısıyla sunan bir tüketici uygulaması.

## Language

### Ürün & Barkod

**Barkod Dedektifi**:
Uygulamanın adı (2026-11-02'ye kadar "Şeffaf Ürün", öncesinde "Ürün Dedektifi"). Marka metni, sayfa başlığı ve mağaza adıdır; koleksiyon/alan/rota adlarında kullanılmaz.
_Avoid_: Şeffaf Ürün, Ürün Dedektifi, urundedektifi (eski adlar; yalnız ADR 0018/0031 ve mevcut altyapı adlarında geçer)

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

**Panel Hesabı**:
Bir Uzmanın panele giriş yaptığı `users` kaydı (`experts.user`). 1 uzman = 1 hesap; hesap uzman kaydından otomatik açılır, e-posta **varsayılan olarak** uzmanın adından türetilir (`boykot_dedektifi@expert.local`) ve admin bunu uzman formundaki `Panel E-posta Adresi` alanından gerçek adresle değiştirebilir; ilk şifreyi admin panelden belirler. Rol her iki yönde kilitlidir: bağsız hesap "Uzman" olamaz, bağlı hesap "Uzman"dan düşürülemez (ADR 0032).
_Avoid_: uzman kullanıcısı, expert hesabı

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

**Katkı Maddesi**:
`additives` master listesindeki tek kayıt: `code` (E-kodu, ör. `E330`; etikette yazmıyorsa boş — ADR 0019), `name` (Türkçe kimyasal ad, `Sitrik Asit`), `aliases[]` (İngilizce/OFF adları), `function`, `riskLevel`, `halalStatus`, `isVegan`, `description`, `sources[]`. Panel başlığı `title` alanıdır ve kancayla türetilir: `E330 · Sitrik Asit`. Liste 675 kayıttır (673 E-kodlu + 2 kodsuz grup); veri `src/lib/seed/data/additives-world.json`, yazıcı `scripts/seed-additives-prod.ts` (ADR 0025).
_Avoid_: katkı (bu sözcük Tüketici Hesabının ürüne yaptığı iş için ayrılmıştır), içindekiler (o `ingredients`), E-numarası kaydı, katkı kodu

**Katkı Grubu**:
E-kodu olmayan ortak katkı kaydı (`additives.code = null`), ör. **Modifiye Nişastalar** (E1400–E1452 ailesi) ve **Sodyum Hidrojen Karbonat ve Disodyum Difosfat**. Etikette grup adı geçtiğinde ürün bu kayda bağlanır; alt türler ayrı E-kodlu kayıtlardır.
_Avoid_: kategorik katkı, aile kaydı, sahte E-kodu (`E14XX` gibi uydurma kod yazılmaz)

**Boykot Durumu**:
"Boykot Dedektifi" uzmanının altı seviyeli ölçeği: **Boykot** · **İkincil Boykot** · **Ahlaken Boykot** · **Şüpheli** · **Araştırılıyor** · **Uygun** (renk/sıra `rating-scales`). Her marka kendi durumuyla bir Uzman Kuralı olarak kayıtlıdır (ADR 0016); marka hakkındaki boykot hükmünün **tek kaynağı** bu kuraldır — markada ayrı bir boykot bayrağı yoktur (ADR 0023).
_Avoid_: skor, puan, "İsrail malı" (ölçek adı değildir), "boykotlu marka bayrağı"

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

### Katkı ve Profil

**Katkı**:
`product-contributions` koleksiyonundaki tek kayıt: bir Tüketici Hesabının bir Ürün Dosyasına yaptığı iş — `create` (oluşturdu), `update` (kaydedilmiş düzenleme), `verify` (doğrulama oyu). Yalnız sunucudan yazılır (ürün kancaları + doğrulama oyu ucu); REST `create/update` kapalıdır, okuma herkese açıktır.
_Avoid_: emek, puan, bonus, credit

**Katkıda Bulunanlar**:
Bir Ürün Dosyasının altında avatar grubu olarak listelenen kişiler. Aynı kişi birden çok iş yaptıysa **tek avatar** olur ve işler rozet olarak (`Oluşturdu/Düzenledi/Doğruladı`) yazılır. Web'de diyalog, mobilde alt çekmece açılır; satır kişinin Katkı Profiline gider.
_Avoid_: yazarlar, editörler, ekip

**Katkı Profili**:
Herkese açık kullanıcı profili (`/profil/[id]`, `GET /api/users/profile/:id`): ad, kısa tanıtım (`users.bio`), avatar, üç sayı (**katkı sağladığı ürün**, **toplam görüntülenme**, **katkı işi**), katkı verdiği yayındaki ürünler ve takip ettiği uzmanlar. E-posta, oturumlar ve rol dışındaki hesap alanları asla dönmez.
_Avoid_: kullanıcı sayfası, hesap profili, üye profili

**Toplam Görüntülenme**:
Katkı Profilindeki sayı: katkı verilen **yayındaki** ürünlerin Görüntülenme Sayaçlarının ürün başına bir kez toplanması. Tekil ziyaretçi ölçümü yoktur; aynı ürüne üç kez katkı vermek sayıyı üçlemez.
_Avoid_: erişim, izlenme toplamı, tekil ziyaretçi

### Tarama, Katkı ve İnceleme

**Katkı Akışı**:
Taramada yayında dosyası olmayan barkod için **her rolün** (admin, editör, son kullanıcı) fotoğraf gönderip Ürün açtığı tek akış (`/katki/[barcode]`, mobil `katki/[barcode]`). Ürün `status: draft` açılır, `submittedBy` katkı sahibini tutar. Aynı barkodda ikinci katkı açılmaz; kullanıcı başına en fazla 50 açık Taslak Katkı vardır.
_Avoid_: ürün önerisi, talep, bildirim

Katkı akışının iki kapısı vardır: `/katki` (barkod elle girişi) ve tarama/sorgudaki "ürün yok" dalı. İkisi de rol ayrımı yapmaz; panel rolleri için ayrı bir ekleme ekranı yoktur (ADR 0026).

Mobil aynı akışı birebir taşır: `katki` (barkod elle girişi + kamera) ve ürün ekranının "DOSYA YOK" dalında gömülü form. Fotoğraf ekleme yüzeyi iki tarafta tek bileşendir (web `ContributionForm`, mobil `components/katki/ContributionForm`): 1–6 fotoğraf, kamera + galeri, sıralama (ilk kare ön yüz), tek tek silme, sayaç ve "İNCELEMEDE" bitiş durumu.

**Taslak Katkı**:
İnceleme bekleyen Ürün: `status: draft` + `submittedBy` dolu. Taramada "yok" sayılır (`products.read` yalnız yayındakini herkese açar); yalnız sahibi ve panel rollerine görünür.
_Avoid_: bekleyen ürün, aday kayıt

**İnceleme Kuyruğu**:
Editör/yöneticinin Taslak Katkıları gördüğü yüzey (`/inceleme`, mobil İnceleme). Görülmemişler önce ve eski önce gelir; "Baktım" işareti `products.is_submit` alanıdır. Menüdeki girdi bekleyen (görülmemiş) taslak sayısını rozet olarak taşır (`GET /api/products/review/count`). "Analiz et" **İnceleme Sihirbazı**nı açar (`/inceleme/[id]`, mobil `inceleme/[id]`; mevcut fotoğraflar hazır) ve yayınlama oradan yapılır; kaydettikten sonra otomatik olarak sıradaki incelenmemiş taslağa geçilir. Kendi katkısı da kuyrukta "senin katkın" etiketiyle görünür ve aynı kişi tarafından incelenebilir. Kuyruk tüm taslak ürünleri gösterir (katkı sahibi olmayan panel taslakları dahil).
_Avoid_: moderasyon paneli, onay listesi, görev kuyruğu

**İnceleme Sihirbazı**:
Panel rolünün Katkı Akışından gelen taslağı alanlara dönüştürdüğü yüzey (`/inceleme/[id]`, mobil `inceleme/[id]`). Web'de tek ekran (ADR 0027): fotoğraf tepsisi, "Analiz et", alan onayı, master eşleme ve kayıt bölümleri alt alta; adım geçişi yok. Mobilde adımlı akış (fotoğraf → onay → eşleme → kayıt) sürer. "Analiz et" yapay zekâyla etiketi okur. Yeni ürün açan bir modu yoktur — ürün yalnız Katkı Akışından doğar.
_Avoid_: Ekle sihirbazı, ürün ekleme ekranı

**Katkı Reddi**:
Kabul edilmeyen Taslak Katkı silinir; katkı satırları da silinir, dolayısıyla katkı sahibinin profilinde hiç görünmez. Ayrı "reddedildi" durumu ve ret notu yoktur.
_Avoid_: red, veto, arşivleme

**Katkılarım**:
Katkı Profilindeki tek katkı bölümü (`#katkilarim`). Herkese açık ziyaretçi başlığı "Katkı sağladığı ürünler"dir ve yayındaki katkı ürünlerini en çok görüntülenen sırasıyla gösterir; profil sahibi giriş yaptığında başlık "Katkılarım" olur, `GET /api/products/mine` ile gelen incelemedeki katkılar listenin başına eklenir ve "bekleyen / 50" sayacı görünür. Bölüm en fazla 30 kayıt gösterir; taslaklar önce gelir, kalan yer yayındaki ürünlerle dolar.
_Avoid_: katkı geçmişi, önerilerim, katkı sağladığı ürünler (ayrı bölüm)
