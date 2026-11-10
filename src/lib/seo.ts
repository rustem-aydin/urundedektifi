import type { Metadata } from 'next'

import type { ProductCase } from './productCase'

/**
 * Gelişmiş SEO katmanı — tek kaynak.
 *
 * Sayfalar `pageMetadata()` ile kanonik adres, Open Graph/Twitter kartı ve dil
 * eşlemesini birlikte üretir; JSON-LD düğümleri aynı modülden gelir. Böylece bir
 * sayfada kanonik eksik kalsa bile başlık/açıklama tutarlı kalır.
 */

export const SITE_NAME = 'Barkod Dedektifi'
export const SITE_TAGLINE = 'Barkodu tara, kararı gör'
export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`
export const SITE_DESCRIPTION =
  'Barkodu tara; uzman kurallarına göre ürünün boykot, sağlık ve helal hükmünü anında gör.'

const FALLBACK_SITE_URL = 'https://barkoddedektifi.com'

function normalizeSiteUrl(value: string | undefined): string {
  if (!value) return FALLBACK_SITE_URL
  try {
    const parsed = new URL(value)
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '')
  } catch {
    return FALLBACK_SITE_URL
  }
}

/** Kanonik kök adres; sonunda eğik çizgi taşımaz. */
export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL,
)

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

export function absoluteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return absoluteUrl(url)
}

/** Meta açıklaması: tek satır, 160 karakter sınırı, kelime ortasında kesmez. */
export function metaDescription(
  value: string | null | undefined,
  fallback: string = SITE_DESCRIPTION,
): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  if (text.length <= 160) return text
  const cut = text.slice(0, 157)
  const lastSpace = cut.lastIndexOf(' ')
  const head = (lastSpace > 120 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:!?-]+$/, '')
  return `${head}…`
}

export const NOINDEX: NonNullable<Metadata['robots']> = {
  index: false,
  follow: true,
  googleBot: {
    index: false,
    follow: true,
    'max-image-preview': 'large',
  },
}

export const NOINDEX_NOFOLLOW: NonNullable<Metadata['robots']> = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
    'max-image-preview': 'none',
  },
}

export type SeoImage = {
  url: string
  alt?: string
  width?: number
  height?: number
}

type PageSeoInput = {
  title: string
  /** Ana sayfa gibi şablon eklenmemesi gereken başlıklar için. */
  absoluteTitle?: boolean
  description?: string | null
  /** Kanonik yol; sorgu parametreleri buraya girmez. */
  path: string
  images?: (SeoImage | null | undefined)[]
  type?: 'website' | 'article' | 'profile'
  noindex?: boolean
  nofollow?: boolean
  publishedTime?: string | null
  modifiedTime?: string | null
  authors?: string[]
}

function normalizeImages(
  images: PageSeoInput['images'],
  title: string,
): (Required<Pick<SeoImage, 'url' | 'alt'>> & Partial<Pick<SeoImage, 'width' | 'height'>>)[] {
  const provided = (images ?? [])
    .filter((image): image is SeoImage => Boolean(image?.url))
    .map((image) => ({
      url: absoluteUrl(image.url),
      alt: image.alt?.trim() || title,
      ...(image.width ? { width: image.width } : {}),
      ...(image.height ? { height: image.height } : {}),
    }))

  if (provided.length > 0) return provided

  return [
    {
      url: absoluteUrl('/og'),
      alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
      width: 1200,
      height: 630,
    },
  ]
}

/**
 * Sayfa üst verisi. `openGraph` her zaman tam üretilir: alt sayfada tanımlanan
 * nesne üst layout'un nesnesini değiştirdiği için eksik alan bırakılmaz.
 */
export function pageMetadata(input: PageSeoInput): Metadata {
  const title = input.title
  const description = metaDescription(input.description)
  const path = input.path.startsWith('/') ? input.path : `/${input.path}`
  const images = normalizeImages(input.images, title)
  const type = input.type ?? 'website'

  const baseOpenGraph = {
    siteName: SITE_NAME,
    locale: 'tr_TR',
    url: absoluteUrl(path),
    title,
    description,
    images,
  }

  let openGraph: Metadata['openGraph']
  if (type === 'article') {
    openGraph = {
      ...baseOpenGraph,
      type: 'article',
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
      ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
      ...(input.authors?.length ? { authors: input.authors } : {}),
    }
  } else if (type === 'profile') {
    openGraph = { ...baseOpenGraph, type: 'profile' }
  } else {
    openGraph = { ...baseOpenGraph, type: 'website' }
  }

  return {
    title: input.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: path,
      languages: {
        'tr-TR': path,
        'x-default': path,
      },
    },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((image) => image.url),
    },
    ...(input.noindex
      ? { robots: input.nofollow ? NOINDEX_NOFOLLOW : NOINDEX }
      : {}),
  }
}

/* -------------------------------------------------------------------------- */
/* JSON-LD                                                                     */
/* -------------------------------------------------------------------------- */

export type JsonLdNode = Record<string, unknown>

/** Birden çok düğümü tek `@graph` betiğinde birleştirir. */
export function jsonLdGraph(nodes: JsonLdNode[]): JsonLdNode {
  return { '@context': 'https://schema.org', '@graph': nodes }
}

export function organizationNode(): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'tr-TR',
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/icon'),
      width: 512,
      height: 512,
    },
  }
}

export function websiteNode(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: 'tr-TR',
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/urunler?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export type BreadcrumbItem = { name: string; path: string }

export function breadcrumbNode(items: BreadcrumbItem[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function webPageNode(input: {
  name: string
  description?: string | null
  path: string
  type?: 'WebPage' | 'CollectionPage' | 'ProfilePage'
  mainEntityId?: string
  items?: BreadcrumbItem[]
  numberOfItems?: number
}): JsonLdNode {
  return {
    '@type': input.type ?? 'WebPage',
    '@id': `${absoluteUrl(input.path)}#webpage`,
    url: absoluteUrl(input.path),
    name: input.name,
    ...(input.description ? { description: metaDescription(input.description) } : {}),
    inLanguage: 'tr-TR',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    ...(input.items?.length
      ? {
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: input.numberOfItems ?? input.items.length,
            itemListElement: input.items.map((item, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: item.name,
              url: absoluteUrl(item.path),
            })),
          },
        }
      : {}),
    ...(input.mainEntityId ? { mainEntity: { '@id': input.mainEntityId } } : {}),
  }
}

/** EAN-8/12/13/14 ve diğer sayısal kodlar için doğru GTIN özelliği. */
function gtinFields(barcode: string | null): Record<string, string> {
  const digits = (barcode ?? '').replace(/\D/g, '')
  if (!digits) return {}
  switch (digits.length) {
    case 8:
      return { gtin8: digits }
    case 12:
      return { gtin12: digits }
    case 13:
      return { gtin13: digits }
    case 14:
      return { gtin14: digits }
    default:
      return { gtin: digits }
  }
}

function productVerdictProperties(product: ProductCase): JsonLdNode[] {
  const properties: JsonLdNode[] = []
  for (const topicVerdict of product.verdict.byTopic) {
    const rating = topicVerdict.matchedRules.find((rule) => rule.rating?.name)?.rating?.name
    properties.push({
      '@type': 'PropertyValue',
      name: `${topicVerdict.topic.name} hükmü`,
      value: rating ?? 'Eşleşen kural yok',
    })
  }
  if (product.ingredients.length > 0) {
    properties.push({
      '@type': 'PropertyValue',
      name: 'İçindekiler',
      value: product.ingredients.map((ingredient) => ingredient.name).join(', '),
    })
  }
  if (product.labels.length > 0) {
    properties.push({
      '@type': 'PropertyValue',
      name: 'Etiketler',
      value: product.labels.map((label) => label.name).join(', '),
    })
  }
  return properties
}

export function productNode(product: ProductCase, path: string): JsonLdNode {
  const images = product.gallery
    .map((image) => absoluteMediaUrl(image.url))
    .filter((url): url is string => Boolean(url))
  const properties = productVerdictProperties(product)
  const pageUrl = absoluteUrl(path)
  const offers = product.priceSummary
    ? {
        '@type': 'AggregateOffer',
        url: pageUrl,
        priceCurrency: 'TRY',
        lowPrice: product.priceSummary.min.toFixed(2),
        highPrice: product.priceSummary.max.toFixed(2),
        offerCount: product.priceSummary.count,
      }
    : null

  return {
    '@type': 'Product',
    '@id': `${pageUrl}#product`,
    name: product.name,
    url: pageUrl,
    ...(product.description ? { description: metaDescription(product.description) } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    ...gtinFields(product.barcode),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.brand
      ? { brand: { '@type': 'Brand', name: product.brand.name } }
      : {}),
    ...(product.category ? { category: product.category.name } : {}),
    ...(product.manufacturer
      ? { manufacturer: { '@type': 'Organization', name: product.manufacturer } }
      : {}),
    ...(product.country
      ? { countryOfOrigin: { '@type': 'Country', name: product.country.name } }
      : {}),
    ...(properties.length > 0 ? { additionalProperty: properties } : {}),
    ...(offers ? { offers } : {}),
    inLanguage: 'tr-TR',
  }
}

export type PersonSeoInput = {
  name: string
  slug: string
  title?: string | null
  bio?: string | null
  avatarUrl?: string | null
  verified?: boolean | null
  socialLinks?: Record<string, unknown> | null
}

export function personNode(person: PersonSeoInput): JsonLdNode {
  const socials = Object.values(person.socialLinks ?? {}).filter(
    (value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value),
  )
  const avatar = absoluteMediaUrl(person.avatarUrl)

  return {
    '@type': 'Person',
    '@id': `${absoluteUrl(`/uzmanlar/${person.slug}`)}#person`,
    name: person.name,
    url: absoluteUrl(`/uzmanlar/${person.slug}`),
    ...(person.title ? { jobTitle: person.title } : {}),
    ...(person.bio ? { description: metaDescription(person.bio) } : {}),
    ...(avatar ? { image: avatar } : {}),
    ...(socials.length > 0 ? { sameAs: socials } : {}),
    worksFor: { '@id': `${SITE_URL}/#organization` },
  }
}

export type ArticleSeoInput = {
  title: string
  path: string
  description?: string | null
  images?: string[]
  datePublished?: string | null
  dateModified?: string | null
  author?: { name: string; path?: string | null } | null
  section?: string | null
}

export function articleNode(input: ArticleSeoInput): JsonLdNode {
  const pageUrl = absoluteUrl(input.path)
  const images = (input.images ?? [])
    .map((image) => absoluteMediaUrl(image))
    .filter((url): url is string => Boolean(url))

  return {
    '@type': 'Article',
    '@id': `${pageUrl}#article`,
    mainEntityOfPage: pageUrl,
    headline: input.title,
    ...(input.description ? { description: metaDescription(input.description) } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(input.section ? { articleSection: input.section } : {}),
    ...(input.author
      ? {
          author: {
            '@type': 'Person',
            name: input.author.name,
            ...(input.author.path
              ? { url: absoluteUrl(input.author.path) }
              : {}),
          },
        }
      : {}),
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'tr-TR',
  }
}

/** `JsonLd` bileşeninin ürettiği betik gövdesi: `<` kaçışı XSS'e kapatır. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}
