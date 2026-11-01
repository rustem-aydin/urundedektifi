import { slugify } from '../../src/lib/slugify'

/**
 * Alerjen master listesi — tek kaynak.
 *
 * `scripts/seed-allergens.ts` (yerel) ve `scripts/seed-allergens-prod.ts`
 * (uzak) bu listeyi uygular. Slug `slugify(name)` ile üretilir; OFF içe
 * aktarıcısı (`scripts/lib/off-import.ts`) da aynı slug'ları ürettiği için
 * kayıtlar çakışmaz, yalnız güncellenir.
 *
 * Kapsam: dünyada zorunlu alerjen beyanı/etiketleme listelerinde geçen ve
 * klinik olarak yaygın besin alerjenleri.
 * - AB 1169/2011 Ek II (14 alerjen; Türkiye'de de esas alınan liste)
 * - ABD FALCPA + FASTER Act (9 büyük alerjen)
 * - Kanada öncelikli alerjenleri (hardal, sülfit, susam, yumuşakçalar dahil)
 * - Avustralya-Yeni Zelanda (acı bakla dahil)
 * - Japonya (7 zorunlu + 20 önerilen: karabuğday, karides, yengeç, kivi,
 *   şeftali, elma, muz, sığır/tavuk/domuz eti, jelatin…)
 * - Kore (karabuğday, domates, çam fıstığı, şeftali…)
 * - Codex Alimentarius
 *
 * Yazım kuralı: başlık düzeni — her kelimenin ilk harfi büyük, kalanı küçük.
 */
export const ALLERGEN_NAMES: readonly string[] = [
  // Gluten ve tahıllar (AB 1169/2011 Ek II: glüten içeren tahıllar)
  'Gluten',
  'Buğday',
  'Arpa',
  'Çavdar',
  'Yulaf',
  'Karabuğday',
  'Mısır',
  'Pirinç',
  'Darı',
  'Kavuzlu Buğday',
  'Kamut',
  'Tritikale',

  // Süt ürünleri
  'Süt',
  'Laktoz',

  // Yumurta
  'Yumurta',

  // Yer fıstığı ve sert kabuklu yemişler (AB'de adı geçen 8 yemiş + yaygın diğerleri)
  'Yer Fıstığı',
  'Sert Kabuklu Yemişler',
  'Badem',
  'Fındık',
  'Ceviz',
  'Kaju',
  'Pekan Cevizi',
  'Brezilya Fıstığı',
  'Antep Fıstığı',
  'Makademya Fıstığı',
  'Çam Fıstığı',
  'Kestane',

  // Tohumlar ve baharat alerjenleri
  'Susam',
  'Haşhaş',
  'Ayçiçeği',
  'Pamuk Tohumu',
  'Hardal',
  'Kereviz',

  // Baklagiller ve soya
  'Soya',
  'Acı Bakla',
  'Bezelye',
  'Nohut',
  'Mercimek',
  'Bakla',

  // Balık ve deniz ürünleri
  'Balık',
  'Somon',
  'Uskumru',
  'Somon Havyarı',
  'Kabuklular',
  'Yumuşakçalar',
  'Karides',
  'Yengeç',
  'Istakoz',
  'Midye',
  'İstiridye',
  'Deniz Kulağı',
  'Kalamar',
  'Ahtapot',
  'Deniz Tarağı',

  // Sebze ve meyveler
  'Havuç',
  'Domates',
  'Patates',
  'Soğan',
  'Sarımsak',
  'Elma',
  'Şeftali',
  'Kayısı',
  'Kiraz',
  'Çilek',
  'Kivi',
  'Muz',
  'Portakal',
  'Avokado',

  // Katkı, hayvansal protein ve diğer
  'Sülfitler',
  'Kakao',
  'Maya',
  'Jelatin',
  'Sığır Eti',
  'Domuz Eti',
  'Tavuk Eti',
]

export type AllergenSeedRow = {
  name: string
  slug: string
}

/** Taksonomi satırları (slug türetilmiş, sıra korunmuş). */
export function allergenRows(): AllergenSeedRow[] {
  const seen = new Set<string>()
  return ALLERGEN_NAMES.map((name) => {
    const slug = slugify(name)
    if (!slug) throw new Error(`Alerjen slug üretilemedi: ${name}`)
    if (seen.has(slug)) throw new Error(`Yinelenen alerjen slug: ${slug}`)
    seen.add(slug)
    return { name, slug }
  })
}
