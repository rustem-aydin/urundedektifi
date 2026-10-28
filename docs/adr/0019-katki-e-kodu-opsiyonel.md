# ADR 0019 — Katkı maddesinde E-kodu opsiyonel

- Durum: Kabul edildi
- Tarih: 2026-10-28
- İlgili: ADR 0008 (Ekle/Düzenle), ADR 0010, mobil `productWrite`

## Bağlam

Katkı master listesinin (`additives`) kimliği E-kodu (`code`) idi: alan `required: true` +
tekil indeks, panelin başlığı da (`useAsTitle`) `code`. Ürün etiketlerinin bir kısmı katkıyı
yalnız adıyla yazıyor (ör. "Laktik asit", "Pektin"); Ekle sihirbazı kodsuz satır için
`E-kodu olmadan katkı kaydı oluşturulamaz` hatası veriyor, panelde de kayıt açılamıyordu.
Sonuç: adı okunabilen katkı ürüne hiç bağlanamıyordu.

## Karar

- **`code` opsiyonel, doluysa tekil.** Alan `required` değil; `unique` indeks duruyor,
  Postgres tekil indeksi birden çok `NULL`'u kabul eder — kodsuz kayıtlar çakışmaz.
  `beforeChange` kancası kodu normalize eder (`" e 330 "` → `E330`) ve boş değeri `null`'a
  çevirir; böylece `''` tekil indekse takılmaz.
- **`name` zorunlu kalır.** Kayıt için tek şart ad: E-kodu yoksa ad, varsa `ad ?? kod`
  wizard'da isim olarak kullanılır. Ne kod ne ad varsa hata verilir.
- **Yeni `title` alanı (türetilmiş, readOnly).** `useAsTitle` gerçek bir alan istiyor,
  sanal alan kabul edilmiyor. `beforeChange` `title = code ? "<kod> · <ad>" : "<ad>"`
  yazar; ilişki seçimleri, panel başlığı ve liste sütunu kodsuz kayıtta da anlamlı kalır.
  Migration mevcut satırları aynı kuralla doldurur; sonraki yazmalarda kanca günceller.
- **Sihirbazda "Yeni oluştur" kodsuz çalışır (web + mobil).** `resolveCreatedMasters`
  katkı satırı için `{ code, name }` yerine yalnız `{ name }` gönderir; aynı ad master
  listede varsa eskisi gibi mevcut kayda bağlanır, kopya açılmaz.
- **Hüküm metni kod yokluğuna dayanıklı.** `verdictEngine` `additive_code` kuralında
  `"E621 (MSG) içeriyor"` yerine kodsuz kayıtta `"MSG içeriyor"` yazar; `null` metne sızmaz.
- **Migration elle yazıldı:** `20261028_204639_additives_code_optional`
  (`ALTER COLUMN code DROP NOT NULL`, `ADD COLUMN IF NOT EXISTS title`, `UPDATE … WHERE
  title IS NULL`). Anlık görüntüye yalnız bu iki değişiklik işlendi. Üretimde
  `prodMigrations` konteyner açılışında bekleyen migration'ı kendisi uygular.

## Sonuçlar

- Kodsuz katkı admin formunda, sihirbazda ve ürün düzenlemede kaydedilebilir; panelde
  başlık/ilişki etiketi addan gelir, kodsuz satır boş görünmez.
- Aynı E-kodu ikinci kez girilemez (400); kodsuz kayıtlarda ad tekilliği zorlanmaz —
  aynı adı taşıyan kayıtlar eskisi gibi "en eski kanonik" kuralıyla eşlenir.
- Ürün sayfası kodsuz katkıyı yalnız adıyla listeler (kod öneki yok); kontrol:
  admin'de kodsuz kayıt → ürün dosyası "Katkı maddeleri" satırında ad görünür, `null`
  veya boş ayırıcı yok.
- Doğrulama: yerel API'de iki kodsuz kayıt + `''` kodu → üçü de `null` kodla oluştu;
  ` e 999 ` → `E999`, `title` = `E999 · Tmp Sitrik`; aynı kod ikinci kez → 400; panelde
  E-Kodu alanında `*` yok, adla kayıt açıldı (kodsuz satır listede `<E-Kodu yok>`);
  ürün sayfası kodsuz katkıyı adıyla bastı. `tsc`, `test:int` (18 test) temiz.
