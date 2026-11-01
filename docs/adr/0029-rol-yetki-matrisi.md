# ADR 0029 — Rol yetki matrisi: yazma işleri role göre daraltıldı

- Durum: Kabul edildi
- Tarih: 2026-11-01
- Yerini aldığı: ADR 0021'in "editör global `ai-settings` okuyabilir" maddesi, ADR 0026'nın
  "ürün doğrudan oluşturma" yetkisi
- İlgili: ADR 0011 (uzman yazıları), ADR 0024/0026 (katkı akışı), `src/collections/*.ts`,
  `src/globals/AiSettings.ts`, `src/components/SaglayiciForm.tsx`

## Bağlam

Dört koleksiyonda/globalde erişim kuralları işin sahibinden daha genişti:

- `ai-settings`: editör global'i okuyabiliyordu; `apiKey` gizli olsa da adres/model/ayar dosyası
  salt-okunur olarak açıktı.
- `products.create: Boolean(user)`: oturum açmış **her** hesap REST üzerinden tam ürün kaydı
  açabiliyordu. Ürün alanlarını (marka, içindekiler, besin tablosu, hüküm) doldurmak panel işi;
  son kullanıcının tek meşru katkısı barkod + fotoğraf (ADR 0026).
- `posts.create`: editör de yazı açabiliyordu. Yazının sahibi uzmandır; `posts.delete` editöre de
  açıktı, oysa yayınlanmış bir yazıyı silmek geri alınamaz bir işlem.
- `expert-rules.create`: editör de kural açabiliyordu. Kural bir uzmanın değerlendirme hükmüdür.

## Karar

### 1. Yapay zekâ ayarı yalnız admin

- `ai-settings` global `read`/`update`: **yalnız admin**. `apiKey` alanı da yalnız admin.
- Vekil uçlar (`/status`, `/models`, `/chat`) **admin + editör** kalır: editör sağlayıcıyı
  **kullanır**, ayarını görmez. Aksi hâlde inceleme sihirbazının fotoğraf analizi editör için
  kırılırdı.
- Web `/saglayici` ekranı yalnız admin'e açık; diğer roller "yalnız admin" kartı görür.
- Gerekçe: ayar tek merkez (ADR 0021) ama görünürlüğü de tek rolde olmalı.

### 2. Ürün: herkes barkod + fotoğraf, alanları admin/editör

- `products.create`: **admin + editör**. Son kullanıcı REST'ten ürün açamaz.
- Herkesin kapısı `/api/products/contribute` (ADR 0026): sunucu barkodu ve 1–6 fotoğrafı yazar,
  ürün `draft` açılır, `submittedBy` sahibi işaretler. Katkı ucu `overrideAccess: true` ile
  çalıştığı için bu daraltmadan etkilenmez; hangi alanların yazıldığını istemci seçemez.
- Diğer alanların (marka, içindekiler, besin, kategori, hüküm…) doldurulması inceleme
  sihirbazında editör/admin işidir (`products.update`, ADR 0009).
- Gerekçe: "herkes ürün açabilir" yetkisi, içerik doğruluğu olan bir ürün dosyasında veri
  kirliliği üretiyordu; katkı akışı zaten barkod + fotoğraf ihtiyacını karşılıyor.

### 3. Yazı: uzman açar, admin siler

- `posts.create`: **admin + uzman**. Editör yazı açamaz.
- `posts.update`: admin/editör her yazıyı, uzman yalnız kendi yazısını düzenler (değişmedi).
- `posts.delete`: **yalnız admin**. Uzman yazısını silmez; `status` ile yayından kaldırır.
- Gerekçe: yazının yazarı uzmandır; silme geri alınamaz olduğu için tek elde toplandı.

### 4. Uzman kuralı: admin + uzman açar

- `expert-rules.create`: **admin + uzman**. Editör kural açamaz.
- `expert-rules.update`: admin/editör her kuralı, uzman yalnız kendi kuralını düzenler
  (`expert.user` süzgeci, değişmedi).
- Gerekçe: kural bir uzmanın değerlendirme ölçeğine bağlıdır; editörün kural üretmesi
  "uzmanın kaleminden" ilkesini bozar.

## Sonuçlar

- Panelde editörün "Yeni yazı"/"Yeni kural" düğmeleri erişim kuralıyla birlikte kaybolur
  (Payload `create` erişimi arayüzü de kapatır); API'den deneme 403 alır.
- Ürün doğrudan açma yolu kalmadığı için ürün yaşam döngüsü tek: katkı → inceleme → yayın.
- Uzman yazı/kural üretiminde tek sahip: uzman. Admin denetler ve siler, editör yayınlar.
- `products.update` hâlâ uzmanı içerir (ürün verisi düzeltmesi, ADR 0026 §5); bu ADR onu
  değiştirmez.
