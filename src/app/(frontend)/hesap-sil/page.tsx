import type { Metadata } from 'next'

import { pageMetadata } from '@/lib/seo'
import { DeleteAccountPanel } from './DeleteAccountPanel'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: 'Hesabımı sil',
  description:
    'Barkod Dedektifi hesabınızı ve ilişkili kişisel verilerinizi kalıcı olarak silin. Google Play veri silme talebi sayfası.',
  path: '/hesap-sil',
})

/**
 * Google Play, hesap oluşturan uygulamalarda uygulama dışından erişilebilen bir hesap
 * silme yolu ister (mağaza girişindeki "Hesap silme URL'si" alanı bu adresi gösterir).
 * Sayfa oturum yoksa yol gösterir; oturum varsa tek onayla siler.
 */
export default function HesapSilPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <p className="font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase">
        DOSYA NO: BD-HESAP-SIL
      </p>
      <h1 className="mt-2 font-display text-3xl tracking-wide">Hesabımı sil</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Barkod Dedektifi hesabınız silindiğinde e-posta adresiniz, adınız, kısa tanıtımınız,
        avatarınız, takip listeniz, doğrulama oylarınız ve yorumlarınız kalıcı olarak silinir.
        Bu işlem geri alınamaz.
      </p>

      <DeleteAccountPanel />

      <h2 className="mt-10 font-display text-xl tracking-wide">Alternatif: e-posta ile talep</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Hesabınıza giriş yapamıyorsanız talebinizi{' '}
        <a
          href="mailto:rustemaydinnn@gmail.com?subject=Hesap%20silme%20talebi"
          className="underline underline-offset-4 hover:text-foreground"
        >
          rustemaydinnn@gmail.com
        </a>{' '}
        adresine yazın. Talepler en geç 30 gün içinde yanıtlanır.
      </p>

      <p className="mt-10 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
        SON GÜNCELLEME: 2026-11-21
      </p>
    </div>
  )
}
