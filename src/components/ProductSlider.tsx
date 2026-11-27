import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'

import { CaseCard } from '@/components/CaseCard'
import { SliderVerdictBadge, SliderVerdictCounts } from '@/components/SliderVerdictCounts'
import type { ProductCardData } from '@/lib/productCardData'

type SliderChrome = {
  /** Bölüm başlığının `id`si; `section`un `aria-labelledby` değeri. */
  id: string
  title: string
}

type ProductSliderProps = SliderChrome & {
  products: ProductCardData[]
  /** Bölümün tamamını listeleyen sayfa (ör. `/urunler?sirala=newest`). */
  viewAllHref: string
}

function SliderCard({ product }: { product: ProductCardData }) {
  const card = (
    <CaseCard className="flex h-full flex-col overflow-hidden py-0 transition-shadow group-hover:shadow-md">
      <div className="relative aspect-[4/3] w-full shrink-0 border-b border-border bg-muted/50">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt || product.name}
            fill
            quality={60}
            sizes="(min-width: 640px) 192px, 160px"
            className="object-contain p-3"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center p-2 text-center font-mono text-[0.6rem] leading-tight tracking-[0.1em] text-faded uppercase">
            Görsel yok
          </span>
        )}
      </div>
      <div className="flex min-h-[7.5rem] flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm leading-snug font-medium">{product.name}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {product.brandName || 'Marka belirtilmemiş'}
        </p>
        {/* Fiyat bloğu: rozet varsa fiyatın hemen üstünde durur; fiyat her kartta tabana hizalı kalır. */}
        <p className="mt-auto flex flex-col items-start gap-1 font-mono text-sm">
          <SliderVerdictBadge barcode={product.barcode} />
          {product.priceText ? (
            <span>{product.priceText}</span>
          ) : (
            <span className="text-faded">Fiyat yok</span>
          )}
        </p>
      </div>
    </CaseCard>
  )

  if (!product.href) return card

  return (
    <Link
      href={product.href}
      className="group block h-full rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {card}
    </Link>
  )
}

function SliderHeader({
  id,
  title,
  viewAllHref,
}: SliderChrome & { viewAllHref: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="font-display text-xl sm:text-2xl">
        {title}
      </h2>
      <div className="flex items-baseline gap-3">
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
        >
          Tümünü gör
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

/**
 * Yatay ürün slider'ı.
 *
 * Kartlar tek satırda yana kayar (`overflow-x-auto` + `snap-x`); mobilde iki kart,
 * masaüstünde dörtten fazlası görünür. Kaydırma bölgesi klavyeyle de odaklanabilir.
 * **Boş veride hiçbir şey çizmez**: "boş sonuç" bölümü gizler, yükleme/hata durumları
 * ayrı bileşenlerdedir (bkz. `ProductSliderSkeleton`, `ProductSliderError`).
 */
export function ProductSlider({
  id,
  title,
  products,
  viewAllHref,
}: ProductSliderProps) {
  if (products.length === 0) return null

  const barcodes = products
    .map((product) => product.barcode)
    .filter((barcode): barcode is string => Boolean(barcode))

  return (
    <section aria-labelledby={id} className="border-b border-border py-8">
      <SliderHeader id={id} title={title} viewAllHref={viewAllHref} />
      <div
        role="region"
        aria-label={`${title} ürünleri`}
        tabIndex={0}
        className="-mx-4 mt-5 overflow-x-auto px-4 pb-2 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <SliderVerdictCounts barcodes={barcodes}>
          <ul className="flex snap-x snap-mandatory gap-3 sm:gap-4">
            {products.map((product) => (
              <li key={product.id} className="w-40 shrink-0 snap-start sm:w-48">
                <SliderCard product={product} />
              </li>
            ))}
          </ul>
        </SliderVerdictCounts>
      </div>
    </section>
  )
}

/** Slider yüklenirken: başlık yerinde kalır, kart yuvaları nabız atar. */
export function ProductSliderSkeleton({ id, title }: SliderChrome) {
  return (
    <section aria-labelledby={id} aria-busy="true" className="border-b border-border py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="font-display text-xl sm:text-2xl">
          {title}
        </h2>
        <span className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
          Yükleniyor…
        </span>
      </div>
      <div className="mt-5 flex gap-3 overflow-hidden sm:gap-4" aria-hidden="true">
        {[0, 1, 2, 3].map((slot) => (
          <div key={slot} className="w-40 shrink-0 sm:w-48">
            <div className="aspect-[4/3] animate-pulse rounded-xl border border-border bg-muted" />
            <div className="mt-2 h-3 w-3/4 animate-pulse rounded-sm bg-muted" />
            <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded-sm bg-muted" />
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Slider verisi çekilemediğinde gösterilir; boş sonuçtan görünür biçimde ayrılır
 * (`role="alert"` + kırmızı şerit) ve listenin geri kalanı çalışmaya devam eder.
 */
export function ProductSliderError({ id, title }: SliderChrome) {
  return (
    <section aria-labelledby={id} className="border-b border-border py-8">
      <h2 id={id} className="font-display text-xl sm:text-2xl">
        {title}
      </h2>
      <div
        role="alert"
        className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-stamp/40 bg-card p-4"
      >
        <AlertTriangle className="size-4 shrink-0 text-stamp" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Bu bölüm şu an yüklenemedi. Ürün dosyalarına listeden ulaşabilirsin.
        </p>
        <Link
          href="/urunler"
          className="text-sm font-medium underline underline-offset-4 hover:text-stamp"
        >
          Tüm ürünler
        </Link>
      </div>
    </section>
  )
}
