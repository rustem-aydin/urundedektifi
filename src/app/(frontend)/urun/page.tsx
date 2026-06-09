import { getPayload } from 'payload'
import React from 'react'
import Link from 'next/link'

import config from '@/payload.config'
import { evaluateProductRules } from '@/lib/verdictEngine'
import { summarizePrices } from '@/lib/priceSummary'

function RatingBadge({
  rating,
}: {
  rating?: { name: string; color?: string; description?: string }
}) {
  if (!rating) return null
  const bg = rating.color || '#6b7280'
  return (
    <span
      className="verdict-badge"
      style={{ background: bg, color: '#fff' }}
      title={rating.description || rating.name}
    >
      {rating.name}
    </span>
  )
}

export default async function ProductPage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string; slug?: string }>
}) {
  const params = await searchParams
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  let product: any = null

  if (params.barcode) {
    const result = await payload.find({
      collection: 'products',
      where: { barcode: { equals: params.barcode } },
      limit: 1,
      depth: 2,
    })
    product = result.docs[0]
  } else if (params.slug) {
    const result = await payload.find({
      collection: 'products',
      where: { slug: { equals: params.slug } },
      limit: 1,
      depth: 2,
    })
    product = result.docs[0]
  }

  if (!product) {
    return (
      <div className="container">
        <div className="not-found">
          <h1>Ürün bulunamadı</h1>
          <p>Aradığınız barkod sistemde kayıtlı değil.</p>
          <a href="/tara" className="cta-button">Tekrar Tara</a>
        </div>
      </div>
    )
  }

  // Kural motoru
  const verdictResult = await evaluateProductRules(payload, product)

  // Görsel galerisi (Ön Yüz primary + 3 kategorize + ek fotoğraflar)
  type GalleryItem = { url: string; alt: string; label: string }
  const gallery: GalleryItem[] = []
  if (product.frontImage?.url) {
    gallery.push({
      url: product.frontImage.url,
      alt: product.frontImage.alt || product.name,
      label: 'Ön Yüz',
    })
  }
  if (product.ingredientsImage?.url) {
    gallery.push({
      url: product.ingredientsImage.url,
      alt: product.ingredientsImage.alt || 'İçindekiler',
      label: 'İçindekiler',
    })
  }
  if (product.nutritionImage?.url) {
    gallery.push({
      url: product.nutritionImage.url,
      alt: product.nutritionImage.alt || 'Besin Değerleri',
      label: 'Besin Değerleri',
    })
  }
  if (product.recyclingImage?.url) {
    gallery.push({
      url: product.recyclingImage.url,
      alt: product.recyclingImage.alt || 'Geri Dönüşüm',
      label: 'Geri Dönüşüm',
    })
  }
  for (const [i, img] of (product.additionalImages || []).entries()) {
    if (img?.image?.url) {
      gallery.push({
        url: img.image.url,
        alt: img.image.alt || img.caption || `Ek fotoğraf ${i + 1}`,
        label: img.caption || `Ek ${i + 1}`,
      })
    }
  }

  // Fiyat özeti
  const priceSummary = summarizePrices(product.prices)

  return (
    <div className="container product-page">
      <div className="product-header">
        {gallery.length > 0 && (
          <div className="product-gallery">
            <a
              href={gallery[0].url}
              target="_blank"
              rel="noreferrer"
              className="gallery-main"
              title={`${gallery[0].label} — büyük boyutta aç`}
            >
              <img src={gallery[0].url} alt={gallery[0].alt} />
              <span className="gallery-main-label">{gallery[0].label}</span>
            </a>
            {gallery.length > 1 && (
              <div className="gallery-thumbs">
                {gallery.slice(1).map((item, i) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="gallery-thumb"
                    title={item.label}
                  >
                    <img src={item.url} alt={item.alt} />
                    <span className="gallery-thumb-label">{item.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
        <div>
          <h1>{product.name}</h1>
          {product.brand?.name && (
            <p className="brand">
              Marka: <strong>{product.brand.name}</strong>
              {product.brand.isBoycotted && (
                <span className="warn"> 🛑 Boykotlu marka</span>
              )}
            </p>
          )}
          {product.category?.name && <p>Kategori: {product.category.name}</p>}
          {product.country?.name && <p>Menşe Ülke: {product.country.name}</p>}
          {product.manufacturer && <p>Üretici: {product.manufacturer}</p>}
          {product.model && <p>Model: {product.model}</p>}
          <p className="barcode">
            Barkod: <code>{product.barcode}</code>
          </p>

          {priceSummary && (
            <div className="price-summary-inline">
              <p className="price-range">
                <span className="muted small">Fiyat:</span>{' '}
                <strong className="price-big">{priceSummary.rangeText}</strong>
              </p>
              <p className="muted small">
                Ortalama: <strong>{priceSummary.averageText}</strong>
                {' · '}
                {priceSummary.count} kayıt
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Uzman Bazlı Değerlendirmeler */}
      {verdictResult.byExpert.length > 0 ? (
        <section className="expert-verdicts">
          <h2>🕵️ Uzman Değerlendirmeleri</h2>
          <p className="muted">
            {verdictResult.totalMatched} aktif kural eşleşti · {verdictResult.byExpert.length} uzman yorumu
          </p>
          {verdictResult.byExpert.map((ev) => (
            <div key={ev.expert.id} className="expert-block">
              <div className="expert-block-header">
                <h3>
                  <Link href={`/uzmanlar/${ev.expert.slug}`} className="expert-link">
                    {ev.expert.name}
                  </Link>
                </h3>
                {ev.ratings.length > 0 && (
                  <div className="expert-ratings">
                    <span className="muted small">Uzmanın ölçeği:</span>{' '}
                    {ev.ratings.map((r) => (
                      <span
                        key={r.id}
                        className="rating-scale-chip"
                        style={{
                          background: r.color || '#6b7280',
                          color: '#fff',
                        }}
                        title={r.description || r.name}
                      >
                        {r.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <ul className="rule-list">
                {ev.matchedRules.map((m) => (
                  <li key={m.id} className="rule-item">
                    <div className="rule-head">
                      <strong>{m.name}</strong>
                      <RatingBadge rating={m.rating} />
                    </div>
                    <p className="muted small">
                      {m.topic && (
                        <span
                          className="topic-chip small"
                          style={{ background: m.topic.color || '#374151' }}
                        >
                          {m.topic.icon} {m.topic.name}
                        </span>
                      )}
                      {m.matchedValue && (
                        <span> • {m.matchedValue}</span>
                      )}
                    </p>
                    <p>{m.description}</p>
                    {m.sources && m.sources.length > 0 && (
                      <p className="sources">
                        Kaynaklar:{' '}
                        {m.sources.map((s: any, i: number) => (
                          <a
                            key={i}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {s.title}
                            {i < (m.sources?.length || 0) - 1 ? ', ' : ''}
                          </a>
                        ))}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : (
        <section className="no-verdict">
          <p>
            Bu ürün için henüz eşleşen kural yok. Uzmanlar{' '}
            <Link href="/uzmanlar">kurallarını</Link> yazdıkça burası otomatik güncellenecek.
          </p>
        </section>
      )}

      {product.ingredientsAnalyzed && product.ingredientsAnalyzed.length > 0 && (
        <section className="ingredients">
          <h2>İçindekiler</h2>
          <ul>
            {product.ingredientsAnalyzed.map((ia: any, i: number) => {
              const ing = ia.ingredient
              return (
                <li key={i}>
                  {typeof ing === 'object' ? ing.name : ing}
                </li>
              )
            })}
          </ul>
          {product.allergens && product.allergens.length > 0 && (
            <p className="allergens">
              <strong>⚠️ Alerjenler:</strong>{' '}
              {product.allergens
                .map((a: string) => {
                  const labels: Record<string, string> = {
                    gluten: 'Gluten/Buğday',
                    milk: 'Süt/Laktoz',
                    egg: 'Yumurta',
                    soy: 'Soya',
                    peanut: 'Yer fıstığı',
                    nuts: 'Ağaç yemişleri',
                    fish: 'Balık',
                    shellfish: 'Kabuklu deniz ürünleri',
                    sesame: 'Susam',
                    mustard: 'Hardal',
                    celery: 'Kereviz',
                    sulphite: 'Sülfit',
                  }
                  return labels[a] || a
                })
                .join(', ')}
            </p>
          )}
        </section>
      )}

      {product.additives && product.additives.length > 0 && (
        <section className="additives">
          <h2>Katkı Maddeleri</h2>
          <ul>
            {product.additives.map((a: any, i: number) => {
              const add = a.additive
              return (
                <li key={i}>
                  {typeof add === 'object' ? (
                    <>
                      <code>{add.code}</code> — {add.name}
                    </>
                  ) : (
                    add
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {product.nutritionFacts && (
        <section className="nutrition">
          <h2>Besin Değerleri (100g/ml)</h2>
          <table>
            <tbody>
              {product.nutritionFacts.energyKcal != null && (
                <tr>
                  <td>Enerji</td>
                  <td>{product.nutritionFacts.energyKcal} kcal</td>
                </tr>
              )}
              {product.nutritionFacts.fat != null && (
                <tr>
                  <td>Yağ</td>
                  <td>{product.nutritionFacts.fat} g</td>
                </tr>
              )}
              {product.nutritionFacts.saturatedFat != null && (
                <tr>
                  <td>Doymuş yağ</td>
                  <td>{product.nutritionFacts.saturatedFat} g</td>
                </tr>
              )}
              {product.nutritionFacts.carbohydrates != null && (
                <tr>
                  <td>Karbonhidrat</td>
                  <td>{product.nutritionFacts.carbohydrates} g</td>
                </tr>
              )}
              {product.nutritionFacts.sugars != null && (
                <tr>
                  <td>Şeker</td>
                  <td>{product.nutritionFacts.sugars} g</td>
                </tr>
              )}
              {product.nutritionFacts.protein != null && (
                <tr>
                  <td>Protein</td>
                  <td>{product.nutritionFacts.protein} g</td>
                </tr>
              )}
              {product.nutritionFacts.salt != null && (
                <tr>
                  <td>Tuz</td>
                  <td>{product.nutritionFacts.salt} g</td>
                </tr>
              )}
            </tbody>
          </table>
          {product.nutriscore && (
            <p>
              Nutri-Score:{' '}
              <strong className={`nutri-${product.nutriscore}`}>
                {product.nutriscore.toUpperCase()}
              </strong>
            </p>
          )}
        </section>
      )}

      {/* Etiketler / Sertifikalar (gıda + non-food ortak) */}
      {product.labels && product.labels.length > 0 && (
        <section className="labels-section">
          <h2>🏷️ Etiketler & Sertifikalar</h2>
          <div className="label-chips">
            {product.labels.map((l: string) => {
              const labels: Record<string, string> = {
                vegan: '🌱 Vegan',
                vegetarian: '🥗 Vejetaryen',
                'gluten-free': 'Glütensiz',
                'lactose-free': 'Laktozsuz',
                organic: '🌿 Organik',
                'halal-certified': '☪️ Helal',
                kosher: '✡️ Koşer',
                'non-gmo': 'GDO Yok',
                natural: 'Doğal',
                'no-additives': 'Katkısız',
                'sugar-free': 'Şekersiz',
                'ce-mark': 'CE',
                rohs: 'RoHS',
                'energy-star': 'Energy Star',
                'cruelty-free': '🐰 Hayvan Deneysiz',
                'vegan-certified-cosmetics': 'Vegan (Kozmetik)',
                'bpa-free': 'BPA Free',
                'paraben-free': 'Parabensiz',
                'sulfate-free': 'Sülfatsız',
                recyclable: '♻️ Geri Dönüştürülebilir',
                disposable: 'Tek Kullanımlık',
                reusable: 'Yeniden Kullanılabilir',
                'oeko-tex': 'Oeko-Tex',
                gots: 'GOTS',
                'fair-trade': 'Fair Trade',
                fsc: 'FSC',
                'energy-a-plus-plus-plus': 'Enerji A+++',
                'energy-a-plus-plus': 'Enerji A++',
                'energy-a-plus': 'Enerji A+',
                'energy-a': 'Enerji A',
                'energy-b': 'Enerji B',
              }
              return (
                <span key={l} className="label-chip">
                  {labels[l] || l}
                </span>
              )
            })}
          </div>
        </section>
      )}

      {/* Teknik Özellikler (key-value) */}
      {product.specifications && product.specifications.length > 0 && (
        <section className="specifications">
          <h2>📐 Teknik Özellikler</h2>
          <table>
            <tbody>
              {product.specifications.map((s: any, i: number) => (
                <tr key={i}>
                  <td>{s.key}</td>
                  <td>
                    {s.value}
                    {s.unit && <span className="muted small"> {s.unit}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Uyarılar */}
      {product.warnings && product.warnings.length > 0 && (
        <section className="warnings-section">
          <h2>⚠️ Uyarılar & Dikkat Edilmesi Gerekenler</h2>
          <ul className="warnings-list">
            {product.warnings.map((w: any, i: number) => (
              <li key={i} className={`warning-item warning-${w.severity || 'medium'}`}>
                <strong>
                  {w.severity === 'high' && '🔴 Yüksek Risk'}
                  {w.severity === 'medium' && '🟡 Dikkat'}
                  {(!w.severity || w.severity === 'low') && '🟢 Bilgi'}
                </strong>
                <p style={{ whiteSpace: 'pre-wrap', margin: '0.25rem 0 0' }}>{w.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Genel Bilgiler (Model, SKU, Garanti, Kullanım, Saklama, Ambalaj, Boyut) */}
      {(product.model ||
        product.sku ||
        product.warranty ||
        product.usage ||
        product.storage ||
        product.packaging ||
        product.size) && (
        <section className="general-info">
          <h2>ℹ️ Genel Bilgiler</h2>
          <table>
            <tbody>
              {product.model && (
                <tr>
                  <td>Model / Ürün Kodu</td>
                  <td>{product.model}</td>
                </tr>
              )}
              {product.sku && (
                <tr>
                  <td>SKU / Stok Kodu</td>
                  <td>{product.sku}</td>
                </tr>
              )}
              {product.warranty && (
                <tr>
                  <td>Garanti</td>
                  <td>{product.warranty}</td>
                </tr>
              )}
              {product.packaging && (
                <tr>
                  <td>Ambalaj</td>
                  <td>{product.packaging}</td>
                </tr>
              )}
              {product.size && (
                <tr>
                  <td>Boyut / Ağırlık</td>
                  <td>{product.size}</td>
                </tr>
              )}
              {product.storage && (
                <tr>
                  <td>Saklama Koşulları</td>
                  <td>{product.storage}</td>
                </tr>
              )}
            </tbody>
          </table>
          {product.usage && (
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Kullanım Talimatı</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{product.usage}</p>
            </div>
          )}
        </section>
      )}

      {/* Açıklama */}
      {product.description && (
        <section className="description-section">
          <h2>📝 Açıklama</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{product.description}</p>
        </section>
      )}

      {/* Fiyat Detayı */}
      {product.prices && product.prices.length > 0 && (
        <section className="prices-section">
          <h2>💰 Fiyat Detayı</h2>
          {priceSummary && (
            <p className="muted">
              <strong>{priceSummary.rangeText}</strong> aralığında, ortalama{' '}
              <strong>{priceSummary.averageText}</strong>. {priceSummary.count} kayıttan veri
              toplandı.
            </p>
          )}
          <ul className="price-list">
            {product.prices
              .slice()
              .sort((a: any, b: any) => (a.amount || 0) - (b.amount || 0))
              .map((p: any, i: number) => (
                <li key={i} className="price-item">
                  <div>
                    <strong>
                      {typeof p.amount === 'number'
                        ? p.amount.toLocaleString('tr-TR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : '—'}{' '}
                      ₺
                    </strong>
                  </div>
                  {p.date && (
                    <div className="muted small">
                      {new Date(p.date).toLocaleDateString('tr-TR')}
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}
