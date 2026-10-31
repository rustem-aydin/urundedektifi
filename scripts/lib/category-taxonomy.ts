import { slugify } from '../../src/lib/slugify'

/**
 * Ürün kategorisi taksonomisi (üst → alt, iki düzey).
 *
 * Tek kaynak: `scripts/seed-categories.ts` (yerel) ve
 * `scripts/seed-categories-prod.ts` (uzak) bu listeyi uygular; slug'lar
 * `slugify(name)` ile üretilir, böylece OFF içe aktarıcısının
 * (`scripts/lib/off-import.ts`, isim → slug eşlemesi) ürettiği slug'larla
 * aynı kalır ve içe aktarma aynı kayıtları günceller.
 */

export type TaxonomyNode = {
  name: string
  description?: string
  /** Aynı düzeyde sıralama (küçük önce). */
  order: number
  children?: TaxonomyNode[]
}

export const CATEGORY_TAXONOMY: TaxonomyNode[] = [
  {
    name: 'İçecekler',
    description: 'Su, gazlı içecek, meyve suyu, çay-kahve ve diğer içecekler.',
    order: 100,
    children: [
      { name: 'Su', description: 'Şişe, damacana ve maden suları.', order: 110 },
      { name: 'Meyve Suyu', description: 'Meyve suları, nektarlar ve smoothieler.', order: 120 },
      { name: 'Gazlı İçecekler', description: 'Kola, gazoz ve aromalı maden suyu.', order: 130 },
      { name: 'Enerji & Spor İçecekleri', order: 140 },
      { name: 'Kahve & Çay', description: 'Demleme/instant kahve, siyah-yeşil-baharatlı çay.', order: 150 },
      { name: 'Bitkisel İçecek', description: 'Badem, soya, yulaf ve pirinç sütü gibi bitkisel içecekler.', order: 160 },
      { name: 'Ayran', order: 170 },
      { name: 'Alkollü İçecekler', description: 'Bira, şarap ve sert alkollü içkiler.', order: 180 },
    ],
  },
  {
    name: 'Süt Ürünleri',
    description: 'Süt, peynir, yoğurt, kaymak, tereyağı ve kefir.',
    order: 200,
    children: [
      { name: 'Süt', order: 210 },
      { name: 'Peynir', description: 'Beyaz peynir, kaşar, tulum ve diğer peynirler.', order: 220 },
      { name: 'Yoğurt', order: 230 },
      { name: 'Kaymak & Krema', order: 240 },
      { name: 'Tereyağı & Margarin', order: 250 },
      { name: 'Kefir', order: 260 },
    ],
  },
  {
    name: 'Et & Şarküteri',
    description: 'Kırmızı et, tavuk-hindi, şarküteri ürünleri ve su ürünleri.',
    order: 300,
    children: [
      { name: 'Kırmızı Et', order: 310 },
      { name: 'Tavuk & Hindi', order: 320 },
      { name: 'Şarküteri & Sosis', description: 'Salam, sosis, sucuk, pastırma ve jambon.', order: 330 },
      { name: 'Su Ürünleri', description: 'Balık, deniz mahsulleri ve konserve balık.', order: 340 },
    ],
  },
  {
    name: 'Meyve & Sebze',
    description: 'Taze meyve, sebze, kuru meyve ve mantar.',
    order: 400,
    children: [
      { name: 'Meyve', order: 410 },
      { name: 'Sebze', order: 420 },
      { name: 'Kuru Meyve', order: 430 },
      { name: 'Mantar', order: 440 },
    ],
  },
  {
    name: 'Baklagil & Tahıl',
    description: 'Makarna, pirinç, baklagil, un ve kahvaltılık tahıllar.',
    order: 500,
    children: [
      { name: 'Makarna & Pirinç', order: 510 },
      { name: 'Baklagil', description: 'Mercimek, nohut, fasulye ve barbunya.', order: 520 },
      { name: 'Un & İrmik', order: 530 },
      { name: 'Kahvaltılık Tahıl', description: 'Müsli, granola ve kahvaltılık gevrek.', order: 540 },
    ],
  },
  {
    name: 'Fırın & Ekmek',
    description: 'Ekmek, pasta-börek, reçel-bal ve kahvaltılık sürülebilirler.',
    order: 600,
    children: [
      { name: 'Ekmek & Lavaş', order: 610 },
      { name: 'Pasta & Börek', order: 620 },
      { name: 'Kahvaltılık & Sürülebilir', description: 'Krem çikolata, fıstık ezmesi ve kahvaltılık sürülebilirler.', order: 630 },
      { name: 'Reçel & Bal', order: 640 },
    ],
  },
  {
    name: 'Atıştırmalık & Tatlı',
    description: 'Bisküvi, çikolata, cips, kuruyemiş, tatlı ve dondurma.',
    order: 700,
    children: [
      { name: 'Bisküvi & Gofret', order: 710 },
      { name: 'Çikolata', order: 720 },
      { name: 'Kuruyemiş', description: 'Kuruyemiş, çekirdek ve kuru yemiş karışımları.', order: 730 },
      { name: 'Cips & Atıştırmalık', order: 740 },
      { name: 'Atıştırmalık', order: 750 },
      { name: 'Tatlı', description: 'Kek, pasta, puding ve sütlü tatlılar.', order: 760 },
      { name: 'Dondurma', order: 770 },
      { name: 'Şeker & Sakız', order: 780 },
    ],
  },
  {
    name: 'Temel Gıda & Mutfak',
    description: 'Yağ, sos, baharat, konserve ve hazır yemek.',
    order: 800,
    children: [
      { name: 'Yağlar', description: 'Ayçiçek, zeytinyağı, mısır ve diğer bitkisel yağlar.', order: 810 },
      { name: 'Soslar & Çeşniler', description: 'Ketçap, mayonez, hardal ve hazır soslar.', order: 820 },
      { name: 'Baharat & Çeşni', order: 830 },
      { name: 'Hazır Yemek', description: 'Çorba, konserve yemek ve ısıtıp servis edilen hazır yemekler.', order: 840 },
      { name: 'Konserve & Turşu', order: 850 },
      { name: 'Salça & Sirke', order: 860 },
    ],
  },
  {
    name: 'Bebek & Çocuk',
    description: 'Bebek maması, bebek bakımı ve çocuk ürünleri.',
    order: 900,
    children: [
      { name: 'Bebek Maması', order: 910 },
      { name: 'Bebek Bezi & Bakım', order: 920 },
      { name: 'Çocuk Atıştırmalık', order: 930 },
    ],
  },
  {
    name: 'İlaç',
    description: 'Reçetesiz ilaçlar, takviyeler ve ilk yardım ürünleri.',
    order: 1000,
    children: [
      { name: 'Reçetesiz İlaçlar', order: 1010 },
      { name: 'Vitamin & Takviye', order: 1020 },
      { name: 'İlk Yardım & Pansuman', order: 1030 },
      { name: 'Kişisel Sağlık', order: 1040 },
    ],
  },
  {
    name: 'Ev & Temizlik',
    description: 'Deterjan, yüzey temizleyici, kağıt ve hijyen ürünleri.',
    order: 1100,
    children: [
      { name: 'Deterjan & Yüzey Temizleyici', order: 1110 },
      { name: 'Bulaşık & Çamaşır', order: 1120 },
      { name: 'Kağıt & Hijyen', order: 1130 },
    ],
  },
  {
    name: 'Kişisel Bakım',
    description: 'Cilt, saç, ağız-diş ve vücut bakım ürünleri.',
    order: 1200,
    children: [
      { name: 'Cilt & Yüz Bakımı', order: 1210 },
      { name: 'Saç Bakımı', order: 1220 },
      { name: 'Ağız & Diş Bakımı', order: 1230 },
      { name: 'Sabun & Duş', order: 1240 },
      { name: 'Tıraş & Ağda', order: 1250 },
    ],
  },
  {
    name: 'Evcil Hayvan',
    description: 'Kedi-köpek maması ve evcil hayvan bakım ürünleri.',
    order: 1300,
    children: [
      { name: 'Kedi & Köpek Maması', order: 1310 },
      { name: 'Evcil Hayvan Bakımı', order: 1320 },
    ],
  },
  {
    name: 'Diğer',
    description: 'Yukarıdaki türlere girmeyen ürünler.',
    order: 9999,
  },
]

/**
 * Aynı içeriği taşıyan yinelenen kategoriler (eski içe aktarımlardan kaldı).
 * Sol taraf silinir; ürünleri ve uzman kuralı referansları sağ tarafa taşınır.
 */
export const DUPLICATE_CATEGORY_MERGES: Array<{ from: string; to: string }> = [
  { from: 'i-cecekler', to: 'icecekler' },
  { from: 'caylar', to: 'kahve-cay' },
  { from: 'meyve-nektari', to: 'meyve-suyu' },
]

/** Taksonomiyi kökten yaprağa düz listeye açar (üst kayıtlar önce oluşsun). */
export function flattenTaxonomy(
  nodes: TaxonomyNode[] = CATEGORY_TAXONOMY,
): Array<{ name: string; slug: string; description?: string; order: number; parentSlug: string | null }> {
  const flat: Array<{ name: string; slug: string; description?: string; order: number; parentSlug: string | null }> = []
  const walk = (list: TaxonomyNode[], parentSlug: string | null) => {
    for (const node of list) {
      const slug = slugify(node.name)
      flat.push({ name: node.name, slug, description: node.description, order: node.order, parentSlug })
      if (node.children?.length) walk(node.children, slug)
    }
  }
  walk(nodes, null)
  return flat
}
