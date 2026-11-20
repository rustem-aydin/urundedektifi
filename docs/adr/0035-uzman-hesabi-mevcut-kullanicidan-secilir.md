# ADR 0035 — Uzman panel hesabı mevcut kullanıcıdan seçilir

- Durum: Kabul edildi
- Tarih: 2026-11-20
- Yerini aldığı: ADR 0032 (uzman ↔ panel hesabı eşleşmesi)
- İlgili: ADR 0029 (rol yetki matrisi), `src/collections/Experts.ts`,
  `src/collections/Users.ts`

## Bağlam

ADR 0032, her uzman kaydı için hesabı otomatik açıyordu: e-posta uzmanın adından
türetiliyor (`boykot_dedektifi@expert.local`), rastgele şifre üretiliyor, rol
`Users.beforeChange` içinde iki yönde kilitleniyor ve uzman silinince hesap
cascade siliniyordu. Uygulamada bu otomasyon kullanılmadı:

- Personel hesapları zaten Kullanıcılar ekranında açılıyor ve gerçek e-posta ile
  yönetiliyor.
- Türetilmiş e-posta + sanal `accountEmail` alanı, tek ilişkiyi iki alana bölüyordu.
- "Uzman" rolü bu ekrandan açılamadığı için hesap açma sırası zorunlu hale geliyordu.

## Karar

### 1. Tek kolon: düzenlenebilir `experts.user` ilişkisi

Uzmanın panel hesabı, Uzmanlar formundaki `Panel Hesabı` alanından **var olan bir
kullanıcı seçilerek** bağlanır. Alan normal (salt okunur olmayan) `relationship`
alanıdır; ikinci bir e-posta kolonu yoktur. `accountEmail` sanal alanı kaldırıldı.

### 2. Otomatik hesap işlemleri kaldırıldı

- Uzman kaydı oluşturma/güncelleme hesap açmaz, e-posta yazmaz, rol değiştirmez.
- `Experts.beforeChange` / `afterRead` hesap hook'ları ve `src/lib/expertAccounts.ts`
  (e-posta türetme, rastgele şifre, rol çekme) silindi.
- Uzman silinince bağlı kullanıcı silinmez (cascade yok).

### 3. Rol yönetimi Kullanıcılar ekranında

`Users.beforeChange` uzman rol kapısı kaldırıldı. Admin, Kullanıcılar ekranında
`Uzman` rolüyle hesabı doğrudan açar veya mevcut hesabın rolünü belirler; uzman
kaydı yalnız bu hesaba bağlanır. Yetki matrisi (ADR 0029) değişmedi.

### 4. Temizlik

`seed:expert-accounts` / `seed:expert-accounts:prod` scriptleri ve
`tests/int/expertAccounts.int.spec.ts` kaldırıldı; davranışı artık
`tests/int/access.int.spec.ts` rol matrisi kapsar.

## Sonuçlar

- Uzman ↔ hesap bağı tek alanda, panelden yönetilir; 1 uzman = 1 hesap bir
  **konvansiyondur**, kod tarafından zorlanmaz.
- Şema değişikliği yok: `user` ilişkisi zaten vardı, sanal alanın kolonu yoktu.
- Hesapsız uzman yalnız sitede görünür; panele giriş için önce Kullanıcılar
  ekranında hesap açılıp Uzmanlar formundan bağlanmalıdır.
