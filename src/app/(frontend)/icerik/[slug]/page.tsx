import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { ruleTypeLabel } from '@/lib/ruleLabels'
import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { ProductCard } from '@/components/ProductCard'

export const metadata: Metadata = {
  title: 'İçerik',
}

export default async function IngredientDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const ingredientResult = await payload.find({
    collection: 'ingredients',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })
  const ingredient = ingredientResult.docs[0]
  if (!ingredient) notFound()

  const [rules, products] = await Promise.all([
    payload.find({
      collection: 'expert-rules',
      where: {
        and: [{ ingredient: { equals: ingredient.id } }, { isActive: { equals: true } }],
      },
      depth: 2,
      limit: 100,
      sort: 'name',
    }),
    payload.find({
      collection: 'products',
      where: {
        and: [{ status: { equals: 'published' } }, { 'items.ingredients': { equals: ingredient.id } }],
      },
      depth: 1,
      limit: 100,
      sort: 'name',
    }),
  ])

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <Link
        href="/urunler"
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        ← Ürünler
      </Link>

      <CaseCard tape className="mt-4 flex flex-col gap-3 p-5 sm:p-6">
        <EvidenceTag variant="evidence">İÇERİK DOSYASI</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">{ingredient.name}</h1>
        {ingredient.description ? (
          <p className="text-sm text-muted-foreground">{ingredient.description}</p>
        ) : null}
        <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
          {rules.totalDocs} kural · {products.totalDocs} yayında ürün
        </p>
      </CaseCard>

      <section className="mt-10">
        <h2 className="font-display text-xl">Bu içeriğe ait kurallar ({rules.totalDocs})</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          İçeriği kullanan uzman kuralları. Kurala girince eşleştiği ürünleri görürsün.
        </p>

        {rules.docs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Bu içerik için tanımlı uzman kuralı yok.
          </p>
        ) : (
          <ol className="mt-4 flex flex-col gap-3">
            {rules.docs.map((rule) => {
              const rating = rule.rating && typeof rule.rating === 'object' ? rule.rating : null
              const topic = rule.topic && typeof rule.topic === 'object' ? rule.topic : null
              const expert = rule.expert && typeof rule.expert === 'object' ? rule.expert : null
              return (
                <li key={rule.id}>
                  <Link href={`/kural/${rule.id}`} className="block">
                    <CaseCard className="gap-2 p-4 transition-shadow hover:shadow-md">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{rule.name}</p>
                        {rating ? (
                          <span
                            className="inline-flex w-fit shrink-0 items-center rounded-[3px] border-2 border-current px-2 py-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em]"
                            // Derecelendirme rengi CMS'ten serbest gelir; token dışı tek renk burada, inline stil ile uygulanır
                            style={{ color: rating.color || undefined }}
                          >
                            {rating.name}
                          </span>
                        ) : null}
                      </div>
                      <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                        {ruleTypeLabel(rule.ruleType)}
                        {expert?.name ? ` · ${expert.name}` : ''}
                        {topic?.name ? ` · ${topic.name}` : ''}
                      </p>
                    </CaseCard>
                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl">Bu içeriği taşıyan ürünler ({products.totalDocs})</h2>
        {products.docs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Yayında bu içeriği taşıyan ürün yok.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.docs.map((product) => {
              const image = product.frontImage && typeof product.frontImage === 'object' ? product.frontImage : null
              return (
                <ProductCard
                  key={product.id}
                  href={product.barcode ? `/urun/${product.barcode}` : null}
                  name={product.name || 'İsimsiz ürün'}
                  brandName={
                    product.brand && typeof product.brand === 'object' ? product.brand.name : null
                  }
                  categoryName={
                    product.category && typeof product.category === 'object'
                      ? product.category.name
                      : null
                  }
                  imageUrl={image?.url || null}
                  imageAlt={image?.alt || product.name}
                />
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
