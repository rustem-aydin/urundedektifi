# Tanıtım videosu

Ana sayfa hero'sundaki tanıtım videosunun kaynağı. Film iki araçla üretilir:

1. **Remotion** (`video/remotion`) — uygulamanın kendi arayüz demosu: barkod okuma, ürün
   dosyası, uzman delilleri ve hüküm damgası. React bileşenleri, 1280×720, 30 fps, 10 sn.
2. **HyperFrames** (`video/hyperframes`) — film: açılış kartı, Remotion klibi, üç adım,
   kapanış kartı. HTML + GSAP kompozisyonu, 22 sn, tek MP4.

Yayınlanan dosya `public/video/barkod-dedektifi-tanitim.mp4` (1,6 MB, H.264, sessiz);
hero'da `src/components/HeroVideo.tsx` oynatır.

## Yeniden üretme

```bash
pnpm video:clip     # Remotion → video/hyperframes/assets/ui-demo.mp4
pnpm video:hero     # HyperFrames → public/video/barkod-dedektifi-tanitim.mp4
pnpm video:poster   # 3,4. saniyeden afiş → public/video/...-poster.jpg
```

Sıra önemli: HyperFrames kompozisyonu Remotion klibini `<video>` olarak gömer.
`video/remotion` bağımlılıkları kök projeden ayrıdır (`npm install` ile kurulur);
HyperFrames `npx hyperframes@0.9.29` ile çalışır ve sistemde `ffmpeg` ister.

## Notlar

- Fontlar sitenin kendi tipografisidir (Special Elite, Inter, JetBrains Mono) ve
  `video/*/public/fonts` altında yereldir; render sırasında ağa çıkılmaz.
- Barkod çubukları gerçek EAN-13 kodlamasından üretilir.
- Video sessizdir; bu yüzden `muted + autoplay + loop` tarayıcıda engellenmez.
  `prefers-reduced-motion` açıksa video kendiliğinden başlamaz, afiş ve oynat düğmesi görünür.
