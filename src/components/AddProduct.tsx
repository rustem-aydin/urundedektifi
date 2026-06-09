// app/products/add/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Camera,
  Upload,
  Plus,
  X,
  Save,
  Scan,
  AlertTriangle,
  Info,
  ChevronLeft,
  Loader2,
} from 'lucide-react'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { fetchRelations, checkBarcode, uploadMedia, createProduct } from '@/lib/api'
import { productSchema } from '@/types/schemas'

export default function AddProductPage() {
  const router = useRouter()
  const [scannerOpen, setScannerOpen] = useState(false)
  const [existingProduct, setExistingProduct] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [relations, setRelations] = useState<any>({
    brands: [],
    categories: [],
    countries: [],
    ingredients: [],
    additives: [],
  })

  // @ts-ignore - Tip hatasını görmezden gel
  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      barcode: '',
      status: 'draft',
      brand: '',
      category: '',
      manufacturer: '',
      country: '',
      description: '',
      packaging: '',
      size: '',
      model: '',
      sku: '',
      warranty: '',
      usage: '',
      storage: '',
      prices: [],
      specifications: [],
      warnings: [],
      ingredientsAnalyzed: [],
      additives: [],
      allergens: [],
      labels: [],
      additionalImages: [],
      nutritionFacts: {},
    },
  })

  const { register, control, handleSubmit, setValue, watch } = form

  // Field Arrays
  const {
    fields: priceFields,
    append: appendPrice,
    remove: removePrice,
  } = useFieldArray({ control, name: 'prices' })
  const {
    fields: specFields,
    append: appendSpec,
    remove: removeSpec,
  } = useFieldArray({ control, name: 'specifications' })
  const {
    fields: warningFields,
    append: appendWarning,
    remove: removeWarning,
  } = useFieldArray({ control, name: 'warnings' })
  const {
    fields: ingredientFields,
    append: appendIngredient,
    remove: removeIngredient,
  } = useFieldArray({ control, name: 'ingredientsAnalyzed' })
  const {
    fields: additiveFields,
    append: appendAdditive,
    remove: removeAdditive,
  } = useFieldArray({ control, name: 'additives' })
  const {
    fields: imageFields,
    append: appendImage,
    remove: removeImage,
  } = useFieldArray({ control, name: 'additionalImages' })

  useEffect(() => {
    fetchRelations()
      .then(setRelations)
      .catch(() => toast.error('Veriler yüklenemedi'))
  }, [])

  const handleBarcodeScan = async (barcode: string) => {
    setValue('barcode', barcode)
    const existing = await checkBarcode(barcode)
    if (existing) {
      setExistingProduct(existing)
      toast.info('Bu barkod zaten kayıtlı!')
    } else {
      setExistingProduct(null)
      toast.success('Barkod okundu!')
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const media = await uploadMedia(file, fieldName)
      setValue(fieldName as any, media.id)
      toast.success('Görsel yüklendi')
    } catch {
      toast.error('Yükleme başarısız')
    }
  }

  const onSubmit = async (data: any) => {
    if (existingProduct) return toast.error('Bu barkod zaten kayıtlı!')
    setIsSubmitting(true)
    try {
      await createProduct(data)
      toast.success('Ürün eklendi!')
      router.push('/admin/collections/products')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Hata oluştu')
    } finally {
      setIsSubmitting(false)
    }
  }

  const watchedAllergens = watch('allergens') || []
  const watchedLabels = watch('labels') || []

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <Button type="button" variant="ghost" className="mb-2" onClick={() => router.back()}>
              <ChevronLeft className="h-4 w-4 mr-2" /> Geri
            </Button>
            <h1 className="text-3xl font-bold">Yeni Ürün Ekle</h1>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>

        {/* Barkod Scanner */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" /> Barkod Tara
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 w-full">
                <Label>Barkod Numarası *</Label>
                <Input {...register('barcode')} placeholder="Barkod girin veya taratın" />
              </div>
              <Button type="button" variant="outline" onClick={() => setScannerOpen(true)}>
                <Camera className="h-4 w-4 mr-2" /> Kamerayla Tara
              </Button>
            </div>
            {existingProduct && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-800">Bu barkod zaten kayıtlı!</p>
                  <p className="text-yellow-700">Ürün: {existingProduct.name}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form Tabs */}
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 h-auto flex-wrap">
            <TabsTrigger value="general">📋 Genel</TabsTrigger>
            <TabsTrigger value="images">📸 Görseller</TabsTrigger>
            <TabsTrigger value="brand">🏷️ Marka</TabsTrigger>
            <TabsTrigger value="ingredients">🧪 İçindekiler</TabsTrigger>
            <TabsTrigger value="nutrition">🥗 Besin</TabsTrigger>
            <TabsTrigger value="labels">🏷️ Etiketler</TabsTrigger>
            <TabsTrigger value="specs">📦 Özellikler</TabsTrigger>
            <TabsTrigger value="price">💰 Fiyat</TabsTrigger>
          </TabsList>

          {/* GENEL */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Genel Bilgiler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Ürün Adı *</Label>
                  <Input {...register('name')} placeholder="Örn: Coca-Cola Original 1L" />
                </div>
                <div>
                  <Label>Açıklama</Label>
                  <Textarea {...register('description')} placeholder="Ürün açıklaması" rows={4} />
                </div>
                <div>
                  <Label>Yayın Durumu</Label>
                  <Select onValueChange={(v: any) => setValue('status', v)} defaultValue="draft">
                    <SelectTrigger>
                      <SelectValue placeholder="Durum seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">📝 Taslak</SelectItem>
                      <SelectItem value="published">✅ Yayında</SelectItem>
                      <SelectItem value="archived">🗄️ Arşivlendi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* GÖRSELLER */}
          <TabsContent value="images">
            <Card>
              <CardHeader>
                <CardTitle>Ürün Görselleri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Ön Yüz Fotoğrafı</Label>
                  <div className="mt-2 border-2 border-dashed rounded-lg p-8 text-center">
                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleImageUpload(e, 'frontImage')}
                      className="hidden"
                      id="frontImage"
                    />
                    <Label htmlFor="frontImage" className="cursor-pointer">
                      <Upload className="h-8 w-8 mx-auto text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">Fotoğraf çek veya seç</p>
                    </Label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {['ingredientsImage', 'nutritionImage', 'recyclingImage'].map((key) => (
                    <div key={key}>
                      <Label>
                        {key === 'ingredientsImage'
                          ? 'İçindekiler'
                          : key === 'nutritionImage'
                            ? 'Besin Değerleri'
                            : 'Geri Dönüşüm'}
                      </Label>
                      <div className="mt-2 border-2 border-dashed rounded-lg p-4 text-center">
                        <Input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handleImageUpload(e, key)}
                          className="hidden"
                          id={key}
                        />
                        <Label htmlFor={key} className="cursor-pointer">
                          <Camera className="h-6 w-6 mx-auto text-gray-400" />
                          <p className="mt-1 text-xs text-gray-500">Fotoğraf ekle</p>
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator />
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label>Ek Fotoğraflar (Maks. 2)</Label>
                    {imageFields.length < 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => appendImage({ image: undefined, caption: '' })}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Ekle
                      </Button>
                    )}
                  </div>
                  {imageFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-end gap-3 mb-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const media = await uploadMedia(file, `Ek ${index + 1}`)
                              setValue(`additionalImages.${index}.image`, media.id)
                            }
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          {...register(`additionalImages.${index}.caption`)}
                          placeholder="Açıklama"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MARKA */}
          <TabsContent value="brand">
            <Card>
              <CardHeader>
                <CardTitle>Marka & Kategori</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Marka *</Label>
                  <Select onValueChange={(v) => setValue('brand', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Marka seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {relations.brands.map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Kategori *</Label>
                  <Select onValueChange={(v) => setValue('category', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategori seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {relations.categories.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Üretici Firma</Label>
                  <Input {...register('manufacturer')} placeholder="Üretici firma adı" />
                </div>
                <div>
                  <Label>Üretim Yeri (Ülke)</Label>
                  <Select onValueChange={(v) => setValue('country', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ülke seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {relations.countries.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* İÇİNDEKİLER */}
          <TabsContent value="ingredients">
            <Card>
              <CardHeader>
                <CardTitle>İçindekiler & Alerjenler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label>İçindekiler</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendIngredient({ ingredient: '' })}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Ekle
                    </Button>
                  </div>
                  {ingredientFields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-3 mb-3">
                      <div className="flex-1">
                        <Select
                          onValueChange={(v) =>
                            setValue(`ingredientsAnalyzed.${index}.ingredient`, v)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            {relations.ingredients.map((i: any) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeIngredient(index)}
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Separator />
                <div>
                  <Label>Alerjenler</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {[
                      'gluten',
                      'milk',
                      'egg',
                      'soy',
                      'peanut',
                      'nuts',
                      'fish',
                      'shellfish',
                      'sesame',
                      'mustard',
                      'celery',
                      'sulphite',
                    ].map((a) => (
                      <label
                        key={a}
                        className="flex items-center gap-2 p-2 border rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={watchedAllergens.includes(a)}
                          onChange={(e) => {
                            const curr = watch('allergens') || []
                            setValue(
                              'allergens',
                              e.target.checked ? [...curr, a] : curr.filter((v) => v !== a),
                            )
                          }}
                        />
                        <span className="text-sm">{a}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label>Katkı Maddeleri</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendAdditive({ additive: '' })}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Ekle
                    </Button>
                  </div>
                  {additiveFields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-3 mb-3">
                      <div className="flex-1">
                        <Select onValueChange={(v) => setValue(`additives.${index}.additive`, v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            {relations.additives.map((a: any) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.code} - {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAdditive(index)}
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BESİN DEĞERLERİ */}
          <TabsContent value="nutrition">
            <Card>
              <CardHeader>
                <CardTitle>Besin Değerleri (100g/100ml)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Porsiyon</Label>
                    <Input {...register('nutritionFacts.servingSize')} placeholder="30g" />
                  </div>
                  <div>
                    <Label>Porsiyon/Paket</Label>
                    <Input
                      type="number"
                      {...register('nutritionFacts.servingsPerPackage', { valueAsNumber: true })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Enerji (kcal)</Label>
                    <Input
                      type="number"
                      {...register('nutritionFacts.energyKcal', { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <Label>Enerji (kJ)</Label>
                    <Input
                      type="number"
                      {...register('nutritionFacts.energyKj', { valueAsNumber: true })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Yağ (g)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      {...register('nutritionFacts.fat', { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <Label>Doymuş Yağ (g)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      {...register('nutritionFacts.saturatedFat', { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <Label>Trans Yağ (g)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      {...register('nutritionFacts.transFat', { valueAsNumber: true })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Karbonhidrat (g)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      {...register('nutritionFacts.carbohydrates', { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <Label>Şeker (g)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      {...register('nutritionFacts.sugars', { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <Label>Ekl. Şeker (g)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      {...register('nutritionFacts.addedSugars', { valueAsNumber: true })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Lif (g)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      {...register('nutritionFacts.fiber', { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <Label>Protein (g)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      {...register('nutritionFacts.protein', { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <Label>Tuz (g)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register('nutritionFacts.salt', { valueAsNumber: true })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Sodyum (mg)</Label>
                    <Input
                      type="number"
                      {...register('nutritionFacts.sodium', { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <Label>Nutri-Score</Label>
                    <Select onValueChange={(v) => setValue('nutriscore', v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a">A</SelectItem>
                        <SelectItem value="b">B</SelectItem>
                        <SelectItem value="c">C</SelectItem>
                        <SelectItem value="d">D</SelectItem>
                        <SelectItem value="e">E</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ETİKETLER */}
          <TabsContent value="labels">
            <Card>
              <CardHeader>
                <CardTitle>Etiketler & Sertifikalar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Etiketler</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {[
                      'vegan',
                      'vegetarian',
                      'gluten-free',
                      'lactose-free',
                      'organic',
                      'halal',
                      'kosher',
                      'non-gmo',
                      'sugar-free',
                      'recyclable',
                      'fair-trade',
                    ].map((l) => (
                      <label
                        key={l}
                        className="flex items-center gap-2 p-2 border rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={watchedLabels.includes(l)}
                          onChange={(e) => {
                            const curr = watch('labels') || []
                            setValue(
                              'labels',
                              e.target.checked ? [...curr, l] : curr.filter((v) => v !== l),
                            )
                          }}
                        />
                        <span className="text-sm">{l}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Ambalaj Tipi</Label>
                    <Input {...register('packaging')} placeholder="Cam şişe" />
                  </div>
                  <div>
                    <Label>Boyut / Ağırlık</Label>
                    <Input {...register('size')} placeholder="500g" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ÖZELLİKLER */}
          <TabsContent value="specs">
            <Card>
              <CardHeader>
                <CardTitle>Ek Özellikler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label>Teknik Özellikler</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendSpec({ key: '', value: '', unit: '' })}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Ekle
                    </Button>
                  </div>
                  {specFields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-3 mb-3">
                      <Input {...register(`specifications.${index}.key`)} placeholder="Özellik" />
                      <Input {...register(`specifications.${index}.value`)} placeholder="Değer" />
                      <Input
                        {...register(`specifications.${index}.unit`)}
                        placeholder="Birim"
                        className="w-20"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSpec(index)}
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Separator />
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label>Uyarılar</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendWarning({ severity: 'medium', text: '' })}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Ekle
                    </Button>
                  </div>
                  {warningFields.map((field, index) => (
                    <div key={field.id} className="flex items-start gap-3 mb-3">
                      <Select
                        onValueChange={(v) => setValue(`warnings.${index}.severity`, v as any)}
                        defaultValue="medium"
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">🟢 Düşük</SelectItem>
                          <SelectItem value="medium">🟡 Orta</SelectItem>
                          <SelectItem value="high">🔴 Yüksek</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea
                        {...register(`warnings.${index}.text`)}
                        placeholder="Uyarı metni"
                        rows={2}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeWarning(index)}
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Model</Label>
                    <Input {...register('model')} />
                  </div>
                  <div>
                    <Label>SKU</Label>
                    <Input {...register('sku')} />
                  </div>
                  <div>
                    <Label>Garanti</Label>
                    <Input {...register('warranty')} />
                  </div>
                  <div>
                    <Label>Saklama</Label>
                    <Input {...register('storage')} />
                  </div>
                </div>
                <div>
                  <Label>Kullanım</Label>
                  <Textarea {...register('usage')} rows={3} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FİYAT */}
          <TabsContent value="price">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Fiyat Bilgileri</CardTitle>
                  {priceFields.length < 10 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        appendPrice({ amount: 0, date: new Date().toISOString().split('T')[0] })
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" /> Ekle
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {priceFields.map((field, index) => (
                  <div key={field.id} className="flex items-end gap-3 mb-3">
                    <div className="flex-1">
                      <Label>Fiyat (₺)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`prices.${index}.amount`, { valueAsNumber: true })}
                      />
                    </div>
                    <div className="flex-1">
                      <Label>Tarih</Label>
                      <Input type="date" {...register(`prices.${index}.date`)} />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePrice(index)}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
      />
    </div>
  )
}
