import type { Metadata } from 'next'
import Link from 'next/link'

import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Künye',
  description:
    'Barkod Dedektifi künyesi: hizmet, sağlayıcı, iletişim, veri sorumlusu ve sorumluluk reddi.',
  path: '/kunye',
})

export default function KunyePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <p className="font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase">
        DOSYA NO: BD-KUNYE
      </p>
      <h1 className="mt-2 font-display text-3xl tracking-wide">Künye</h1>

      <h2 className="mt-10 font-display text-xl tracking-wide">Hizmet</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Barkod Dedektifi — barkoddedektifi.com web sitesi ve Barkod Dedektifi mobil uygulaması.
        Barkodla ürün bilgisi ve uzman görüşü sunan bilgi platformu; satış yapılmaz.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Sağlayıcı</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Rustem Aydın (gerçek kişi) — içerik sağlayıcı ve yer sağlayıcı.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Bu platform kişisel bir projedir; herhangi bir kamu kurumunu temsil etmez.
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Vergi durumu</h2>
      <p className="mt-3 text-sm text-muted-foreground">Vergi mükellefi değildir.</p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Yerleşim yeri</h2>
      <p className="mt-3 text-sm text-muted-foreground">Ankara / Altındağ</p>

      <h2 className="mt-10 font-display text-xl tracking-wide">İletişim</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        <a
          href="mailto:rustemaydinnn@gmail.com"
          className="underline underline-offset-4 hover:text-foreground"
        >
          rustemaydinnn@gmail.com
        </a>
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Veri sorumlusu</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Rustem Aydın (ayrıntı:{' '}
        <Link href="/gizlilik" className="underline underline-offset-4 hover:text-foreground">
          /gizlilik
        </Link>
        ).
      </p>

      <h2 className="mt-10 font-display text-xl tracking-wide">Sorumluluk reddi</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Görüşler resmî tespit değildir; ayrıntı{' '}
        <Link
          href="/kullanim-kosullari"
          className="underline underline-offset-4 hover:text-foreground"
        >
          /kullanim-kosullari
        </Link>
        .
      </p>

      <p className="mt-10 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
        SON GÜNCELLEME: 2026-11-23
      </p>
    </div>
  )
}
