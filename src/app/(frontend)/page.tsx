import { getPayload } from 'payload'
import Link from 'next/link'

import config from '@/payload.config'
import { evaluateProductRules } from '@/lib/verdictEngine'
import { summarizePrices } from '@/lib/priceSummary'
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const [products, latestRules, experts, topics] = await Promise.all([
    payload.find({
      collection: 'products',
      where: { status: { equals: 'published' } },
      limit: 8,
      depth: 1,
    }),
    payload.find({
      collection: 'expert-rules',
      where: { isActive: { equals: true } },
      limit: 6,
      sort: '-createdAt',
      depth: 1,
    }),
    payload.find({
      collection: 'experts',
      where: {
        and: [{ isPublic: { equals: true } }, { verified: { equals: true } }],
      },
      limit: 6,
      sort: 'name',
      depth: 1,
    }),
    payload.find({
      collection: 'topics',
      limit: 12,
      sort: 'order',
      depth: 0,
    }),
  ])

  // Her ürün için verdict + fiyat özeti hesapla
  const productsWithVerdicts = await Promise.all(
    products.docs.map(async (p: any) => {
      const v = await evaluateProductRules(payload, p)
      const ps = summarizePrices(p.prices)
      return { product: p, verdict: v, priceSummary: ps }
    }),
  )

  return (
    <div className="home">
      <section className="hero">
        <div className="container">
          <h1>Ürünü Tara, Uzmanlar Yorumlasın</h1>
          <p>
            Barkod veya QR kod ile ürünleri tarayın. Alanında uzman kişilerin otomatik
            değerlendirmesine anında ulaşın.
          </p>
          <a href="/tara" className="cta-button">
            📷 Ürünü Tara
          </a>
        </div>
      </section>

      <section className="how-it-works">
        <div className="container">
          <h2>Nasıl Çalışır?</h2>
          <ol>
            <li>
              <strong>Uzmanlar kurallar yazar.</strong> "Domuz yağı içeren ürünler → Yasak", "İsrail
              menşeli → Boykot", "E621 katkısı → Önerilmez" gibi.
            </li>
            <li>
              <strong>Ürünler eklenir.</strong> Barkod, içindekiler, besin değerleri girilir.
            </li>
            <li>
              <strong>Siz taratırsınız.</strong> Tüm aktif kurallar otomatik değerlendirilir.
            </li>
          </ol>
        </div>
      </section>

      {topics.docs.length > 0 && (
        <section className="topics-list">
          <div className="container">
            <h2>Konular</h2>
            <p className="muted">
              Uzmanların çalıştığı alanlar. Bir konuya tıklayarak o alandaki uzmanlara ulaşın.
            </p>
            <div className="topics-grid">
              {topics.docs.map((t: any) => (
                <Link key={t.id} href={`/konu/${t.slug}`} className="topic-card">
                  <span className="topic-icon">{t.icon || '🏷️'}</span>
                  <span className="topic-name">{t.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {experts.docs.length > 0 && (
        <section className="experts-list">
          <div className="container">
            <h2>Uzmanlarımız</h2>
            <p className="muted">
              Sitedeki tüm değerlendirmeler bu uzmanların yazdığı kurallar ve yorumlar ile oluşur.
            </p>
            <div className="grid">
              {experts.docs.map((e: any) => (
                <Link key={e.id} href={`/uzmanlar/${e.slug}`} className="expert-card-link">
                  <article className="expert-card">
                    {e.avatar?.url && (
                      <img
                        src={e.avatar.url}
                        alt={e.avatar.alt || e.name}
                        className="expert-avatar"
                      />
                    )}
                    <h3>
                      {e.name} {e.verified && <span className="verified">✓</span>}
                    </h3>
                    {e.title && <p className="muted">{e.title}</p>}
                    {e.bio && (
                      <p className="muted small">
                        {e.bio.slice(0, 120)}
                        {e.bio.length > 120 ? '…' : ''}
                      </p>
                    )}
                  </article>
                </Link>
              ))}
            </div>
            <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <Link href="/uzmanlar" className="cta-button-secondary">
                Tüm uzmanları gör →
              </Link>
            </p>
          </div>
        </section>
      )}

      {productsWithVerdicts.length > 0 && (
        <section className="latest-products">
          <div className="container">
            <h2>Son Eklenen Ürünler</h2>
            <div className="grid">
              {productsWithVerdicts.map(({ product: p, verdict: v, priceSummary: ps }: any) => (
                <Link key={p.id} href={`/urun?barcode=${p.barcode}`} className="product-card">
                  {p.frontImage?.url && (
                    <img src={p.frontImage.url} alt={p.frontImage.alt || p.name} />
                  )}
                  <h3>{p.name}</h3>
                  {p.brand?.name && <p className="brand">{p.brand.name}</p>}
                  {ps && <p className="price-range-mini">💰 {ps.rangeText}</p>}
                  <div className="verdict-mini">
                    {v.byExpert.slice(0, 3).map((ev: any) => (
                      <span
                        key={ev.expert.id}
                        className="mini-badge"
                        title={ev.matchedRules.map((m: any) => m.name).join(', ')}
                      >
                        {ev.expert.name}: {ev.ratings.map((r: any) => r.name).join(', ') || '—'}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {latestRules.docs.length > 0 && (
        <section className="latest-rules">
          <div className="container">
            <h2>📋 Son Eklenen Uzman Kuralları</h2>
            <p className="muted">
              Uzmanlar bu kuralları yazdığında, eşleşen tüm ürünlere otomatik olarak uygulanır.
            </p>
            <div className="grid">
              {latestRules.docs.map((rule: any) => {
                const expert = rule.expert
                const topic = rule.topic
                return (
                  <article key={rule.id} className="rule-card">
                    {topic && (
                      <span
                        className="badge"
                        style={{
                          background: topic.color || '#e5e7eb',
                          color: 'white',
                        }}
                      >
                        {topic.icon} {topic.name}
                      </span>
                    )}
                    <h3>{rule.name}</h3>
                    <p
                      className="muted"
                      style={{
                        fontSize: '0.875rem',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {rule.description}
                    </p>
                    <p className="verdict">
                      Derece:{' '}
                      {rule.rating ? (
                        <span
                          className="verdict-badge"
                          style={{
                            background: rule.rating.color || '#6b7280',
                            color: '#fff',
                          }}
                        >
                          {rule.rating.name}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </p>
                    {expert?.name && (
                      <p className="author">
                        <Link href={`/uzmanlar/${expert.slug}`}>— {expert.name}</Link>
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
