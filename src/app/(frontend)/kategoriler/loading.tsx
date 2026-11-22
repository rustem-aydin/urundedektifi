import { Skeleton } from '@/components/ui/skeleton'

/** Üst kategori bölümü: ikon + başlık, altında üç kolonluk alt kategori listesi. */
function CategorySectionSkeleton() {
  return (
    <div className="border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-40 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
      </div>
      <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="size-8 shrink-0 rounded-sm" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <p role="status" className="sr-only">
        Kategoriler yükleniyor…
      </p>
      <div className="flex flex-col items-start gap-2">
        <Skeleton className="h-5 w-32 rounded-sm" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </div>
      <div className="mt-8 flex flex-col gap-6 rounded-lg border border-border bg-card p-4 sm:p-6">
        {Array.from({ length: 4 }, (_, index) => (
          <CategorySectionSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}
