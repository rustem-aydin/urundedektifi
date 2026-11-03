# ADR 0033 — Uzak sunucu adresleri `barkoddedektifi.com` altında

- Durum: Kabul edildi
- Tarih: 2026-11-03
- Yerini aldığı: ADR 0030 madde 4'ün "medya S3'ten `rusts.elharezmi.com` üzerinden geliyor"
  notu; ADR 0031'in "Altyapı adları" maddesindeki canlı API makinesi notu
- İlgili: Cloudflare tüneli `seffaf-urun-tr`, Dokploy uygulaması
  `2MAijUp4U-3R-fHmvvyGp`, `scripts/audit-orphan-media.ts`

## Bağlam

ADR 0030 canlı siteyi `barkoddedektifi.com` adresine taşıdı, ama altyapı adresleri
`elharezmi.com`da kaldı: panel `dokploy.elharezmi.com`, nesne deposu
`rusts.elharezmi.com`, uygulamanın mutlak adres değişkenleri
`urundedektifi.elharezmi.com`. `elharezmi.com` artık yerel/ikincil kullanıma ayrılıyor;
uzak sunucunun kendi markası altında adreslenmesi gerekiyor.

## Karar

1. Tünel ingress listesine iki hostname eklendi (catch-all `http_status:404` sonda kaldı):
   `dokploy.barkoddedektifi.com → http://dokploy:3000`,
   `rusts.barkoddedektifi.com → http://rustfs:9000`. Zone içinde aynı tünele proxied CNAME
   açıldı; sertifika ayrıca alınmadı (Universal SSL wildcard kapsıyor).
2. Dokploy uygulama env'i panel API'siyle güncellendi (`application.saveEnvironment`):
   `NEXT_PUBLIC_SERVER_URL` ve `PAYLOAD_PUBLIC_SERVER_URL` → `https://barkoddedektifi.com`,
   `S3_ENDPOINT` → `https://rusts.barkoddedektifi.com/`. Env Dokploy veritabanında tutulduğu
   için `docker service update --env-add` gibi elle müdahale sonraki deploy'da geri alınırdı.
3. `scripts/audit-orphan-media.ts` kullanım örneğindeki S3 adresi yeni host'a çevrildi.
4. `elharezmi.com` hostname'leri **silinmedi**: `dokploy.elharezmi.com`,
   `rusts.elharezmi.com`, `urundedektifi.elharezmi.com` hem tünelde hem DNS'te duruyor —
   yerel ortam ve eski mobil APK'lar bu adresleri kullanmaya devam ediyor.

## Doğrulama

- `https://dokploy.barkoddedektifi.com/` → 200, Dokploy giriş sayfası; `og:image` kendi
  host'unu gösteriyor.
- `https://rusts.barkoddedektifi.com/` → 403 `AccessDenied` XML'i, `rusts.elharezmi.com`
  yanıtıyla bayt bayt aynı (tünel yönlendirmesi kanıtı).
- `application.one` çıktısında üç env değeri yeni host'larda; deploy sonrası çalışan
  container env'i ve medya okuma ile doğrulandı.

## Sonuçlar

- Uzak ortam kendi alan adı altında: panel, S3 ve uygulama adresleri `barkoddedektifi.com`
  üzerinden erişilir; `elharezmi.com` yerel kullanım için serbest kalır.
- İki hostname aynı origin'e gittiği için geçiş kesintisiz ve geri alınabilir (ingress + DNS
  kayıtları tek tek geri yazılabilir).
- `NEXT_PUBLIC_SERVER_URL` derleme zamanında gömüldüğü için değişiklik yeni bir derleme
  gerektirdi; sonraki env değişikliklerinde de deploy şart.
