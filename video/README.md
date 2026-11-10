# Tanıtım videosu

Ana sayfa hero'sundaki tanıtım videosunun kaynağı. Film iki araçla üretilir:

1. **Remotion** (`video/remotion`) — uygulamanın kendi arayüz demosu: barkod okuma, ürün
   dosyası, uzman delilleri ve sonuç satırı. React bileşenleri, 1280×720, 30 fps, 10 sn.
   Tema bir prop'tur (`theme: 'light' | 'dark'`), paletler `src/theme.ts` içinde sitenin
   `index.css` değerleriyle aynıdır.
2. **HyperFrames** (`video/hyperframes`) — film: açılış levhası, Remotion klibi, üç adım,
   kapanış kartı. HTML + GSAP kompozisyonu, 20,4 sn, tek MP4. Renkler
   `data-composition-variables` ile dışarıdan verilir; koyu sürüm
   `dark-variables.json` dosyasıyla üretilir.

Yayınlanan dosyalar (H.264, sessiz):

| Tema | Video | Afiş |
|---|---|---|
| Açık | `public/video/barkod-dedektifi-tanitim-v3.mp4` | `…-v3-poster.jpg` |
| Koyu | `public/video/barkod-dedektifi-tanitim-v3-dark.mp4` | `…-v3-dark-poster.jpg` |

Hero'da `src/components/HeroVideo.tsx` oynatır: iki `<video>` birlikte basılır, görünürlüğü
`dark:` sınıfı belirler, oynatma yalnız aktif olanda başlar (`preload="none"` sayesinde
görünmeyen dosya indirilmez).

Dosya adı sürümlüdür: tarayıcı ve CDN bu yolu 4 saat önbelleğe aldığı için videoyu her
yeniden ürettiğinde soneki artır (`-v3` → `-v4`): `public/video`, `package.json` betikleri
ve `HeroVideo.tsx` içindeki `SOURCES`.

## Yeniden üretme

```bash
pnpm video:clip        # Remotion → video/hyperframes/assets/ui-demo.mp4
pnpm video:clip:dark   # Remotion (dark-props.json) → assets/ui-demo-dark.mp4
pnpm video:hero        # HyperFrames → public/video/…-v3.mp4
pnpm video:hero:dark   # HyperFrames (dark-variables.json) → …-v3-dark.mp4
pnpm video:poster      # 1,5. saniyeden iki afiş
```

Sıra önemli: HyperFrames kompozisyonu Remotion klibini `<video data-var-src="demoClip">`
olarak gömer; koyu film koyu klibi alır. `video/remotion` bağımlılıkları kök projeden
ayrıdır (`npm install` ile kurulur); HyperFrames `npx hyperframes@0.9.29` ile çalışır ve
sistemde `ffmpeg` ister.

## Notlar

- Fontlar sitenin kendi tipografisidir (Special Elite, Inter, JetBrains Mono) ve
  `video/*/public/fonts` altında yereldir; render sırasında ağa çıkılmaz.
- Barkod çubukları gerçek EAN-13 kodlamasından üretilir.
- Video sessizdir; bu yüzden otomatik oynatma tarayıcıda engellenmez.
  `prefers-reduced-motion` açıksa video kendiliğinden başlamaz, afiş ve oynat düğmesi görünür.
