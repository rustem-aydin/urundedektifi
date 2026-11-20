# ADR 0036 — Google ile giriş (web + mobil)

- Durum: Kabul edildi
- Tarih: 2026-11-20
- İlgili: ADR 0029 (rol yetki matrisi), `src/collections/Users.ts`, `src/lib/googleAuth.ts`,
  `src/components/GoogleSignInButton.tsx`, mobil `src/lib/googleAuth.ts`

## Bağlam

Tüketici hesabı yalnız e-posta + şifreyle açılıyordu. Web'de Google Identity Services (GIS), mobilde
Google Sign-In SDK'sı standart akış. İki istemci için ayrı OAuth yönlendirme uçları ve istemcide
istemci sırrı istemiyoruz; Payload oturumu tek yerde üretilmeli.

## Karar

### 1. Tek uç: `POST /api/users/google`

İstemci Google'dan **ID token** alır, gövdede `{ idToken }` olarak yollar. Uç jetonu Google'ın JWKS
anahtarlarıyla doğrular (imza, `iss`, `aud`, süre) ve `email_verified` şartını arar. Seyirci listesi
`GOOGLE_CLIENT_ID` / `GOOGLE_ANDROID_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` ortam değişkenlerinden gelir;
liste boşsa uç `503` döner. Geçersiz jeton `401`, doğrulanmamış e-posta `401`.

### 2. Jeton Payload'ın kendi biçiminde üretilir

Uç, `jose` ile HS256 imzalı `{ id, collection: 'users', email }` yükü üretir (`payload.secret`,
`users.auth.tokenExpiration`). Yanıt `{ token, exp, user }` şeklindedir; web ve mobil bunu şifreli
giriş yanıtıyla aynı oturum yazımından geçirir. Çerez kullanılmaz.

### 3. Hesap eşleştirme ve gölge hesap koruması

- Önce `googleId` (Google `sub`) aranır; e-posta değişse bile hesap bulunur.
- Yoksa e-posta büyük/küçük harf duyarsız aranır (`like` + tam eşleşme).
- Eşleşen hesap Google dışı yolla (şifreyle) açılmışsa `googleId` bağlanır **ve şifre rastgele
  döndürülür**. Açık kayıt e-posta doğrulaması yapmadığı için, bir saldırganın kurbanın e-postasıyla
  önceden açtığı hesabın şifresi gerçek sahibin Google girişinde erişim vermemeli.
- Hiç hesap yoksa rastgele şifreli, `role: 'user'` bir kullanıcı açılır. `googleId` alanı yalnız bu
  uçta yazılır (`overrideAccess`); genel REST'te alan erişimi kapalıdır.

### 4. İstemciler

- **Web**: GIS `<script>` + `renderButton` (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`). Düğme yoksa hiç
  basılmaz; şifreli giriş etkilenmez.
- **Mobil**: `@react-native-google-signin/google-signin`, `webClientId` =
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Android uygulaması paket adı + imza SHA-1'i ile tanınır; istemci
  sırrı yoktur. Expo web hedefinde düğme gizlenir.

## Sonuç

- Yeni ortam değişkenleri olmadan özellik görünmez/`503`; mevcut şifreli giriş bozulmaz.
- Şifreyle açılmış hesabın Google'a bağlanması şifreyi geçersiz kılar; kullanıcı sonraki girişlerde
  Google'ı kullanır.
- Google Cloud'da web istemcisi (yetkili JS kaynakları) ve Android istemcisi (paket + SHA-1)
  tanımlanmalıdır; aksi halde düğme açılsa da Google jeton vermez.
