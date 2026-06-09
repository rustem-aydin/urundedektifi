import type { CollectionConfig } from 'payload'

const RULE_TYPES = [
  { label: '📝 İçindekiler listede (dropdown)', value: 'ingredient_text' },
  { label: '📝 İçindekiler listede OLMAMALI (zorunlu olmalı)', value: 'ingredient_excludes' },
  { label: '🧪 Katkı maddesi içeriyor (E-kod dropdown)', value: 'additive_code' },
  { label: '⚠️ Belirli alerjen içeriyor', value: 'allergen' },
  { label: '🌍 Üretim ülkesi (ülke dropdown)', value: 'country' },
  { label: '🏷️ Marka (marka dropdown)', value: 'brand' },
  { label: '🛑 Marka "Boykotlu" olarak işaretli', value: 'brand_boycotted' },
  { label: '📂 Ürün tipi (kategori dropdown)', value: 'category' },
  { label: '📈 Besin değeri eşik üstünde', value: 'nutrition_max' },
  { label: '📉 Besin değeri eşik altında', value: 'nutrition_min' },
  { label: '✅ Etiket mevcut (dropdown)', value: 'label_has' },
  { label: '❌ Etiket eksik (dropdown)', value: 'label_missing' },
]

export const ExpertRules: CollectionConfig = {
  slug: 'expert-rules',
  labels: {
    singular: 'Uzman Kuralı',
    plural: 'Uzman Kuralları',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'expert', 'topic', 'ruleType', 'rating', 'isActive'],
    group: 'Uzmanlar',
    description:
      'Uzmanların ürünlere otomatik olarak uygulanan değerlendirme kuralları. Her kural tipi için ilgili master listeden (Marka, Ülke, İçindekiler, Katkı, Konu vb.) dropdown ile seçim yapılır — manuel metin girişi yoktur. Kural eşleştiğinde uzmanın kendi derecelendirme ölçeğinden seçtiği "Derece" gösterilir.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => ['admin', 'editor', 'expert'].includes(user?.role || ''),
    update: ({ req: { user } }) => {
      if (['admin', 'editor'].includes(user?.role || '')) return true
      if (user?.role === 'expert') {
        return { 'expert.user': { equals: user?.id } } as any
      }
      return false
    },
    delete: ({ req: { user } }) => ['admin', 'editor'].includes(user?.role || ''),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Kural Başlığı',
      required: true,
      admin: {
        description:
          'Kuralın kısa, akılda kalıcı adı. Sitede bu isimle görüntülenir (Örn: "Domuz yağı → Helal Değil", "İsrail menşeli → Boykot").',
      },
    },
    {
      name: 'expert',
      type: 'relationship',
      relationTo: 'experts',
      label: 'Kuralı Yazan Uzman',
      required: true,
      admin: {
        description: 'Bu kuralı yazan uzman. Sitede uzmanın adıyla birlikte gösterilir.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'topic',
          type: 'relationship',
          relationTo: 'topics',
          label: 'Konu (Hangi Dedektif?)',
          required: true,
          admin: {
            width: '50%',
            description:
              'Bu kural hangi konuyla ilgili? (Örn: Helal, Vegan, Çevresel, Boykot, Katkı). Önce "Konular" bölümünden konu tanımlamalısınız.',
          },
        },
        {
          name: 'rating',
          type: 'relationship',
          relationTo: 'rating-scales',
          label: 'Derece (Uzmanın Kendi Ölçeğinden)',
          required: true,
          admin: {
            width: '50%',
            description:
              'Kural eşleştiğinde gösterilecek derece. Uzmanın "Derecelendirmeler" koleksiyonundan seçilir (Örn: "Boykot", "Şüpheli", "Boykot Değil"). Her uzman kendi ölçeğini oluşturur.',
          },
        },
      ],
    },
    {
      name: 'ruleType',
      type: 'select',
      label: 'Kural Tipi (Ne eşleştirilecek?)',
      required: true,
      options: RULE_TYPES,
      admin: {
        description:
          'Ürünün hangi özelliğine bakılacak? Seçiminize göre aşağıda ilgili dropdown açılır.',
      },
    },

    {
      name: 'ingredient',
      type: 'relationship',
      relationTo: 'ingredients',
      label: 'Hangi İçindekiler?',
      admin: {
        condition: (data) =>
          ['ingredient_text', 'ingredient_excludes'].includes(data?.ruleType),
        description:
          'İçindekiler master listesinden seçim yapın. Kural motoru, ürünün seçili içindekiler listesinde bu maddenin olup olmadığını kontrol eder.',
      },
    },
    {
      name: 'additive',
      type: 'relationship',
      relationTo: 'additives',
      label: 'Hangi Katkı Maddesi (E-kod)?',
      admin: {
        condition: (data) => data?.ruleType === 'additive_code',
        description:
          'Katkı master listesinden seçim yapın (Örn: E621, E330, E102). Kural motoru ürünün katkı listesinde bu kodu arar.',
      },
    },
    {
      name: 'brand',
      type: 'relationship',
      relationTo: 'brands',
      label: 'Hangi Marka?',
      admin: {
        condition: (data) => data?.ruleType === 'brand',
        description: 'Marka master listesinden seçim yapın. Kural motoru ürünün markasını kontrol eder.',
      },
    },
    {
      name: 'country',
      type: 'relationship',
      relationTo: 'countries',
      label: 'Hangi Ülke?',
      admin: {
        condition: (data) => data?.ruleType === 'country',
        description: 'Ülke master listesinden seçim yapın. Kural motoru ürünün üretim ülkesini kontrol eder.',
      },
    },
    {
      name: 'productType',
      type: 'relationship',
      relationTo: 'categories',
      label: 'Hangi Ürün Tipi?',
      admin: {
        condition: (data) => data?.ruleType === 'category',
        description:
          'Ürün kategorisi master listesinden seçim yapın. Kural motoru ürünün tipini kontrol eder (Örn: sadece "Enerji İçeceği" tipindeki ürünler için kural).',
      },
    },
    {
      name: 'allergen',
      type: 'select',
      label: 'Hangi Alerjen?',
      options: [
        { label: 'Gluten / Buğday', value: 'gluten' },
        { label: 'Süt / Laktoz', value: 'milk' },
        { label: 'Yumurta', value: 'egg' },
        { label: 'Soya', value: 'soy' },
        { label: 'Yer fıstığı', value: 'peanut' },
        { label: 'Ağaç yemişleri', value: 'nuts' },
        { label: 'Balık', value: 'fish' },
        { label: 'Kabuklu deniz ürünleri', value: 'shellfish' },
        { label: 'Susam', value: 'sesame' },
        { label: 'Hardal', value: 'mustard' },
        { label: 'Kereviz', value: 'celery' },
        { label: 'Sülfit', value: 'sulphite' },
      ],
      admin: {
        condition: (data) => data?.ruleType === 'allergen',
        description: 'Alerjen tipini seçin. Kural motoru ürünün alerjen listesinde bunu arar.',
      },
    },
    {
      name: 'label',
      type: 'select',
      label: 'Hangi Etiket?',
      options: [
        { label: 'Vegan', value: 'vegan' },
        { label: 'Vejetaryen', value: 'vegetarian' },
        { label: 'Glütensiz', value: 'gluten-free' },
        { label: 'Laktozsuz', value: 'lactose-free' },
        { label: 'Organik', value: 'organic' },
        { label: 'Helal Sertifikalı', value: 'halal-certified' },
        { label: 'Koşer', value: 'kosher' },
        { label: 'GDO içermez', value: 'non-gmo' },
        { label: 'Doğal', value: 'natural' },
        { label: 'Katkısız', value: 'no-additives' },
        { label: 'Şekersiz', value: 'sugar-free' },
      ],
      admin: {
        condition: (data) => ['label_has', 'label_missing'].includes(data?.ruleType),
        description: 'Etiket tipini seçin. label_has: etiket mevcutsa, label_missing: etiket yoksa eşleşir.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'nutritionField',
          type: 'select',
          label: 'Besin Değeri Alanı',
          options: [
            { label: 'Şeker (g/100g)', value: 'sugars' },
            { label: 'Eklenmiş şeker (g/100g)', value: 'addedSugars' },
            { label: 'Yağ (g/100g)', value: 'fat' },
            { label: 'Doymuş yağ (g/100g)', value: 'saturatedFat' },
            { label: 'Tuz (g/100g)', value: 'salt' },
            { label: 'Sodyum (mg/100g)', value: 'sodium' },
            { label: 'Enerji (kcal/100g)', value: 'energyKcal' },
          ],
          admin: {
            condition: (data) => ['nutrition_max', 'nutrition_min'].includes(data?.ruleType),
            width: '50%',
            description: 'Hangi besin değerine bakılacak?',
          },
        },
        {
          name: 'nutritionThreshold',
          type: 'number',
          label: 'Eşik Değer',
          admin: {
            condition: (data) => ['nutrition_max', 'nutrition_min'].includes(data?.ruleType),
            width: '50%',
            description:
              'Sınır değer (100g/ml başına). "Max" için üstünde, "Min" için altında eşleşir (Örn: 22.5).',
          },
        },
      ],
    },

    {
      name: 'description',
      type: 'textarea',
      label: 'Açıklama (Kullanıcıya Gösterilecek)',
      required: true,
      admin: {
        description:
          'Kural eşleştiğinde kullanıcıya gösterilecek detaylı açıklama. Neden bu karar verildiğini anlatın, bilimsel/tarihsel referanslar ekleyin.',
      },
    },
    {
      name: 'evidence',
      type: 'array',
      labels: { singular: 'Kanıt', plural: 'Kanıtlar (Görsel/Belge/Bağlantı)' },
      fields: [
        {
          name: 'type',
          type: 'select',
          label: 'Kanıt Tipi',
          required: true,
          defaultValue: 'image',
          options: [
            { label: 'Görsel (fotoğraf/ekran görüntüsü)', value: 'image' },
            { label: 'Belge (PDF, sertifika)', value: 'document' },
            { label: 'Bağlantı (haber, makale)', value: 'link' },
          ],
        },
        {
          name: 'media',
          type: 'upload',
          relationTo: 'media',
          label: 'Dosya',
          admin: {
            condition: (data) => data?.type === 'image' || data?.type === 'document',
          },
        },
        {
          name: 'url',
          type: 'text',
          label: 'Bağlantı URL\'i',
          admin: {
            condition: (data) => data?.type === 'link',
          },
        },
        {
          name: 'caption',
          type: 'text',
          label: 'Kanıt Açıklaması',
        },
      ],
    },
    {
      name: 'sources',
      type: 'array',
      labels: { singular: 'Kaynak', plural: 'Kaynaklar (Referanslar)' },
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Kaynak Başlığı',
          required: true,
        },
        {
          name: 'url',
          type: 'text',
          label: 'Kaynak URL\'i',
          required: true,
        },
      ],
    },
    {
      name: 'isActive',
      type: 'checkbox',
      label: 'Kural Aktif',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'İşaret kaldırılırsa kural motoru tarafından değerlendirilmez.',
      },
    },
  ],
}
