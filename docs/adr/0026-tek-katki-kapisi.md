# ADR 0026 — Tek katkı kapısı: her rol fotoğrafla açar, panel yalnız inceler

- Durum: Kabul edildi
- Tarih: 2026-11-01
- Yerini aldığı: ADR 0024'ün "giriş noktaları role göre ayrılır" kararı ve ADR 0008'in panel
  rollerine açık Ekle sihirbazı girişi
- İlgili: ADR 0024 (kullanıcı katkısı ve inceleme kuyruğu), ADR 0002 (ürün ekleme yetkisi),
  ADR 0009 (Düzenle), `src/components/ReviewWizard.tsx`, `src/app/(frontend)/inceleme/[id]/page.tsx`,
  `src/components/SiteHeader.tsx`, `src/app/inceleme/[id].tsx` (mobil)

## Bağlam

ADR 0024 iki giriş kapısı bıraktı: panel rolleri (`admin`, `editor`) `/ekle` sihirbazıyla ürün
açıyor, diğer herkes `/katki` ile fotoğraf gönderiyordu. Pratikte bu ayrım işe yaramadı:

- Panel üyesi ürünü kendi başına "ekleyebiliyordu"; oysa aynı kişinin ürünü fotoğrafla açıp
  inceleme kuyruğundan geçirmesi hem daha az kod hem daha tekdüze bir yaşam döngüsü demek.
- İki giriş, role bakan menü etiketi, `canAddProduct` bayrağı ve barkod "bulunamadı" dalında rol
  dallanması üretiyordu. Her yeni yüzey (tarama, elle sorgu, ürün ekranı, profil, anasayfa) bu
  dallanmayı yeniden yazmak zorundaydı.
- `/ekle` yarım kalan taslağı `localStorage`'da tutuyordu; inceleme akışında bu, ürünün kendisiyle
  yarışan ikinci bir taslak kaynağı yaratıyordu.

## Karar

### 1. Tek oluşturma yolu

Ürün **yalnız** Katkı Akışından doğar: `/katki` (web), `katki` (mobil) veya taramada "ürün yok"
dalı. Rol ayrımı yoktur; `admin` ve `editor` de fotoğraf gönderir, ürün `status: draft` açılır ve
`submittedBy` o kişiyi gösterir (kota ve tekillik kuralları ADR 0024'teki gibi).

### 2. `/ekle` kaldırıldı

Web `src/app/(frontend)/ekle/page.tsx` ve mobil `src/app/ekle.tsx` silindi. Yönlendirme bırakılmadı:
eski bağlantı 404 döner (uygulama içi tüm girişler güncellendi). Sihirbazın yaratma modu (boş taslak,
barkod adımı, `localStorage` yarım taslak, "yeni dosya" dalları) silindi; ADR 0008'in sihirbaz
makinesi yalnız inceleme modunda yaşar.

### 3. İnceleme yüzeyi tek: `/inceleme/[id]`

`EkleWizard` → `ReviewWizard` (web `src/components/wizard/ReviewWizard.tsx`, mobil
`src/app/inceleme/[id].tsx`). Kuyruktaki "Analiz et" bu ekranı açar: fotoğraflar katkıdan hazır
gelir, "Analiz et" düğmesi YZ analizini açıkça başlatır (açılışta otomatik çağrı yok), yayınlama
kayıt adımından yapılır. Mobil wizard bileşenleri `components/ekle/` → `components/inceleme/` taşındı.

### 4. Menü ve rozet

Gezinmede herkese `Katkı` görünür; `İnceleme` yalnız panel rollerine, görülmemiş taslak sayısı
rozetiyle (`GET /api/products/review/count`). `canAddProduct` bayrağı `isPanel` olarak yeniden
adlandırıldı: artık "ürün ekleyebilir" değil "inceleme yapabilir" anlamına gelir.

### 5. İnceleme akışı

- Kuyruk tüm `status: draft` ürünleri listeler (katkı sahibi olmayan panel taslakları dahil).
- Kişi kendi katkısını da inceleyip yayınlayabilir; kartta "senin katkın" etiketi durur.
- Kaydetme sonrası otomatik olarak sıradaki incelenmemiş taslağa geçilir; kuyruk boşsa `/inceleme`.
- "Baktım" (`products.is_submit`) ve görülmemişler-önce sırası korunur.
- Ret sessiz silmedir (ADR 0024 §Katkı Reddi aynen geçerli).

## Sonuçlar

- Ürün yaşam döngüsü tek: katkı → taslak → inceleme → yayın. Panel rolü ayrı bir "ekleme" hikâyesi
  taşımaz, dolayısıyla web/mobil ayrı ekran bakımı yok.
- Sihirbazın yarım taslak kalıcılığı kalktı; inceleme ekranı yenilenirse çalışma kaybolur (fotoğraflar
  üründe durur, yeniden analiz gerekir). Bilinçli kabul: yarım taslak kalıcılığı yaratma moduna aitti.
- `/ekle` bağlantısı paylaşılmışsa kırılır (404). Kullanıcı kararı: eski bağlantılar için yönlendirme
  tutulmayacak.
