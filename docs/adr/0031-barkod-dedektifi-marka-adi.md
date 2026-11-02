# ADR 0031 — Ürün adının "Barkod Dedektifi" olarak değişmesi

- Durum: Kabul edildi
- Tarih: 2026-11-02
- Yerini aldığı: ADR 0018 (marka adı "Şeffaf Ürün")
- İlgili: `src/payload.config.ts`, `src/app/(frontend)/layout.tsx`,
  `src/app/(frontend)/page.tsx`, `src/app/(frontend)/gizlilik/page.tsx`,
  `src/components/SiteHeader.tsx`, `src/components/SiteFooter.tsx`, `package.json`,
  `CONTEXT.md`; mobil repo: `app.json`, `android/app/**` (prebuild), `README.md`,
  `GLOSSARY.md`

## Bağlam

Ürünün adı "Şeffaf Ürün"dü (ADR 0018). O ad bir nitelik ifadesiydi; uygulamanın ne
yaptığını (barkod okut) söylemiyordu. Yeni ad **Barkod Dedektifi**. Uygulama hâlâ
mağazada yayımlanmadı (ADR 0005: ikon/splash yer tutucu, EAS `submit` yapılandırması
boş, Play yükleme kaydı yok), yani kimlik değişikliğinin geri dönüşü olmayan bir
kullanıcı maliyeti yok.

## Karar

- **Marka metni her yüzeyde "Barkod Dedektifi"**: site başlığı ve şablonu, yönetici
  paneli başlık eki, ana sayfa ve alt bilgi metni, gizlilik politikası, mağaza/launcher
  adı, npm paket adı (`barkod-dedektifi`).
- **Vaka dosyası numarası `ŞÜ-2026` → `BD-2026`; `ŞÜ-KVKK` → `BD-KVKK`.** Dekoratif
  numara markanın baş harflerinden türer.
- **Mobil kimlik yeniden üretildi:** `name: "Barkod Dedektifi"`,
  `scheme: "barkoddedektifi"`, `android.package: "com.rustemaydin.barkoddedektifi"`.
  `android/` prebuild çıktısı olduğu için (git'te izlenmiyor) `namespace` /
  `applicationId`, `rootProject.name`, `strings.xml#app_name`, manifest şeması ve
  Kotlin paket dizini aynı adla güncellendi; eski derleme dizinleri silinir.
- **Değişmeyenler — bilinçli:**
  - **EAS slug `urundedektifi`.** EAS projesinin kimliği bu slug'a bağlı; slug
    değiştirilince yeni slug eski projeyle eşleşmiyor (bkz. commit 242bee7). `owner` ve
    `extra.eas.projectId` değişmez, build geçmişi aynı projede kalır.
  - **Keystore alias `urundedektifi`** (mobil `credentials.json`): imza anahtarının
    takma adıdır; değiştirmek imza kimliğini bozar.
  - **Altyapı adları**: canlı API makinesi `urundedektifi.elharezmi.com`
    (`EXPO_PUBLIC_API_URL`, `SEED_API_URL`), `DATABASE_URL` veritabanı adı, S3 kök
    klasörü `urundedektifi`, repo dizin adı. Bunlar marka metni değil adres/kimliktir;
    taşınmaları ayrı bir dağıtım işidir.
  - **Depolama anahtarları** (`seffafurun.token`, `seffafurun.recent`,
    `seffafurun.cache`, `seffafurun.wizard`, `seffafurun.ai.*`). Kullanıcıya görünmez;
    yeniden adlandırmak oturumları düşürür, yarım taslakları ve önbelleği siler.
    "Kullanıcılar şaşırmasın" ilkesi gereği bu turda dokunulmadı; gerekirse tek
    seferlik taşıma (okuma eski anahtar → yazma yeni anahtar) ile sonra yapılır.
  - **"Boykot Dedektifi"**: `boykotdedektifi.com` veri setini taşıyan bağımsız uzmanın
    adıdır (ADR 0016); kendi adı, kaynak bağlantıları ve seed dosyaları olduğu gibi kalır.
  - **Eski ADR'ler (0016, 0018)** tarihsel kayıttır, yeniden yazılmaz.

## Sonuçlar

- Paket adı değiştiği için yeni derleme cihazda **ayrı bir uygulama** olarak kurulur;
  eski `com.rustemaydin.seffafurun` kurulumu elle kaldırılmalı (mobil README'deki
  `adb uninstall` satırı yeni pakete göre güncellendi). İlk mağaza yayınından sonra
  paket adı bir daha değiştirilmemeli.
- Yönetici paneli ve site başlığı aynı kaynaktan değil (`payload.config.ts` ve
  `(frontend)/layout.tsx`); ikisi de güncellendi, yeni marka eklendiğinde ikisi birlikte
  kontrol edilir.
- Doğrulama: web `tsc --noEmit` + `pnpm test:int` temiz; ana sayfada
  `<title>Barkod Dedektifi — Barkodu tara, kararı gör</title>`, gövdede `BD-2026`;
  mobilde `expo config` yeni ad/şema/paketi çözer ve release derlemesinde launcher
  etiketi "Barkod Dedektifi" olur.
