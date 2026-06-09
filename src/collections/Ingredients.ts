import type { CollectionConfig } from 'payload'

export const Ingredients: CollectionConfig = {
  slug: 'ingredients',
  labels: {
    singular: 'İçindekiler Öğesi',
    plural: 'İçindekiler (Master Liste)',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name'],
    group: 'Master Listeler',
    description:
      'Ürünlerde geçebilecek içindekilerin master listesi. Uzman kuralları bu listeden seçim yaparak eşleşme arar (Örn: "Palm Yağı" kuralı, ürünün içindekiler metninde "Palm Yağı", "Palm Oil" veya tanımlı alternatif adları aranır). Sadece ad + eş anlamlılar + kısa açıklama içerir. Helal/vegan/sağlık/çevre değerlendirmeleri uzmanların kural yazımıyla yapılır.',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Standart Ad',
      required: true,
      index: true,
      admin: {
        description:
          'İçindekilerin standart Türkçe adı. Ürün etiketinde farklı yazılsa bile kural motoru buradan arar (Örn: "Palm Yağı", "Monosodyum Glutamat").',
      },
    },
    {
      name: 'aliases',
      type: 'array',
      labels: { singular: 'Alternatif Ad', plural: 'Alternatif Adlar / Eş Anlamlılar' },
      admin: {
        description:
          'Etiketlerde farklı yazılabilecek alternatif adlar. Bunlardan biri geçtiğinde de eşleşir (Örn: Palm Yağı için ["Palm Oil", "Palmiye Yağı", "Yağ (palm)"]).',
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
      name: 'description',
      type: 'textarea',
      label: 'Açıklama',
      admin: {
        description:
          'Bu içindekiler hakkında kısa, nötr bilgi (kökeni, üretim yöntemi). Değer yargısı içermemeli — helal/vegan/sağlık/çevre yorumlarını uzman kural yazımında yapar.',
      },
    },
  ],
}
