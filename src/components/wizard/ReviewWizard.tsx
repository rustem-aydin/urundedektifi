'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'
import { AnalysisSummary } from '@/components/wizard/AnalysisSummary'
import { WizardIntro } from '@/components/wizard/controls'
import { MasterResolver } from '@/components/wizard/MasterResolver'
import { PhotoRequests } from '@/components/wizard/PhotoRequests'
import { PhotoTray } from '@/components/wizard/PhotoTray'
import { SaveReview } from '@/components/wizard/SaveReview'
import { type PhotoRole } from '@/lib/wizard/ai'
import {
  fetchProductDoc,
  fetchReviewQueue,
  restartAnalysis,
} from '@/lib/wizard/api'
import { PHOTO_ROLE_NAMES } from '@/lib/wizard/labels'
import { getPhotoBlob, putPhotoBlob } from '@/lib/wizard/photoStore'
import {
  analysisError,
  analysisExtraction,
  forgetPhoto,
  mergeExtraction,
  productPhotoRefs,
  resolutionCounts,
  reviewDraftFromProduct,
  type Draft,
  type DraftPhoto,
  type ProductForm,
} from '@/lib/wizard/productDraft'
import {
  preparePhoto,
  resolveCreatedMasters,
  saveProduct,
  type UploadablePhoto,
} from '@/lib/wizard/productWrite'
import { userMessage } from '@/lib/userMessages'

function describe(error: unknown): string {
  return userMessage(error, 'Bilinmeyen hata. Tekrar dene.')
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
  /** Arka plan analizinin durumu (ADR 0028): ürün üzerinde saklanır, burada yalnız okunur. */
  const [aiStatus, setAiStatus] = useState<string>('none')
  const [aiProblem, setAiProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dropped, setDropped] = useState<string[]>([])
  /** Analiz yapılmadan alanların elle doldurulmasına izin verir (tek ekran akışı). */
  const [manualEdit, setManualEdit] = useState(false)
  /** Fotoğraf çekmecesi varsayılan kapalı: sayfa kaydırılırken fotoğraflar yolu kesmez. */
  const [photosOpen, setPhotosOpen] = useState(false)

  useEffect(() => {
    if (!isPanel || !token) return
    let active = true
    ;(async () => {
      try {
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
            // Görsel okunamadı: analiz kalan fotoğraflarla hazırlanmış olabilir.
          }
        }
        if (!active) return
        const status = doc.aiStatus ?? 'none'
        setAiStatus(status)
        setAiProblem(analysisError(doc))
        setNotice(
          status === 'running'
            ? 'Katkı taslağı açıldı. Etiket okuması arka planda sürüyor; bittiğinde alanlar kendiliğinden dolar.'
            : analysisExtraction(doc)
              ? 'Katkı taslağı açıldı: etiket okuması hazır, alanlar dolu geldi.'
              : photos.length
                ? 'Katkı taslağı açıldı: fotoğraflar hazır ama etiket okuması yok.'
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

  /**
   * Analiz sürerken ürünü yoklar: bitince taslak, kullanıcı hiçbir alanı elle değiştirmediyse
   * analizle tazelenir; değiştirdiyse yazılanlar korunur ve yalnız bildirim gösterilir.
   */
  useEffect(() => {
    if (!token || aiStatus !== 'running') return
    let active = true
    const timer = setInterval(() => {
      void (async () => {
        try {
          const doc = await fetchProductDoc(productId, token)
          if (!active || !doc) return
          const status = doc.aiStatus ?? 'none'
          if (status === 'running') return
          setAiStatus(status)
          setAiProblem(analysisError(doc))
          const extraction = analysisExtraction(doc)
          if (status === 'done' && extraction) {
            setDraft((current) => {
              if (!current) return current
              if (current.touched.length) {
                setNotice('Etiket okuması bitti. Değiştirdiğin alanlar korunuyor; tümünü almak için sayfayı yenile.')
                return current
              }
              return mergeExtraction(current, extraction)
            })
            setNotice('Etiket okuması bitti: alanlar analizden dolduruldu.')
          } else if (status === 'failed') {
            setFailure('Arka plan analizi tamamlanamadı. "Analizi yeniden başlat" ile tekrar dene.')
          }
        } catch {
          // Ağ hatası: sonraki turda yeniden denenir.
        }
      })()
    }, 4000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [aiStatus, productId, token])

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
      const message = `Fotoğraf hazırlanamadı: ${describe(error)}`
      setFailure(message)
      toast.error(message)
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

  /**
   * Analizi elle yeniden başlatır (ADR 0028): normalde katkı anında arka planda başlar. Bu yol
   * yalnız başarısız ya da analizsiz eski taslaklar için.
   */
  async function restart() {
    if (!draft || !token) return
    setFailure(null)
    setBusy(true)
    try {
      await restartAnalysis(productId, token)
      setAiStatus('running')
      setAiProblem(null)
      const message = 'Analiz yeniden başlatıldı. Bitince alanlar kendiliğinden dolar.'
      setNotice(message)
      toast.success('Analiz yeniden başlatıldı.')
    } catch (error) {
      const message = describe(error)
      setFailure(message)
      toast.error(message)
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
        const message = `Bazı kayıtlar oluşturulamadı: ${resolved.errors.map((error) => error.message).join(' · ')}`
        setFailure(message)
        toast.error(message)
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
      toast.success('Ürün kaydedildi. Sıradaki taslağa geçiliyor.')
      router.refresh()
      await advance()
    } catch (error) {
      const message = describe(error)
      setFailure(message)
      toast.error(message)
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
  /** Tek ekran: analiz yoksa alanlar gizli kalır, elle doldurma ile açılabilir. */
  const hasContent = manualEdit || draft.extraction !== null
  const statusTag =
    aiStatus === 'running'
      ? { variant: 'tape' as const, label: 'ETİKET OKUNUYOR' }
      : aiStatus === 'done'
        ? { variant: 'evidence' as const, label: 'ANALİZ HAZIR' }
        : aiStatus === 'failed'
          ? { variant: 'stamp' as const, label: 'ANALİZ BAŞARISIZ' }
          : { variant: 'stamp' as const, label: 'ANALİZ YOK' }

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex flex-wrap items-center gap-2">
        <EvidenceTag variant="tape">{draft.barcode}</EvidenceTag>
        <EvidenceTag variant={statusTag.variant}>{statusTag.label}</EvidenceTag>
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
          {draft.photos.length} FOTOĞRAF
        </span>
      </div>

      {notice ? <p className="text-sm text-evidence-green">{notice}</p> : null}
      {failure ? <p className="text-sm text-stamp">{failure}</p> : null}
      {aiProblem ? <p className="text-sm text-stamp">Analiz notu: {aiProblem}</p> : null}
      {busy ? (
        <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">İşleniyor…</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {aiStatus === 'running' ? (
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
            ETİKET OKUMASI SÜRÜYOR…
          </span>
        ) : aiStatus === 'done' ? null : (
          <Button type="button" variant="outline" disabled={busy || !draft.photos.length} onClick={() => void restart()}>
            {aiStatus === 'failed' ? 'Analizi yeniden başlat' : 'Analizi başlat'}
          </Button>
        )}
        {!hasContent ? (
          <Button type="button" variant="ghost" onClick={() => setManualEdit(true)}>
            Analiz olmadan elle doldur
          </Button>
        ) : null}
        {draft.extraction ? (
          <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
            {draft.extraction.requests.length} FOTOĞRAF TALEBİ
            {draft.usage ? ` · ${draft.usage.prompt ?? 0}+${draft.usage.completion ?? 0} TOKEN` : ''}
          </span>
        ) : null}
      </div>

      {hasContent ? (
        <div className="flex flex-col gap-6">
          <PhotoRequests requests={draft.extraction?.requests ?? []} />

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

      {/* Fotoğraf çekmecesi: sayfa kaydırılırken fotoğraflar yolu kesmesin diye sabit alt şerit,
          içerik yalnız istendiğinde açılır (varsayılan kapalı). */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        {photosOpen ? (
          <div className="max-h-[70vh] overflow-y-auto border-t border-border bg-card">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-4 pb-2">
              <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
                FOTOĞRAFLAR ({draft.photos.length}/6)
              </span>
              <PhotoTray
                photos={draft.photos}
                disabled={busy}
                onAdd={(files, source) => void addPhotos(files, source)}
                onRemove={(id) => void removePhoto(id)}
                onRole={(id, role) => void setPhotoRole(id, role)}
              />
            </div>
          </div>
        ) : null}
        <div className="border-t border-border bg-card">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 py-2">
            <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
              {draft.photos.length}/6 FOTOĞRAF
              {draft.photos.some((photo) => photo.role !== 'unknown')
                ? ' · ROL ATANDI'
                : draft.photos.length
                  ? ' · ROL BEKLİYOR'
                  : ''}
            </span>
            <Button
              type="button"
              variant={photosOpen ? 'outline' : 'default'}
              onClick={() => setPhotosOpen((open) => !open)}
            >
              {photosOpen ? 'Fotoğrafları kapat' : 'Fotoğrafları aç'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
