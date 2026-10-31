# ADR 0020 — Herkese açık profiller ve "Katkıda Bulunanlar"

- Durum: Kabul edildi
- Tarih: 2026-10-29
- İlgili: ADR 0002 (ürün ekleme yetkisi), mobil ADR 0021, `src/lib/productContributions.ts`

## Bağlam

Ürün dosyası kimin emeğiyle oluştuğunu göstermiyordu: `products.submittedBy` yalnız ürünü
ilk ekleyeni tutuyor, düzenlemeler ve doğrulama oyları (`product-feedback`) ayrı yerlerde
duruyordu. Kullanıcının bir "kimlik" yüzeyi de yoktu: `users` dokümanı yalnız kendi sahibine
ve admin'e açıktı, profilde gösterilecek kamusal alan (bio, katkı listesi, görüntülenme
toplamı) hiç yoktu.

## Karar

- **Katkı ayrı koleksiyonda: `product-contributions`.** Alanlar: `product`, `user`,
  `kind` (`create` | `update` | `verify`). Yazma yalnız sunucudan (ürün kancaları ve ürün
  uçları) yapılır; REST `create/update` kapalıdır — kimse kendini katkıcı olarak ekleyemez.
  Okuma herkese açıktır.
- **Kimlik tek satır.** Aynı kişi ürünü oluşturup düzenleyip doğruladıysa avatar grubunda
  ve listede bir kez görünür; yaptığı işler rozet olarak (`Oluşturdu/Düzenledi/Doğruladı`)
  yazılır. Tekilleştirme okuma tarafında kişi kimliğine göre yapılır.
- **Yazma `req` ile aynı işlemde.** Payload yazıyı bir transaction içinde çalıştırır; kanca
  içinden ikinci belge yazarken `req` geçilmezse insert iç içe işlem yüzünden düşer. Bu yüzden
  `recordContribution` `req` alır ve hata durumunda ürün yazımını geri düşürmez (katkı ikincil
  bilgidir).
- **Doğrulama da katkıdır.** `/api/products/feedback/:barcode/vote` başarılı oy yazımından
  sonra `verify` katkısı bırakır.
- **Profil, `users` dokümanının kamuya açık kesiti.** `users.read` kendi dokümanıyla sınırlı
  kalır (e-posta, oturumlar, rol sızmasın); kamuya açık veri `/api/users/profile/:id` ucundan
  gelir: ad, bio (`users.bio`), avatar, katkı özeti, katkı verdiği yayındaki ürünler, takip
  ettiği uzmanlar. Web `/profil/[id]` aynı yardımcıyı sunucu tarafında çağırır.
- **Görüntülenme toplamı.** Profildeki "toplam görüntülenme", katkı verdiği **yayındaki**
  ürünlerin `goruntulenme` sayaçlarının toplamıdır (ürün başına bir kez). Tekil ziyaretçi
  takibi yoktur: mevcut ham sayaç kullanılır.
- **Liste sınırı ve tek toplama sorgusu.** Bir kullanıcı 9.000+ ürüne katkı verebiliyor; hepsini
  basmak profili 22 MB / 22 sn yapıyordu. Profil yalnız **en çok görüntülenen 30 ürünü** listeler
  (kırpma notu gösterilir), sayılar (`productCount`, `viewTotal`, `contributionCount`) tek bir
  SQL toplama sorgusundan gelir.
- **Profil düzenleme.** Ad, kısa tanıtım (`bio`) ve avatar kullanıcının kendisinde. Avatar
  önce `/api/media`'ya yüklenir, sonra kullanıcı dokümanına bağlanır. Rol alanı zaten admin'e
  kilitli olduğu için profilden yetki yükseltilemez.
- **Yüzeyler.** Ürün sayfasında başlığın altında avatar grubu: web'de diyalog, mobilde alt
  çekmece. Grupta en fazla 5 yüz + "+N"; liste kişi başına tek satır ve profiline bağlantı.

## Sonuçlar

- Yeni tablo + `users.bio`: `20261029_210000_add_profiles_and_contributions` (idempotent DDL),
  dev'de `push` ile aynı şema üretilir.
- `product-contributions` panelde görünür; elle ekleme yapılamaz, admin yalnız silebilir.
- Misafir (oturumsuz) ürün yazımı katkı üretmez: kayıt yalnız `req.user` varken tutulur.
