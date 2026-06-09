// schemas/product-schema.ts
import { z } from 'zod'

export const productSchema = z.object({
  // Genel Bilgiler
  name: z.string().min(2, 'Ürün adı en az 2 karakter olmalı'),
  barcode: z.string().min(8, 'Geçerli bir barkod girin'),

  // Opsiyonel string alanlar
  slug: z.string().optional().default(''),
  description: z.string().optional().default(''),

  // Görseller (hepsi opsiyonel)
  frontImage: z.any().optional(),
  ingredientsImage: z.any().optional(),
  nutritionImage: z.any().optional(),
  recyclingImage: z.any().optional(),
  additionalImages: z
    .array(
      z.object({
        image: z.any().optional(),
        caption: z.string().optional().default(''),
      }),
    )
    .default([]),

  // Marka & Kategori (zorunlu)
  brand: z.string().min(1, 'Marka seçimi zorunlu'),
  category: z.string().min(1, 'Kategori seçimi zorunlu'),

  // Opsiyonel string alanlar
  manufacturer: z.string().default(''),
  country: z.string().default(''),

  // İçindekiler
  ingredientsAnalyzed: z
    .array(
      z.object({
        ingredient: z.string(),
      }),
    )
    .default([]),

  allergens: z.array(z.string()).default([]),

  additives: z
    .array(
      z.object({
        additive: z.string(),
      }),
    )
    .default([]),

  // Besin Değerleri - TÜM ALANLAR OPSİYONEL
  nutritionFacts: z
    .object({
      servingSize: z.string().default(''),
      servingsPerPackage: z.number().optional(),
      energyKcal: z.number().optional(),
      energyKj: z.number().optional(),
      fat: z.number().optional(),
      saturatedFat: z.number().optional(),
      transFat: z.number().optional(),
      carbohydrates: z.number().optional(),
      sugars: z.number().optional(),
      addedSugars: z.number().optional(),
      fiber: z.number().optional(),
      protein: z.number().optional(),
      salt: z.number().optional(),
      sodium: z.number().optional(),
    })
    .default({ servingSize: '' }),

  nutriscore: z.enum(['a', 'b', 'c', 'd', 'e']).optional(),

  // Etiketler & Paket
  labels: z.array(z.string()).default([]),
  packaging: z.string().default(''),
  size: z.string().default(''),

  // Ek Özellikler
  specifications: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
        unit: z.string().default(''),
      }),
    )
    .default([]),

  warnings: z
    .array(
      z.object({
        severity: z.enum(['low', 'medium', 'high']),
        text: z.string(),
      }),
    )
    .default([]),

  model: z.string().default(''),
  sku: z.string().default(''),
  warranty: z.string().default(''),
  usage: z.string().default(''),
  storage: z.string().default(''),

  // Fiyat
  prices: z
    .array(
      z.object({
        amount: z.number().min(0),
        date: z.string(),
      }),
    )
    .default([]),

  // Durum
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
})

export type ProductFormData = z.infer<typeof productSchema>
