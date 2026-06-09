import * as z from 'zod'

export interface ActionResponse<T = any> {
  success: boolean
  message: string
  errors?: {
    [K in keyof T]?: string[]
  }
  inputs?: T
}
export const formSchema = z.object({
  barcode: z.string({ error: 'This field is required' }),
  name: z.string({ error: 'This field is required' }),
  brand: z.string().min(1, 'Please select an item'),
  category: z.string().min(1, 'Please select an item'),
  manufacturer: z.string({ error: 'This field is required' }).optional(),
  country: z.string({ error: 'This field is required' }).optional(),
  frontImage: z.union([
    z.file().mime(['image/png', 'image/jpeg', 'image/gif']).max(5242880),
    z
      .array(z.file().mime(['image/png', 'image/jpeg', 'image/gif']).max(5242880))
      .nonempty({ message: 'Please select a file' }),
    z.string().min(1, 'Please select a file'),
    z.instanceof(FileList),
  ]),
  ingredientsImage: z
    .union([
      z.file().mime(['image/png', 'image/jpeg', 'image/gif']).max(5242880),
      z
        .array(z.file().mime(['image/png', 'image/jpeg', 'image/gif']).max(5242880))
        .nonempty({ message: 'Please select a file' }),
      z.string().min(1, 'Please select a file'),
      z.instanceof(FileList),
    ])
    .optional(),
  nutritionImage: z
    .union([
      z.file().mime(['image/png', 'image/jpeg', 'image/gif']).max(5242880),
      z
        .array(z.file().mime(['image/png', 'image/jpeg', 'image/gif']).max(5242880))
        .nonempty({ message: 'Please select a file' }),
      z.string().min(1, 'Please select a file'),
      z.instanceof(FileList),
    ])
    .optional(),
  recyclingImage: z
    .union([
      z.file().mime(['image/png', 'image/jpeg', 'image/gif']).max(5242880),
      z
        .array(z.file().mime(['image/png', 'image/jpeg', 'image/gif']).max(5242880))
        .nonempty({ message: 'Please select a file' }),
      z.string().min(1, 'Please select a file'),
      z.instanceof(FileList),
    ])
    .optional(),
  additionalImages: z
    .union([
      z.file().mime(['image/png', 'image/jpeg', 'image/gif']).max(5242880),
      z
        .array(z.file().mime(['image/png', 'image/jpeg', 'image/gif']).max(5242880))
        .nonempty({ message: 'Please select a file' }),
      z.string().min(1, 'Please select a file'),
      z.instanceof(FileList),
    ])
    .optional(),
  ingredients: z.string().min(1, 'Please select an item'),
  allergens: z.string().min(1, 'Please select an item').optional(),
  additives: z.string().min(1, 'Please select an item').optional(),
  servingSize: z.coerce.number({ error: 'Please enter a valid number' }).optional(),
  servingsPerPackage: z.coerce.number({ error: 'Please enter a valid number' }).optional(),
  energyKcal: z.coerce.number({ error: 'Please enter a valid number' }).optional(),
  energyKj: z.coerce.number({ error: 'Please enter a valid number' }).optional(),
  fat: z.coerce.number({ error: 'Please enter a valid number' }).optional(),
  saturatedFat: z.coerce.number({ error: 'Please enter a valid number' }).optional(),
  transFat: z.coerce.number({ error: 'Please enter a valid number' }).optional(),
  carbohydrates: z.coerce.number({ error: 'Please enter a valid number' }).optional(),
  sugars: z.coerce.number({ error: 'Please enter a valid number' }).optional(),
  addedSugars: z.coerce.number({ error: 'Please enter a valid number' }).optional(),
  fiber: z.coerce.number({ error: 'Please enter a valid number' }).optional(),
  protein: z.coerce.number({ error: 'Please enter a valid number' }).optional(),
  salt: z.coerce.number({ error: 'Please enter a valid number' }).optional(),
  sodium: z.coerce.number({ error: 'Please enter a valid number' }).optional(),
  nutriscore: z.string().min(1, 'Please select an item').optional(),
})
