import type { Payload } from 'payload'

type Rule = {
  id: string
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
  allergen?: string
  label?: string
  nutritionField?: string
  nutritionThreshold?: number
  description: string
  evidence?: any[]
  sources?: any[]
  isActive: boolean
}

type Product = {
  id: string
  name: string
  ingredientsAnalyzed?: any[]
  additives?: any[]
  allergens?: string[]
  country?: any
  brand?: any
  category?: any
  labels?: string[]
  nutritionFacts?: any
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
  if (typeof rel === 'object') return rel.id || null
  return String(rel)
}

function getRelObj(rel: any): any | null {
  if (!rel) return null
  if (typeof rel === 'object') return rel
  return null
}

function evaluateRule(rule: Rule, product: Product): { matched: boolean; matchedValue?: string } {
  const rt = rule.ruleType

  switch (rt) {
    case 'ingredient_text': {
      const ing = getRelObj(rule.ingredient)
      if (!ing) return { matched: false }
      const ingId = ing.id
      const found = product.ingredientsAnalyzed?.some((ia: any) => {
        const id = getId(ia.ingredient)
        return id === ingId
      })
      return found
        ? { matched: true, matchedValue: `İçindekilerde "${ing.name}" var` }
        : { matched: false }
    }
    case 'ingredient_excludes': {
      const ing = getRelObj(rule.ingredient)
      if (!ing) return { matched: false }
      const ingId = ing.id
      const found = product.ingredientsAnalyzed?.some((ia: any) => {
        const id = getId(ia.ingredient)
        return id === ingId
      })
      if (found) return { matched: false }
      return { matched: true, matchedValue: `"${ing.name}" bulunmuyor` }
    }
    case 'additive_code': {
      const additive = getRelObj(rule.additive)
      if (!additive) return { matched: false }
      const addId = additive.id
      const found = product.additives?.some((a: any) => {
        const id = getId(a.additive)
        return id === addId
      })
      return found
        ? { matched: true, matchedValue: `${additive.code} (${additive.name}) içeriyor` }
        : { matched: false }
    }
    case 'allergen': {
      if (!rule.allergen) return { matched: false }
      const found = product.allergens?.some((a: string) => a === rule.allergen)
      return found
        ? { matched: true, matchedValue: `Alerjen içeriyor: ${rule.allergen}` }
        : { matched: false }
    }
    case 'country': {
      const country = getRelObj(rule.country)
      if (!country) return { matched: false }
      const productCountryId = getId(product.country)
      if (productCountryId === country.id) {
        return { matched: true, matchedValue: `Menşe ülke: ${country.name}` }
      }
      return { matched: false }
    }
    case 'brand': {
      const brand = getRelObj(rule.brand)
      if (!brand) return { matched: false }
      const productBrandId = getId(product.brand)
      if (productBrandId === brand.id) {
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
      if (productCatId === productType.id) {
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
      const val = product.nutritionFacts?.[field]
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
      const val = product.nutritionFacts?.[field]
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

export async function evaluateProductRules(
  payload: Payload,
  product: Product,
): Promise<VerdictResult> {
  const result: VerdictResult = { byTopic: [], byExpert: [], totalMatched: 0 }

  let allRules: any
  try {
    allRules = await payload.find({
      collection: 'expert-rules',
      where: { isActive: { equals: true } },
      limit: 2000,
      depth: 1,
    })
  } catch (e) {
    console.error('Kurallar yüklenemedi', e)
    return result
  }

  const topicMap: Record<string, TopicVerdict> = {}
  const expertMap: Record<string, ExpertVerdict> = {}
  const allRatings = new Set<string>()

  for (const rule of allRules.docs as any as Rule[]) {
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
    if (rating) allRatings.add(rating.id)

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
