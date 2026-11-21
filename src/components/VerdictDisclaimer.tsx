import { cn } from '@/lib/utils'

/**
 * Uzman hükümlerinin hukuki çerçevesi.
 *
 * Hüküm, bağlayıcı resmî tespit ya da bilirkişi raporu değil; uzmanın kendi
 * yazdığı kurala ve o kuralın kaynaklarına dayanan değerlendirmedir. Bu metin
 * hükmün göründüğü her yüzeyde (ürün dosyası, kural dosyası, uzman profili)
 * aynen yer alır ve itiraz/düzeltme kanalını taşır — marka tarafından gelen
 * talebin "kanal yoktu" savunmasına düşmemesi için.
 */
export const CORRECTION_EMAIL = 'rustemaydinnn@gmail.com'

export function VerdictDisclaimer({ className }: { className?: string }) {
  const mailto = `mailto:${CORRECTION_EMAIL}?subject=${encodeURIComponent(
    'Hüküm düzeltme talebi',
  )}&body=${encodeURIComponent('Marka/ürün:\nİtiraz edilen hüküm:\nDayanak:')}`

  return (
    <aside
      className={cn(
        'flex flex-col gap-2 rounded-md border border-dashed border-border bg-card/60 px-4 py-3',
        className,
      )}
    >
      <p className="font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase">
        Uzman görüşü
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Hükümler, uzmanların kendi yazdığı kurallara ve o kuralların kaynaklarına dayanan{' '}
        <strong className="font-medium text-foreground">değerlendirmelerdir</strong>; resmî tespit,
        bilirkişi raporu veya satın alma tavsiyesi değildir. Her kural kaynağını ve son güncelleme
        tarihini gösterir; kaynak değişirse hüküm de güncellenir.
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Hakkınızda verilen bir hükme itiraz etmek veya düzeltme talep etmek için{' '}
        <a
          href={mailto}
          className="text-foreground underline underline-offset-4 hover:text-stamp"
        >
          {CORRECTION_EMAIL}
        </a>{' '}
        adresine yazın: talep incelenir, dayanak yetersizse kayıt düzeltilir veya kaldırılır.
      </p>
    </aside>
  )
}
