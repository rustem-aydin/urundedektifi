'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'
import { AnalysisSummary } from '@/components/wizard/AnalysisSummary'
import { WizardIntro } from '@/components/wizard/controls'
import { MasterResolver } from '@/components/wizard/MasterResolver'
import { PhotoTray } from '@/components/wizard/PhotoTray'
import { SaveReview } from '@/components/wizard/SaveReview'
import { AiError, analyzeProduct, type PhotoRole } from '@/lib/wizard/ai'
import { ApiError, fetchProductDoc, fetchReviewQueue } from '@/lib/wizard/api'
import { PHOTO_ROLE_NAMES } from '@/lib/wizard/labels'
import { getPhotoBlob, putPhotoBlob } from '@/lib/wizard/photoStore'
import {
  forgetPhoto,
  mergeExtraction,
  productPhotoRefs,
  resolutionCounts,
  reviewDraftFromProduct,
  type Draft,
  type DraftPhoto,
  type ProductForm,
} from '@/lib/wizard/productDraft'
import { fetchProviderStatus } from '@/lib/wizard/provider'
import {
  preparePhoto,
  resolveCreatedMasters,
  saveProduct,
  type UploadablePhoto,
} from '@/lib/wizard/productWrite'

function describe(error: unknown): string {
  if (error instanceof AiError || error instanceof ApiError) return error.message
  return error instanceof Error ? error.message : 'Bilinmeyen hata.'
}

/**
 * İnceleme ekranı (ADR 0026, ADR 0027): katkı olarak açılmış taslak ürünü, fotoğrafları hazır
 * hâlde tek sayfada açar — YZ analizi, alan onayı, master eşleme ve kayıt aynı ekranda
 * alt alta durur; adım makinesi yoktur. Yeni ürün açan bir mod yoktur: herkes ürünü
 * fotoğrafla katkı olarak açar, ürünü yalnız panel rolleri yayınlar.
 * Kaydetmeden sonra otomatik olarak sıradaki incelenmemiş taslağa geçilir.
 */
export function ReviewWizard({ productId }: { productId: string }) {
  const router = useRouter()
  const { token, isPanel, restoring } = useSession()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [providerReady, setProviderReady] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dropped, setDropped] = useState<string[]>([])
  /** Analiz yapılmadan alanların elle doldurulmasına izin verir (tek ekran akışı). */
  const [manualEdit, setManualEdit] = useState(false)

  useEffect(() => {
    if (!isPanel || !token) return
    let active = true
    ;(async () => {
      try {
        setProviderReady((await fetchProviderStatus(token)).configured)
        const doc = await fetchProductDoc(productId, token)
        if (!doc) {
          if (active) setFailure('Bu taslak bulunamadı. Silinmiş olabilir.')
          return
        }
        const photos: DraftPhoto[] = []
        for (const ref of productPhotoRefs(doc)) {
          if (!ref.url) continue
          try {
            const blob = await fetch(ref.url).then((response) => response.blob())
            if (!blob.size) continue
            const id = `media-${ref.mediaId}`
            await putPhotoBlob(id, blob)
            photos.push({ id, role: ref.role, source: 'library', url: URL.createObjectURL(blob) })
          } catch {
            // Görsel okunamadı: analiz kalan fotoğraflarla yapılır.
          }
        }
        if (!active) return
        setNotice(
          photos.length
            ? `Katkı taslağı açıldı: ${photos.length} fotoğraf hazır. "Analiz et" ile devam et.`
            : 'Katkı taslağı açıldı ama fotoğraflar okunamadı. Editör panelinden kontrol et.',
        )
        setDraft(reviewDraftFromProduct(doc, photos))
      } catch (error) {
        if (active) setFailure(describe(error))
      } finally {
        if (active) setLoaded(true)
      }
    })()
    return () => {
      active = false
    }
  }, [isPanel, productId, token])

  const update = useCallback(async (next: Draft) => {
    setDraft(next)
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

  async function analyze() {
    if (!draft) return
    setFailure(null)
    setNotice(null)
    const status = await fetchProviderStatus(token)
    setProviderReady(status.configured)
    if (!status.configured) {
      setFailure('Yapay zekâ sağlayıcısı ayarlanmamış. Yönetici panelinden tanımlanmalı.')
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
        token: token ?? '',
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
      await update(merged)
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

  /** Sıradaki incelenmemiş taslağa geçer; kuyruk boşsa listeye döner. */
  async function advance() {
    if (!token) {
      router.push('/inceleme')
      return
    }
    try {
      const queue = await fetchReviewQueue(token)
      const next = queue.find((item) => !item.seen && item.id !== productId)
      router.push(next ? `/inceleme/${next.id}` : '/inceleme')
    } catch {
      router.push('/inceleme')
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
      // `media-` kimlikli fotoğraflar ürüne zaten bağlı (katkıda yüklendi): yeniden yüklenmez.
      for (const photo of resolved.draft.photos.filter(
        (item) => item.role !== 'unknown' && !item.id.startsWith('media-'),
      )) {
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
      for (const photo of resolved.draft.photos) await forgetPhoto(photo)
      setDraft(null)
      router.refresh()
      await advance()
    } catch (error) {
      setFailure(describe(error))
    } finally {
      setBusy(false)
    }
  }

  if (restoring || (isPanel && !loaded)) {
    return <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">Oturum ve taslak hazırlanıyor…</p>
  }

  if (!isPanel) {
    return (
      <CaseCard className="flex flex-col gap-3 p-5">
        <EvidenceTag variant="stamp">YETKİ YOK</EvidenceTag>
        <WizardIntro eyebrow="İNCELEME" title="İnceleme panel rollerine açık">
          Ürünü yayına almak admin ve editör hesabına açıktır. Sen de ürünün fotoğraflarını
          göndererek katkı verebilirsin; katkı bu kuyruğa düşer.
        </WizardIntro>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="w-fit">
            <Link href="/katki">Fotoğrafla katkı ver</Link>
          </Button>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/tara">Kamerayla tara</Link>
          </Button>
        </div>
      </CaseCard>
    )
  }

  if (!draft) {
    return <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">Taslak hazırlanıyor…</p>
  }

  const counts = resolutionCounts(draft)
  /** Tek ekran: analiz yapılmadıysa alanlar gizli kalır, elle doldurma ile açılabilir. */
  const hasContent = manualEdit || draft.analysisRounds > 0 || draft.extraction !== null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <EvidenceTag variant="tape">{draft.barcode}</EvidenceTag>
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
          {draft.photos.length} FOTOĞRAF
          {draft.analysisRounds ? ` · ${draft.analysisRounds} ANALİZ` : ''}
        </span>
      </div>

      {notice ? <p className="text-sm text-evidence-green">{notice}</p> : null}
      {failure ? <p className="text-sm text-stamp">{failure}</p> : null}
      {busy ? (
        <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">İşleniyor…</p>
      ) : null}

      {providerReady === false ? (
        <CaseCard className="flex flex-col gap-2 p-4">
          <EvidenceTag variant="stamp">SAĞLAYICI</EvidenceTag>
          <WizardIntro eyebrow="YAPAY ZEKÂ" title="Sağlayıcı ayarlanmadı">
            Fotoğraf analizi için yönetici sağlayıcıyı tanımlamalı (servis adresi, API anahtarı,
            model).
          </WizardIntro>
          <Button asChild className="w-fit">
            <Link href="/saglayici">Durumu gör</Link>
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

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={busy || draft.photos.length === 0} onClick={() => void analyze()}>
          {draft.analysisRounds ? 'Tekrar analiz et' : 'Analiz et'}
        </Button>
        {!hasContent ? (
          <Button type="button" variant="outline" onClick={() => setManualEdit(true)}>
            Analiz olmadan elle doldur
          </Button>
        ) : null}
        {draft.analysisRounds > 0 ? (
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
            {draft.analysisRounds} ANALİZ TURU
            {draft.usage ? ` · ${draft.usage.prompt ?? 0}+${draft.usage.completion ?? 0} TOKEN` : ''}
          </span>
        ) : null}
      </div>

      {hasContent ? (
        <div className="flex flex-col gap-6">
          {draft.extraction?.requests.length ? (
            <CaseCard className="flex flex-col gap-1 p-4">
              <EvidenceTag variant="stamp">EKSİK VERİ</EvidenceTag>
              {draft.extraction.requests.map((request, index) => (
                <p key={`${request.need}-${index}`} className="text-sm">
                  • {request.need} — {request.hint}
                </p>
              ))}
              <p className="text-sm text-muted-foreground">
                Eksik alan için fotoğrafı yukarıdan ekleyip yeniden analiz et.
              </p>
            </CaseCard>
          ) : null}

          <AnalysisSummary form={draft.form} touched={draft.touched} onEdit={editForm} />

          <MasterResolver form={draft.form} onEdit={editForm} />

          <p className="text-sm text-muted-foreground">
            {counts.matched} eşleşti · {counts.created} yeni · {counts.skipped} atlandı ·{' '}
            {counts.pending} beklemede
          </p>

          <SaveReview
            draft={draft}
            counts={counts}
            busy={busy}
            failure={failure}
            dropped={dropped}
            onEdit={(next) => void update(next)}
            onSave={() => void save()}
          />
        </div>
      ) : null}
    </div>
  )
}
