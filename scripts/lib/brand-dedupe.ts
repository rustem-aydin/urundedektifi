/**
 * Marka adı standardı ve kopya marka birleştirme planı.
 *
 * Kural: marka adı özel isim gibi yazılır — her kelimenin ilk harfi büyük, kalanı küçük
 * ("NESTLE" → "Nestle", "kahve-dunyasi" → "Kahve-Dunyasi"). Türkçe i/İ ve ı/I ayrımı korunur,
 * kesme işaretinden sonra tek harflik ek küçük kalır ("Lay's"), iki+ harflik parça büyür
 * ("Carte d'Or" → "Carte D'Or"). Nokta yalnız kısaltmalarda büyütür: "Dr.Oetker" → "Dr.Oetker",
 * "Yemek.com" → "Yemek.com".
 *
 * Birleştirme anahtarı: Türkçe küçük harf + ı→i katlama + aksan/şapka silme + harf/rakam dışını
 * atma. Aynı anahtara düşen kayıtlar aynı markanın yazım varyantı sayılır; kanonik kayıt en çok
 * ürün taşıyan, ardından en düzgün yazılmış olandır. Farklı markalar olduğu bilinen anahtarlar
 * `MERGE_DENYLIST` içinde tutulur ve birleştirilmez.
 */

/** Aynı anahtara düşse de gerçekte farklı marka olan gruplar. */
const MERGE_DENYLIST: Record<string, string> = {
  tatarasi: 'Tatarası (tatlı) ile Tat Arası (Tat alt markası) farklı markalar',
  disney: 'Disney+ ayrı bir hizmet markası',
}

/**
 * Tamamı büyük harf yazılmış yabancı/İngilizce kelimelerde Türkçe küçük harf "I"yı "ı" yapar
 * ("ZURICH" → "zurıch"). Bu kelimelerin doğru küçük harfli yazımı burada tutulur; listede
 * olmayanlar Türkçe kurala göre küçültülür ("ALTIN" → "altın").
 */
const BRAND_WORD_OVERRIDES: Record<string, string> = {
  anisah: 'anisah',
  aqualin: 'aqualin',
  bio: 'bio',
  boombastic: 'boombastic',
  bublicious: 'bublicious',
  cariad: 'cariad',
  ciftligi: 'ciftligi',
  classico: 'classico',
  cocobite: 'cocobite',
  dacia: 'dacia',
  delights: 'delights',
  dippo: 'dippo',
  donaci: 'donaci',
  dripesso: 'dripesso',
  favori: 'favori',
  hdi: 'hdi',
  herbalwind: 'herbalwind',
  hotline: 'hotline',
  ibm: 'ibm',
  icl: 'icl',
  ii: 'ii',
  ing: 'ing',
  ion: 'ion',
  isidin: 'isidin',
  isushi: 'isushi',
  italiano: 'italiano',
  kiddy: 'kiddy',
  kiko: 'kiko',
  kiwi: 'kiwi',
  komili: 'komili',
  milkquick: 'milkquick',
  mirro: 'mirro',
  moia: 'moia',
  musclestation: 'musclestation',
  odpowiedzialnoscia: 'odpowiedzialnością',
  ograniczona: 'ograniczoną',
  original: 'original',
  puffkins: 'puffkins',
  quick: 'quick',
  rioba: 'rioba',
  rolling: 'rolling',
  sekerci: 'sekerci',
  skii: 'sk-ii',
  stick: 'stick',
  stix: 'stix',
  supermi: 'supermi',
  taki: 'taki',
  tigo: 'tigo',
  todix: 'todix',
  trio: 'trio',
  vitassist: 'vitassist',
  warning: 'warning',
  zim: 'zim',
  zurich: 'zurich',
}

export type BrandRow = { id: number; name: string }

export type BrandMerge = {
  key: string
  canonicalId: number
  canonicalName: string
  deleteIds: number[]
  productCount: number
}

export type BrandPlan = {
  merges: BrandMerge[]
  /** Birleştirilmeyen ama aynı anahtara düşen gruplar (denylist). */
  skipped: { key: string; reason: string; names: string[] }[]
  /** Kopya kayıt → kanonik kayıt eşlemesi (ürün/kural taşıma için). */
  reassign: { from: number; to: number }[]
  /** Adı standarda çekilecek kayıtlar (kanonik adlar dahil). */
  renames: { id: number; from: string; to: string }[]
}

const TR_UPPER = (value: string) => value.toLocaleUpperCase('tr')
const TR_LOWER = (value: string) => value.toLocaleLowerCase('tr')
const EN_UPPER = (value: string) => value.toLocaleUpperCase('en-US')
const TURKISH_LETTERS = /[çğıöşü]/u
/** Türkçe olup özel harf içermeyen, ilk harfi "i" olan kelimeler (aksi hâlde "Ip"/"Itimat" olurdu). */
const TURKISH_WORD_OVERRIDES: Record<string, string> = {
  ip: 'ip',
  itimat: 'itimat',
  izgaz: 'izgaz',
}
/** Yazım hatası düzeltmeleri: "Bıg Red" → "Big Red", "Djı" → "Dji". */
const FOREIGN_WORD_OVERRIDES: Record<string, string> = {
  big: 'big',
  dji: 'dji',
}
/** "50 ml", "250 g" gibi ölçü birimleri: sayıdan sonra gelirse küçük kalır. */
const MEASURE_UNITS: Record<string, true> = {
  g: true,
  gr: true,
  kg: true,
  mg: true,
  ml: true,
  cl: true,
  dl: true,
  l: true,
  lt: true,
  cm: true,
  mm: true,
  kcal: true,
}
const EDGE_QUOTES = /^[\s"'“”‘’]+|[\s"'“”‘’]+$/g
const LEAD_TRAIL = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u
const CAPITALIZE_AFTER: Record<string, true> = {
  '-': true,
  '/': true,
  '(': true,
  '“': true,
  '"': true,
  '&': true,
}
const APOSTROPHES: Record<string, true> = { "'": true, '’': true }
/** Noktadan sonra büyüten kısaltmalar ("Dr.Oetker", "Mrs.Meyers"); "Yemek.com" etkilenmez. */
const DOT_ABBREVIATIONS: Record<string, true> = {
  dr: true,
  mr: true,
  mrs: true,
  ms: true,
  jr: true,
  sr: true,
  st: true,
  co: true,
  inc: true,
  ltd: true,
  corp: true,
  no: true,
  vs: true,
  ave: true,
  blvd: true,
}

/** Karşılaştırma anahtarı: yazım farklarını (büyük/küçük, aksan, noktalama) siler. */
export function foldBrandKey(name: string): string {
  return TR_LOWER(name)
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

/** Adı yazdırmaya hazırlar: NFC, kenar tırnakları at, boşlukları tekler. */
export function cleanBrandName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, ' ').replace(EDGE_QUOTES, '').trim()
}

/** Küçük harfli bir parçayı başlık düzenine çevirir (girdi zaten küçük harf). */
function capitalizeToken(
  lowered: string,
  upper: (value: string) => string,
  firstUpper?: string,
): string {
  const chars = [...lowered]
  let out = ''
  let capitalizeNext = true
  let firstLetter = true
  let letterRun = 0
  let runStart = 0
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index]!
    if (/\p{L}/u.test(char)) {
      if (letterRun === 0) runStart = index
      if (capitalizeNext) out += firstLetter && firstUpper ? firstUpper : upper(char)
      else out += char
      firstLetter = false
      capitalizeNext = false
      letterRun++
      continue
    }
    const runBefore = letterRun
    const runText = TR_LOWER(chars.slice(runStart, index).join(''))
    letterRun = 0
    out += char
    if (/\d/u.test(char)) continue
    if (APOSTROPHES[char]) {
      const run = /^\p{L}+/u.exec(chars.slice(index + 1).join(''))?.[0] ?? ''
      capitalizeNext = run.length >= 2
      continue
    }
    if (char === '.') {
      // "Dr.Oetker", "E.C.A." büyür; "Yemek.com", "uni.co" küçük kalır.
      capitalizeNext = runBefore === 1 || DOT_ABBREVIATIONS[runText] === true
      continue
    }
    capitalizeNext = CAPITALIZE_AFTER[char]
  }
  return out
}

/** Tek kelimeyi (tırnak/parantez kenarları korunarak) başlık düzenine çevirir. */
function titleToken(token: string): string {
  const match = LEAD_TRAIL.exec(token)
  const lead = match?.[1] ?? ''
  const core = match?.[2] ?? ''
  const tail = match?.[3] ?? ''
  if (!core) return token
  const letters = core.replace(/[^\p{L}]/gu, '')
  const allCaps = letters !== '' && letters === TR_UPPER(letters)
  const key = foldBrandKey(core)

  if (allCaps && BRAND_WORD_OVERRIDES[key]) {
    return lead + capitalizeToken(BRAND_WORD_OVERRIDES[key]!, EN_UPPER) + tail
  }
  if (!allCaps && TURKISH_WORD_OVERRIDES[key]) {
    return lead + capitalizeToken(TURKISH_WORD_OVERRIDES[key]!, TR_UPPER, 'İ') + tail
  }
  if (!allCaps && FOREIGN_WORD_OVERRIDES[key]) {
    return lead + capitalizeToken(FOREIGN_WORD_OVERRIDES[key]!, EN_UPPER) + tail
  }

  const lowered = TR_LOWER(core)
  const turkishLetters = TURKISH_LETTERS.test(lowered)
  // İlk harf belirsiz olabilir: "İnci" (noktalı) / "ISTANBUL" (noktasız) / "ikea" (İngilizce i).
  const first = /\p{L}/u.exec(core)?.[0] ?? ''
  const firstUpper =
    first === 'İ'
      ? 'İ'
      : first === 'ı' || first === 'I'
        ? 'I'
        : first === 'i'
          ? turkishLetters
            ? 'İ'
            : 'I'
          : undefined
  return (
    lead +
    capitalizeToken(lowered, turkishLetters ? TR_UPPER : EN_UPPER, firstUpper) +
    tail
  )
}

/** Marka adını Türkçe özel isim düzenine çevirir. */
export function brandTitle(name: string): string {
  const words = cleanBrandName(name).split(' ')
  return words
    .map((word, index) => {
      const title = titleToken(word)
      const previous = words[index - 1] ?? ''
      const core = LEAD_TRAIL.exec(word)?.[2] ?? ''
      const unit = MEASURE_UNITS[foldBrandKey(core)]
      // "50 ml" ölçüsü büyütülmez; "M Life" markası etkilenmez.
      return unit && /\d$/u.test(previous) ? TR_LOWER(core) : title
    })
    .join(' ')
}

/**
 * Kanonik kayıt sıralaması: önce tırnaklı/tireli (slug kaçmış) adlar elenir, sonra en çok ürün,
 * sonra karışık harfli yazım, sonra küçük id.
 */
function nameTier(name: string): number {
  const clean = name.trim()
  if (/^["'“”‘’]|["'“”‘’]$/.test(clean)) return 2
  if (/[-_]/.test(clean)) return 1
  return 0
}

function caseQuality(name: string): number {
  const letters = name.replace(/[^\p{L}]/gu, '')
  if (!letters) return 0
  if (letters === TR_UPPER(letters)) return -2
  if (letters === TR_LOWER(letters)) return -1
  return 0
}

export function planBrandMerges(
  brands: BrandRow[],
  productCounts: Map<number, number>,
): BrandPlan {
  const groups = new Map<string, BrandRow[]>()
  for (const brand of brands) {
    const key = foldBrandKey(brand.name)
    if (!key) continue
    const bucket = groups.get(key) ?? []
    bucket.push(brand)
    groups.set(key, bucket)
  }

  const merges: BrandMerge[] = []
  const skipped: BrandPlan['skipped'] = []
  const reassign: BrandPlan['reassign'] = []
  const renames: BrandPlan['renames'] = []
  const count = (id: number) => productCounts.get(id) ?? 0

  for (const [key, members] of groups) {
    const ordered = [...members].sort((a, b) => {
      const tier = nameTier(a.name) - nameTier(b.name)
      if (tier !== 0) return tier
      const products = count(b.id) - count(a.id)
      if (products !== 0) return products
      const quality = caseQuality(b.name) - caseQuality(a.name)
      if (quality !== 0) return quality
      return a.id - b.id
    })
    const canonical = ordered[0]!
    const finalName = brandTitle(canonical.name)
    const others = ordered.slice(1)

    if (others.length === 0) {
      if (finalName !== canonical.name) {
        renames.push({ id: canonical.id, from: canonical.name, to: finalName })
      }
      continue
    }

    const reason = MERGE_DENYLIST[key]
    if (reason) {
      skipped.push({ key, reason, names: members.map((member) => member.name) })
      for (const member of members) {
        const title = brandTitle(member.name)
        if (title !== member.name) renames.push({ id: member.id, from: member.name, to: title })
      }
      continue
    }

    merges.push({
      key,
      canonicalId: canonical.id,
      canonicalName: finalName,
      deleteIds: others.map((member) => member.id),
      productCount: members.reduce((sum, member) => sum + count(member.id), 0),
    })
    for (const member of others) reassign.push({ from: member.id, to: canonical.id })
    if (finalName !== canonical.name) {
      renames.push({ id: canonical.id, from: canonical.name, to: finalName })
    }
  }

  merges.sort((a, b) => b.productCount - a.productCount || a.canonicalId - b.canonicalId)
  return { merges, skipped, reassign, renames }
}
