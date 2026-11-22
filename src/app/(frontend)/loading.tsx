import { Skeleton } from '@/components/ui/skeleton'

/**
 * Grup geneli yükleme iskeleti: veri çözülürken sayfanın başlık ve kart
 * ızgarasını korur, içerik gelince düzen zıplamaz. Sayfaya özgü iskeleti olan
 * rotalar (`urunler`, `kategoriler`, `urun/[barcode]`) kendi dosyalarını kullanır.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <p role="status" className="sr-only">
        Yükleniyor…
      </p>
      <div className="flex flex-col items-start gap-3">
        <Skeleton className="h-5 w-28 rounded-sm" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="h-72" />
      </div>
    </div>
  )
}
