'use client'

import { useMemo, useState, type ReactNode } from 'react'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { bestMatch, resolveSelection, searchOptions } from '@/lib/wizard/match'
import type { ProductForm, Resolution } from '@/lib/wizard/productDraft'
import type { MasterOption } from '@/lib/wizard/types'
import { useMasterOptions } from '@/lib/wizard/useMasterOptions'
import { cn } from '@/lib/utils'

import { Chip, TextField, WizardIntro } from './controls'

type Props = {
  form: ProductForm
  onEdit: (next: ProductForm, field?: string) => void
}

function ResolverRow({
  title,
  options,
  loading,
  resolution,
  onChange,
  extra,
}: {
  title: string
  options: MasterOption[]
  loading: boolean
  resolution: Resolution
  onChange: (next: Resolution) => void
  extra?: ReactNode
}) {
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')

  const suggestion = useMemo(() => {
    if (resolution.suggestion) return resolution.suggestion
    const match = bestMatch(options, resolution.name)
    return match ? { id: match.id, name: match.name } : null
  }, [options, resolution.name, resolution.suggestion])

  const results = useMemo(() => searchOptions(options, query), [options, query])

  if (!title.trim() && !resolution.name.trim()) return null

  const stateTag =
    resolution.kind === 'existing' ? (
      <EvidenceTag variant="evidence">EŞLEŞTİ</EvidenceTag>
    ) : resolution.kind === 'create' ? (
      <EvidenceTag variant="stamp">YENİ</EvidenceTag>
    ) : resolution.kind === 'skip' ? (
      <EvidenceTag>ATLANDI</EvidenceTag>
    ) : (
      <EvidenceTag variant="tape">KARAR BEKLİYOR</EvidenceTag>
    )

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border bg-card p-3',
        resolution.kind === 'pending' ? 'border-tape-yellow' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-words font-mono text-sm">{title || resolution.name}</span>
        {extra}
        {stateTag}
        {loading ? <span className="font-mono text-[0.62rem] text-muted-foreground">liste…</span> : null}
      </div>

      {resolution.kind === 'existing' ? (
        <div className="flex flex-wrap gap-1.5">
          <Chip label={resolution.suggestion?.name ?? resolution.name} selected />
          <Chip label="Geri al" onClick={() => onChange({ ...resolution, kind: 'pending', id: null })} />
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {/* Eşleşme "Yeni" seçildikten sonra da görünür kalır: aksi hâlde aynı ad master'da
              dururken satır sessizce kopya kayıt açıyordu (üretimde "Su" ×3, "Şeker" ×3). */}
          {suggestion ? (
            <Chip
              label={`Eşleştir: ${suggestion.name}`}
              onClick={() => onChange({ ...resolution, kind: 'existing', id: suggestion.id, suggestion })}
            />
          ) : null}
          <Chip
            label={resolution.kind === 'create' ? 'Yeni (seçili)' : 'Yeni oluştur'}
            selected={resolution.kind === 'create'}
            onClick={() => onChange({ ...resolution, kind: 'create', id: null })}
          />
          <Chip
            label={resolution.kind === 'skip' ? 'Atlandı' : 'Atla'}
            selected={resolution.kind === 'skip'}
            onClick={() => onChange({ ...resolution, kind: 'skip', id: null })}
          />
          <Chip label="Ara" onClick={() => setSearching((value) => !value)} />
        </div>
      )}

      {resolution.kind === 'create' && suggestion ? (
        <p className="text-sm text-muted-foreground">
          Aynı ad master listede var. Kayıt sırasında yeni satır açılmaz; satır «{suggestion.name}»
          kaydına bağlanır.
        </p>
      ) : null}

      {searching && resolution.kind !== 'existing' ? (
        <div className="flex flex-col gap-2">
          <TextField label="Master listede ara" value={query} onChange={setQuery} />
          <div className="flex flex-wrap gap-1.5">
            {results.map((option) => (
              <Chip
                key={option.id}
                label={option.code ? `${option.code} ${option.name}` : option.name}
                onClick={() => {
                  onChange({
                    ...resolution,
                    kind: 'existing',
                    id: option.id,
                    suggestion: { id: option.id, name: option.name },
                  })
                  setSearching(false)
                  setQuery('')
                }}
              />
            ))}
            {query.trim() && results.length === 0 ? (
              <span className="text-sm text-muted-foreground">Eşleşme yok.</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function GroupHeader({
  title,
  onBulk,
}: {
  title: string
  onBulk?: (kind: 'create' | 'skip') => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
        {title}
      </span>
      {onBulk ? (
        <>
          <Chip label="Hepsini yeni oluştur" onClick={() => onBulk('create')} />
          <Chip label="Hepsini atla" onClick={() => onBulk('skip')} />
        </>
      ) : null}
    </div>
  )
}

/** Eşleme adımı: serbest metni master kayıtlara bağlar (ADR 0008). */
export function MasterResolver({ form, onEdit }: Props) {
  const brands = useMasterOptions('brands')
  const categories = useMasterOptions('categories')
  const ingredients = useMasterOptions('ingredients')
  const additives = useMasterOptions('additives')
  const allergens = useMasterOptions('allergens')
  const nutrients = useMasterOptions('nutrients')

  /** Toplu karar: "yeni oluştur" önce eşleştirir (bkz. `resolveSelection`). */
  const bulk = <T extends { resolution: Resolution }>(
    rows: T[],
    kind: 'create' | 'skip',
    options: MasterOption[],
  ): T[] => rows.map((row) => ({ ...row, resolution: resolveSelection(row.resolution, kind, options) }))

  return (
    <div className="flex flex-col gap-4">
      <CaseCard className="flex flex-col gap-2 p-4">
        <EvidenceTag variant="evidence">EŞLEME</EvidenceTag>
        <WizardIntro eyebrow="ADIM 3" title="Serbest metni master kayda bağla">
          Kural motoru yalnız master kayıtlar üzerinden eşleşir. “Yeni oluştur” dediğin satırlar kayıt
          sırasında açılır; atlanan satır ürüne bağlanmaz ve hükümlerde görünmez.
        </WizardIntro>
      </CaseCard>

      <GroupHeader title="MARKA" />
      <ResolverRow
        title="Marka"
        options={brands.data}
        loading={brands.loading}
        resolution={form.brand}
        onChange={(next) => onEdit({ ...form, brand: next }, 'brand')}
      />

      <GroupHeader title="KATEGORİ" />
      <ResolverRow
        title="Kategori"
        options={categories.data}
        loading={categories.loading}
        resolution={form.category}
        onChange={(next) => onEdit({ ...form, category: next }, 'category')}
      />

      <GroupHeader
        title={`İÇİNDEKİLER (${form.ingredients.length})`}
        onBulk={(kind) =>
          onEdit({ ...form, ingredients: bulk(form.ingredients, kind, ingredients.data) }, 'ingredients')
        }
      />
      {form.ingredients.length === 0 ? (
        <p className="text-sm text-muted-foreground">Fotoğrafta içindekiler bulunamadı.</p>
      ) : null}
      {form.ingredients.map((row, index) => (
        <ResolverRow
          key={`ingredient-${index}`}
          title={row.name}
          options={ingredients.data}
          loading={ingredients.loading}
          resolution={row.resolution}
          onChange={(next) =>
            onEdit(
              {
                ...form,
                ingredients: form.ingredients.map((item, i) =>
                  i === index ? { ...item, resolution: next } : item,
                ),
              },
              'ingredients',
            )
          }
          extra={
            <TextField
              className="w-24"
              label="Yüzde"
              value={row.percent}
              inputMode="decimal"
              placeholder="—"
              onChange={(percent) =>
                onEdit(
                  {
                    ...form,
                    ingredients: form.ingredients.map((item, i) =>
                      i === index ? { ...item, percent } : item,
                    ),
                  },
                  'ingredients',
                )
              }
            />
          }
        />
      ))}

      <GroupHeader
        title={`KATKI MADDELERİ (${form.additives.length})`}
        onBulk={(kind) =>
          onEdit({ ...form, additives: bulk(form.additives, kind, additives.data) }, 'additives')
        }
      />
      {form.additives.length === 0 ? (
        <p className="text-sm text-muted-foreground">Katkı maddesi okunamadı.</p>
      ) : null}
      {form.additives.map((row, index) => (
        <ResolverRow
          key={`additive-${index}`}
          title={[row.code, row.name].filter(Boolean).join(' ')}
          options={additives.data}
          loading={additives.loading}
          resolution={row.resolution}
          onChange={(next) =>
            onEdit(
              {
                ...form,
                additives: form.additives.map((item, i) =>
                  i === index ? { ...item, resolution: next } : item,
                ),
              },
              'additives',
            )
          }
          extra={row.code ? undefined : <EvidenceTag variant="tape">E-KODU YOK</EvidenceTag>}
        />
      ))}

      <GroupHeader
        title={`ALERJENLER (${form.allergens.length})`}
        onBulk={(kind) =>
          onEdit(
            {
              ...form,
              allergens: form.allergens.map((row) => resolveSelection(row, kind, allergens.data)),
            },
            'allergens',
          )
        }
      />
      <p className="text-sm text-muted-foreground">
        Ürüne tek alerjen bağlanabiliyor: ilk eşleşen kaydedilir.
      </p>
      {form.allergens.map((row, index) => (
        <ResolverRow
          key={`allergen-${index}`}
          title={row.name}
          options={allergens.data}
          loading={allergens.loading}
          resolution={row}
          onChange={(next) =>
            onEdit(
              { ...form, allergens: form.allergens.map((item, i) => (i === index ? next : item)) },
              'allergens',
            )
          }
        />
      ))}

      <GroupHeader
        title={`BESİN DEĞERLERİ (${form.nutrition.items.length})`}
        onBulk={(kind) =>
          onEdit(
            {
              ...form,
              nutrition: { ...form.nutrition, items: bulk(form.nutrition.items, kind, nutrients.data) },
            },
            'nutrition',
          )
        }
      />
      <div className="flex flex-wrap gap-1.5">
        {[
          { value: '100g', label: '100 g' },
          { value: '100ml', label: '100 ml' },
          { value: 'serving', label: 'Porsiyon' },
        ].map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={form.nutrition.per === option.value}
            onClick={() =>
              onEdit(
                { ...form, nutrition: { ...form.nutrition, per: option.value as ProductForm['nutrition']['per'] } },
                'nutrition',
              )
            }
          />
        ))}
      </div>
      {form.nutrition.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Besin tablosu okunamadı.</p>
      ) : null}
      {form.nutrition.items.map((row, index) => (
        <ResolverRow
          key={`nutrient-${index}`}
          title={row.name}
          options={nutrients.data}
          loading={nutrients.loading}
          resolution={row.resolution}
          onChange={(next) =>
            onEdit(
              {
                ...form,
                nutrition: {
                  ...form.nutrition,
                  items: form.nutrition.items.map((item, i) =>
                    i === index ? { ...item, resolution: next } : item,
                  ),
                },
              },
              'nutrition',
            )
          }
          extra={
            <TextField
              className="w-32"
              label={`Miktar (${row.unit})`}
              value={row.amount}
              inputMode="decimal"
              onChange={(amount) =>
                onEdit(
                  {
                    ...form,
                    nutrition: {
                      ...form.nutrition,
                      items: form.nutrition.items.map((item, i) =>
                        i === index ? { ...item, amount } : item,
                      ),
                    },
                  },
                  'nutrition',
                )
              }
            />
          }
        />
      ))}
    </div>
  )
}
