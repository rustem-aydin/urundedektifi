# ADR 0030 — Canlı alan adı `barkoddedektifi.com`

- Durum: Kabul edildi (kayıt defteri NS değişimi kullanıcıda)
- Tarih: 2026-11-02
- Yerini aldığı: ADR 0018'in "canlı API ana makinesi `urundedektifi.elharezmi.com` değişmiyor"
  maddesi
- İlgili: `scripts/*-prod.ts` (SEED_API_URL varsayılanları), Cloudflare tüneli `seffaf-urun-tr`;
  ADR 0031 "Altyapı adları" maddesinin taşıma işi

## Bağlam

Marka metni ADR 0018'de "Barkod Dedektifi" olarak değişti ama canlı adres
`urundedektifi.elharezmi.com` kaldı; altyapı adı ile marka birbirini tutmuyordu. Yeni
`barkoddedektifi.com` alan adı satın alındı (kayıt operatörü Turkticaret.net).

Üretim trafiği Traefik domain kaydından değil, VPS 154.53.164.228'deki cloudflared tünelinden
geliyor: ingress `hostname → http://web-projects-urundedektifi-nmuxe0-h4kxby:3000`. Bu yüzden
uygulamaya domain eklemek Dokploy panelinden değil, Cloudflare tarafından yapılır.

## Karar

1. `barkoddedektifi.com` aynı Cloudflare hesabına zone olarak eklendi
   (`5f1b8a39a0c23513f4c81f97ff50f49b`, NS `nora/phil.ns.cloudflare.com`).
2. Zone içinde: apex ve `www` → `af7d5e92-e3b7-47ee-a6f2-474f29584c99.cfargotunnel.com`
   (proxied). E-posta kesilmesin diye kayıt defterindeki MX (`mx.turkticaret.net`), SPF metni,
   `mail`/`autodiscover` CNAME'leri DNS-only olarak yeniden yazıldı.
3. Tünel ingress listesine `barkoddedektifi.com` ve `www.barkoddedektifi.com` eklendi; catch-all
   `http_status:404` sonda kaldı.
4. Uygulama kodu değişmiyor: Next/Payload host'a bağımsız çalışıyor (mutlak adres üretilmiyor,
   medya S3'ten `rusts.elharezmi.com` üzerinden geliyor). Yalnız seed/denetim betiklerinin
   `SEED_API_URL` varsayılanı yeni adrese çevrildi.
5. Eski adres **kaldırılmadı**: yüklü mobil APK'lar hâlâ `urundedektifi.elharezmi.com/api`
   çağırıyor; iki hostname de aynı servise gider. Yeni sürümler `EXPO_PUBLIC_API_URL` ile yeni
   adrese geçer.

## Kalan adım (elle, kayıt defteri)

Turkticaret.net panelinde alan adının ad sunucuları `nora.ns.cloudflare.com` ve
`phil.ns.cloudflare.com` yapılmalı. Zone `pending` durumda; NS değişmeden Cloudflare kenarı bu
hostname için TLS el sıkışması yapmıyor.

Doğrulama: `nslookup -type=NS barkoddedektifi.com 8.8.8.8` Cloudflare NS dönmeli,
`curl -sI https://barkoddedektifi.com/` 200 ve `server: cloudflare` vermeli.

## Sonuçlar

- Tek tünel, tek origin: yeni alan adı da aynı servise (`…-h4kxby:3000`) gider; ayrı Dokploy
  domaini, sertifika veya origin portu açılmadı.
- Eski adres ikinci isim olarak yaşadığı için geçiş kesintisiz; DNS geri alınabilir.
- Mobil uygulamanın kalıcı adres değişikliği yeni bir release derlemesi gerektirir.
