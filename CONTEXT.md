# Ürün Dedektifi

Barkodla sorgulanan ürünlerin güvenilirliğini (boykot, sağlık, helal, içerik) uzman kurallarına göre değerlendiren, "delil dosyası" anlatısıyla sunan bir tüketici uygulaması.

## Language

### Ürün & Barkod

**Barkod**:
GS1/EAN-13 (veya UPC/EAN-8) ürün kimliği. Hem okutma hem sorgulama anahtarıdır; aynı barkodla ikinci ürün kaydı olmaz.
_Avoid_: ürün kodu, SKU (farklı şey)

**Ürün Dosyası**:
Bir barkoda ait derin, sunuma hazır paket: çözümlenmiş ürün + hükümler + galeri + fiyat özeti + etiket çevirileri. Web sayfası da mobil API de bu tek nesneyi tüketir.
_Avoid_: ürün detayı, ürün sayfası, detail DTO

**Ürün**:
Payload'da `products` koleksiyonu dokümanı. Ham veri; Dosya'ya dönüşmeden dışarı sunulmaz.

### Değerlendirme

**Konu**:
Değerlendirme ekseni (Helal, Vegan, Çevre, Boykot, Katkı vb.). Uzman kuralları bir konuya bağlıdır.
_Avoid_: kategori (ürün kategorisi ayrı şey)

**Uzman**:
Kuralları yazan, her biri kendi derecelendirme ölçeğine sahip değerlendirici profil.

**Uzman Kuralı**:
Bir uzmana ve bir konuya ait tek eşleşme kuralı. 12 kural tipi (içindekiler/katkı/alerjen/ülke/marka/boykot/kategori/besin min-max/etiket) destekler.
_Avoid_: politika, kontrol

**Delil**:
Bir ürünle **eşleşmiş** bir kuraldır (matched rules). Ürün sayfasında "delil" olarak sunulur; yakalanan `matchedValue` kullanıcıya eşleşme nedenini açıklar.
_Avoid_: eşleşme (teknik), sonuç

**Hüküm / Karar**:
Uzmanın bir ürün hakkındaki nihai değerlendirmesi (yenilebilir / boykot / riskli vb.). Birden çok Delil'den ve her uzmanın Derecelendirmesinden türer.
_Avoid_: skor, puan

**Derecelendirme / Derece**:
Bir uzmanın kendi ölçeğindeki tek bir seviye (örn: "Helal", "Riskli", "Boykot"). Renk + sıra (`rating-scales`) ile CMS'ten gelir.
_Avoid_: rozet, kötü/iyi

### Alan Yapısı (dikkat çekenler)

**Besinler / items**:
`products.items[]` — `{ ingredient: relationship, percent_estimate }` dizisi. İçindekiler listesini taşır; "Besinler" adı aldatıcıdır, besin değeri değildir.
_Avoid_: content, nutrition (bunlar diski karıştırır)

**Besin Değerleri / nutrition**:
`products.nutrition` — `{ per: '100g'|'100ml'|'serving', items: [{ nutrient, amount, unit }] }`. Gerçek gıda değerleri tablosu.
_Avoid_: besinler (bununla karıştırma)

**Boykotlu**:
Bir markanın `isBoycotted` flag'tir işaretli olması. Ürün Dosyasında üst seviye damga olarak gösterilir.
