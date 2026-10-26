# ADR 0013 — Ürün görüntülenme sayacı

- Durum: Kabul edildi
- Tarih: 2026-10-25
- İlgili: mobil ADR 0014, `CONTEXT.md`

## Bağlam

Hangi ürün dosyalarının gerçekten açıldığı bilinmiyordu: elde ne hit ne de görüntülenme sayısı
vardı. İstenen: ürün dosyası her açıldığında sayacı veritabanında artırmak ve sayıyı hem web
hem mobil detay ekranında göstermek.

Kısıtlar: sayaç istemciden doğrudan yazılamamalı (şişirme yok), taslak/arşiv ürün sayılmamalı,
artış eşzamanlı ziyaretlerde kaybolmamalı, mevcut 10 dakikalık Dosya önbelleği bozulmamalı.

## Karar

- **Alan: `products.goruntulenme`** (`number`, `min: 0`, `defaultValue: 0`, panelde sidebar,
  readOnly). Alan düzeyi erişim `create: false, update: false`: Payload gelen veriden anahtarı
  siler, güncellemede saklı değeri korur. Yani panelden veya `PATCH` ile sayaç değiştirilemez.
- **Artış yalnız tek uçtan:** `POST /api/products/:id/goruntulenme`. Giriş gerekmez; tek
  atomik `UPDATE … SET goruntulenme = COALESCE(goruntulenme, 0) + 1 … RETURNING goruntulenme`
  çalışır. Okuyup yazmak eşzamanlı görüntülemelerde sayı kaybettirir. Yanıt `{ goruntulenme }`.
- **Yayın süzgeci uçta:** okuma herkese açık olduğu için `findByID` sonrası `status !==
  'published'` ise `404` döner; taslak ve arşiv ürün sayılmaz, içerik sızmaz. Kimlik sayı
  değilse `400`.
- **Sayaç önbellekten sunulmaz.** Dosya 10 dakika `caseCache`'te yaşar; sayaç da önbellekten
  okunsaydı sayfa yenilendiğinde sayı geriye düşerdi (ölçüldü: 1 → 0). Bu yüzden
  `viewCountFor()` tek indeksli PK sorgusuyla canlı sayıyı okur; detay sayfası ve
  `GET /api/products/case/:barcode` yanıtı bu taze değeri kullanır. Artış Dosya önbelleğini
  **düşürmez** (her açılışta kural motorunu yeniden çalıştırmak pahalı).
- **İstemci bekleme (beacon):** detay sayfasındaki `ProductViewCounter` sunucudan gelen sayıyla
  açılır, sekme oturumu başına bir kez POST atar ve dönen taze sayıyı gösterir. `sessionStorage`
  işareti React StrictMode'un çift effect'ini ve yenilemeyi ikinci görüntülenme saymaktan
  korur; depolama kapalıysa modül kümesi devreye girer. Liste kartları saymaz: kartın
  görünmesi görüntülenme değildir.
- **Liste sırası ve kart sayacı:** `/urunler` sorgusu `sort: ['-goruntulenme', '-createdAt']`
  ile gelir — en çok görüntülenen önce, eşitlikte (yeni ürünlerde 0) yayın tarihi belirler.
  Kartlar sayıyı salt okur (`viewCount`) ve göz ikonuyla basar; mobil liste aynı sıralamayı
  `sort=-goruntulenme,-createdAt` ile ister.
- **Metin:** göz ikonu + `1.234 görüntülenme` (mono mikro tipografi, `tr-TR` sayı biçimi).
- **Migration elle yazıldı:** `20261025_173424_add_goruntulenme`
  (`ADD COLUMN IF NOT EXISTS … numeric DEFAULT 0`). `payload migrate:create` kullanılmadı;
  son şema anlık görüntüsünde elle eklenen `product_feedback_vote_unique` kısmi tekil indeksi
  yok ve üretici onu `DROP INDEX` olarak diff'e koyardı. Anlık görüntüye yalnız yeni sütun
  eklendi. Sütun `numeric`: Postgres sürücüsü değeri metin döndürür, sunucu `Number()` ile
  sayıya çevirir.

## Sonuçlar

- Sayaç yalnız bu uçtan artar; istemci kodu veya üye oturumu değeri yazamaz.
- Görüntülenme tanımı "ürün dosyası açıldı"dır: arama sonucu/kart görünümü sayılmaz, aynı
  sekmede yenileme tekrar saymaz. Mobilde bu, uygulama oturumu başına ürün başına bir kezdir.
- Doğrulama: iki POST → `1`, `2`; taslak ürün ve bilinmeyen kimlik → `404`; `abc` → `400`;
  admin `PATCH { goruntulenme: 9999 }` değeri değiştirmez. Üretim derlemesinde tarayıcıda tek
  POST, yenilemede sıfır POST; yenilemede gösterilen sayı geriye düşmez.
- Boş veritabanında tüm migration zinciri uygulandı (`20261025_173424_add_goruntulenme`, 3 ms).
