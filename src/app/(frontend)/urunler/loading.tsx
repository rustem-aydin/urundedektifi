import { Skeleton } from '@/components/ui/skeleton'

/** Ürün kartının iskeleti: mobilde liste satırı, `sm` ve üzerinde dikey kart. */
function ProductCardSkeleton() {
  return (
    <div className="flex h-full gap-3 rounded-lg border border-border bg-card p-3 sm:flex-col sm:gap-4 sm:p-0">
      <Skeleton className="h-24 w-24 shrink-0 sm:aspect-[4/3] sm:h-auto sm:w-full sm:rounded-b-none" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:pt-4 sm:pr-4 sm:pb-4 sm:pl-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="mt-auto h-3 w-2/5" />
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <p role="status" className="sr-only">
        Ürünler yükleniyor…
      </p>
      <div className="flex flex-col items-start gap-2">
        <Skeleton className="h-5 w-24 rounded-sm" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Skeleton className="h-9 w-full sm:w-64" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="mt-6 h-3 w-56" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}
