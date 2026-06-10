// app/urun/[id]/page.tsx
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

// Dinamik metadata için
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const product = await payload.findByID({
    collection: 'products',
    id,
    depth: 2,
  })

  if (!product) return { title: 'Ürün Bulunamadı' }

  return {
    title: `${product.name} | Ürün Detayı`,
    description: product.description?.substring(0, 160) || `${product.name} ürün detayları`,
  }
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })

  const product = await payload
    .findByID({
      collection: 'products',
      id,
      depth: 2,
    })
    .catch(() => null)

  if (!product) notFound()

  // Güvenli dizi kontrolleri
  const ingredients = Array.isArray(product.ingredients) ? product.ingredients : []
  const allergens = Array.isArray(product.allergens) ? product.allergens : []
  const labels = Array.isArray(product.labels) ? product.labels : []
  const specifications = Array.isArray(product.specifications) ? product.specifications : []
  const warnings = Array.isArray(product.warnings) ? product.warnings : []
  const additionalImages = Array.isArray(product.additionalImages) ? product.additionalImages : []

  // Fiyat hesaplamaları
  const prices = Array.isArray(product.prices) ? product.prices.filter((p: any) => p?.amount) : []
  const minPrice = prices.length ? Math.min(...prices.map((p: any) => p.amount)) : null
  const maxPrice = prices.length ? Math.max(...prices.map((p: any) => p.amount)) : null
  const avgPrice = prices.length
    ? prices.reduce((a: number, b: any) => a + b.amount, 0) / prices.length
    : null

  // Tab kontrolü için
  const tabs = [
    { id: 'ingredients', label: '🧪 İçindekiler', hasData: ingredients.length > 0 },
    { id: 'nutrition', label: '🥗 Besin Değerleri', hasData: !!product.nutritionFacts },
    { id: 'labels', label: '🏷️ Etiketler', hasData: labels.length > 0 },
    { id: 'specs', label: '📦 Teknik Özellikler', hasData: specifications.length > 0 },
    { id: 'warnings', label: '⚠️ Uyarılar', hasData: warnings.length > 0 },
  ].filter((tab) => tab.hasData)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumb */}
        <nav className="flex mb-6 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/" className="hover:text-blue-600 transition">
            Ana Sayfa
          </Link>
          <span className="mx-2">/</span>
          <Link href="/urunler" className="hover:text-blue-600 transition">
            Ürünler
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-800 dark:text-gray-200">{product.name}</span>
        </nav>

        {/* Ana Ürün Kartı */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="grid lg:grid-cols-2 gap-8 p-6 lg:p-8">
            {/* Sol: Görsel Galerisi */}
            <div className="space-y-4">
              <div className="relative aspect-square bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden">
                {product.frontImage &&
                  typeof product.frontImage === 'object' &&
                  product.frontImage.url && (
                    <Image
                      src={product.frontImage.url}
                      alt={product.name}
                      fill
                      className="object-contain p-4"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority
                    />
                  )}
              </div>

              {/* Küçük Görsel Thumbnail'leri */}
              {(product.ingredientsImage || product.nutritionImage || product.recyclingImage) && (
                <div className="grid grid-cols-3 gap-3">
                  {product.ingredientsImage &&
                    typeof product.ingredientsImage === 'object' &&
                    product.ingredientsImage.url && (
                      <div className="relative aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition">
                        <Image
                          src={product.ingredientsImage.url}
                          alt="İçindekiler"
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                  {product.nutritionImage &&
                    typeof product.nutritionImage === 'object' &&
                    product.nutritionImage.url && (
                      <div className="relative aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition">
                        <Image
                          src={product.nutritionImage.url}
                          alt="Besin Değerleri"
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                  {product.recyclingImage &&
                    typeof product.recyclingImage === 'object' &&
                    product.recyclingImage.url && (
                      <div className="relative aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition">
                        <Image
                          src={product.recyclingImage.url}
                          alt="Geri Dönüşüm"
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Sağ: Ürün Bilgileri */}
            <div className="space-y-6">
              {/* Marka ve Kategori */}
              <div className="flex items-center gap-3 flex-wrap">
                {product.brand && typeof product.brand === 'object' && product.brand.name && (
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-semibold rounded-full">
                    {product.brand.name}
                  </span>
                )}
                {product.category &&
                  typeof product.category === 'object' &&
                  product.category.name && (
                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-semibold rounded-full">
                      {product.category.name}
                    </span>
                  )}
                {product.status === 'published' && (
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-semibold rounded-full">
                    ✓ Yayında
                  </span>
                )}
              </div>

              {/* Ürün Adı */}
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                {product.name}
              </h1>

              {/* Barkod */}
              {product.barcode && (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    />
                  </svg>
                  <span>Barkod: {product.barcode}</span>
                </div>
              )}

              {/* Fiyat */}
              {minPrice !== null && (
                <div className="border-t border-b border-gray-200 dark:border-gray-700 py-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {minPrice.toFixed(2)} ₺
                    </span>
                    {maxPrice !== null && maxPrice !== minPrice && (
                      <>
                        <span className="text-gray-400">-</span>
                        <span className="text-2xl font-semibold text-gray-600 dark:text-gray-400">
                          {maxPrice.toFixed(2)} ₺
                        </span>
                      </>
                    )}
                  </div>
                  {avgPrice !== null && prices.length > 1 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Ortalama {avgPrice.toFixed(2)} ₺ • {prices.length} fiyat kaydı
                    </p>
                  )}
                </div>
              )}

              {/* Açıklama */}
              {product.description && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Ürün Açıklaması
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Üretici Bilgileri */}
              {(product.manufacturer || product.country) && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {product.manufacturer && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Üretici:</span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {product.manufacturer}
                      </p>
                    </div>
                  )}
                  {product.country &&
                    typeof product.country === 'object' &&
                    product.country.name && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Menşei:</span>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {product.country.name}
                        </p>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detaylı Bilgiler Tabs */}
        {tabs.length > 0 && (
          <div className="mt-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="flex overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 border-b-2 border-transparent hover:border-blue-500 transition whitespace-nowrap"
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* İçindekiler */}
                {ingredients.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                      İçindekiler
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {ingredients.map((ing: any) => (
                        <span
                          key={ing.id}
                          className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm"
                        >
                          {ing.name}
                        </span>
                      ))}
                    </div>
                    {allergens.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">
                          ⚠️ Alerjen Uyarısı:
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {allergens.map((allergen: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded"
                            >
                              {allergen}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Besin Değerleri */}
                {product.nutritionFacts && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                      Besin Değerleri (100g/ml)
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(product.nutritionFacts).map(([key, value]) => {
                        if (!value || key === 'id') return null
                        const labels: any = {
                          energyKcal: '🔥 Enerji',
                          energyKj: '⚡ Enerji',
                          fat: '🥑 Yağ',
                          saturatedFat: '🍔 Doymuş Yağ',
                          transFat: '🚫 Trans Yağ',
                          carbohydrates: '🍚 Karbonhidrat',
                          sugars: '🍬 Şeker',
                          addedSugars: '➕ Eklenmiş Şeker',
                          fiber: '🌾 Lif',
                          protein: '🥩 Protein',
                          salt: '🧂 Tuz',
                          sodium: '💧 Sodyum',
                        }
                        const units: any = {
                          energyKcal: 'kcal',
                          energyKj: 'kJ',
                          fat: 'g',
                          saturatedFat: 'g',
                          transFat: 'g',
                          carbohydrates: 'g',
                          sugars: 'g',
                          addedSugars: 'g',
                          fiber: 'g',
                          protein: 'g',
                          salt: 'g',
                          sodium: 'mg',
                        }
                        return (
                          <div key={key} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {labels[key] || key}
                            </p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {typeof value === 'number' ? value.toFixed(1) : value}{' '}
                              <span className="text-xs">{units[key] || ''}</span>
                            </p>
                          </div>
                        )
                      })}
                    </div>
                    {product.nutriscore && (
                      <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <span className="font-medium">Nutri-Score:</span>
                        <span className="text-2xl font-bold uppercase">{product.nutriscore}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Etiketler */}
                {labels.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                      Etiketler & Sertifikalar
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {labels.map((label: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm rounded-full"
                        >
                          {label.replace(/-/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Teknik Özellikler */}
                {specifications.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                      Teknik Özellikler
                    </h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      {specifications.map((spec: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700"
                        >
                          <span className="text-gray-600 dark:text-gray-400">{spec.key}:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {spec.value}{' '}
                            {spec.unit && (
                              <span className="text-sm text-gray-500">({spec.unit})</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Uyarılar */}
                {warnings.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                      ⚠️ Uyarılar
                    </h3>
                    <div className="space-y-2">
                      {warnings.map((warning: any, idx: number) => {
                        const severityColors: any = {
                          low: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 text-blue-800',
                          medium:
                            'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 text-yellow-800',
                          high: 'bg-red-50 dark:bg-red-900/20 border-red-200 text-red-800',
                        }
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border ${severityColors[warning.severity] || severityColors.medium}`}
                          >
                            <p className="text-sm">{warning.text}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Ek Bilgiler Kartı */}
        {(product.packaging ||
          product.size ||
          product.model ||
          product.sku ||
          product.warranty) && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📦 Ambalaj & Teknik Detaylar
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {product.packaging && (
                <div>
                  <span className="text-gray-500 text-sm">Ambalaj:</span>
                  <p className="font-medium">{product.packaging}</p>
                </div>
              )}
              {product.size && (
                <div>
                  <span className="text-gray-500 text-sm">Boyut/Ağırlık:</span>
                  <p className="font-medium">{product.size}</p>
                </div>
              )}
              {product.model && (
                <div>
                  <span className="text-gray-500 text-sm">Model:</span>
                  <p className="font-medium">{product.model}</p>
                </div>
              )}
              {product.sku && (
                <div>
                  <span className="text-gray-500 text-sm">SKU:</span>
                  <p className="font-medium">{product.sku}</p>
                </div>
              )}
              {product.warranty && (
                <div>
                  <span className="text-gray-500 text-sm">Garanti:</span>
                  <p className="font-medium">{product.warranty}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
