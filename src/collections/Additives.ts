import type { CollectionConfig } from 'payload'

/**
 * "e 330" / " E330 " → "E330"; boş değer `null`. Boş bırakılan E-kodu tekil indekse
 * (Postgres'te birden çok NULL'a izin verir) takılmadan kaybolur.
 */
export const normalizeAdditiveCode = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null
  const value = raw.replace(/\s+/g, '').toUpperCase()
  return value.length > 0 ? value : null
}

export const Additives: CollectionConfig = {
  slug: 'additives',
  labels: {
    singular: 'Katkı Maddesi',
    plural: 'Katkı Maddeleri (E-Kod Listesi)',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'code', 'function', 'riskLevel', 'halalStatus'],
    group: 'Master Listeler',
    description:
      'Gıda katkı maddelerinin master listesi. Uzman kuralları bu listeden seçim yapar (Örn: "E621 Monosodyum Glutamat" → sağlığa zararlı kuralı). E-kodu her etikette yazmaz; kod yoksa boş bırakın.',
  },
  access: {
    read: () => true,
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        // `'code' in data` şart: alan panelde temizlendiğinde `null` gelir; `??` ile
        // eski değere düşmek silmeyi engellerdi.
        const code = normalizeAdditiveCode('code' in data ? data.code : originalDoc?.code)
        const name = String(('name' in data ? data.name : originalDoc?.name) ?? '').trim()
        data.code = code
        if (name) data.title = [code, name].filter(Boolean).join(' · ')
        return data
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Görünen Ad',
      admin: {
        readOnly: true,
        description: 'Otomatik üretilir: E-kodu varsa "E330 · Sitrik Asit", yoksa yalnız katkı adı.',
        position: 'sidebar',
      },
    },
    {
      name: 'code',
      type: 'text',
      label: 'E-Kodu',
      unique: true,
      index: true,
      admin: {
        description:
          'Avrupa katkı kodu (Örn: "E330", "E621", "E102"). Opsiyonel: etikette kod yazmıyorsa boş bırakın.',
      },
    },
    {
      name: 'name',
      type: 'text',
      label: 'Katkı Adı',
      required: true,
      admin: {
        description: 'Katkı maddesinin tam adı (Örn: "Sitrik Asit", "Monosodyum Glutamat", "Tartrazin").',
      },
    },
    {
      name: 'aliases',
      type: 'array',
      labels: { singular: 'Alternatif Ad', plural: 'Alternatif Adlar' },
      admin: {
        description: 'Farklı dillerde veya ticari isimlerle yazılan alternatif adlar.',
      },
      fields: [
        {
          name: 'alias',
          type: 'text',
          label: 'Alternatif Ad',
          required: true,
        },
      ],
    },
    {
      name: 'function',
      type: 'select',
      label: 'Fonksiyonu',
      options: [
        { label: 'Asitlik düzenleyici', value: 'acidity_regulator' },
        { label: 'Antioksidan', value: 'antioxidant' },
        { label: 'Aroma arttırıcı', value: 'flavor_enhancer' },
        { label: 'Emülgatör', value: 'emulsifier' },
        { label: 'Koruyucu', value: 'preservative' },
        { label: 'Renklendirici', value: 'color' },
        { label: 'Tatlandırıcı', value: 'sweetener' },
        { label: 'Kıvam arttırıcı', value: 'thickener' },
        { label: 'Topaklanmayı önleyici', value: 'anti_caking' },
        { label: 'Kabartma ajanı', value: 'leavening' },
        { label: 'Stabilizatör', value: 'stabilizer' },
        { label: 'Diğer', value: 'other' },
      ],
      admin: {
        description: 'Katkının gıdadaki fonksiyonu. Kategorize etmek için kullanılır.',
      },
    },
    {
      name: 'riskLevel',
      type: 'select',
      label: 'Risk Seviyesi',
      options: [
        { label: '✅ Düşük (güvenli)', value: 'low' },
        { label: '⚠️ Orta (aşırı tüketimde dikkat)', value: 'medium' },
        { label: '❌ Yüksek (sağlığa zararlı olduğu gösterilmiş)', value: 'high' },
      ],
      admin: {
        description: 'Sağlık açısından risk seviyesi. Bilimsel kanıtlara dayanır.',
      },
    },
    {
      name: 'halalStatus',
      type: 'select',
      label: 'Helal Durumu',
      options: [
        { label: '✅ Helal', value: 'halal' },
        { label: '❌ Haram', value: 'haram' },
        { label: '⚠️ Müşkül (kaynağı belirsiz)', value: 'mashbooh' },
        { label: '❓ Bilinmiyor', value: 'unknown' },
      ],
      admin: {
        description: 'Helal kuralları için referans. Bazı katkılar hayvansal kaynaklı olabilir (örn: E120 koşnil böceği).',
      },
    },
    {
      name: 'isVegan',
      type: 'select',
      label: 'Vegan Durumu',
      options: [
        { label: '✅ Vegan', value: 'yes' },
        { label: '❌ Hayvansal kaynak (vegan değil)', value: 'no' },
        { label: '❓ Bilinmiyor', value: 'unknown' },
      ],
      admin: {
        description: 'Vegan kuralları için referans.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Açıklama',
      admin: {
        description: 'Katkı maddesinin ne olduğu, ne için kullanıldığı, olası sağlık etkileri hakkında bilgi.',
      },
    },
    {
      name: 'sources',
      type: 'array',
      labels: { singular: 'Kaynak', plural: 'Kaynaklar' },
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
  ],
}
