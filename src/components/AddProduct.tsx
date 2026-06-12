'use client'
import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, Controller } from 'react-hook-form'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field'
import {
  FormHeader,
  FormFooter,
  StepFields,
  PreviousButton,
  NextButton,
  SubmitButton,
  MultiStepFormContent,
} from '@/components/multi-step-viewer'
import { MultiStepFormProvider } from '@/hooks/use-multi-step-viewer'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { ChevronsUpDown } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FileUpload } from '@/components/file-upload'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { formSchema } from '@/types/schemas'

//------------------------------
type Schema = z.infer<typeof formSchema>

export function GeneratedForm({ barcode }: { barcode: string }) {
  const form = useForm<Schema>({
    resolver: zodResolver(formSchema as any),
  })
  const {
    formState: { isSubmitting, isSubmitSuccessful },
  } = form

  const handleSubmit = form.handleSubmit(async (data: Schema) => {
    try {
      // TODO: implement form submission
      console.log(data)
      form.reset()
    } catch (error) {
      // TODO: handle error
    }
  })
  const stepsFields = [
    {
      fields: ['barcode', 'name', 'brand', 'category', 'manufacturer', 'country'],
      component: (
        <>
          <h2 className="mt-4 mb-1 font-bold text-2xl tracking-tight col-span-full">
            Ürün Bilgileri
          </h2>
          <p className="tracking-wide text-muted-foreground mb-5 text-wrap text-sm col-span-full">
            Ürüne ait bilgiler
          </p>

          <Controller
            name="barcode"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 col-span-full">
                <FieldLabel htmlFor="barcode">Barkod *</FieldLabel>
                <Input
                  {...field}
                  value={barcode}
                  id="barcode"
                  type="text"
                  onChange={(e) => {
                    field.onChange(e.target.value)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder="Ürüne ait baarcode"
                />

                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 col-span-full">
                <FieldLabel htmlFor="name">Ürün Adı *</FieldLabel>
                <Input
                  {...field}
                  id="name"
                  type="text"
                  onChange={(e) => {
                    field.onChange(e.target.value)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder="Enter your text"
                />

                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="brand"
            control={form.control}
            render={({ field, fieldState }: any) => {
              const options = [
                { value: 'arabic', label: 'Arabic' },
                { value: 'english', label: 'English' },
                { value: 'turkish', label: 'Turkish' },
                { value: 'russian', label: 'Russian' },
                { value: 'korean', label: 'Korean' },
                { value: 'chinese', label: 'Chinese' },
                { value: 'german', label: 'German' },
                { value: 'spanish', label: 'Spanish' },
              ]
              return (
                <Field data-invalid={fieldState.invalid} className="gap-2 col-span-full">
                  <FieldLabel htmlFor="brand">Marka *</FieldLabel>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          'justify-between active:scale-100',
                          !field.value && 'text-muted-foreground',
                        )}
                      >
                        {field.value
                          ? field.options.find((option: any) => option.value === field.value)?.label
                          : 'Marka seçiniz'}
                        <ChevronsUpDown className="opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0 min-w-(--radix-popper-anchor-width) w-full"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="tap to search..." className="h-10" />
                        <CommandList>
                          <CommandEmpty>No items found.</CommandEmpty>
                          <CommandGroup>
                            {options.map(({ label, value }) => (
                              <CommandItem
                                value={value}
                                key={value}
                                onSelect={() => {
                                  form.setValue('brand', value)
                                }}
                              >
                                {label}
                                <Check
                                  className={cn(
                                    'ml-auto',
                                    value === field.value ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )
            }}
          />

          <Controller
            name="category"
            control={form.control}
            render={({ field, fieldState }: any) => {
              const options = [
                { value: 'arabic', label: 'Arabic' },
                { value: 'english', label: 'English' },
                { value: 'turkish', label: 'Turkish' },
                { value: 'russian', label: 'Russian' },
                { value: 'korean', label: 'Korean' },
                { value: 'chinese', label: 'Chinese' },
                { value: 'german', label: 'German' },
                { value: 'spanish', label: 'Spanish' },
              ]
              return (
                <Field data-invalid={fieldState.invalid} className="gap-2 col-span-full">
                  <FieldLabel htmlFor="category">Kategori *</FieldLabel>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          'justify-between active:scale-100',
                          !field.value && 'text-muted-foreground',
                        )}
                      >
                        {field.value
                          ? field.options.find((option: any) => option.value === field.value)?.label
                          : 'Kategori seçiniz'}
                        <ChevronsUpDown className="opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0 min-w-(--radix-popper-anchor-width) w-full"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="tap to search..." className="h-10" />
                        <CommandList>
                          <CommandEmpty>No items found.</CommandEmpty>
                          <CommandGroup>
                            {options.map(({ label, value }) => (
                              <CommandItem
                                value={value}
                                key={value}
                                onSelect={() => {
                                  form.setValue('category', value)
                                }}
                              >
                                {label}
                                <Check
                                  className={cn(
                                    'ml-auto',
                                    value === field.value ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )
            }}
          />

          <Controller
            name="manufacturer"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 col-span-full">
                <FieldLabel htmlFor="manufacturer">Üretici Firma (Opsiyonel) </FieldLabel>
                <Input
                  {...field}
                  id="manufacturer"
                  type="text"
                  onChange={(e) => {
                    field.onChange(e.target.value)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder=""
                />
                <FieldDescription>
                  Ürünü fiziksel olarak üreten firma. Markadan farklıysa buraya yazın (Örn: "Marka:
                  Coca-Cola, Üretici: The Coca-Cola Company İstanbul Şubesi
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="country"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 col-span-full">
                <FieldLabel htmlFor="country">Üretim Yeri Ülke </FieldLabel>
                <Input
                  {...field}
                  id="country"
                  type="text"
                  onChange={(e) => {
                    field.onChange(e.target.value)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder="Enter your text"
                />
                <FieldDescription>
                  Ürünün fiziksel olarak üretildiği ülke. Barkod girildiğinde GS1 prefix\'inden (ilk
                  3 hane) OTOMATİK doldurulur; isterseniz elle değiştirebilirsiniz. Kural motorunda
                  ülke bazlı boykot analizi için kullanılır. Ülke listede yoksa önce "Ülkeler"
                  bölümünden ekleyin.
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </>
      ),
    },
    {
      fields: [
        'frontImage',
        'ingredientsImage',
        'nutritionImage',
        'recyclingImage',
        'additionalImages',
      ],
      component: (
        <>
          <h1 className="mt-6 mb-1 font-extrabold text-3xl tracking-tight col-span-full">
            Ürün Fotoğrafları
          </h1>

          <Controller
            name="frontImage"
            control={form.control}
            render={({ field, fieldState }: any) => (
              <div>
                <Field data-invalid={fieldState.invalid} className="gap-1 col-span-full">
                  <FieldLabel htmlFor="frontImage">Ön Yüz Fotoğrafı (Zorunlu) *</FieldLabel>
                  <FieldDescription>
                    Ürünün ana/ön yüz fotoğrafı. Listelerde ve ürün sayfasında hero olarak
                    gösterilir. Marka logosu, ürün adı ve gramaj görünen kısım. Kare veya dikey
                    format önerilir, en az 600x600 piksel.
                  </FieldDescription>
                  <FileUpload
                    {...field}
                    setValue={form.setValue}
                    name="frontImage"
                    placeholder="PNG, JPEG or Gif, (max. 5MB)"
                    accept={`image/png, image/jpeg, image/gif`}
                    maxFiles={1}
                    maxSize={5242880}
                  />
                </Field>
                {Array.isArray(fieldState.error) ? (
                  fieldState.error?.map((error: any, i: any) => (
                    <p
                      key={i}
                      role="alert"
                      data-slot="field-error"
                      className="text-destructive text-sm"
                    >
                      {error.message}
                    </p>
                  ))
                ) : (
                  <FieldError errors={[fieldState.error]} />
                )}
              </div>
            )}
          />

          <Controller
            name="ingredientsImage"
            control={form.control}
            render={({ field, fieldState }: any) => (
              <div>
                <Field data-invalid={fieldState.invalid} className="gap-1 col-span-full">
                  <FieldLabel htmlFor="ingredientsImage">İçindekiler Fotoğrafı </FieldLabel>
                  <FieldDescription>
                    Paket üzerindeki içindekiler tablosunun fotoğrafı. Sitede "İçindekiler"
                    etiketiyle gösterilir.
                  </FieldDescription>
                  <FileUpload
                    {...field}
                    setValue={form.setValue}
                    name="ingredientsImage"
                    placeholder="PNG, JPEG or Gif, (max. 5MB)"
                    accept={`image/png, image/jpeg, image/gif`}
                    maxFiles={1}
                    maxSize={5242880}
                  />
                </Field>
                {Array.isArray(fieldState.error) ? (
                  fieldState.error?.map((error: any, i: any) => (
                    <p
                      key={i}
                      role="alert"
                      data-slot="field-error"
                      className="text-destructive text-sm"
                    >
                      {error.message}
                    </p>
                  ))
                ) : (
                  <FieldError errors={[fieldState.error]} />
                )}
              </div>
            )}
          />

          <Controller
            name="nutritionImage"
            control={form.control}
            render={({ field, fieldState }: any) => (
              <div>
                <Field data-invalid={fieldState.invalid} className="gap-1 col-span-full">
                  <FieldLabel htmlFor="nutritionImage">Besin Değerleri Fotoğrafı </FieldLabel>
                  <FieldDescription>
                    Paket üzerindeki besin değerleri tablosunun fotoğrafı. Sitede "Besin Değerleri"
                    etiketiyle gösterilir.
                  </FieldDescription>
                  <FileUpload
                    {...field}
                    setValue={form.setValue}
                    name="nutritionImage"
                    placeholder="PNG, JPEG or Gif, (max. 5MB)"
                    accept={`image/png, image/jpeg, image/gif`}
                    maxFiles={1}
                    maxSize={5242880}
                  />
                </Field>
                {Array.isArray(fieldState.error) ? (
                  fieldState.error?.map((error: any, i: any) => (
                    <p
                      key={i}
                      role="alert"
                      data-slot="field-error"
                      className="text-destructive text-sm"
                    >
                      {error.message}
                    </p>
                  ))
                ) : (
                  <FieldError errors={[fieldState.error]} />
                )}
              </div>
            )}
          />

          <Controller
            name="recyclingImage"
            control={form.control}
            render={({ field, fieldState }: any) => (
              <div>
                <Field data-invalid={fieldState.invalid} className="gap-1 col-span-full">
                  <FieldLabel htmlFor="recyclingImage">Geri Dönüşüm Bilgisi Fotoğrafı </FieldLabel>
                  <FieldDescription>
                    Ambalaj üzerindeki geri dönüşüm sembolleri veya bertaraf talimatları. Sitede
                    "Geri Dönüşüm" etiketiyle gösterilir.
                  </FieldDescription>
                  <FileUpload
                    {...field}
                    setValue={form.setValue}
                    name="recyclingImage"
                    placeholder="PNG, JPEG or Gif, (max. 5MB)"
                    accept={`image/png, image/jpeg, image/gif`}
                    maxFiles={1}
                    maxSize={5242880}
                  />
                </Field>
                {Array.isArray(fieldState.error) ? (
                  fieldState.error?.map((error: any, i: any) => (
                    <p
                      key={i}
                      role="alert"
                      data-slot="field-error"
                      className="text-destructive text-sm"
                    >
                      {error.message}
                    </p>
                  ))
                ) : (
                  <FieldError errors={[fieldState.error]} />
                )}
              </div>
            )}
          />

          <Controller
            name="additionalImages"
            control={form.control}
            render={({ field, fieldState }: any) => (
              <div>
                <Field data-invalid={fieldState.invalid} className="gap-1 col-span-full">
                  <FieldLabel htmlFor="additionalImages">Ek Fotoğraflar </FieldLabel>
                  <FieldDescription>
                    İsteğe bağlı ek fotoğraflar: arka yüz, kullanım örneği, sertifika, garanti
                    belgesi vb. Maksimum 2 ek fotoğraf. Ön Yüz + 3 kategorize + 2 ek = toplam en
                    fazla 6 fotoğraf.
                  </FieldDescription>
                  <FileUpload
                    {...field}
                    setValue={form.setValue}
                    name="additionalImages"
                    placeholder="PNG, JPEG or Gif, (max. 5MB)"
                    accept={`image/png, image/jpeg, image/gif`}
                    maxFiles={1}
                    maxSize={5242880}
                  />
                </Field>
                {Array.isArray(fieldState.error) ? (
                  fieldState.error?.map((error: any, i: any) => (
                    <p
                      key={i}
                      role="alert"
                      data-slot="field-error"
                      className="text-destructive text-sm"
                    >
                      {error.message}
                    </p>
                  ))
                ) : (
                  <FieldError errors={[fieldState.error]} />
                )}
              </div>
            )}
          />
        </>
      ),
    },
    {
      fields: ['ingredients', 'allergens', 'additives'],
      component: (
        <>
          <h2 className="mt-4 mb-1 font-bold text-2xl tracking-tight col-span-full">
            🧪 İçindekiler
          </h2>
          <p className="tracking-wide text-muted-foreground mb-5 text-wrap text-sm col-span-full">
            Ürüne ait içerikler
          </p>

          <Controller
            name="ingredients"
            control={form.control}
            render={({ field, fieldState }: any) => {
              const options = [
                { value: 'arabic', label: 'Arabic' },
                { value: 'english', label: 'English' },
                { value: 'turkish', label: 'Turkish' },
                { value: 'russian', label: 'Russian' },
                { value: 'korean', label: 'Korean' },
                { value: 'chinese', label: 'Chinese' },
                { value: 'german', label: 'German' },
                { value: 'spanish', label: 'Spanish' },
              ]
              return (
                <Field data-invalid={fieldState.invalid} className="gap-2 col-span-full">
                  <FieldLabel htmlFor="ingredients">İçindekiler *</FieldLabel>
                  <FieldDescription>
                    İçindekilerin her bir öğesinin ayrı ayrı listesi. Her öğeyi master listeden
                    seçin (Örn: "Palm Yağı", "Su", "Şeker"). Kural motoru bu seçimlere göre çalışır.
                  </FieldDescription>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          'justify-between active:scale-100',
                          !field.value && 'text-muted-foreground',
                        )}
                      >
                        {field.value
                          ? field.options.find((option: any) => option.value === field.value)?.label
                          : ''}
                        <ChevronsUpDown className="opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0 min-w-(--radix-popper-anchor-width) w-full"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="tap to search..." className="h-10" />
                        <CommandList>
                          <CommandEmpty>No items found.</CommandEmpty>
                          <CommandGroup>
                            {options.map(({ label, value }) => (
                              <CommandItem
                                value={value}
                                key={value}
                                onSelect={() => {
                                  form.setValue('ingredients', value)
                                }}
                              >
                                {label}
                                <Check
                                  className={cn(
                                    'ml-auto',
                                    value === field.value ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )
            }}
          />

          <Controller
            name="allergens"
            control={form.control}
            render={({ field, fieldState }: any) => {
              const options = [{ value: 'gluten', label: 'Gluten / Buğday' }]
              return (
                <Field data-invalid={fieldState.invalid} className="gap-2 col-span-full">
                  <FieldLabel htmlFor="allergens">Alerjenler </FieldLabel>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          'justify-between active:scale-100',
                          !field.value && 'text-muted-foreground',
                        )}
                      >
                        {field.value
                          ? field.options.find((option: any) => option.value === field.value)?.label
                          : 'tap to search language'}
                        <ChevronsUpDown className="opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0 min-w-(--radix-popper-anchor-width) w-full"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="tap to search..." className="h-10" />
                        <CommandList>
                          <CommandEmpty>No items found.</CommandEmpty>
                          <CommandGroup>
                            {options.map(({ label, value }) => (
                              <CommandItem
                                value={value}
                                key={value}
                                onSelect={() => {
                                  form.setValue('allergens', value)
                                }}
                              >
                                {label}
                                <Check
                                  className={cn(
                                    'ml-auto',
                                    value === field.value ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )
            }}
          />

          <Controller
            name="additives"
            control={form.control}
            render={({ field, fieldState }: any) => {
              const options = [
                { value: 'arabic', label: 'Arabic' },
                { value: 'english', label: 'English' },
                { value: 'turkish', label: 'Turkish' },
                { value: 'russian', label: 'Russian' },
                { value: 'korean', label: 'Korean' },
                { value: 'chinese', label: 'Chinese' },
                { value: 'german', label: 'German' },
                { value: 'spanish', label: 'Spanish' },
              ]
              return (
                <Field data-invalid={fieldState.invalid} className="gap-2 col-span-full">
                  <FieldLabel htmlFor="additives">Katkı Maddesi </FieldLabel>
                  <FieldDescription>
                    Katkı master listesinden seçim yapın (Örn: E330 Sitrik Asit, E621 MSG).
                  </FieldDescription>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          'justify-between active:scale-100',
                          !field.value && 'text-muted-foreground',
                        )}
                      >
                        {field.value
                          ? field?.options.find((option: any) => option.value === field.value)
                              ?.label
                          : ''}
                        <ChevronsUpDown className="opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0 min-w-(--radix-popper-anchor-width) w-full"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="tap to search..." className="h-10" />
                        <CommandList>
                          <CommandEmpty>No items found.</CommandEmpty>
                          <CommandGroup>
                            {options.map(({ label, value }) => (
                              <CommandItem
                                value={value}
                                key={value}
                                onSelect={() => {
                                  form.setValue('additives', value)
                                }}
                              >
                                {label}
                                <Check
                                  className={cn(
                                    'ml-auto',
                                    value === field.value ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )
            }}
          />
        </>
      ),
    },
    {
      fields: [
        'servingSize',
        'servingsPerPackage',
        'energyKcal',
        'energyKj',
        'fat',
        'saturatedFat',
        'transFat',
        'carbohydrates',
        'sugars',
        'addedSugars',
        'fiber',
        'protein',
        'salt',
        'sodium',
        'nutriscore',
      ],
      component: (
        <>
          <h2 className="mt-4 mb-1 font-bold text-2xl tracking-tight col-span-full">
            🥗 Besin Değerleri
          </h2>
          <h3 className="mt-3 mb-1 font-semibold text-xl tracking-tight col-span-full">
            Besin Değerleri Tablosu (100g/100ml başına)
          </h3>

          <Controller
            name="servingSize"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 md:col-span-3">
                <FieldLabel htmlFor="servingSize">Porsiyon Boyutu </FieldLabel>
                <Input
                  {...field}
                  id="servingSize"
                  type="number"
                  onChange={(e) => {
                    field.onChange(e.target.valueAsNumber)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder=""
                />
                <FieldDescription>
                  Bir porsiyonun ağırlığı/hacmi (Örn: "30g", "1 bardak 250ml").
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="servingsPerPackage"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 md:col-span-3">
                <FieldLabel htmlFor="servingsPerPackage">Paket Başına Porsiyon </FieldLabel>
                <Input
                  {...field}
                  id="servingsPerPackage"
                  type="number"
                  onChange={(e) => {
                    field.onChange(e.target.valueAsNumber)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder=""
                />
                <FieldDescription>Toplam paketteki porsiyon sayısı.</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="energyKcal"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 md:col-span-3">
                <FieldLabel htmlFor="energyKcal">Enerji (kcal) </FieldLabel>
                <Input
                  {...field}
                  id="energyKcal"
                  type="number"
                  onChange={(e) => {
                    field.onChange(e.target.valueAsNumber)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder=""
                />

                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="energyKj"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 md:col-span-3">
                <FieldLabel htmlFor="energyKj">Enerji (kJ) </FieldLabel>
                <Input
                  {...field}
                  id="energyKj"
                  type="number"
                  onChange={(e) => {
                    field.onChange(e.target.valueAsNumber)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder="Enter your text"
                />

                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="fat"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 md:col-span-2">
                <FieldLabel htmlFor="fat">Toplam Yağ (g) </FieldLabel>
                <Input
                  {...field}
                  id="fat"
                  type="number"
                  onChange={(e) => {
                    field.onChange(e.target.valueAsNumber)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder=""
                />
                <FieldDescription>Tüm yağ miktarı, 100g başına.</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="saturatedFat"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 md:col-span-2">
                <FieldLabel htmlFor="saturatedFat">Doymuş Yağ (g) </FieldLabel>
                <Input
                  {...field}
                  id="saturatedFat"
                  type="number"
                  onChange={(e) => {
                    field.onChange(e.target.valueAsNumber)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder=""
                />
                <FieldDescription>Doymuş yağ asitleri.</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="transFat"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 md:col-span-2">
                <FieldLabel htmlFor="transFat">Trans Yağ (g) </FieldLabel>
                <Input
                  {...field}
                  id="transFat"
                  type="number"
                  onChange={(e) => {
                    field.onChange(e.target.valueAsNumber)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder=""
                />
                <FieldDescription>Trans yağ asitleri (genelde sağlıksız).</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="carbohydrates"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 md:col-span-2">
                <FieldLabel htmlFor="carbohydrates">Karbonhidrat (g) </FieldLabel>
                <Input
                  {...field}
                  id="carbohydrates"
                  type="number"
                  onChange={(e) => {
                    field.onChange(e.target.valueAsNumber)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder=""
                />

                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="sugars"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 md:col-span-2">
                <FieldLabel htmlFor="sugars">Şeker (g) </FieldLabel>
                <Input
                  {...field}
                  id="sugars"
                  type="number"
                  onChange={(e) => {
                    field.onChange(e.target.valueAsNumber)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder=""
                />
                <FieldDescription>Doğal + eklenmiş tüm şekerler.</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="addedSugars"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 md:col-span-2">
                <FieldLabel htmlFor="addedSugars">Eklenmiş Şeker (g) </FieldLabel>
                <Input
                  {...field}
                  id="addedSugars"
                  type="number"
                  onChange={(e) => {
                    field.onChange(e.target.valueAsNumber)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder=""
                />
                <FieldDescription>Üretim sırasında eklenen şeker (en zararlı).</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="fiber"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 md:col-span-2">
                <FieldLabel htmlFor="fiber">Lif / Posa (g) </FieldLabel>
                <Input
                  {...field}
                  id="fiber"
                  type="number"
                  onChange={(e) => {
                    field.onChange(e.target.valueAsNumber)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder="Enter your text"
                />

                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="protein"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 md:col-span-2">
                <FieldLabel htmlFor="protein">Protein (g) </FieldLabel>
                <Input
                  {...field}
                  id="protein"
                  type="number"
                  onChange={(e) => {
                    field.onChange(e.target.valueAsNumber)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder="Enter your text"
                />

                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="salt"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 md:col-span-2">
                <FieldLabel htmlFor="salt">Tuz (g) </FieldLabel>
                <Input
                  {...field}
                  id="salt"
                  type="number"
                  onChange={(e) => {
                    field.onChange(e.target.valueAsNumber)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder="Enter your text"
                />

                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="sodium"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1 col-span-full">
                <FieldLabel htmlFor="sodium">Sodyum (mg) </FieldLabel>
                <Input
                  {...field}
                  id="sodium"
                  type="number"
                  onChange={(e) => {
                    field.onChange(e.target.valueAsNumber)
                  }}
                  aria-invalid={fieldState.invalid}
                  placeholder=""
                />
                <FieldDescription>
                  Sodyum miktarı, miligram olarak. Tuz ≈ Sodyum × 2.5.
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="nutriscore"
            control={form.control}
            render={({ field, fieldState }) => {
              const options = [
                { value: 'a', label: 'A (En sağlıklı)' },
                { value: 'b', label: 'B' },
                { value: 'c', label: 'C' },
                { value: 'd', label: 'D' },
                { value: 'e', label: 'E (En sağlıksız)' },
              ]
              return (
                <Field data-invalid={fieldState.invalid} className="gap-1 col-span-full">
                  <FieldLabel htmlFor="nutriscore">Nutri-Score </FieldLabel>

                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )
            }}
          />
        </>
      ),
    },
  ]

  if (isSubmitSuccessful) {
    return (
      <div className="p-2 sm:p-5 md:p-8 w-full rounded-md gap-2 border">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, stiffness: 300, damping: 25 }}
          className="h-full py-6 px-3"
        >
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{
              delay: 0.3,
              type: 'spring',
              stiffness: 500,
              damping: 15,
            }}
            className="mb-4 flex justify-center border rounded-full w-fit mx-auto p-2"
          >
            <Check className="size-8" />
          </motion.div>
          <h2 className="text-center text-2xl text-pretty font-bold mb-2">Thank you</h2>
          <p className="text-center text-lg text-pretty text-muted-foreground">
            Form submitted successfully, we will get back to you soon
          </p>
        </motion.div>
      </div>
    )
  }
  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col p-2 md:p-5 w-full mx-auto rounded-md max-w-3xl gap-2 border"
      >
        <MultiStepFormProvider
          stepsFields={stepsFields}
          onStepValidation={async (step: any) => {
            const isValid = await form.trigger(step.fields)
            return isValid
          }}
        >
          <MultiStepFormContent>
            <FormHeader />
            <StepFields />
            <FormFooter>
              <PreviousButton>
                <ChevronLeft />
                Previous
              </PreviousButton>
              <NextButton>
                Next <ChevronRight />
              </NextButton>
              <SubmitButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </SubmitButton>
            </FormFooter>
          </MultiStepFormContent>
        </MultiStepFormProvider>
      </form>
    </div>
  )
}
