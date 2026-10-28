import type { Payload } from 'payload'

export type Rule = {
  id: string | number
  name: string
  expert: any
  topic: any
  ruleType: string
  rating?: any
  ingredient?: any
  additive?: any
  brand?: any
  country?: any
  productType?: any
  allergen?: string | null
  label?: string | null
  nutritionField?: string | null
  nutritionThreshold?: number | null
  description: string
  evidence?: any[] | null
  sources?: any[] | null
  isActive?: boolean | null
}

export type Product = {
  id: string | number
  name?: string | null
  /** Products.items[] — { ingredients: relationship, percent_estimate }[] */
  items?: any[] | null
  /** Products.additives — düz relationship dizisi (ID[] veya obje[]) */
  additives?: any[] | null
  /** Products.allergens — tek ilişki (kodda diziye normalize edilir) */
  allergens?: any
  country?: any
  brand?: any
  category?: any
  labels?: string[] | null
  /** Products.nutrition — { per, items: { nutrient: relationship, amount, unit }[] } */
  nutrition?: any
}

export type RatingInfo = {
  id: string
  name: string
  color?: string
  order?: number
  description?: string
}

export type MatchedRule = Rule & {
  matchedValue?: string
  expertName?: string
  expertSlug?: string
  topic?: { id: string; name: string; slug: string; icon?: string; color?: string }
  rating?: RatingInfo
}

export type TopicVerdict = {
  topic: { id: string; name: string; slug: string; icon?: string; color?: string }
  matchedRules: MatchedRule[]
}

export type ExpertVerdict = {
  expert: { id: string; name: string; slug: string }
  matchedRules: MatchedRule[]
  ratings: RatingInfo[]
}

export type VerdictResult = {
  byTopic: TopicVerdict[]
  byExpert: ExpertVerdict[]
  totalMatched: number
}

function getId(rel: any): string | null {
  if (!rel) return null
  // Kimlik karşılaştırmaları derinliğe bağlı olmamalı: depth 0'da ilişki sayı,
  // depth 1'de nesne gelir. Tek biçime (string) çevrilir.
  if (typeof rel === 'object') return rel.id != null ? String(rel.id) : null
  return String(rel)
}

function getRelObj(rel: any): any | null {
  if (!rel) return null
  if (typeof rel === 'object') return rel
  return null
}

function normalizeKey(s: any): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/** nutrition.items[] içinden nutrient slug/name'ine göre amount bulur */
function findNutritionAmount(product: Product, field: string): number | undefined {
  const items = product.nutrition?.items
  if (!Array.isArray(items)) return undefined
  const target = normalizeKey(field)
  for (const item of items) {
    const nutrient = item?.nutrient
    if (!nutrient) continue
    const slug = typeof nutrient === 'object' ? nutrient.slug : null
    const name = typeof nutrient === 'object' ? nutrient.name : null
    if (normalizeKey(slug) === target || normalizeKey(name) === target) {
      return typeof item.amount === 'number' ? item.amount : undefined
    }
  }
  return undefined
}

export function evaluateRule(
  rule: Rule,
  product: Product,
): { matched: boolean; matchedValue?: string } {
  const rt = rule.ruleType

  switch (rt) {
    case 'ingredient_text': {
      const ing = getRelObj(rule.ingredient)
      if (!ing) return { matched: false }
      const ingId = getId(rule.ingredient)
      const found = product.items?.some((ia: any) => {
        const id = getId(ia?.ingredients)
        return id === ingId
      })
      return found
        ? { matched: true, matchedValue: `İçindekilerde "${ing.name}" var` }
        : { matched: false }
    }
    case 'ingredient_excludes': {
      const ing = getRelObj(rule.ingredient)
      if (!ing) return { matched: false }
      const ingId = getId(rule.ingredient)
      const found = product.items?.some((ia: any) => {
        const id = getId(ia?.ingredients)
        return id === ingId
      })
      if (found) return { matched: false }
      return { matched: true, matchedValue: `"${ing.name}" bulunmuyor` }
    }
    case 'additive_code': {
      const additive = getRelObj(rule.additive)
      if (!additive) return { matched: false }
      const addId = getId(rule.additive)
      const found = product.additives?.some((a: any) => getId(a) === addId)
      return found
        ? { matched: true, matchedValue: `${additive.code} (${additive.name}) içeriyor` }
        : { matched: false }
    }
    case 'allergen': {
      if (!rule.allergen) return { matched: false }
      const target = normalizeKey(rule.allergen)
      // `allergens` koleksiyonda tek ilişki; eski veri dizisi gelebilir.
      const allergenRelations = Array.isArray(product.allergens)
        ? product.allergens
        : product.allergens
          ? [product.allergens]
          : []
      const found = allergenRelations.some((a: unknown) => {
        if (typeof a === 'string') return normalizeKey(a) === target
        if (!a || typeof a !== 'object') return false
        const candidate = 'slug' in a ? a.slug : 'name' in a ? a.name : null
        return normalizeKey(typeof candidate === 'string' ? candidate : null) === target
      })
      return found
        ? { matched: true, matchedValue: `Alerjen içeriyor: ${rule.allergen}` }
        : { matched: false }
    }
    case 'country': {
      const country = getRelObj(rule.country)
      if (!country) return { matched: false }
      const productCountryId = getId(product.country)
      if (productCountryId === getId(rule.country)) {
        return { matched: true, matchedValue: `Menşe ülke: ${country.name}` }
      }
      return { matched: false }
    }
    case 'brand': {
      const brand = getRelObj(rule.brand)
      if (!brand) return { matched: false }
      const productBrandId = getId(product.brand)
      if (productBrandId === getId(rule.brand)) {
        return { matched: true, matchedValue: `Marka: ${brand.name}` }
      }
      return { matched: false }
    }
    case 'brand_boycotted': {
      if (product.brand?.isBoycotted) {
        return {
          matched: true,
          matchedValue: `Boykotlu marka: ${product.brand.name}`,
        }
      }
      return { matched: false }
    }
    case 'category': {
      const productType = getRelObj(rule.productType)
      if (!productType) return { matched: false }
      const productCatId = getId(product.category)
      if (productCatId === getId(rule.productType)) {
        return { matched: true, matchedValue: `Kategori: ${productType.name}` }
      }
      if (product.category?.name?.toLowerCase().includes(productType.name?.toLowerCase() || '')) {
        return { matched: true, matchedValue: `Kategori: ${product.category.name}` }
      }
      return { matched: false }
    }
    case 'nutrition_max': {
      const field = rule.nutritionField
      if (!field) return { matched: false }
      const val = findNutritionAmount(product, field)
      if (typeof val === 'number' && val > (rule.nutritionThreshold || 0)) {
        return {
          matched: true,
          matchedValue: `${field}: ${val} > ${rule.nutritionThreshold} (100g/ml)`,
        }
      }
      return { matched: false }
    }
    case 'nutrition_min': {
      const field = rule.nutritionField
      if (!field) return { matched: false }
      const val = findNutritionAmount(product, field)
      if (typeof val === 'number' && val < (rule.nutritionThreshold || 0)) {
        return {
          matched: true,
          matchedValue: `${field}: ${val} < ${rule.nutritionThreshold} (100g/ml)`,
        }
      }
      return { matched: false }
    }
    case 'label_has': {
      if (!rule.label) return { matched: false }
      if (product.labels?.some((l: string) => l === rule.label)) {
        return { matched: true, matchedValue: `Etiket mevcut: ${rule.label}` }
      }
      return { matched: false }
    }
    case 'label_missing': {
      if (!rule.label) return { matched: false }
      if (product.labels && !product.labels.some((l: string) => l === rule.label)) {
        return { matched: true, matchedValue: `Etiket eksik: ${rule.label}` }
      }
      return { matched: false }
    }
    default:
      return { matched: false }
  }
}

function normalizeRating(raw: any): RatingInfo | undefined {
  if (!raw) return undefined
  if (typeof raw === 'object') {
    return {
      id: raw.id,
      name: raw.name,
      color: raw.color,
      order: raw.order,
      description: raw.description,
    }
  }
  return undefined
}

/**
 * Aktif uzman kurallarını sayfalayarak yükler.
 * getProductCase / listProductCases bunu bir kez çağırır;
 * eşleştirme bellek içinde yapılır (N+1 yok).
 *
 * Not: kural seti 3.900+ kayda çıkabildiği için (Boykot Dedektifi marka kuralları)
 * tek sayfalık limit kullanılmaz — aksi halde kuralar sessizce kesilirdi.
 */
export async function loadRuleSet(payload: Payload): Promise<Rule[]> {
  try {
    const rules: Rule[] = []
    const pageSize = 500
    for (let page = 1; ; page++) {
      const result = await payload.find({
        collection: 'expert-rules',
        where: { isActive: { equals: true } },
        limit: pageSize,
        page,
        depth: 1,
      })
      rules.push(...(result.docs as any as Rule[]))
      if (!result.hasNextPage || result.docs.length === 0) return rules
    }
  } catch (e) {
    console.error('Kurallar yüklenemedi', e)
    return []
  }
}

/**
 * Kural setinin ürün başına daraltılmış görünümü.
 *
 * Kural seti 3.900'ü aşkın marka kuralı taşıyor; her ürün için tümünü gezmek liste
 * sayfasını saniyelerce bekletiyordu. Marka ve ülke kuralları ilişki kimliğine göre
 * gruplanır, geri kalan (içindekiler/katkı/kategori/besin…) kurallar genel kovaya girer.
 * Ürünün markası/ülkesi yoksa yalnız genel kuralar değerlendirilir — bu, eşleşme
 * sonucunu değiştirmez (marka kuralı markasız ürüne zaten uymaz).
 */
type RuleIndex = {
  generic: Rule[]
  byBrand: Map<string, Rule[]>
  byCountry: Map<string, Rule[]>
}

const ruleIndexCache = new WeakMap<Rule[], RuleIndex>()

function pushIndex(map: Map<string, Rule[]>, key: string, rule: Rule) {
  const list = map.get(key)
  if (list) list.push(rule)
  else map.set(key, [rule])
}

function buildRuleIndex(rules: Rule[]): RuleIndex {
  const index: RuleIndex = { generic: [], byBrand: new Map(), byCountry: new Map() }
  for (const rule of rules) {
    if (rule.ruleType === 'brand') {
      const brandId = getId(rule.brand)
      if (brandId != null) {
        pushIndex(index.byBrand, String(brandId), rule)
        continue
      }
    }
    if (rule.ruleType === 'country') {
      const countryId = getId(rule.country)
      if (countryId != null) {
        pushIndex(index.byCountry, String(countryId), rule)
        continue
      }
    }
    index.generic.push(rule)
  }
  return index
}

export function rulesForProduct(product: Product, rules: Rule[]): Rule[] {
  let index = ruleIndexCache.get(rules)
  if (!index) {
    index = buildRuleIndex(rules)
    ruleIndexCache.set(rules, index)
  }

  const candidates = index.generic
  const brandId = getId(product.brand)
  const brandRules = brandId != null ? index.byBrand.get(String(brandId)) : undefined
  const countryId = getId(product.country)
  const countryRules = countryId != null ? index.byCountry.get(String(countryId)) : undefined

  if (!brandRules && !countryRules) return candidates
  return [...candidates, ...(brandRules ?? []), ...(countryRules ?? [])]
}

/** Saf eşleştirme: ürün + önceden yüklenmiş kural seti → hüküm. DB erişimi yok. */
export function evaluateProduct(product: Product, rules: Rule[]): VerdictResult {
  const result: VerdictResult = { byTopic: [], byExpert: [], totalMatched: 0 }

  const topicMap: Record<string, TopicVerdict> = {}
  const expertMap: Record<string, ExpertVerdict> = {}

  for (const rule of rulesForProduct(product, rules)) {
    const { matched, matchedValue } = evaluateRule(rule, product)
    if (!matched) continue

    const topic = rule.topic
    const topicId = typeof topic === 'object' ? topic?.id : topic

    const expert = rule.expert
    const expertId = typeof expert === 'object' ? expert?.id : expert

    const expertObj =
      typeof expert === 'object'
        ? { id: expertId, name: expert?.name, slug: expert?.slug }
        : { id: expertId, name: 'Uzman', slug: '' }

    const topicObj =
      topicId && typeof topic === 'object'
        ? {
            id: topicId,
            name: topic?.name || 'Konu',
            slug: topic?.slug || topicId,
            icon: topic?.icon,
            color: topic?.color,
          }
        : topicId
          ? { id: topicId, name: 'Konu', slug: String(topicId) }
          : null

    const rating = normalizeRating(rule.rating)

    const matchedRule: MatchedRule = {
      ...rule,
      matchedValue,
      expertName: expertObj.name,
      expertSlug: expertObj.slug,
      topic: topicObj || undefined,
      rating,
    }

    if (topicObj) {
      if (!topicMap[topicObj.id]) {
        topicMap[topicObj.id] = { topic: topicObj, matchedRules: [] }
      }
      topicMap[topicObj.id].matchedRules.push(matchedRule)
    }

    if (expertId) {
      if (!expertMap[expertId]) {
        expertMap[expertId] = {
          expert: expertObj,
          matchedRules: [],
          ratings: [],
        }
      }
      expertMap[expertId].matchedRules.push(matchedRule)
      if (rating && !expertMap[expertId].ratings.find((r) => r.id === rating.id)) {
        expertMap[expertId].ratings.push(rating)
      }
    }
  }

  for (const id in topicMap) {
    topicMap[id].matchedRules.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    result.byTopic.push(topicMap[id])
    result.totalMatched += topicMap[id].matchedRules.length
  }
  result.byTopic.sort((a, b) => a.topic.name.localeCompare(b.topic.name, 'tr'))

  for (const id in expertMap) {
    expertMap[id].matchedRules.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    expertMap[id].ratings.sort((a, b) => (a.order || 0) - (b.order || 0))
    result.byExpert.push(expertMap[id])
  }
  result.byExpert.sort((a, b) => a.expert.name.localeCompare(b.expert.name, 'tr'))

  return result
}

/** Geriye dönük uyumluluk: tek ürün için kural setini kendisi yükler. */
export async function evaluateProductRules(
  payload: Payload,
  product: Product,
): Promise<VerdictResult> {
  const rules = await loadRuleSet(payload)
  return evaluateProduct(product, rules)
}
