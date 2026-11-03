# ADR 0032 — Uzman ↔ panel hesabı eşleşmesi: 1 uzman = 1 hesap

- Durum: Kabul edildi
- Tarih: 2026-11-02
- İlgili: ADR 0011 (uzman yazıları), ADR 0029 (rol yetki matrisi), `src/collections/Users.ts`,
  `src/collections/Experts.ts`, `src/lib/expertAccounts.ts`
- Yerini aldığı: ADR 0029 §2'nin "uzman `products.update` yapabilir" maddesi ile ADR 0029 §3'ün
  "uzman kendi yazısını silmez" maddesi

## Bağlam

`experts.user` alanı vardı ama hiçbir akış onu doldurmuyordu:

- Üretimdeki tek uzman (`Boykot Dedektifi`) hesapsızdı; yereldeki uzmanların da çoğu.
- `role: 'expert'` yetkileri (yazı/kural/ölçek yazma) kodu vardı ama hangi kullanıcının hangi
  uzman olduğu belirli değildi. Uzman hesabı olmayan bir kullanıcı yazı açamıyor, hata mesajı
  "yöneticiyle iletişime geçin" diyordu.
- Sonuç: "uzman" rolü tanımlı, sahibi tanımsız bir yetkiydi.

## Karar

### 1. Tek kanonik bağ: `experts.user`

`Users` tarafına ikinci bir ilişki alanı eklenmez; bağ tek yönlüdür. 1 uzman = 1 hesap,
1 hesap = en fazla 1 uzman:

- Hesap `experts` kaydından **otomatik** açılır (`beforeChange` hook'u).
- Aynı hesap ikinci bir uzmana bağlanamaz (hook doğrulaması, 400).
- `Panel Hesabı` alanı panelde salt okunur; bağ yalnız sistem tarafından kurulur.

Kurumsal uzmanlar (kişi olmayan, ör. Boykot Dedektifi) da hesap alır: hesap bir kişiye değil
uzman kaydına aittir, personel devri panelden yapılır.

### 2. Hesap açılışı: ad → e-posta (varsayılan), rastgele şifre

- E-posta **varsayılan olarak** uzmanın adından türetilir: Türkçe karakterler ASCII'ye çevrilir,
  boşluklar `_` olur (`Boykot Dedektifi` → `boykot_dedektifi@expert.local`). Aynı ad ikinci kez
  gelirse `-2`, `-3`…
- Varsayılan alan adı bilerek teslim edilemez bir alan (`.local`): hiçbir gerçek posta kutusuna
  düşmez, böylece "şifremi unuttum" postası üçüncü şahsa gitmez.
- **Admin e-postayı değiştirebilir.** Uzman formundaki `Panel E-posta Adresi` alanı (sanal alan,
  DB'de kolon yok) bağlı hesabın `users.email` değerini okur ve yazar; gerçek adres verilebilir
  (ör. `ahmet@ornek.com`). Girdi kırpılır + küçük harfe indirilir, biçim doğrulanır, aynı adres
  ikinci bir hesaba verilemez (400). Uzman adı değişince e-posta yeniden türetilmez: admin'in
  verdiği adres kalır.
- Şifre rastgele üretilir ve hiçbir yerde saklanmaz/gösterilmez. İlk giriş şifresini admin
  Kullanıcılar ekranından belirleyip personele iletir.

### 3. Rol seti ve tutarlılık

Rol ↔ uzman kaydı iki yönlü kilitlidir (`Users.beforeChange`):

- "Uzman" rolüyle **yeni hesap açılamaz**: hesap uzman kaydından doğar.
- Bir uzmana bağlı hesabın rolü "Uzman" kalır; düşürmek için önce uzman kaydı silinir.
- Bağı olmayan hesap "Uzman" rolüne yükseltilemez.
- Uzman kaydına bağlanan `user`/`editor`/`admin` hesabı: `user` rolü "Uzman"a çekilir (panele
  girebilsin diye), admin/editör rolleri korunur (yetki kaybı olmasın).
- Uzman kaydından gelen yazımlar `EXPERT_ACCOUNT_CONTEXT` (`skipExpertAccountGuard`) ile bu
  kapıyı atlar; bayrak yalnız sunucu kodunda kullanılır.

### 4. Uzman yetkileri

| İş | Yetki |
| --- | --- |
| Yazı aç | ✓ kendi uzmanı adına |
| Yazı güncelle / sil | ✓ kendi yazısı (başkasınınki 403) |
| Kural aç | ✓ kendi uzmanı adına |
| Kural güncelle | ✓ kendi kuralı |
| Derecelendirme aç/güncelle | ✓ kendi ölçeği |
| Kendi uzman profilini düzenle, medya yükle | ✓ |
| Ürün geri bildirimi oku | ✓ (yazma/silme yok) |
| Ürün verisi oluştur/güncelle/sil | ✗ (admin/editör) |

Ürün dosyası bir veri kaydıdır; uzman içerik üretir, dosyaya dokunmaz (ADR 0029 §2 ile aynı çizgi).

### 5. Silme

Uzman silinince **otomatik açılmış** hesabı da silinir (cascade). Bağlı hesap `admin`/`editor`
ise korunur: personel hesabı uzman kaydının eki değildir, kazara silinmesi yetki kaybıdır.

## Sonuçlar

- Uzmanın "hangi hesapla girdiği" tek yerden okunur: uzman kaydındaki `Panel Hesabı`.
- Hesapsız uzmanlar `pnpm seed:expert-accounts` (yerel) / `pnpm seed:expert-accounts:prod`
  (uzak, `SEED_EMAIL`/`SEED_PASSWORD`) ile idempotent biçimde eşleştirilir; panelde uzman
  kaydetmek de hesabı kendiliğinden açar.
- Kalıcı regresyon: `tests/int/expertAccounts.int.spec.ts` (otomatik hesap, 1:1, rol kilidi,
  cascade) ve `tests/int/access.int.spec.ts` (rol matrisi + ürün güncelleme daraltması).
- Şema değişikliği yok: alan zaten vardı, kurallar hook'ta. Geçiş için veritabanı migration'ı
  gerekmez; yalnız kayıtların eşleştirilmesi gerekir.
