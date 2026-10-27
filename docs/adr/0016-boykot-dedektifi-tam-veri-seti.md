# ADR 0016 — Boykot Dedektifi veri setinin tamamının uzman kuralı olarak alınması

- Durum: Kabul edildi
- Tarih: 2026-10-27
- İlgili: ADR 0009 (ürün dosyası), `src/lib/seed/boykotDedektifi.ts`,
  `src/lib/seed/data/boykot-dedektifi-brands.json`, `scripts/seed-boykot-dedektifi.ts`,
  `scripts/seed-boykot-prod.ts`, `src/lib/verdictEngine.ts`

## Bağlam

"Boykot Dedektifi" uzmanı ilk kurulduğunda elle derlenmiş 104 marka ve iki katmanlı bir kanıt
hiyerarşisi (BDS hedefi → **Boykotlu**, doğrulanmamış tüketici listesi → **Şüpheli**) taşıyordu.
Kaynak platform (boykotdedektifi.com) ise kendi veritabanını **3.950 marka** ve **altı durumlu tek
ölçek** ile yayımlıyor: Boykot · İkincil Boykot · Ahlaken Boykot · Şüpheli · Araştırılıyor · Uygun.
Bizim uzman kaydımız bu ölçeğin yalnız iki seviyesini biliyordu; markaların %96'sı sistemde yoktu.

Site ile aramızdaki farkı kapatmanın iki yolu vardı: (a) markaları yalnız `isBoycotted` ile işaretlemek,
(b) her markayı sitedeki durumuyla ayrı bir kural olarak yazmak. (a) "Şüpheli/Araştırılıyor/Uygun"
ayrımını ve marka gerekçesini kaybederdi: sorgulanan marka için hüküm değil yalnız "evet/hayır" çıkardı.

## Karar

- **Site verisi tek dosyada, tek seferlik kazınır.** `boykotdedektifi.com/site-haritasi` altındaki
  3.950 marka sayfası gezilip ad, durum, sahibi, menşei, kategori, açıklama ve gerekçe metni
  `src/lib/seed/data/boykot-dedektifi-brands.json` içine yazıldı. Seed planı bu dosyayı çalışma
  anında okur; veri güncellemesi kod değişikliği değil dosya değişikliğidir. (JSON'u `import` etmek
  yerine `fs` ile okumak bilinçli: aksi halde tsc 3 MB'lık literal tipi üretmeye çalışıyor.)
- **Ölçek sitedeki altı durumdur.** `rating-scales` kayıtları sitenin rozet renkleriyle birebir
  açılır (`#ba191c`, `#fc8405`, `#00008c`, `#fcd30c`, `#465468`, `#267f78`). Eski "Boykotlu"
  derecesi plandan çıktığı için temizlik adımında silinir.
- **Her marka için bir kural.** `ruleType: 'brand'` + marka ilişkisi + markanın durumuna denk derece.
  Kural adı `"<Marka> — <Durum>"`; açıklama durumun anlamını, sitenin gerekçe metnini ve marka
  sayfası bağlantısını taşır. Üstüne tek genel kural korunur: "İsrail Menşeli Ürün (GS1 729)".
  Genel `brand_boycotted` kuralı **kaldırıldı**: marka kuralı aynı ürün için ikinci bir delil
  satırı üretiyordu (Ülker'de "Marka Boykot Listesinde" + "Ülker — Boykot"). `isBoycotted`
  damgası ürün dosyasında aynen durur, hükmün delili artık tek satırdır.
- **`isBoycotted` yalnız Boykot/İkincil/Ahlaken için işaretlenir.** Şüpheli, Araştırılıyor ve Uygun
  kayıtları ürün dosyasında üst seviye "boykotlu" damgası üretmemeli; onların hükmü marka kuralından gelir.
- **Plandan çıkan kayıtlar silinir.** Seed, aynı uzman+konu altında planda olmayan kuralları ve
  aynı uzmanın planda olmayan derecelerini temizler. Sıra önemli: `expert_rules.rating_id` zorunlu
  olduğu için önce kural, sonra derece silinir (tersi FK ihlali verir).
- **Eski hayalet markalar silinir.** Yeni planda olmayan, eski elle derlenmiş 104'lük listeden
  kalan (`LEGACY_BRANDS`: Chevron, Intel, Carrefour, McDonald's …) ve ürün/kural referansı olmayan
  kayıtlar silinir. Silinmeselerdi `isBoycotted` işaretli kalıp marka kuralı olmadan "boykotlu"
  damgası üretirlerdi (yerel doğrulamada 12 böyle kayıt vardı).
- **Kopya marka yazımları birleştirilir.** Site "Mc Donald's", eski kayıt "McDonald's" gibi
  farklı yazımlar aynı normalize anahtara düşerse hedef kayıt sitedeki ad/slug olur, ürün
  referansları hedefe taşınır, kopya silinir. Silinemeyen kopya loglanır ve bırakılır. Site bazı
  markaları bilerek iki ayrı kayıt tutuyor ("KIWI"/"Kiwi", "Disney"/"Disney+", "Lay's"/"Lays");
  planda aynı normalize anahtara iki marka düşüyorsa birleştirme atlanır — 20 grup bu şekilde korundu.
- **Kural seti sayfalanarak yüklenir.** `loadRuleSet` önceden `limit: 2000` idi; 3.952 kuralın
  1.952'si sessizce kesilecekti. Artık 500'lük sayfalarla `hasNextPage` bitene kadar okunur.
- **Sayaçlar satır çekmez, SQL'de gruplanır.** Ölçüm şunu gösterdi: aynı `findAllDocs` çağrısı
  route handler içinde 0,7 sn, RSC (sayfa render) içinde 9,5 sn sürüyor — maliyet satır sayısıyla
  artıyor (~2,5 ms/satır). Bu yüzden ana sayfa, /konular ve /uzmanlar kural satırlarını hiç çekmez:
  `src/lib/ruleStats.ts` tek `GROUP BY GROUPING SETS` sorgusuyla konu/uzman sayaçlarını üretir,
  60 sn süreç içi önbellekte tutar ve kural yazımı/silmesi önbelleği düşürür.
- **Marka süzgeci sunucuda listelenmez.** /urunler 3.950 markayı tek istekte çekiyordu. Süzgeç artık
  `BrandCombobox`: yazdıkça `/api/brands?where[name][contains]=…&limit=20` üzerinden ilk 20 eşleşme.
  Seçili marka adı için sayfa tek `findByID` yapar. (3.950 seçeneklik `<Select>` zaten kullanılamazdı.)
- **Sayfalama yardımcısı.** `src/lib/findAllDocs.ts` büyük listeleri 2.000'lik sayfalarla gezer;
  hâlâ satır gerektiren tek yer uzman sayfasındaki derecelendirme sayımı.
- **Eşleştirme ürün başına daraltılır.** `evaluateProduct` kural setini marka/ülke ilişkisine göre
  indeksler (`rulesForProduct`), ürünün yalnız kendi marka+ülke kuralları ile markasız kurallar
  değerlendirilir. Kural taraması da aynı indeksi kullanır. Sonuç değişmez (marka kuralı markasız
  ürüne zaten uymaz), maliyet 3.950 → ~1-2 kural/ürün.

## Sonuçlar

- Yerel veritabanı: 3.950 marka (site ile 1:1), 3.951 kural (3.950 marka kuralı + GS1 ülke kuralı),
  6 derece, `isBoycotted` 2.231 markada (Boykot 1.844 + İkincil 337 + Ahlaken 50). Seed üç kez üst
  üste çalıştırıldı; son turlarda 0 yeni marka, 0 yeni kural — idempotent.
- Ürün hükmü doğrulandı: Ülker Çubuk Kraker → `Boykot` (tek delil: "Ülker — Boykot"),
  Eti Form Bisküvi → `Uygun`. `GET /api/products/case/:barcode` ve uzman sayfası (3.951 aktif kural,
  6 derece) canlı dev sunucusunda okundu.
- Maliyet ölçümleri (yerel dev, 3.951 kural): `loadRuleSet` 0,7–1,2 sn (tek sefer, `ruleSetCache`);
  yayındaki 5 ürünün tam taraması 20 ms; `listProductCases(24)` ~1 sn; `ruleStats` tek sorgu.
  Sıcak sayfa süreleri (öncesi → sonrası): ana sayfa 33 sn → 0,42 sn; /konular 12 sn → 0,77 sn;
  /uzmanlar 19 sn → 0,82 sn; /urunler 60 sn → 0,35 sn; ürün detayı 0,17 sn; uzman profili 0,4 sn.
- Sayaç doğrulaması: /konular "1 uzman · 3951 aktif kural", ana sayfa "3951 aktif kural",
  /uzmanlar uzman kartında 3951 — GROUP BY sonucu gerçek kural sayısıyla aynı.
- Üretim (urundedektifi.elharezmi.com) aynı veriyle yazıldı ve doğrulandı: 3.951 kural, 6 derece,
  2.232 boykotlu marka, toplam 5.543 marka (3.950 site + ürünlerin mevcut markaları); 68 eski kural
  ve 1 eski derece ("Boykotlu") silindi. Altı durumun tamamı gerçek ürünlerle okundu:
  Ülker → Boykot, A101 → Şüpheli, Bim/Eti → Uygun, Tempo → İkincil Boykot, Metro → Ahlaken Boykot,
  xroll → Araştırılıyor. Üretim sayfa süreleri: / 0,23 sn, /urunler 0,95 sn, /konular 0,15 sn,
  /uzmanlar 0,17 sn, uzman profili 1,54 sn.
- Veri tazeliği koddan bağımsızdır: site güncellendiğinde JSON yeniden üretilip seed tekrar koşulur;
  kural/derece temizliği eski kayıtları kendiliğinden kaldırır.
