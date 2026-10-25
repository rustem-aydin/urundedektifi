# ADR 0011 — Tüketici hesapları, uzman takibi ve uzman yazıları

- Durum: Kabul edildi
- Tarih: 2026-10-25
- İlgili: ADR 0010 (web Ekle/Düzenle), mobil ADR 0002 (kimlik ve rol kapısı), mobil ADR 0012

## Bağlam

Site bugüne kadar yalnız okuma yüzeyiydi: `users` koleksiyonundaki hesaplar admin paneli içindi,
`users.create` yalnız admin'e açıktı ve `users.read` admin dışına kapalıydı. Uzmanların ürün
hükümleri ve kuralları vardı ama takip edilemiyor, uzman kendi kaleminden yazı paylaşamıyordu.

Tasarım oturumunda (grilling) tüketici tarafı şöyle kararlaştırıldı:

- Tüketici hesabı = mevcut `users` koleksiyonunda `role: 'user'`; ayrı auth koleksiyonu yok.
- Takip bir **kapıdır**: ürün dosyasında yalnız takip edilen uzmanların hükümleri görünür;
  ürün kartlarındaki "N kural eşleşti" rozeti yalnız takip edilen uzmanların eşleşen
  kurallarını sayar. Takip yoksa hüküm bölümü "uzmanları takip edin" boş durumunu gösterir.
- CTA: hüküm yoksa (ya da takip yoksa) **Uzmanlara git**; hüküm satırlarında takip düğmesi
  **yoktur** — satırlar zaten yalnız takip edilen uzmanları gösterir.
- Yazı gövdesi Payload'ın Lexical editörüyle yazılır; **kanonik biçim Lexical JSON**'dur,
  markdown türetilmiş çıktıdır (`bodyMarkdown`).
- Mobil istemci markdown yerine Lexical JSON'u doğrudan basar (mobil ADR 0012).

## Karar

- **Açık kayıt + iki kilit.** `users.create: () => true`; `role` alanına `create` ve `update`
  için admin kilidi; `beforeChange` hook'u admin olmayan isteklerde `role = 'user'` yazar.
  Böylece `POST /api/users {"role":"admin"}` yetki yükseltemez (curl ile doğrulandı: istenen
  rol yok sayıldı, `role: "user"` kaydedildi).
- **Panel kapısı.** Payload 3'te panel erişimi `access.admin`'dir; verilmezse her authenticated
  kullanıcı panele girer. `access.admin = admin|editor|expert`. Tüketici hesabıyla `/admin`
  isteği `/admin/unauthorized`'a düşer (doğrulandı).
- **Kendi dokümanını okuma.** `users.read` admin değilse `{ id: { equals: user.id } }` döner.
  `/api/users/me` `overrideAccess: false` ile `findByID` yaptığı için bu koşul şart: aksi hâlde
  tüketici oturumu kendi profilini okuyamaz ve takip listesi hiç gelmez.
- **Oturum ömrü.** `tokenExpiration` 7 gün, `maxLoginAttempts: 5`, `lockTime: 10 dk`.
  Tüketici uygulamasında 2 saatlik varsayılan sürekli yeniden giriş demekti.
- **Takip tek alanda.** `users.following` (hasMany → `experts`, indeksli). Ayrı `follows`
  koleksiyonu yok: takip tarihi hiçbir yüzeyde kullanılmıyor, ray yazı tarihine göre sıralanıyor.
  Takipçi sayısı `GET /api/experts/:id/stats` ile public servis edilir; anonim istemci `users`
  sorgulayamaz (`read` yalnız kendi dokümanı).
- **Takibe bağlı hüküm.** `GET /api/products/verdict/:barcode` JWT varsa kullanıcının
  `following` listesini okur, `getProductCase`'in (paylaşılan, önbellekli) sonucunu
  `verdictForExperts` ile süzer ve `totalMatched`'i kalan uzmanların eşleşen kurallarından
  yeniden hesaplar. Misafir/boş takip → `{ totalMatched: 0, byExpert: [] }`. Paylaşılan case
  önbelleği bozulmaz; süzme istek başına yapılır.
- **Kart rozeti.** `GET /api/products/match-counts?barcodes=a,b,c` (≤60) takip edilen uzmanların
  kurallarını önbellekteki kural setinden süzüp yalnız istenen ürünleri değerlendirir; yanıt
  `{ counts: { [barcode]: n } }`. Web'de `ProductGrid`, mobilde `ProductCard` bu sayıyı
  "N kural eşleşti" olarak basar; misafirde rozet yoktur.
- **İstemci akışı.** Web ürün sayfası sunucuda tam `ProductCase` üretir ama hükmü **render
  etmez**: `ProductVerdictProvider` (client) JWT ile `/verdict/:barcode`'u çeker, üst bilgi
  rozeti (`MatchedStamp`) ve Dosya 01 (`VerdictSection`) aynı isteği paylaşır. Takip listesi
  değişince istek yenilenir. Mobil ürün ekranı aynı ucu `useVerdict` ile kullanır.
- **`posts` koleksiyonu.** Alanlar: `expert`, `title`, `slug`, `excerpt`, `cover`, `body`
  (Lexical), `bodyMarkdown` (hook türetir), `topics`, `status`, `publishedAt`.
  Okuma **yalnız yayında** (`{ status: { equals: 'published' } }`) — `products`'taki
  `read: () => true` deseni burada kopyalanmaz, yoksa taslak yazı ham REST'ten sızardı.
  `admin|editor` tümünü, `expert` kendi taslaklarını görür.
- **Yazı sahipliği.** `expert` rolüyle giriş yapan kullanıcıda `expert` alanı
  `experts.user == req.user.id` üzerinden hook'ta zorlanır; başka uzmana atıf imkânsız,
  `update` access'i de aynı koşulla sınırlanır. Admin/editör serbestçe seçer.
- **Markdown hattı.** `src/lib/postMarkdown.ts` Lexical düğümlerini markdown'a çevirir
  (paragraf, h2/h3, kalın/eğik/üstü çizili, satır içi kod, link, liste, alıntı, kod, yatay çizgi,
  görsel). Görsel düğümlerindeki medya kimlikleri hook'ta medya URL'ine çözülür. Zengin metin
  için resmî markdown serializer yok; bu yüzden izinli düğüm kümesi bilinçli olarak dar tutuldu.
- **Anasayfa rayı.** `StoryRail` (client) yalnız oturum + takip varsa render edilir; son 14 gün,
  uzman başına en yeni yazı, okundu bilgisi `localStorage['ud.story-seen']`. 24 saatte silme yok:
  içerik kaybolmasın.
- **Girişsiz takip niyeti.** Düğme `localStorage['ud.follow-intent']`'e uzmanı yazar ve
  `/giris?next=<yol>`'a gider; giriş/kayıt başarılı olunca `completePendingFollow` takibi
  kendiliğinden tamamlar (doğrulandı: kayıt sonrası kullanıcı uzmanı takip ediyordu).
- **Uzman profili.** Kapak (`experts.cover`, opsiyonel; boşsa tipografik zemin), avatar, unvan,
  takipçi + kural sayısı, takip düğmesi, bio, sertifikalar, bağlantılar, yazılar, **hüküm verdiği
  ürünler** (`listProductsForRules`: yayındaki ürünler bir kez çekilir, uzmanın tüm kuralları
  bellekte değerlendirilir; kural başına ayrı tarama yapan `listProductsMatchingRule`'dan farkı
  budur) ve kurallar. Eşleşme yoksa ürün bloğu hiç render edilmez.
- **Public olmayan uzman.** `isPublic=false` uzmanın yazıları ray sorgusunda
  `expert.isPublic = true` koşuluyla düşer; takip kaydı silinmez (uzman geri açılınca ray döner).
- **CORS.** Üretimde istemciler aynı kaynakta (web) ya da yerel (mobil) çalışır; `cors` boş.
  Yerelde Expo web hedefi farklı porttan bağlandığı için `NODE_ENV !== 'production'` iken `'*'`.

## Consequences

- **Misafir artık hüküm görmez.** Ürün sayfasındaki hüküm bölümü SEO'da boş kalır; içerik
  değeri "uzmanları takip edin" CTA'sına kayar. Hüküm verisi API'de `/products/case/:barcode`
  içinde hâlâ ham hâlde durur (iç kullanım/uzman panelleri); kişisel kapı yalnız yeni
  `/verdict` ucundadır.
- Açık kayıt, spam hesap riskini getirir. Bu sürümde e-posta doğrulama yok (repoda e-posta
  adaptörü yok) ve captcha yok; yalnız giriş denemesi kilidi var. Spam görülürse e-posta
  doğrulama veya Turnstile eklenir.
- `products.create` hâlâ herkese açık (ADR 0002); bu ADR onu değiştirmez. Ürün taslaklarının
  ham REST'ten okunabilmesi ayrı bir borçtur.
- Hikâye rayı istemci tarafında `followingIds` ile kurulur; takip listesi büyüdükçe sorgu
  `expert in [...]` uzar. Ölçek gerekirse sunucuda "ray" ucu açılır.
- Uzman profili her istekte yayındaki ürünleri tarar (hüküm verdiği ürünler). Ürün sayısı
  büyürse bu blok önbelleğe alınmalı.
- Migration idempotent yazıldı (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
  constraint/index guard'ları): 2026-10-24'te idempotent olmayan migration üretimi çökertmişti.
