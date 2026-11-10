import Link from 'next/link'
import { ArrowLeft, PackageSearch } from 'lucide-react'

import { EvidenceTag } from '@/components/EvidenceTag'

/** 404: durum kodu Next tarafından 404 döner, arama motoru yumuşak 404 görmez. */
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-6 px-4 py-16">
      <EvidenceTag variant="stamp">DOSYA BULUNAMADI</EvidenceTag>
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[0.7rem] tracking-[0.3em] text-faded uppercase">404</p>
        <h1 className="font-display text-2xl sm:text-3xl">
          Bu adreste bir dosya yok
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Bağlantı eskimiş ya da dosya adı değişmiş olabilir. Ürün listesinden aradığın dosyayı
          bulabilirsin.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/urunler"
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          <PackageSearch className="size-4" aria-hidden="true" />
          Ürünlere göz at
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Ana sayfa
        </Link>
      </div>
    </div>
  )
}
