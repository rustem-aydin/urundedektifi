# ADR 0027 — İnceleme tek ekran: adım makinesi kaldırıldı

- Durum: Kabul edildi
- Tarih: 2026-11-01
- Yerini aldığı: ADR 0026 §3'ün "fotoğraf → onay → eşleme → kayıt" adım makinesi (web yüzeyi)
- İlgili: ADR 0024 (kullanıcı katkısı ve inceleme kuyruğu), ADR 0026 (tek katkı kapısı),
  `src/components/wizard/ReviewWizard.tsx`, `src/lib/wizard/productDraft.ts`

## Bağlam

ADR 0026 incelemeyi tek yüzeye indirdi ama yüzeyin kendisi dört adımlı bir sihirbaz olarak
kaldı: `draft.step` (`1 Fotoğraf · 2 Onay · 3 Eşleme · 4 Kayıt`) hangi bölümün görüneceğini
belirliyordu. Editör/admin geri bildirimi:

- Ekran bir "sihirbaz" gibi davranıyor: bir sonraki bölüme geçmek için "Eşlemeye geç",
  "Kayıt adımına geç" gibi düğmelere basmak gerekiyordu. Oysa aynı sayfada yapılan iş tek
  karar akışı: analiz et → alanları kontrol et → master eşle → kaydet.
- Adımlar arasında gezinmek geri dönüşleri gizliyordu: eşleme sırasında bir alanın yanlış
  olduğunu gören kişi önce "2. Onay"a dönmek zorundaydı.
- Fotoğraf ekleme yalnız 1. adımda görünüyordu; analiz sonrası eksik alan için fotoğraf
  eklemek adım değiştirmeyi gerektiriyordu.

## Karar

### 1. Tek ekran

`ReviewWizard` tek bir dikey akış çizer, adım durumu yoktur:

1. Barkod + fotoğraf sayısı başlığı, bildirim/hata satırları.
2. Sabit alt fotoğraf şeridi ve varsayılan **kapalı** çekmece: açıldığında fotoğraf ekleme, rol
   seçimi, kaldırma. Şerit her zaman görünür (ör. "3/6 FOTOĞRAF"), böylece alanları okurken
   fotoğrafa bakmak için sayfa başına dönmek gerekmez.
3. "Analiz et" / "Tekrar analiz et" düğmesi; analiz olmadan devam etmek isteyene
   "Analiz olmadan elle doldur" (yerel `manualEdit` bayrağı, taslakta saklanmaz).
4. Analiz varsa (ya da elle doldurma açıldıysa) alt alta: eksik veri kartı, alan onayı
   (`AnalysisSummary`), master eşleme (`MasterResolver`), eşleme özeti, kayıt (`SaveReview`).
   Fotoğraf rolleri kayıt bölümünde tekrarlanmaz; tek yer çekmecedir.

"Eşlemeye geç", "Kayıt adımına geç", "Analizi atla, elle doldur" ve adım çipleri silindi.

### 2. `Draft.step` kaldırıldı

Adım makinesi taslak tipinden de çıktı: `Draft` artık `step` taşımaz, `draftFromProduct` ve
`reviewDraftFromProduct` bu alanı üretmez. Taslak bellekte yaşadığı için geçiş göçü gerekmez.

### 3. Mobil yüzey bu ADR'nin dışında

Mobil (`expo-urundedektifi`, `inceleme/[id]`) kendi adımlı akışını korur; bu ADR yalnız web
inceleme ekranını bağlar. İki yüzey aynı sözleşmeyi (aynı uçlar, aynı eşleme kuralları)
paylaşmaya devam eder; ekran düzeni farkı bilinçlidir.

## Sonuçlar

- İnceleme tek sayfada kaydırılarak yapılır; iş sırası ekranın kendi düzeninden okunur, düğme
  tıklamalarından değil.
- Uzun sayfa: 30+ satırlık eşleme listesi ile kayıt bölümü aynı kaydırmada. Bilinçli kabul;
  bölüm başlıkları (`ANALİZ`, `EŞLEME`, `KAYIT`) sınırı korur.
- Analiz yapılmadan kaydetmek isteyen kişi elle doldurma düğmesine bir kez basar; bu bayrak
  taslakta saklanmadığı için sayfa yenilenince yeniden açılır.
- Eşleme satırlarındaki dört seçenek (`Eşleştir / Yeni oluştur / Atla / Ara`) bu ADR'de
  değişmedi; sadeleştirmesi ayrı bir karardır.
