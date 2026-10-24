'use client'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { LABEL_OPTIONS } from '@/lib/wizard/labels'
import type { ProductForm } from '@/lib/wizard/productDraft'
import { cn } from '@/lib/utils'

import { Chip, TextField, WizardIntro } from './controls'

type Props = {
  form: ProductForm
  touched: string[]
  onEdit: (next: ProductForm, field: string) => void
  /** `edit`: Düzenle ekranı — YZ işaretleri ve analiz dili gizlenir (ADR 0009). */
  mode?: 'review' | 'edit'
}

const NUTRISCORE_OPTIONS = [
  { value: '', label: 'Yok' },
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
  { value: 'd', label: 'D' },
  { value: 'e', label: 'E' },
] as const

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Düşük' },
  { value: 'medium', label: 'Orta' },
  { value: 'high', label: 'Yüksek' },
] as const

/**
 * Onay adımı: YZ'dan gelen alanlar düzenlenebilir; etiket "(YZ)" işaretini kaybeder kaybetmez
 * yeniden analiz o alanı ezmez (draft.touched).
 */
export function AnalysisSummary({ form, touched, onEdit, mode = 'review' }: Props) {
  const editing = mode === 'edit'
  const mark = (field: string, label: string) =>
    editing || touched.includes(field) ? label : `${label} · YZ`

  const setText = (field: keyof ProductForm, value: string) => {
    onEdit({ ...form, [field]: value }, field)
  }

  return (
    <div className="flex flex-col gap-5">
      <CaseCard className="flex flex-col gap-2 p-4">
        {editing ? (
          <>
            <EvidenceTag variant="stamp">DÜZENLE</EvidenceTag>
            <WizardIntro eyebrow="KAYITLI ÜRÜN" title="Ürünün kayıtlı bilgileri">
              Değişiklikler kaydedildiğinde ürünün üzerine yazılır. Boş bıraktığın alanlar sunucuda da
              temizlenir.
            </WizardIntro>
          </>
        ) : (
          <>
            <EvidenceTag variant="evidence">ONAY</EvidenceTag>
            <WizardIntro eyebrow="ADIM 2" title="Yapay zekânın okuduğu veriler">
              Etiket “(YZ)” taşıyan alanlar fotoğraftan geldi. Yazmaya başladığın anda işaret kalkar ve
              o alan bir daha otomatik değişmez.
            </WizardIntro>
          </>
        )}
      </CaseCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={mark('name', 'Ürün adı')} value={form.name} onChange={(value) => setText('name', value)} />
        <TextField
          label={mark('brand', editing ? 'Marka (aşağıda eşlenir)' : 'Marka (eşleme sonraki adımda)')}
          value={form.brand.name}
          onChange={(value) =>
            onEdit(
              { ...form, brand: { ...form.brand, name: value, kind: 'pending', id: null, suggestion: null } },
              'brand',
            )
          }
        />
        <TextField
          label={mark('category', editing ? 'Kategori (aşağıda eşlenir)' : 'Kategori (eşleme sonraki adımda)')}
          value={form.category.name}
          onChange={(value) =>
            onEdit(
              {
                ...form,
                category: { ...form.category, name: value, kind: 'pending', id: null, suggestion: null },
              },
              'category',
            )
          }
        />
        <TextField
          label={mark('manufacturer', 'Üretici firma')}
          value={form.manufacturer}
          onChange={(value) => setText('manufacturer', value)}
        />
        <TextField label={mark('size', 'Boyut / ağırlık')} value={form.size} onChange={(value) => setText('size', value)} />
        <TextField
          label={mark('packaging', 'Ambalaj')}
          value={form.packaging}
          onChange={(value) => setText('packaging', value)}
        />
      </div>

      <TextField
        label={mark('description', 'Açıklama')}
        value={form.description}
        multiline
        onChange={(value) => setText('description', value)}
      />
      <TextField
        label={mark('usage', 'Kullanım')}
        value={form.usage}
        multiline
        onChange={(value) => setText('usage', value)}
      />
      <TextField label={mark('storage', 'Saklama')} value={form.storage} onChange={(value) => setText('storage', value)} />

      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
          {mark('nutriscore', 'NUTRİ-SCORE')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {NUTRISCORE_OPTIONS.map((option) => (
            <Chip
              key={option.value || 'none'}
              label={option.label}
              selected={form.nutriscore === option.value}
              onClick={() => onEdit({ ...form, nutriscore: option.value }, 'nutriscore')}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
          {mark('labels', 'ETİKETLER')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {LABEL_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={form.labels.includes(option.value)}
              onClick={() =>
                onEdit(
                  {
                    ...form,
                    labels: form.labels.includes(option.value)
                      ? form.labels.filter((value) => value !== option.value)
                      : [...form.labels, option.value],
                  },
                  'labels',
                )
              }
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
          {mark('warnings', 'UYARILAR')}
        </span>
        {form.warnings.map((warning, index) => (
          <div key={`warning-${index}`} className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
            <div className="flex flex-wrap gap-1.5">
              {SEVERITY_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={warning.severity === option.value}
                  onClick={() =>
                    onEdit(
                      {
                        ...form,
                        warnings: form.warnings.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, severity: option.value } : row,
                        ),
                      },
                      'warnings',
                    )
                  }
                />
              ))}
              <Chip
                label="Uyarıyı sil"
                className={cn('ml-auto')}
                onClick={() =>
                  onEdit(
                    { ...form, warnings: form.warnings.filter((_, rowIndex) => rowIndex !== index) },
                    'warnings',
                  )
                }
              />
            </div>
            <TextField
              label="Uyarı metni"
              value={warning.text}
              multiline
              onChange={(text) =>
                onEdit(
                  {
                    ...form,
                    warnings: form.warnings.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, text } : row,
                    ),
                  },
                  'warnings',
                )
              }
            />
          </div>
        ))}
        <Chip
          label="Uyarı ekle"
          onClick={() =>
            onEdit({ ...form, warnings: [...form.warnings, { severity: 'medium', text: '' }] }, 'warnings')
          }
        />
      </div>

      <div className="flex flex-col gap-3">
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
          {mark('specifications', 'TEKNİK ÖZELLİKLER')}
        </span>
        {form.specifications.map((row, index) => (
          <div key={`spec-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <TextField
              label="Ad"
              value={row.key}
              onChange={(key) =>
                onEdit(
                  {
                    ...form,
                    specifications: form.specifications.map((item, i) =>
                      i === index ? { ...item, key } : item,
                    ),
                  },
                  'specifications',
                )
              }
            />
            <TextField
              label="Değer"
              value={row.value}
              onChange={(value) =>
                onEdit(
                  {
                    ...form,
                    specifications: form.specifications.map((item, i) =>
                      i === index ? { ...item, value } : item,
                    ),
                  },
                  'specifications',
                )
              }
            />
            <Chip
              label="Sil"
              className="h-8"
              onClick={() =>
                onEdit(
                  { ...form, specifications: form.specifications.filter((_, i) => i !== index) },
                  'specifications',
                )
              }
            />
          </div>
        ))}
        <Chip
          label="Özellik ekle"
          onClick={() =>
            onEdit(
              { ...form, specifications: [...form.specifications, { key: '', value: '', unit: '' }] },
              'specifications',
            )
          }
        />
      </div>

      <p className="text-sm text-muted-foreground">
        İçindekiler, katkı maddeleri, alerjenler ve besin tablosu {editing ? 'aşağıda' : 'sonraki adımda'}{' '}
        master listeye eşlenir.
      </p>
    </div>
  )
}
