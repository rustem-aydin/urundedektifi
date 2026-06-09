export type PrefixRule = {
  /** Minimum GS1 prefix değeri (3 haneli, dahil) */
  min: number
  /** Maksimum GS1 prefix değeri (3 haneli, dahil) */
  max: number
  /** Ülke adı (Türkçe, Countries koleksiyonundaki 'name' ile birebir aynı olmalı) */
  country: string
  /** ISO 3166-1 alpha-2 (TR, DE, US vb.) */
  iso: string
}

export const PREFIX_RULES: PrefixRule[] = [
  { min: 0, max: 19, country: 'Amerika Birleşik Devletleri', iso: 'US' },
  { min: 30, max: 39, country: 'Amerika Birleşik Devletleri', iso: 'US' },
  { min: 60, max: 99, country: 'Amerika Birleşik Devletleri', iso: 'US' },
  { min: 100, max: 139, country: 'Amerika Birleşik Devletleri', iso: 'US' },

  { min: 300, max: 379, country: 'Fransa', iso: 'FR' },
  { min: 380, max: 380, country: 'Bulgaristan', iso: 'BG' },
  { min: 383, max: 383, country: 'Slovenya', iso: 'SI' },
  { min: 385, max: 385, country: 'Hırvatistan', iso: 'HR' },
  { min: 387, max: 387, country: 'Bosna Hersek', iso: 'BA' },
  { min: 389, max: 389, country: 'Karadağ', iso: 'ME' },

  { min: 400, max: 440, country: 'Almanya', iso: 'DE' },
  { min: 450, max: 459, country: 'Japonya', iso: 'JP' },
  { min: 460, max: 469, country: 'Rusya', iso: 'RU' },
  { min: 470, max: 470, country: 'Kırgızistan', iso: 'KG' },
  { min: 471, max: 471, country: 'Tayvan', iso: 'TW' },
  { min: 474, max: 474, country: 'Estonya', iso: 'EE' },
  { min: 475, max: 475, country: 'Letonya', iso: 'LV' },
  { min: 476, max: 476, country: 'Azerbaycan', iso: 'AZ' },
  { min: 477, max: 477, country: 'Litvanya', iso: 'LT' },
  { min: 478, max: 478, country: 'Özbekistan', iso: 'UZ' },
  { min: 479, max: 479, country: 'Sri Lanka', iso: 'LK' },
  { min: 480, max: 480, country: 'Filipinler', iso: 'PH' },
  { min: 481, max: 481, country: 'Belarus', iso: 'BY' },
  { min: 482, max: 482, country: 'Ukrayna', iso: 'UA' },
  { min: 483, max: 483, country: 'Türkmenistan', iso: 'TM' },
  { min: 484, max: 484, country: 'Moldova', iso: 'MD' },
  { min: 485, max: 485, country: 'Ermenistan', iso: 'AM' },
  { min: 486, max: 486, country: 'Gürcistan', iso: 'GE' },
  { min: 487, max: 487, country: 'Kazakistan', iso: 'KZ' },
  { min: 488, max: 488, country: 'Tacikistan', iso: 'TJ' },
  { min: 489, max: 489, country: 'Hong Kong', iso: 'HK' },
  { min: 490, max: 499, country: 'Japonya', iso: 'JP' },

  { min: 500, max: 509, country: 'Birleşik Krallık', iso: 'GB' },
  { min: 520, max: 521, country: 'Yunanistan', iso: 'GR' },
  { min: 528, max: 528, country: 'Lübnan', iso: 'LB' },
  { min: 529, max: 529, country: 'Kıbrıs', iso: 'CY' },
  { min: 540, max: 549, country: 'Belçika', iso: 'BE' },
  { min: 560, max: 560, country: 'Portekiz', iso: 'PT' },
  { min: 569, max: 569, country: 'İzlanda', iso: 'IS' },
  { min: 570, max: 579, country: 'Danimarka', iso: 'DK' },
  { min: 590, max: 590, country: 'Polonya', iso: 'PL' },
  { min: 594, max: 594, country: 'Romanya', iso: 'RO' },
  { min: 599, max: 599, country: 'Macaristan', iso: 'HU' },

  { min: 600, max: 601, country: 'Güney Afrika', iso: 'ZA' },
  { min: 603, max: 603, country: 'Gana', iso: 'GH' },
  { min: 604, max: 604, country: 'Senegal', iso: 'SN' },
  { min: 608, max: 608, country: 'Bahreyn', iso: 'BH' },
  { min: 609, max: 609, country: 'Mauritius', iso: 'MU' },
  { min: 611, max: 611, country: 'Mısır', iso: 'EG' },
  { min: 613, max: 613, country: 'Cezayir', iso: 'DZ' },
  { min: 616, max: 616, country: 'Tayland', iso: 'TH' },
  { min: 618, max: 618, country: 'Gana', iso: 'GH' },
  { min: 619, max: 619, country: 'Tunus', iso: 'TN' },
  { min: 621, max: 621, country: 'Suriye', iso: 'SY' },
  { min: 622, max: 623, country: 'Ürdün', iso: 'JO' },
  { min: 624, max: 624, country: 'Libya', iso: 'LY' },
  { min: 625, max: 625, country: 'Lübnan', iso: 'LB' },
  { min: 626, max: 626, country: 'İran', iso: 'IR' },
  { min: 627, max: 627, country: 'Kuveyt', iso: 'KW' },
  { min: 628, max: 628, country: 'Suudi Arabistan', iso: 'SA' },
  { min: 629, max: 629, country: 'Birleşik Arap Emirlikleri', iso: 'AE' },
  { min: 640, max: 649, country: 'Finlandiya', iso: 'FI' },
  { min: 690, max: 695, country: 'Çin', iso: 'CN' },

  { min: 700, max: 709, country: 'Norveç', iso: 'NO' },
  { min: 729, max: 729, country: 'İsrail', iso: 'IL' },
  { min: 730, max: 739, country: 'Meksika', iso: 'MX' },
  { min: 740, max: 740, country: 'Uruguay', iso: 'UY' },
  { min: 741, max: 741, country: 'Guatemala', iso: 'GT' },
  { min: 742, max: 742, country: 'Honduras', iso: 'HN' },
  { min: 743, max: 743, country: 'El Salvador', iso: 'SV' },
  { min: 744, max: 744, country: 'Nikaragua', iso: 'NI' },
  { min: 745, max: 745, country: 'Kosta Rika', iso: 'CR' },
  { min: 746, max: 746, country: 'Panama', iso: 'PA' },
  { min: 750, max: 750, country: 'Meksika', iso: 'MX' },
  { min: 754, max: 755, country: 'Kanada', iso: 'CA' },
  { min: 760, max: 769, country: 'İsviçre', iso: 'CH' },
  { min: 770, max: 771, country: 'Kolombiya', iso: 'CO' },
  { min: 773, max: 773, country: 'Uruguay', iso: 'UY' },
  { min: 775, max: 775, country: 'Peru', iso: 'PE' },
  { min: 777, max: 777, country: 'Bolivya', iso: 'BO' },
  { min: 778, max: 779, country: 'Arjantin', iso: 'AR' },
  { min: 780, max: 780, country: 'Şili', iso: 'CL' },
  { min: 784, max: 784, country: 'Paraguay', iso: 'PY' },
  { min: 785, max: 785, country: 'Peru', iso: 'PE' },
  { min: 786, max: 786, country: 'Ekvador', iso: 'EC' },
  { min: 789, max: 790, country: 'Brezilya', iso: 'BR' },

  { min: 800, max: 839, country: 'İtalya', iso: 'IT' },
  { min: 840, max: 849, country: 'İspanya', iso: 'ES' },
  { min: 850, max: 850, country: 'Küba', iso: 'CU' },
  { min: 858, max: 858, country: 'Slovakya', iso: 'SK' },
  { min: 859, max: 859, country: 'Çek Cumhuriyeti', iso: 'CZ' },
  { min: 860, max: 860, country: 'Sırbistan', iso: 'RS' },
  { min: 865, max: 865, country: 'Moğolistan', iso: 'MN' },
  { min: 867, max: 867, country: 'Kuzey Kore', iso: 'KP' },
  { min: 868, max: 869, country: 'Türkiye', iso: 'TR' },
  { min: 870, max: 879, country: 'Hollanda', iso: 'NL' },
  { min: 880, max: 880, country: 'Güney Kore', iso: 'KR' },
  { min: 884, max: 884, country: 'Kamboçya', iso: 'KH' },
  { min: 885, max: 885, country: 'Tayland', iso: 'TH' },
  { min: 888, max: 888, country: 'Singapur', iso: 'SG' },
  { min: 890, max: 890, country: 'Hindistan', iso: 'IN' },
  { min: 893, max: 893, country: 'Vietnam', iso: 'VN' },
  { min: 894, max: 894, country: 'Bangladeş', iso: 'BD' },
  { min: 899, max: 899, country: 'Endonezya', iso: 'ID' },

  { min: 900, max: 919, country: 'Avusturya', iso: 'AT' },
  { min: 930, max: 939, country: 'Avustralya', iso: 'AU' },
  { min: 940, max: 949, country: 'Yeni Zelanda', iso: 'NZ' },
  { min: 950, max: 950, country: 'GS1 Küresel', iso: 'XX' },
  { min: 955, max: 955, country: 'Malezya', iso: 'MY' },
  { min: 958, max: 958, country: 'Makao', iso: 'MO' },
  { min: 960, max: 969, country: 'GS1 Küresel', iso: 'XX' },
  { min: 977, max: 977, country: 'ISSN (Süreli Yayın)', iso: 'XX' },
  { min: 978, max: 979, country: 'ISBN (Kitap)', iso: 'XX' },
  { min: 980, max: 980, country: 'İade Fişi', iso: 'XX' },
  { min: 981, max: 984, country: 'Kupon', iso: 'XX' },
  { min: 990, max: 999, country: 'İade/Kupon', iso: 'XX' },
]

/**
 * EAN-13 / UPC / EAN-8 barkodunun ilk 3 hanesinden ülke tespit eder.
 * QR kod gibi alfasayısal kodlar için null döner.
 * @returns { country, iso } veya null
 */
export function detectCountryFromBarcode(
  barcode: string | null | undefined,
): { country: string; iso: string; prefix: number } | null {
  if (!barcode) return null
  const digits = String(barcode).replace(/\D/g, '')
  if (digits.length < 3) return null

  const prefix = parseInt(digits.substring(0, 3), 10)
  if (isNaN(prefix)) return null

  for (const rule of PREFIX_RULES) {
    if (prefix >= rule.min && prefix <= rule.max) {
      return { country: rule.country, iso: rule.iso, prefix }
    }
  }
  return null
}

/**
 * Tüm benzersiz ülkeleri döner (seed script'i için).
 * Her ülke için ana GS1 prefix, ISO kodu ve varsa ek prefix'ler listelenir.
 */
export function getAllCountries(): Array<{
  name: string
  code: string
  iso: string
  aliases: string[]
}> {
  const map = new Map<
    string,
    { name: string; code: string; iso: string; aliases: Set<number> }
  >()

  for (const rule of PREFIX_RULES) {
    const existing = map.get(rule.country)
    if (existing) {
      for (let p = rule.min; p <= rule.max; p++) existing.aliases.add(p)
    } else {
      const aliases = new Set<number>()
      for (let p = rule.min; p <= rule.max; p++) aliases.add(p)
      map.set(rule.country, { name: rule.country, code: rule.iso, iso: rule.iso, aliases })
    }
  }

  return Array.from(map.values())
    .filter((c) => c.iso !== 'XX')
    .map((c) => {
      const arr = Array.from(c.aliases).sort((a, b) => a - b)
      const main = arr[0]
      const rest = arr.slice(1).map((p) => String(p).padStart(3, '0'))
      return {
        name: c.name,
        code: main != null ? String(main).padStart(3, '0') : '',
        iso: c.iso,
        aliases: rest,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
}
