import type { CollectionConfig } from 'payload'
import { detectCountryFromBarcode } from '@/lib/barcodePrefixes'
import { barcodeField } from './custom/BarcodeField/BarcodeField'

export const Products: CollectionConfig = {
  slug: 'products',
  labels: {
    singular: 'Ürün',
    plural: 'Ürünler',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'barcode', 'brand', 'status'],
    group: 'Ürünler',
    description:
      'Sistemdeki tüm ürün kayıtları. Kullanıcılar barkod okutarak veya arayarak bu ürünlere ulaşır. Aktif uzman kuralları sayfasında otomatik değerlendirilir.',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  // access: {
  //   read: () => true,
  //   create: ({ req: { user } }) => ['admin', 'editor', 'expert'].includes(user?.role || ''),
  //   update: ({ req: { user } }) => ['admin', 'editor'].includes(user?.role || ''),
  //   delete: ({ req: { user } }) => user?.role === 'admin',
  // },

  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: '📋 Genel Bilgiler',
          fields: [
            barcodeField({
              name: 'barcode',
              label: 'Barkod / QR Kod',
              // required: true,
              description:
                'EAN-13, UPC, EAN-8 veya QR kod. Kullanıcılar bu kod ile ürünü tarar. Aynı barkod girilirse sizi düzenleme sayfasına yönlendirir.',
            }),

            {
              name: 'name',
              type: 'text',
              label: 'Ürün Adı',
              // required: true,
              admin: {
                description:
                  'Ürünün tam adı. Paketin üzerindeki isimle aynı olmalı (Örn: "Coca-Cola Original 1L", "Ülker Çikolatalı Gofret 150g").',
              },
            },
            {
              name: 'slug',
              type: 'text',
              label: 'URL Kısa Adı (Slug)',
              // required: true,
              unique: true,
              index: true,
              admin: {
                hidden: true,
                description: "URL'de kullanılacak kısa ad. Otomatik üretilir.",
              },
            },

            {
              name: 'description',
              type: 'textarea',
              label: 'Açıklama',
              admin: {
                description:
                  'Ürün hakkında genel açıklama. Düz metin olarak yazılır (satır sonları korunur).',
              },
            },
          ],
        },
        {
          label: '📸 Görseller',
          description:
            'Toplam en fazla 6 fotoğraf. Ön Yüz Fotoğrafı zorunludur; diğer 5 alan (3 kategorize + 2 ek) isteğe bağlıdır. Belirli kategoriler için ayrılmış alanlar sitede özel etiketle gösterilir.',
          fields: [
            {
              name: 'frontImage',
              type: 'upload',
              relationTo: 'media',
              label: 'Ön Yüz Fotoğrafı (Zorunlu)',
              // required: true,
              admin: {
                description:
                  'Ürünün ana/ön yüz fotoğrafı. Listelerde ve ürün sayfasında hero olarak gösterilir. Marka logosu, ürün adı ve gramaj görünen kısım. Kare veya dikey format önerilir, en az 600x600 piksel.',
              },
            },
            {
              name: 'ingredientsImage',
              type: 'upload',
              relationTo: 'media',
              label: 'İçindekiler Fotoğrafı',
              admin: {
                description:
                  'Paket üzerindeki içindekiler tablosunun fotoğrafı. Sitede "İçindekiler" etiketiyle gösterilir.',
              },
            },
            {
              name: 'nutritionImage',
              type: 'upload',
              relationTo: 'media',
              label: 'Besin Değerleri Fotoğrafı',
              admin: {
                description:
                  'Paket üzerindeki besin değerleri tablosunun fotoğrafı. Sitede "Besin Değerleri" etiketiyle gösterilir.',
              },
            },
            {
              name: 'recyclingImage',
              type: 'upload',
              relationTo: 'media',
              label: 'Geri Dönüşüm Bilgisi Fotoğrafı',
              admin: {
                description:
                  'Ambalaj üzerindeki geri dönüşüm sembolleri veya bertaraf talimatları. Sitede "Geri Dönüşüm" etiketiyle gösterilir.',
              },
            },
            {
              name: 'additionalImages',
              type: 'array',
              labels: { singular: 'Ek Fotoğraf', plural: 'Ek Fotoğraflar' },
              minRows: 0,
              maxRows: 2,
              admin: {
                description:
                  'İsteğe bağlı ek fotoğraflar: arka yüz, kullanım örneği, sertifika, garanti belgesi vb. Maksimum 2 ek fotoğraf. Ön Yüz + 3 kategorize + 2 ek = toplam en fazla 6 fotoğraf.',
              },
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  label: 'Görsel',
                  // required: true,
                },
                {
                  name: 'caption',
                  type: 'text',
                  label: 'Açıklama',
                  admin: {
                    description:
                      'Bu görselin ne olduğunu açıklayan kısa metin (Örn: "Arka yüz", "Kullanım örneği", "Sertifika").',
                  },
                },
              ],
            },
          ],
        },
        {
          label: '🏷️ Marka & Kategori',
          fields: [
            {
              name: 'brand',
              type: 'relationship',
              relationTo: 'brands',
              label: 'Marka',
              // required: true,
              admin: {
                description: 'Ürünün markası. Listelerde marka logusu ile gösterilir.',
              },
            },
            {
              name: 'category',
              type: 'relationship',
              relationTo: 'categories',
              label: 'Ürün Kategorisi',
              // required: true,
              admin: {
                description:
                  'Ürünün tipi (içecek, atıştırmalık, süt ürünleri vb.). Hiyerarşik olabilir.',
              },
            },
            {
              name: 'manufacturer',
              type: 'text',
              label: 'Üretici Firma',
              admin: {
                description:
                  'Ürünü fiziksel olarak üreten firma. Markadan farklıysa buraya yazın (Örn: "Marka: Coca-Cola, Üretici: The Coca-Cola Company İstanbul Şubesi").',
              },
            },
            {
              name: 'country',
              type: 'relationship',
              relationTo: 'countries',
              label: 'Üretim Yeri Ülke',
              admin: {
                description:
                  'Ürünün fiziksel olarak üretildiği ülke. Barkod girildiğinde GS1 prefix\'inden (ilk 3 hane) OTOMATİK doldurulur; isterseniz elle değiştirebilirsiniz. Kural motorunda ülke bazlı boykot analizi için kullanılır. Ülke listede yoksa önce "Ülkeler" bölümünden ekleyin.',
              },
            },
          ],
        },
        {
          label: '🧪 İçindekiler',
          fields: [
            {
              name: 'items',
              type: 'array',
              label: 'Besinler',
              fields: [
                {
                  name: 'ingredients',
                  type: 'relationship',
                  relationTo: 'ingredients',
                  // required: true,

                  label: 'İçindekiler',
                  admin: {
                    description:
                      'İçindekilerin her bir öğesinin ayrı ayrı listesi. Her öğeyi master listeden seçin (Örn: "Palm Yağı", "Su", "Şeker"). Kural motoru bu seçimlere göre çalışır.',
                  },
                },
                {
                  label: 'Yüzdelik',
                  name: 'percent_estimate',
                  type: 'number',
                  required: true,
                },
              ],
            },

            {
              name: 'allergens',
              type: 'relationship',
              relationTo: 'allergens',
              label: 'Alerjenler',
              required: true,
            },
            {
              name: 'additives',
              type: 'relationship',
              relationTo: 'additives',
              label: 'Katkı Maddesi',
              hasMany: true,
              admin: {
                description:
                  'Katkı master listesinden seçim yapın (Örn: E330 Sitrik Asit, E621 MSG).',
              },
            },
          ],
        },
        {
          label: '🥗 Besin Değerleri',
          fields: [
            {
              name: 'nutrition',
              type: 'group',
              label: 'Besin Değerleri',
              fields: [
                {
                  name: 'per',
                  type: 'select',
                  label: 'Ölçüm',
                  required: true,
                  defaultValue: '100g',
                  options: [
                    { label: '100g', value: '100g' },
                    { label: '100ml', value: '100ml' },
                    { label: 'serving', value: 'serving' },
                  ],
                },
                {
                  name: 'items',
                  type: 'array',
                  label: 'Besinler',
                  fields: [
                    {
                      name: 'nutrient',
                      type: 'relationship',
                      relationTo: 'nutrients',
                      required: true,
                    },
                    {
                      name: 'amount',
                      type: 'number',
                      required: true,
                    },
                    {
                      name: 'unit',
                      type: 'text',
                      required: true,
                      defaultValue: 'mg',
                    },
                  ],
                },
              ],
            },
            {
              name: 'nutriscore',
              type: 'select',
              label: 'Nutri-Score',
              options: [
                { label: 'A (En sağlıklı)', value: 'a' },
                { label: 'B', value: 'b' },
                { label: 'C', value: 'c' },
                { label: 'D', value: 'd' },
                { label: 'E (En sağlıksız)', value: 'e' },
              ],
              admin: {
                description:
                  'Nutri-Score, ürünün genel besin değeri kalitesini gösteren A-E harfli etiket (A=en iyi, E=en kötü). Etikette yazıyorsa seçin.',
              },
            },
          ],
        },
        {
          label: '🏷️ Etiketler & Paket',
          fields: [
            {
              name: 'labels',
              type: 'select',
              hasMany: true,
              label: 'Etiketler / Sertifikalar',
              options: [
                { label: 'Vegan', value: 'vegan' },
                { label: 'Vejetaryen', value: 'vegetarian' },
                { label: 'Glütensiz', value: 'gluten-free' },
                { label: 'Laktozsuz', value: 'lactose-free' },
                { label: 'Organik / Bio', value: 'organic' },
                { label: 'Helal Sertifikalı', value: 'halal-certified' },
                { label: 'Koşer', value: 'kosher' },
                { label: 'GDO içermez (Non-GMO)', value: 'non-gmo' },
                { label: 'Doğal', value: 'natural' },
                { label: 'Katkısız', value: 'no-additives' },
                { label: 'Şekersiz', value: 'sugar-free' },
                { label: 'CE İşareti', value: 'ce-mark' },
                { label: 'RoHS Uyumlu', value: 'rohs' },
                { label: 'Energy Star', value: 'energy-star' },
                { label: 'Hayvan Deneysiz (Cruelty Free)', value: 'cruelty-free' },
                { label: 'Vegan Sertifikalı (Kozmetik)', value: 'vegan-certified-cosmetics' },
                { label: 'BPA İçermez', value: 'bpa-free' },
                { label: 'Paraben İçermez', value: 'paraben-free' },
                { label: 'Sülfatsız', value: 'sulfate-free' },
                { label: 'Geri Dönüştürülebilir Ambalaj', value: 'recyclable' },
                { label: 'Tek Kullanımlık (Disposable)', value: 'disposable' },
                { label: 'Yeniden Kullanılabilir', value: 'reusable' },
                { label: 'Oeko-Tex Standard 100', value: 'oeko-tex' },
                { label: 'GOTS (Organik Tekstil)', value: 'gots' },
                { label: 'Fair Trade / Adil Ticaret', value: 'fair-trade' },
                { label: 'FSC Sertifikalı (Kağıt/Ahşap)', value: 'fsc' },
                { label: 'Enerji Sınıfı A+++', value: 'energy-a-plus-plus-plus' },
                { label: 'Enerji Sınıfı A++', value: 'energy-a-plus-plus' },
                { label: 'Enerji Sınıfı A+', value: 'energy-a-plus' },
                { label: 'Enerji Sınıfı A', value: 'energy-a' },
                { label: 'Enerji Sınıfı B', value: 'energy-b' },
              ],
              admin: {
                description:
                  'Ürünün üzerinde bulunan etiket/sertifikalar. Çoklu seçim yapılabilir. Kural motoru bu etiketlere bakar. Gıda + kozmetik + elektronik + tekstil için ortak liste.',
              },
            },
            {
              name: 'packaging',
              type: 'text',
              label: 'Ambalaj Tipi',
              admin: {
                description:
                  'Ürünün paketleme tipi (Örn: "Cam şişe", "Plastik kutu", "Karton kutu", "Teneke kutu").',
              },
            },
            {
              name: 'size',
              type: 'text',
              label: 'Boyut / Ağırlık',
              admin: {
                description: 'Ürünün boyutu (Örn: "500g", "1L", "330ml", "12x25g").',
              },
            },
          ],
        },
        {
          label: '📦 Ek Özellikler (Genel)',
          description:
            'Tüm ürünler için geçerli teknik özellikler, uyarılar, model, garanti ve kullanım bilgileri. Kozmetik, elektronik, tekstil, ev ürünleri vb. tüm taranabilir ürünler için kullanılır.',
          fields: [
            {
              name: 'specifications',
              type: 'array',
              labels: { singular: 'Teknik Özellik', plural: 'Teknik Özellikler (Key-Value)' },
              admin: {
                description:
                  'Ürünün teknik özellikleri anahtar-değer çiftleri olarak (Örn: "Renk: Siyah", "Materyal: Pamuk", "Güç: 2200W", "Voltaj: 220V").',
              },
              fields: [
                {
                  name: 'key',
                  type: 'text',
                  label: 'Özellik Adı',
                  required: true,
                  admin: {
                    description:
                      'Özelliğin adı (Örn: "Renk", "Materyal", "Güç", "Voltaj", "Kapasite").',
                  },
                },
                {
                  name: 'value',
                  type: 'text',
                  label: 'Değer',
                  required: true,
                  admin: {
                    description:
                      'Özelliğin değeri (Örn: "Siyah", "Pamuk %100", "2200W", "220V", "5L").',
                  },
                },
                {
                  name: 'unit',
                  type: 'text',
                  label: 'Birim (Opsiyonel)',
                  admin: {
                    description:
                      'Değerin birimi, ayrı yazılmak istenirse (Örn: "W", "V", "ml", "kg").',
                  },
                },
              ],
            },
            {
              name: 'warnings',
              type: 'array',
              labels: { singular: 'Uyarı', plural: 'Uyarılar & Dikkat Edilmesi Gerekenler' },
              admin: {
                description:
                  'Ürünün kullanımıyla ilgili uyarılar. Ciddiyet seviyesine göre renklendirilir (sitede).',
              },
              fields: [
                {
                  name: 'severity',
                  type: 'select',
                  label: 'Ciddiyet Seviyesi',
                  required: true,
                  defaultValue: 'medium',
                  options: [
                    { label: '🟢 Düşük (bilgi)', value: 'low' },
                    { label: '🟡 Orta (dikkat)', value: 'medium' },
                    { label: '🔴 Yüksek (tehlike)', value: 'high' },
                  ],
                  admin: {
                    description: 'Uyarının ciddiyet seviyesi. Sitede renkli olarak gösterilir.',
                  },
                },
                {
                  name: 'text',
                  type: 'textarea',
                  label: 'Uyarı Metni',
                  required: true,
                  admin: {
                    description:
                      'Uyarı metni (Örn: "3 yaş altı için uygun değildir", "Direkt güneş ışığından uzak tutun", "Yanıcı madde").',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'model',
                  type: 'text',
                  label: 'Model / Ürün Kodu',
                  admin: {
                    width: '50%',
                    description:
                      'Üreticinin ürüne verdiği model/seri kodu (Örn: "iPhone 15 Pro Max A2849", "Arçelik 5840 NM").',
                  },
                },
                {
                  name: 'sku',
                  type: 'text',
                  label: 'SKU / Stok Kodu',
                  admin: {
                    width: '50%',
                    description: 'Satıcının stok kodu (Örn: "ARN-12345-BK").',
                  },
                },
              ],
            },
            {
              name: 'warranty',
              type: 'text',
              label: 'Garanti Süresi',
              admin: {
                description:
                  'Garanti bilgisi (Örn: "2 yıl", "1 yıl resmi distribütör", "Garanti yok").',
              },
            },
            {
              name: 'usage',
              type: 'textarea',
              label: 'Kullanım Talimatı',
              admin: {
                description:
                  'Ürünün nasıl kullanılacağına dair kısa bilgi (Örn: "Yıkamadan önce ters çevirin", "İlk kullanımda 10 dakika kaynatın").',
              },
            },
            {
              name: 'storage',
              type: 'text',
              label: 'Saklama Koşulları',
              admin: {
                description:
                  'Ürünün saklama koşulları (Örn: "Serin ve kuru yerde saklayın", "+4°C\'de buzdolabında", "Direkt güneş ışığından uzak").',
              },
            },
          ],
        },
        {
          label: '💰 Fiyat',
          description:
            'Farklı tarihlerden fiyat kayıtları. Maksimum 10 kayıt (en eski otomatik silinir). Sitede "X-Y ₺ arası (ort. Z ₺)" şeklinde gösterilir.',
          fields: [
            {
              name: 'prices',
              type: 'array',
              labels: { singular: 'Fiyat Kaydı', plural: 'Fiyat Bilgileri' },
              minRows: 0,
              maxRows: 10,
              admin: {
                description:
                  'Farklı tarihlerdeki fiyat kayıtları. Sitede otomatik olarak "en düşük - en yüksek" aralığı + ortalama fiyat gösterilir. Maksimum 10 kayıt (en eski otomatik düşer).',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'amount',
                      type: 'number',
                      label: 'Fiyat (₺)',
                      required: true,
                      admin: {
                        width: '50%',
                        description: 'Sayısal fiyat Türk Lirası olarak (Örn: 12.50, 1499.99).',
                      },
                    },
                    {
                      name: 'date',
                      type: 'date',
                      label: 'Kayıt Tarihi',
                      required: true,
                      admin: {
                        width: '50%',
                        description: 'Fiyatın kaydedildiği tarih.',
                        date: { pickerAppearance: 'dayOnly' },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      label: 'Yayın Durumu',
      // required: true,
      defaultValue: 'draft',
      options: [
        { label: '📝 Taslak', value: 'draft' },
        { label: '✅ Yayında', value: 'published' },
        { label: '🗄️ Arşivlendi', value: 'archived' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Sadece "Yayında" durumundaki ürünler sitede görünür ve taranabilir. Taslak ürünler admin panele özeldir.',
      },
    },
    {
      name: 'submittedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Ekleyen Kullanıcı',
      admin: {
        hidden: true,
        readOnly: true,
        position: 'sidebar',
        description: 'Ürünü sisteme ekleyen kullanıcı. Otomatik atanır.',
      },
    },
    {
      name: 'is_submit',
      type: 'checkbox',
      label: 'Bakıldı mı?',
    },
  ],
  // hooks: {
  //   beforeChange: [
  //     async ({ data, req, operation }) => {
  //       // submittedBy ataması
  //       if (operation === 'create' && req.user) {
  //         data.submittedBy = req.user.id
  //       }

  //       // ✅ BARKOD KONTROLÜ
  //       if (operation === 'create' && data?.barcode && req.payload) {
  //         const existing = await req.payload.find({
  //           collection: 'products',
  //           where: { barcode: { equals: data.barcode } },
  //           limit: 1,
  //           depth: 0,
  //         })

  //         if (existing.docs.length > 0) {
  //           const product = existing.docs[0]
  //           throw new Error(
  //             `⚠️ BU BARKOD ZATEN KAYITLI!\n\n` +
  //               `Ürün: "${product.name}"\n` +
  //               `ID: ${product.id}\n\n` +
  //               `Lütfen mevcut ürünü düzenleyin veya farklı barkod girin.`,
  //           )
  //         }
  //       }

  //       // Ülke tespiti
  //       if (operation === 'create' && data?.barcode && !data.country && req.payload) {
  //         const detected = detectCountryFromBarcode(data.barcode)
  //         if (detected) {
  //           const result = await req.payload.find({
  //             collection: 'countries',
  //             where: { name: { equals: detected.country } },
  //             limit: 1,
  //             depth: 0,
  //           })
  //           if (result.docs[0]) {
  //             data.country = result.docs[0].id
  //             req.payload.logger.info(
  //               `🌍 Barkod ${data.barcode} prefix'i (${detected.prefix}) → ülke otomatik atandı: ${detected.country}`,
  //             )
  //           }
  //         }
  //       }

  //       // Fiyat sıralama
  //       if (data?.prices && Array.isArray(data.prices)) {
  //         const dated = data.prices
  //           .filter((p: any) => p?.date)
  //           .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
  //           .slice(0, 10)
  //         const undated = data.prices.filter((p: any) => !p?.date)
  //         data.prices = [...dated, ...undated]
  //       }

  //       return data
  //     },
  //   ],
  //   beforeValidate: [
  //     ({ data, operation }) => {
  //       if (operation === 'create' && data?.name && !data.slug) {
  //         data.slug = data.name
  //           .toLowerCase()
  //           .replace(/ğ/g, 'g')
  //           .replace(/ü/g, 'u')
  //           .replace(/ş/g, 's')
  //           .replace(/ı/g, 'i')
  //           .replace(/ö/g, 'o')
  //           .replace(/ç/g, 'c')
  //           .replace(/[^a-z0-9]+/g, '-')
  //           .replace(/(^-|-$)/g, '')
  //       }
  //       return data
  //     },
  //   ],
  //   beforeOperation: [
  //     ({ args, operation }) => {
  //       if (operation !== 'create' && operation !== 'update') return
  //       const data = (args.data as any) || {}
  //       const images = [
  //         data.frontImage,
  //         data.ingredientsImage,
  //         data.nutritionImage,
  //         data.recyclingImage,
  //       ]
  //       const categorizedCount = images.filter(Boolean).length
  //       const additionalCount = Array.isArray(data.additionalImages)
  //         ? data.additionalImages.length
  //         : 0
  //       const total = categorizedCount + additionalCount
  //       if (total > 6) {
  //         throw new Error(`En fazla 6 fotoğraf eklenebilir. Şu an ${total} fotoğraf var.`)
  //       }
  //       if (Array.isArray(data.prices) && data.prices.length > 10) {
  //         throw new Error(`En fazla 10 fiyat kaydı eklenebilir.`)
  //       }
  //     },
  //   ],
  // },
}
