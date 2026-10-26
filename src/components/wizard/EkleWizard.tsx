'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'
import { AnalysisSummary } from '@/components/wizard/AnalysisSummary'
import { Chip, TextField, WizardIntro } from '@/components/wizard/controls'
import { MasterResolver } from '@/components/wizard/MasterResolver'
import { PhotoTray } from '@/components/wizard/PhotoTray'
import { SaveReview } from '@/components/wizard/SaveReview'
import { AiError, analyzeProduct, type PhotoRole } from '@/lib/wizard/ai'
import { ApiError, findProductByBarcode } from '@/lib/wizard/api'
import { PHOTO_ROLE_NAMES } from '@/lib/wizard/labels'
import { getPhotoBlob, putPhotoBlob } from '@/lib/wizard/photoStore'
import {
  clearDraft,
  createEmptyDraft,
  forgetPhoto,
  loadDraft,
  mergeExtraction,
  resolutionCounts,
  saveDraft,
  type Draft,
  type DraftPhoto,
  type ProductForm,
} from '@/lib/wizard/productDraft'
import { readReadyProvider } from '@/lib/wizard/provider'
import {
  preparePhoto,
  resolveCreatedMasters,
  saveProduct,
  type UploadablePhoto,
} from '@/lib/wizard/productWrite'

const STEP_TITLES = ['Fotoğraf ve barkod', 'Onay', 'Eşleme', 'Kayıt'] as const

function describe(error: unknown): string {
  if (error instanceof AiError || error instanceof ApiError) return error.message
  return error instanceof Error ? error.message : 'Bilinmeyen hata.'
}

/**
 * Ekle sihirbazı (ADR 0008, web uyarlaması): barkod → fotoğraflar → YZ analizi → onay →
 * master eşleme → kayıt. Taslak `localStorage`'da, fotoğraflar IndexedDB'de tutulur.
 */
export function EkleWizard({ initialBarcode = '' }: { initialBarcode?: string }) {
  const router = useRouter()
  const { user, token, canAddProduct, restoring } = useSession()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [providerReady, setProviderReady] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dropped, setDropped] = useState<string[]>([])
  const [saved, setSaved] = useState<{ barcode: string; published: boolean } | null>(null)

  useEffect(() => {
    if (!canAddProduct) return
    let active = true
    ;(async () => {
      try {
        const stored = await loadDraft()
        if (!active) return
        setProviderReady(Boolean(readReadyProvider()))
        if (stored) {
          const badges: string[] = [`Yarım kalan taslak geri yüklendi: ${STEP_TITLES[stored.draft.step - 1]}.`]
          if (stored.missingPhotos) {
            badges.push(`${stored.missingPhotos} fotoğraf bulunamadı. Yeniden ekle.`)
          }
          setNotice(badges.join(' '))
          const digits = initialBarcode.replace(/\D/g, '').slice(0, 14)
          const next =
            digits && !stored.draft.barcode
              ? { ...stored.draft, barcode: digits, form: { ...stored.draft.form, barcode: digits } }
              : stored.draft
          setDraft(next)
        } else {
          const empty = createEmptyDraft()
          const digits = initialBarcode.replace(/\D/g, '').slice(0, 14)
          setDraft(digits ? { ...empty, barcode: digits, form: { ...empty.form, barcode: digits } } : empty)
        }
      } catch {
        if (active) setDraft(createEmptyDraft())
      } finally {
        if (active) setLoaded(true)
      }
    })()
    return () => {
      active = false
    }
  }, [canAddProduct, initialBarcode])

  const update = useCallback(async (next: Draft) => {
    setDraft(next)
    await saveDraft(next).catch(() => undefined)
  }, [])

  const editForm = useCallback(
    (form: ProductForm, field?: string) => {
      if (!draft) return
      const touched =
        field && !draft.touched.includes(field) ? [...draft.touched, field] : draft.touched
      void update({ ...draft, form, touched })
    },
    [draft, update],
  )

  async function addPhotos(files: File[], source: 'camera' | 'library') {
    if (!draft) return
    setFailure(null)
    setBusy(true)
    try {
      const photos: DraftPhoto[] = []
      for (const file of files) {
        const resized = await preparePhoto(file)
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        await putPhotoBlob(id, resized.blob)
        photos.push({ id, role: 'unknown', source, url: URL.createObjectURL(resized.blob) })
      }
      await update({ ...draft, photos: [...draft.photos, ...photos] })
    } catch (error) {
      setFailure(`Fotoğraf hazırlanamadı: ${describe(error)}`)
    } finally {
      setBusy(false)
    }
  }

  async function removePhoto(id: string) {
    if (!draft) return
    const photo = draft.photos.find((item) => item.id === id)
    if (photo) await forgetPhoto(photo)
    await update({ ...draft, photos: draft.photos.filter((item) => item.id !== id) })
  }

  async function setPhotoRole(id: string, role: PhotoRole) {
    if (!draft) return
    await update({
      ...draft,
      photos: draft.photos.map((photo) => (photo.id === id ? { ...photo, role } : photo)),
    })
  }

  async function setBarcode(digits: string) {
    if (!draft) return
    await update({ ...draft, barcode: digits, form: { ...draft.form, barcode: digits } })
  }

  async function lookupBarcode() {
    if (!draft) return
    const digits = draft.barcode.replace(/\D/g, '')
    if (digits.length < 8) {
      setFailure('Barkod en az 8 hane olmalı.')
      return
    }
    setFailure(null)
    setBusy(true)
    try {
      const existing = await findProductByBarcode(digits)
      if (existing) {
        await update({
          ...draft,
          mode: 'update',
          productId: existing.id,
          form: {
            ...draft.form,
            barcode: digits,
            name: draft.form.name || existing.name || '',
          },
        })
        setNotice('Bu barkod kayıtlı. Yalnız boş alanlar doldurulur; dolu alanlar korunur.')
      } else {
        await update({ ...draft, mode: 'create', productId: null })
        setNotice('Bu barkod yeni. Kayıt oluşturulacak.')
      }
    } catch (error) {
      setFailure(describe(error))
    } finally {
      setBusy(false)
    }
  }

  async function analyze() {
    if (!draft) return
    setFailure(null)
    setNotice(null)
    const ready = readReadyProvider()
    if (!ready) {
      setProviderReady(false)
      setFailure('Önce yapay zekâ sağlayıcısını ayarla.')
      return
    }
    if (!draft.photos.length) {
      setFailure('Analiz için en az bir fotoğraf gerekiyor.')
      return
    }

    setBusy(true)
    try {
      const images: { index: number; base64: string }[] = []
      const stale: string[] = []
      for (const [index, photo] of draft.photos.entries()) {
        try {
          const blob = await getPhotoBlob(photo.id)
          if (!blob) {
            stale.push(`Fotoğraf ${index + 1}`)
            continue
          }
          const prepared = await preparePhoto(new File([blob], `${photo.id}.jpg`, { type: 'image/jpeg' }))
          images.push({ index, base64: prepared.base64 })
        } catch {
          stale.push(`Fotoğraf ${index + 1}`)
        }
      }
      if (stale.length) {
        setFailure(`${stale.join(', ')} okunamadı. Fotoğrafı kaldırıp yeniden ekle.`)
        return
      }

      const hints = draft.extraction?.requests.map((request) => request.need) ?? []
      const result = await analyzeProduct({
        settings: ready.settings,
        apiKey: ready.apiKey,
        images,
        previous: draft.extraction,
        hints,
      })

      const merged = mergeExtraction(
        {
          ...draft,
          analysisRounds: draft.analysisRounds + 1,
          usage: {
            prompt: result.usage?.promptTokens ?? null,
            completion: result.usage?.completionTokens ?? null,
          },
        },
        result.data,
      )
      await update({ ...merged, step: 2 })
      const tokenNote = result.usage?.totalTokens ? ` · ${result.usage.totalTokens} token` : ''
      setNotice(
        result.data.requests.length
          ? `${result.data.requests.length} eksik alan için yeni fotoğraf isteniyor.${tokenNote}`
          : `Analiz tamamlandı.${tokenNote}`,
      )
    } catch (error) {
      setFailure(describe(error))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!draft || !token) return
    setFailure(null)
    setBusy(true)
    try {
      const resolved = await resolveCreatedMasters(draft, token)
      if (resolved.errors.length) {
        setFailure(`Bazı kayıtlar oluşturulamadı: ${resolved.errors.map((error) => error.message).join(' · ')}`)
        await update(resolved.draft)
        return
      }

      const photos: UploadablePhoto[] = []
      for (const photo of resolved.draft.photos.filter((item) => item.role !== 'unknown')) {
        const blob = await getPhotoBlob(photo.id)
        if (!blob) throw new Error('Bir fotoğraf okunamadı. Kaldırıp yeniden ekle.')
        photos.push({
          id: photo.id,
          blob,
          role: photo.role,
          alt: `${resolved.draft.form.name || 'Ürün'} — ${PHOTO_ROLE_NAMES[photo.role] ?? photo.role}`,
        })
      }

      const outcome = await saveProduct(resolved.draft, token, photos)
      setDropped(outcome.dropped)
      for (const photo of resolved.draft.photos) {
        if (photo.url) URL.revokeObjectURL(photo.url)
      }
      await clearDraft()
      setSaved({ barcode: resolved.draft.form.barcode, published: resolved.draft.form.isPublished })
      setDraft(null)
      router.refresh()
    } catch (error) {
      setFailure(describe(error))
    } finally {
      setBusy(false)
    }
  }

  async function discard() {
    if (draft) {
      for (const photo of draft.photos) await forgetPhoto(photo)
    }
    await clearDraft()
    setDraft(createEmptyDraft())
    setNotice('Taslak silindi.')
    setFailure(null)
    setDropped([])
  }

  if (restoring || (canAddProduct && !loaded)) {
    return <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">Oturum ve taslak hazırlanıyor…</p>
  }

  if (!canAddProduct) {
    return (
      <CaseCard className="flex flex-col gap-3 p-5">
        <EvidenceTag variant="stamp">YETKİ</EvidenceTag>
        <WizardIntro eyebrow="ADIM 0" title="Bu ekran rolüne kapalı">
          {user
            ? `${user.role} rolüyle ürün eklenemez. Admin ya da editör hesabıyla giriş yap.`
            : 'Admin ya da editör hesabıyla giriş yapman gerekiyor.'}
        </WizardIntro>
        <Button asChild className="w-fit">
          <Link href={`/giris?next=${encodeURIComponent('/ekle')}`}>Giriş ekranına git</Link>
        </Button>
      </CaseCard>
    )
  }

  if (saved) {
    return (
      <div className="flex flex-col gap-4">
        <CaseCard className="flex flex-col gap-2 p-5" tape>
          <EvidenceTag variant="evidence">{saved.published ? 'YAYINDA' : 'TASLAK'}</EvidenceTag>
          <p className="font-display text-2xl">{saved.barcode}</p>
          <p className="text-sm text-muted-foreground">
            {saved.published
              ? 'Ürün yayında; dosyası açılabilir.'
              : 'Ürün taslak olarak kaydedildi. Yönetim panelinden yayınlayabilirsin.'}
          </p>
        </CaseCard>
        {dropped.length ? (
          <CaseCard className="flex flex-col gap-1 p-4">
            <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
              BAĞLANMAYAN SATIRLAR
            </span>
            {dropped.map((item) => (
              <p key={item} className="text-sm">
                • {item}
              </p>
            ))}
          </CaseCard>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {saved.published ? (
            <Button asChild>
              <Link href={`/urun/${saved.barcode}`}>Ürün dosyasını aç</Link>
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setSaved(null)}>
            Yeni ürün başlat
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/urunler">Ürünlere dön</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!draft) {
    return <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">Taslak hazırlanıyor…</p>
  }

  const counts = resolutionCounts(draft)
  const step = draft.step

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {STEP_TITLES.map((title, index) => {
          const number = (index + 1) as Draft['step']
          return (
            <Chip
              key={title}
              label={`${number}. ${title}`}
              selected={step === number}
              disabled={number > step}
              onClick={() => void update({ ...draft, step: number })}
              title={number > step ? 'Bu adıma henüz geçilmedi' : title}
            />
          )
        })}
      </div>

      {notice ? <p className="text-sm text-evidence-green">{notice}</p> : null}
      {failure ? <p className="text-sm text-stamp">{failure}</p> : null}
      {busy ? (
        <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">İşleniyor…</p>
      ) : null}

      {!busy && step === 1 ? (
        <div className="flex flex-col gap-5">
          <CaseCard className="flex flex-col gap-3 p-4">
            <EvidenceTag variant="stamp">BARKOD</EvidenceTag>
            <p className="text-sm text-muted-foreground">
              Barkod kayıtlıysa ürün güncellenir; yeni ise dosya oluşturulur. Barkodu kamerayla
              okutabilir ya da elle yazabilirsin.
            </p>
            <TextField
              label="Barkod (8–14 hane)"
              value={draft.barcode}
              inputMode="numeric"
              placeholder="8690123456789"
              onChange={(value) => void setBarcode(value.replace(/\D/g, '').slice(0, 14))}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={draft.barcode.replace(/\D/g, '').length < 8}
                onClick={() => void lookupBarcode()}
              >
                {busy ? 'Sorgulanıyor…' : 'Barkodu sorgula'}
              </Button>
              <Button variant="ghost" type="button" asChild>
                <Link href="/tara">Kamerayla oku</Link>
              </Button>
              {draft.mode === 'update' ? <EvidenceTag variant="tape">GÜNCELLEME MODU</EvidenceTag> : null}
            </div>
          </CaseCard>

          {providerReady === false ? (
            <CaseCard className="flex flex-col gap-2 p-4">
              <EvidenceTag variant="stamp">SAĞLAYICI</EvidenceTag>
              <WizardIntro eyebrow="YAPAY ZEKÂ" title="Sağlayıcı ayarlanmadı">
                Fotoğrafı analiz etmek için servis adresi, API anahtarı ve model gerekiyor.
              </WizardIntro>
              <Button asChild className="w-fit">
                <Link href="/saglayici">Sağlayıcıyı ayarla</Link>
              </Button>
            </CaseCard>
          ) : null}

          <PhotoTray
            photos={draft.photos}
            requests={draft.extraction?.requests ?? []}
            disabled={busy}
            onAdd={(files, source) => void addPhotos(files, source)}
            onRemove={(id) => void removePhoto(id)}
            onRole={(id, role) => void setPhotoRole(id, role)}
          />

          {draft.analysisRounds > 0 ? (
            <p className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
              {draft.analysisRounds} ANALİZ TURU
              {draft.usage ? ` · ${draft.usage.prompt ?? 0}+${draft.usage.completion ?? 0} TOKEN` : ''}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || draft.photos.length === 0}
              onClick={() => void analyze()}
            >
              {draft.analysisRounds ? 'Tekrar analiz et' : 'Analiz et'}
            </Button>
            {draft.analysisRounds > 0 ? (
              <Button variant="outline" onClick={() => void update({ ...draft, step: 2 })}>
                Analizi atla, elle doldur
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => void discard()}>
              Taslağı sil
            </Button>
          </div>
        </div>
      ) : null}

      {!busy && step === 2 ? (
        <div className="flex flex-col gap-5">
          {draft.extraction?.requests.length ? (
            <CaseCard className="flex flex-col gap-1 p-4">
              <EvidenceTag variant="stamp">EKSİK VERİ</EvidenceTag>
              {draft.extraction.requests.map((request, index) => (
                <p key={`${request.need}-${index}`} className="text-sm">
                  • {request.need} — {request.hint}
                </p>
              ))}
              <Button variant="ghost" className="w-fit" onClick={() => void update({ ...draft, step: 1 })}>
                Fotoğraf ekleyip tekrar analiz et
              </Button>
            </CaseCard>
          ) : null}

          <AnalysisSummary form={draft.form} touched={draft.touched} onEdit={editForm} />

          <Button
            className="w-fit"
            disabled={!draft.form.name.trim()}
            onClick={() => void update({ ...draft, step: 3 })}
          >
            Eşlemeye geç
          </Button>
        </div>
      ) : null}

      {!busy && step === 3 ? (
        <div className="flex flex-col gap-4">
          <MasterResolver form={draft.form} onEdit={editForm} />
          <p className="text-sm text-muted-foreground">
            {counts.matched} eşleşti · {counts.created} yeni · {counts.skipped} atlandı · {counts.pending}{' '}
            beklemede
          </p>
          <Button className="w-fit" onClick={() => void update({ ...draft, step: 4 })}>
            Kayıt adımına geç
          </Button>
        </div>
      ) : null}

      {!busy && step === 4 ? (
        <SaveReview
          draft={draft}
          counts={counts}
          busy={busy}
          failure={failure}
          dropped={dropped}
          onEdit={(next) => void update(next)}
          onSave={() => void save()}
        />
      ) : null}
    </div>
  )
}
