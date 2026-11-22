import { Skeleton } from '@/components/ui/skeleton'

/** Ürün dosyası başlığı + iki içerik bölümü: gerçek sayfanın ızgarasını korur. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <p role="status" className="sr-only">
        Ürün dosyası yükleniyor…
      </p>
      <Skeleton className="h-4 w-28" />

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
        <Skeleton className="aspect-square w-full" />
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-5 w-24 rounded-sm" />
            <Skeleton className="h-5 w-20 rounded-sm" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <Skeleton className="h-6 w-44" />
          <div className="mt-auto flex flex-col gap-3 border-t border-dashed border-border pt-4">
            <Skeleton className="h-14 w-full max-w-[240px]" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-10">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="flex flex-col gap-4">
            <div className="flex items-baseline gap-3 border-b-2 border-border pb-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-28 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
