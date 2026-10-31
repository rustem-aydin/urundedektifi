/**
 * Ürün adı yazım standardı (Türkçe): her kelime büyük harfle başlar, kalanı küçüktür.
 * Örn: "SODOBO GURME TON" → "Sodobo Gurme Ton".
 *
 * Kurallar:
 *  - Tire, eğik çizgi, nokta, parantez, tırnak ve & sonrası harf de büyür ("Coca-Cola", "H.E").
 *  - Kesme işaretinden sonra tek harflik ek küçük kalır ("Lay's"), iki+ harfli parça büyür ("d’Or").
 *  - Miktar içeren parçalar dokunulmaz ("12x330", "2'li", "7/24").
 *  - Ölçü birimleri kanonikleşir: 200 GR → 200 g, 500ML → 500 ml, 1,5 LT → 1,5 L.
 *  - Büyük "I" belirsizdir (Türkçe ı / İngilizce i). Karar kataloğun kendi verisinden verilir:
 *    kelimenin düzgün yazılmış karışık harfli hâli başka bir adında geçiyorsa o kullanılır;
 *    kanıt yoksa Türkçe (ı) varsayılır.
 */

/** Ölçü birimlerinin kanonik yazımı; bu kelimeler başlık kuralına sokulmaz. */
const UNIT_CANONICAL: Record<string, string> = {
  g: 'g',
  gr: 'g',
  kg: 'kg',
  mg: 'mg',
  ml: 'ml',
  cl: 'cl',
  dl: 'dl',
  l: 'L',
  lt: 'L',
  x: 'x',
  ad: 'ad',
  adet: 'adet',
  cm: 'cm',
  mm: 'mm',
  kcal: 'kcal',
  kkal: 'kcal',
  kj: 'kj',
  xl: 'XL',
  xxl: 'XXL',
  xs: 'XS',
}

const TR_LOWER = (value: string) => value.toLocaleLowerCase('tr')
const TR_UPPER = (value: string) => value.toLocaleUpperCase('tr')
const LEAD_TRAIL = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u
const CAPITALIZE_AFTER = new Set(['-', '/', '(', '“', '"', '.', '&'])
/** Kesme işaretinden sonra tek harflik ek ("Lay's") küçük kalır; "d’Or" gibi parçalar büyür. */
const APOSTROPHES = new Set(["'", '’'])

/** Kelimeyi Türkçe kurallarıyla başlık biçimine çevirir. */
function titleWord(word: string): string {
  const chars = [...TR_LOWER(word)]
  let out = ''
  let capitalizeNext = true
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index]!
    if (capitalizeNext && /\p{L}/u.test(char)) {
      out += TR_UPPER(char)
      capitalizeNext = false
      continue
    }
    out += char
    if (APOSTROPHES.has(char)) {
      const run = /^\p{L}+/u.exec(chars.slice(index + 1).join(''))?.[0] ?? ''
      capitalizeNext = run.length >= 2
      continue
    }
    capitalizeNext = CAPITALIZE_AFTER.has(char)
  }
  return out
}

/** "ı" ve "i" ayrımını silen arama anahtarı: COLLECTION / Collectıon → collection. */
function foldKey(word: string): string {
  return TR_LOWER(word).replace(/[ıİi]/g, 'i')
}

function splitToken(token: string): { lead: string; core: string; tail: string } {
  const match = LEAD_TRAIL.exec(token)
  return {
    lead: match?.[1] ?? '',
    core: match?.[2] ?? '',
    tail: match?.[3] ?? '',
  }
}

const isAllCaps = (core: string) =>
  /\p{Lu}/u.test(core) && core === TR_UPPER(core) && /\p{L}{2,}/u.test(core)

/**
 * Katalogdan kelime sözlüğü: düzgün yazılmış (karışık harfli) kelimelerin
 * "ı/i" ayrımını silen anahtar → gözlenen küçük harfli yazımlar ve sayıları.
 */
type Corpus = Map<string, Map<string, number>>

function addToCorpus(corpus: Corpus, core: string): void {
  if (!/\p{L}{2,}/u.test(core)) return
  if (isAllCaps(core)) return // büyük harfli yazım kanıt sayılmaz
  const lower = TR_LOWER(core)
  if (!/[ıi]/.test(lower)) return
  const key = foldKey(core)
  const bucket = corpus.get(key) ?? new Map<string, number>()
  bucket.set(lower, (bucket.get(lower) ?? 0) + 1)
  corpus.set(key, bucket)
}

function vote(corpus: Corpus, core: string): string | undefined {
  const bucket = corpus.get(foldKey(core))
  if (!bucket) return undefined
  let best: string | undefined
  let bestCount = -1
  for (const [form, count] of bucket) {
    if (count > bestCount) {
      best = form
      bestCount = count
    }
  }
  return best
}

/** "500ML", "1,5LT", "250g" → "500 ml", "1,5 L", "250 g". */
const DIGIT_UNIT = /^(\d[\d.,]*)(\p{L}{1,2})$/u

function convertToken(token: string, corpus: Corpus): string {
  const { lead, core, tail } = splitToken(token)
  if (!core) return token

  const digitUnit = DIGIT_UNIT.exec(core)
  if (digitUnit) {
    const unit = UNIT_CANONICAL[TR_LOWER(digitUnit[2]!)]
    if (unit) return `${lead}${digitUnit[1]} ${unit}${tail}`
    return token
  }
  if (/\d/.test(core)) return token // miktar/sayı içeren parça dokunulmaz

  const unit = UNIT_CANONICAL[TR_LOWER(core)]
  if (unit) return lead + unit + tail

  // Büyük "I"nın küçüğü belirsizdir (Türkçe ı / İngilizce i). Karışık harfli kelimelerde zaten
  // yazılmış olan harf korunur; yalnız büyük harfli kelimede katalog kanıtına bakılır, kanıt
  // yoksa Türkçe (ı) varsayılır.
  if (isAllCaps(core) && /I/.test(core)) {
    const decided = vote(corpus, core)
    if (decided) {
      // Sözlükten gelen biçim küçük harftir; başlık kuralları (tire sonrası vb.) yeniden uygulanır.
      return lead + titleWord(decided) + tail
    }
  }
  return lead + titleWord(core) + tail
}

export function normalizeProductName(raw: string, corpus: Corpus): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((token) => convertToken(token, corpus))
    .join(' ')
}

/** Geri çekilme beklemesi (tsconfig `lib` hedefi Promise.withResolvers'ı tanımıyor). */
function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** Ad listesinden kelime sözlüğü kurar (ı/i kararı için kanıt toplar). */
export function buildCorpus(names: Iterable<string>): Corpus {
  const corpus: Corpus = new Map()
  for (const name of names) {
    for (const token of name.replace(/\s+/g, ' ').trim().split(' ')) {
      addToCorpus(corpus, splitToken(token).core)
    }
  }
  return corpus
}
