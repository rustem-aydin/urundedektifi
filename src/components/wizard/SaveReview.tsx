'use client'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { Button } from '@/components/ui/button'
import type { PhotoRole } from '@/lib/wizard/ai'
import { PHOTO_ROLE_NAMES } from '@/lib/wizard/labels'
import type { Draft, ResolutionCounts } from '@/lib/wizard/productDraft'

import { Chip, TextField, WizardIntro } from './controls'

const ROLES: PhotoRole[] = ['front', 'ingredients', 'nutrition', 'recycling', 'additional', 'unknown']

type Props = {
  draft: Draft
  counts: ResolutionCounts
  busy: boolean
  failure: string | null
  dropped: string[]
  onEdit: (next: Draft) => void
  onSave: () => void
}

/** Son adım: hangi fotoğraf ürüne bağlanacak, yayın durumu, fiyat, özet. */
export function SaveReview({ draft, counts, busy, failure, dropped, onEdit, onSave }: Props) {
  const form = draft.form
  const attached = draft.photos.filter((photo) => photo.role !== 'unknown')

  function setRole(id: string, role: PhotoRole) {
    onEdit({
      ...draft,
      photos: draft.photos.map((photo) => (photo.id === id ? { ...photo, role } : photo)),
    })
  }

  const warnings: string[] = []
  if (!counts.total) warnings.push('Hiçbir master kayıt eşlenmedi; hüküm değerlendirmesi boş kalır.')
  if (counts.pending) warnings.push(`${counts.pending} satır karar bekliyor (kayıtta bağlanmaz).`)
  if (counts.skipped) warnings.push(`${counts.skipped} satır atlandı; bu içindekiler hükümlerde görünmez.`)
  if (!attached.some((photo) => photo.role === 'front')) {
    warnings.push('Ön yüz fotoğrafı yok: taslak kaydedilir, yayınlama kapalı kalır.')
  }
  if (form.nutrition.items.length === 0) warnings.push('Besin tablosu boş; besin kuralları eşleşmez.')

  const canPublish =
    attached.some((photo) => photo.role === 'front') && form.barcode.replace(/\D/g, '').length >= 8
  const canSave = !busy && Boolean(form.name.trim()) && form.barcode.replace(/\D/g, '').length >= 8

  return (
    <div className="flex flex-col gap-4">
      <CaseCard className="flex flex-col gap-1 p-4" tape>
        <EvidenceTag variant="stamp">KAYIT</EvidenceTag>
        <p className="font-display text-lg">{form.name || 'İsimsiz ürün'}</p>
        <p className="font-mono text-sm">{form.barcode || 'barkod yok'}</p>
        <p className="text-sm text-muted-foreground">
          {draft.mode === 'update'
            ? 'Bu barkod kayıtlı: yalnız boş alanlar doldurulacak, dolu alanlar korunacak.'
            : 'Yeni ürün dosyası oluşturulacak.'}
        </p>
      </CaseCard>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
          ÜRÜNE BAĞLANACAK FOTOĞRAFLAR ({attached.length}/6)
        </span>
        {draft.photos.length === 0 ? <p className="text-sm text-muted-foreground">Fotoğraf yok.</p> : null}
        {draft.photos.map((photo, index) => (
          <div
            key={photo.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- object URL */}
            <img
              src={photo.url}
              alt={`Fotoğraf ${index + 1}`}
              className="size-14 shrink-0 rounded-sm bg-muted object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
                FOTOĞRAF {index + 1}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((role) => (
                  <Chip
                    key={role}
                    label={PHOTO_ROLE_NAMES[role]}
                    selected={photo.role === role}
                    onClick={() => setRole(photo.id, role)}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
          YAYIN DURUMU
        </span>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: 'draft', label: 'Taslak' },
            { value: 'published', label: 'Yayında' },
          ].map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={(form.isPublished ? 'published' : 'draft') === option.value}
              onClick={() =>
                onEdit({
                  ...draft,
                  form: { ...form, isPublished: option.value === 'published' && canPublish },
                })
              }
            />
          ))}
        </div>
        {!canPublish ? (
          <p className="text-sm text-muted-foreground">
            Yayında için ön yüz fotoğrafı ve en az 8 haneli barkod gerekir.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
          FİYAT (OPSİYONEL)
        </span>
        {form.price ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <TextField
              label="Tutar (₺)"
              value={form.price.amount}
              inputMode="decimal"
              onChange={(amount) =>
                onEdit({ ...draft, form: { ...form, price: { ...form.price!, amount } } })
              }
            />
            <TextField
              label="Tarih (YYYY-AA-GG)"
              value={form.price.date}
              onChange={(date) => onEdit({ ...draft, form: { ...form, price: { ...form.price!, date } } })}
            />
            <Chip label="Sil" className="h-8" onClick={() => onEdit({ ...draft, form: { ...form, price: null } })} />
          </div>
        ) : (
          <Chip
            label="Fiyat ekle"
            onClick={() =>
              onEdit({
                ...draft,
                form: { ...form, price: { amount: '', date: new Date().toISOString().slice(0, 10) } },
              })
            }
          />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
          EŞLEME ÖZETİ
        </span>
        <p className="text-sm">
          {counts.matched} eşleşti · {counts.created} yeni · {counts.skipped} atlandı · {counts.pending}{' '}
          beklemede
        </p>
        {warnings.map((warning) => (
          <p key={warning} className="text-sm text-muted-foreground">
            • {warning}
          </p>
        ))}
        {dropped.map((item) => (
          <p key={`dropped-${item}`} className="text-sm text-stamp">
            Bağlanmadı: {item}
          </p>
        ))}
      </div>

      {failure ? <p className="text-sm text-stamp">{failure}</p> : null}

      <Button type="button" disabled={!canSave} onClick={onSave}>
        {busy ? 'Kaydediliyor…' : draft.mode === 'update' ? 'Boş alanları doldur' : 'Ürünü kaydet'}
      </Button>

      <WizardIntro eyebrow="ADIM 4" title="Kayıt">
        Kaydettiğinde ürün Payload koleksiyonuna yazılır; yayında işaretlediysen dosyası hemen açılır.
      </WizardIntro>
    </div>
  )
}
