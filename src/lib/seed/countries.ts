import { getAllCountries } from '@/lib/barcodePrefixes'
import { slugify } from '@/lib/slugify'
import { UN_MEMBER_STATES } from './unCountries'

/**
 * "Ülkeler" koleksiyonunun seed planı.
 *
 * Tek veri kaynağı `UN_MEMBER_STATES` (BM üyesi 193 ülke) + `PREFIX_RULES`
 * (GS1 barkod prefixleri). Yerel ve üretim seed betikleri bu planı paylaşır,
 * böylece iki ortam aynı listeyi yazar. Plan idempotenttir: mevcut kayıtlar
 * ISO kodu (yoksa ad) ile eşleşir, güncellenir; yeni ülke yaratılmaz.
 */

export type CountrySeedRecord = {
  name: string
  /** Addan üretilen URL kısa adı; create'e açıkça geçilir (koleksiyon varsayılanına güvenilmez) */
  slug: string
  iso: string
  /** Ana GS1 prefix (3 hane); GS1 aralığı yoksa null */
  code: string | null
  /** Ana prefix dışındaki GS1 prefixleri */
  aliases: string[]
}

/** Yerel (Local API) veya REST'ten gelen mevcut ülke kaydı. */
export type ExistingCountryDoc = {
  id: number
  name: string
  iso?: string | null
  code?: string | null
  aliases?: Array<{ prefix?: string | null } | string> | null
}

export type CountrySeedWrite = {
  id: number
  data: {
    name: string
    iso: string
    code: string | null
    aliases: { prefix: string }[]
  }
}

export type CountrySeedPlan = {
  creates: CountrySeedRecord[]
  updates: CountrySeedWrite[]
  unchanged: number
}

/** 193 BM üyesi ülke + GS1 prefix eşleşmesi. */
export function buildCountrySeed(): CountrySeedRecord[] {
  const gs1ByIso = new Map(getAllCountries().map((country) => [country.iso, country]))
  const slugs = new Set<string>()
  return UN_MEMBER_STATES.map(({ name, iso }) => {
    const gs1 = gs1ByIso.get(iso)
    const slug = slugify(name)
    // Üretimde (henüz yayınlanmamış) koleksiyon hook'u olmadan da benzersiz slug gerekir.
    if (!slug || slugs.has(slug)) throw new Error(`Ülke slug'ı geçersiz/çakışık: ${name} → ${slug}`)
    slugs.add(slug)
    return {
      name,
      slug,
      iso,
      code: gs1?.code ? gs1.code : null,
      aliases: gs1?.aliases ?? [],
    }
  })
}

function prefixesOf(doc: ExistingCountryDoc): string[] {
  return (doc.aliases ?? [])
    .map((alias) => (typeof alias === 'string' ? alias : alias.prefix))
    .filter((prefix): prefix is string => typeof prefix === 'string' && prefix.length > 0)
}

/** Mevcut kayıtlarla plandan yazılacak işlemleri üretir (saf fonksiyon). */
export function planCountrySeed(
  existing: ExistingCountryDoc[],
  records: CountrySeedRecord[] = buildCountrySeed(),
): CountrySeedPlan {
  const byIso = new Map<string, ExistingCountryDoc>()
  const byName = new Map<string, ExistingCountryDoc>()
  for (const doc of existing) {
    if (doc.iso) byIso.set(doc.iso.toUpperCase(), doc)
    byName.set(doc.name, doc)
  }

  const plan: CountrySeedPlan = { creates: [], updates: [], unchanged: 0 }
  const claimed = new Set<number>()

  for (const record of records) {
    const match = byIso.get(record.iso) ?? byName.get(record.name)
    if (!match) {
      plan.creates.push(record)
      continue
    }
    if (claimed.has(match.id)) {
      throw new Error(`Ülke planı çakıştı: ${record.name} (${record.iso}) → #${match.id}`)
    }
    claimed.add(match.id)

    // Kayıt GS1 aralığında yoksa mevcut elle girilmiş prefix korunur.
    const code = record.code ?? match.code ?? null
    const aliases = Array.from(new Set([...record.aliases, ...prefixesOf(match)]))
      .filter((prefix) => prefix !== code)
      .sort((a, b) => a.localeCompare(b))

    const current = prefixesOf(match).sort((a, b) => a.localeCompare(b))
    const unchanged =
      match.name === record.name &&
      (match.iso ?? '') === record.iso &&
      (match.code ?? null) === code &&
      current.length === aliases.length &&
      current.every((prefix, index) => prefix === aliases[index])

    if (unchanged) {
      plan.unchanged++
      continue
    }

    plan.updates.push({
      id: match.id,
      data: {
        name: record.name,
        iso: record.iso,
        code,
        aliases: aliases.map((prefix) => ({ prefix })),
      },
    })
  }

  return plan
}
