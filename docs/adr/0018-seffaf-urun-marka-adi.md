# ADR 0018 — Ürün adının "Şeffaf Ürün" olarak değişmesi

- Durum: Kabul edildi
- Tarih: 2026-10-28
- İlgili: `src/payload.config.ts`, `src/app/(frontend)/layout.tsx`,
  `src/app/(frontend)/page.tsx`, `src/components/SiteHeader.tsx`,
  `src/components/SiteFooter.tsx`, `src/lib/wizard/*`, `package.json`,
  mobil repo: `app.json`, `android/app/build.gradle`, `android/app/src/main/**`, `src/lib/*`

## Bağlam

Uygulamanın adı "Ürün Dedektifi"ydi. Aynı adı taşıyan `urundedektifi` alan adı artık
alınamıyor (başkası tarafından alınmış); marka adı alan adıyla birlikte anıldığı için
adın değişmesi gerekti. Ürün henüz mağazada yayımlanmadı (ADR 0005: ikon/splash yer
tutucu, Play Store öncesi değişecek; EAS `submit` yapılandırması boş), yani kimlik
değişikliğinin geri dönüşü olmayan bir kullanıcı maliyeti yok.

## Karar

- **Yeni ad: Şeffaf Ürün.** Yalnız marka metni, sayfa başlığı ve mağaza adı olarak kullanılır.
  Koleksiyon adları, rota adları (`/urunler`, `/uzmanlar`), alan adları ve API sözleşmesi
  değişmez: ad bir etikettir, şema değildir.
- **"Dedektif" kelimesi yalnız üçüncü tarafla ilgili yerlerde kalır.** "Boykot Dedektifi",
  `boykotdedektifi.com` veri setini taşıyan bağımsız bir uzmandır (ADR 0016); kendi adı,
  kaynak bağlantıları ve seed dosyaları olduğu gibi bırakılır. Uzman Kuralı formundaki
  "Konu (Hangi Dedektif?)" etiketi ise bizim sözlüğümüzdü → "Konu (Hangi Uzman?)".
- **Vaka dosyası numarası `UD-2026` → `ŞÜ-2026`.** Dekoratif dosya numarası markanın
  baş harflerinden türediği için ada bağlıdır.
- **Tarayıcı/cihaz depolama anahtarları `urundedektifi.*` → `seffafurun.*`.**
  (IndexedDB `seffafurun.wizard`, `localStorage` taslak/sağlayıcı anahtarları, mobil
  AsyncStorage/SecureStore anahtarları.) Eski anahtarlar okunmaz: yarım kalmış taslak,
  kayıtlı yapay zekâ anahtarı ve önbellek bir kereliğine sıfırlanır. Yayın öncesi
  olduğu için taşıma kodu yazılmadı.
- **Mobil kimlik yeniden üretildi:** `app.json` → `name: "Şeffaf Ürün"`,
  `slug: "seffaf-urun"`, `scheme: "seffafurun"`, `android.package:
  "com.rustemaydin.seffafurun"`. `android/` prebuild çıktısı olduğu için (git'te izlenmiyor)
  gradle `namespace`/`applicationId`, `rootProject.name`, `strings.xml#app_name`,
  manifest şeması ve Kotlin paket dizini aynı adla elden geçirildi; build dizinleri silindi.
- **Değişmeyenler — bilinçli:** canlı API ana makinesi `urundedektifi.elharezmi.com`
  (uygulama ve seed betiklerinin varsayılanı) ve yerel `DATABASE_URL` veritabanı adı
  `urundedektifi`. İkisi de altyapı adıdır; değiştirmek çalışan dağıtımı ve yerel veriyi
  taşımayı gerektirir, marka metniyle birlikte yapılmaz. Yeni alan adına geçişte
  `EXPO_PUBLIC_API_URL` / `SEED_API_URL` ve Dokploy alan adı birlikte taşınır.

## Sonuçlar

- Web'de tek kaynak marka metni yok: başlık `payload.config.ts` (yönetici) ve
  `(frontend)/layout.tsx` (site) içinde; ikisi de güncellendi.
- Mobil uygulama yeni paket kimliğiyle ayrı bir uygulama olarak kurulur; eski
  `com.rustemaydin.urundedektifi` kurulumu cihazda kalırsa ikisi yan yana görünür.
- EAS `projectId` korunur (sahip + slug eşleşmesi değişmediği sürece build geçmişi aynı
  projede kalır); ilk EAS build'inde `slug` değişikliği doğrulanmalı.
- Doğrulama: her iki repoda `tsc --noEmit` temiz; web dev sunucusunda `<title>Şeffaf Ürün —
  Barkodu tara, kararı gör</title>` ve gövdede `ŞÜ-2026`; mobilde `expo config` yeni
  ad/slug/şema/paketi çözüyor ve `app:assembleDebug` yeni paketle derleniyor.
