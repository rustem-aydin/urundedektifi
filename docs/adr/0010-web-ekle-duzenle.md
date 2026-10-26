# ADR 0010 — Web'de yapay zekâ destekli Ekle ve Düzenle

- Durum: Kabul edildi
- Tarih: 2026-10-24
- İlgili: mobil uygulamadaki ADR 0008 (Ekle sihirbazı) ve ADR 0009 (Düzenle)

## Bağlam

Ürün ekleme/düzenleme yalnız Expo uygulamasında vardı. Web'de `/ekle` bir yer tutucuydu,
`BarcodeScanner` kayıtsız barkodu işlevsiz bir demo forma (`GeneratedForm`) düşürüyordu.

## Karar

Mobildeki yazma akışı web'e taşındı; iki yüzey aynı sözleşmeyi paylaşır:

- **Tek akış:** barkod → fotoğraflar → YZ analizi → onay → master eşleme → kayıt.
  Düzenle ekranı analiz yapmaz; form `depth=2` ham dokümandan dolar (ADR 0009).
- **Saf mantık taşındı:** `src/lib/wizard/` altında `ai`, `productDraft`, `productPayload`,
  `productWrite`, `match`, `labels`. Kart/kural eşleştirme yine sunucudadır; istemci
  `verdictEngine` kopyası çıkarmaz.
- **Taban yol göreli:** web Payload ile aynı kaynakta çalıştığı için `/api` kullanılır
  (`NEXT_PUBLIC_PAYLOAD_API_URL` verilirse o kullanılır); CORS yok.
- **Kimlik:** `POST /api/users/login` ile alınan JWT `localStorage['payload-token']`'da tutulur
  (Payload admin ve `src/lib/api.ts` interceptor'ı ile aynı anahtar). Ekle/Düzenle/Sil
  yalnız `admin` ve `editor` rollerine açıktır; sunucu kapıları değişmedi.
- **Sağlayıcı anahtarı:** base URL + model `localStorage`'da, API anahtarı `sessionStorage`'da
  (sekme kapanınca silinir). Mobildeki `expo-secure-store`'un tarayıcı karşılığı yoktur;
  anahtar hiçbir zaman sunucumuza gönderilmez.
- **Fotoğraf kalıcılığı:** mobil taslakta dosya adresi saklar; tarayıcıda `File` yeniden
  yüklemede yaşamaz. Bu yüzden küçültülmüş JPEG blob'ları IndexedDB'de, taslak
  `localStorage`'da tutulur. Tarayıcı `createImageBitmap` + canvas ile 1568 px / JPEG 0.8'e indirir.
- **Kayıt semantiği mobil ile aynı:** Ekle yalnız boş alanları doldurur; Düzenle formun
  tamamını yazar, fotoğraf eklenmediyse mevcut görseller ve fiyat geçmişi gövdede yer almaz.
- **Eşleşme "Yeni"den sonra da görünür, kayıt öncesi sunucuya sorulur:** Öneri çipi yalnız
  `pending` satırda görünseydi "Yeni" seçilen satırda aynı ad master'da dururken hiçbir uyarı
  kalmıyordu ve toplu "Hepsini yeni oluştur" eşleşen satırları kopya kayda çeviriyordu
  (üretimde `Su` ×3, `Şeker` ×3, `Aroma Vericiler` ×2). Kural: (a) öneri her durumda çip olarak
  durur, (b) toplu "yeni" **önce eşleştirir** (`resolveSelection`), (c) kayıt anında
  `findMasterByName` normalize ad karşılaştırması yapar ve eşit ad varsa **mevcut (en eski)
  kayda bağlanır** — istemci listesi oturum boyunca önbellekte olduğu için sunucu otoritedir.
- **Ürün dosyası eylemleri:** `/urun/[barcode]` sayfası admin/editöre Düzenle ve Sil gösterir.

## Sonuç

`/ekle`, `/duzenle/[id]`, `/giris`, `/saglayici` yüzeyleri eklendi; `/tara` kayıtsız barkodu
`/ekle?barcode=...` adresine yönlendirir. İşlevsiz demo form (`AddProduct`, `multi-step-viewer`,
`file-upload`, `types/schemas`) kaldırıldı.
