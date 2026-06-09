import type { CollectionConfig } from 'payload'

export const Additives: CollectionConfig = {
  slug: 'additives',
  labels: {
    singular: 'Katkı Maddesi',
    plural: 'Katkı Maddeleri (E-Kod Listesi)',
  },
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'name', 'function', 'riskLevel', 'halalStatus'],
    group: 'Master Listeler',
    description:
      'Gıda katkı maddelerinin (E-kodları) master listesi. Uzman kuralları bu listeden seçim yapar (Örn: "E621 Monosodyum Glutamat" → sağlığa zararlı kuralı).',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      label: 'E-Kodu',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Avrupa katkı kodu (Örn: "E330", "E621", "E102"). Büyük harfle ve "E" ile başlamalı.',
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
