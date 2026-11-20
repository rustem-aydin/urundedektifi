# ADR 0037 — Anonim HTML edge önbelleği uygulanmadı, /_next/image önbelleklendi

- Durum: Kabul edildi
- Tarih: 2026-11-20
- İlgili: `next.config.ts`, `scripts/cf-image-cache-rule.mjs`, `scripts/cf-cache-rule.mjs`

## Bağlam

Mobil istemci (Expo) aynı origin'den okuyor: liste JSON'u (`/api/products`) ve kart görselleri
(`/_next/image?url=…&w=…`). Ölçüm (2026-11-20, prod):

- Liste 24 ürün, `depth=2` tüm alanlar: 198 KB / 0,94 s → `select` + `depth=1` ile 53 KB / 0,59 s.
- `/_next/image` w=640 / 384 / 192 → 52 KB / 24,7 KB / 8,5 KB; hepsi `cf-cache-status: DYNAMIC`.
- `/api/media/file/*` uzantılı olduğu için varsayılan kuralla zaten HIT.

`/_next/image` yolunun uzantısı yok: Cloudflare varsayılan olarak önbelleklemiyor, her kart
isteği origin'de yeniden boyutlandırma yapıyordu.

## Karar

### 1. `/_next/image` edge'de 7 gün

Cache Rule: `http.request.uri.path eq "/_next/image"` → Eligible for cache, Edge TTL 7 gün
(override_origin), Browser TTL respect_origin. Medya dosya adları içerikle değişir (barkod/uuid),
bu yüzden bayat görsel riski yok. Ölçüm: `DYNAMIC` → `MISS` → `HIT`; `Age` artıyor.
Kural canlıda (zone elharezmi.com); kurulum/doğrulama `scripts/cf-image-cache-rule.mjs`.

### 2. Anonim HTML edge önbelleği YAPILMADI

Sayfalar `force-dynamic` ve HTML kullanıcıya göre değişiyor: başlıkta oturum çipi, takip
düğmeleri, kişisel rozetler. Anonim/oturumlu HTML'i ayırmadan edge'de tutmak, giriş yapmış
kullanıcıya misafir HTML'i servis etme riski taşır. Ürün dosyası sayfası zaten
`revalidate = 300` (ISR) + süreç içi 5 dk LRU ile korunuyor; ölçülen TTFB (~150 ms) kabul
edilebilir. Trafik arttığında yeniden değerlendirilecek tek yol: oturum çerezine göre
`Vary`/bypass ayrımı yapmak.

## Sonuç

- Görsel trafiği edge'den döner; mobil ilk ekran origin'e inmez.
- HTML önbelleği bilinçli olarak yok: kişiselleştirme ile tutarlılık arasında kişiselleştirme seçildi.
