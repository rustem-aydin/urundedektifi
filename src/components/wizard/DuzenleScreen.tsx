'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'
import { AnalysisSummary } from '@/components/wizard/AnalysisSummary'
import { Chip, WizardIntro } from '@/components/wizard/controls'
import { MasterResolver } from '@/components/wizard/MasterResolver'
import { PhotoTray } from '@/components/wizard/PhotoTray'
import { AiError } from '@/lib/wizard/ai'
import { ApiError, fetchProductDoc } from '@/lib/wizard/api'
import { PHOTO_ROLE_NAMES } from '@/lib/wizard/labels'
import { getPhotoBlob, putPhotoBlob } from '@/lib/wizard/photoStore'
import {
  draftFromProduct,
  forgetPhoto,
  resolutionCounts,
  type Draft,
  type ProductForm,
} from '@/lib/wizard/productDraft'
import {
  preparePhoto,
  resolveCreatedMasters,
  saveProductEdits,
  type UploadablePhoto,
} from '@/lib/wizard/productWrite'

function describe(error: unknown): string {
  if (error instanceof AiError || error instanceof ApiError) return error.message
  return error instanceof Error ? error.message : 'Bilinmeyen hata.'
}

/**
 * Mevcut ürünü düzenleme yüzeyi (ADR 0009, web uyarlaması). Form doğrudan `depth=2` ham
 * dokümandan doldurulur; kayıt form değerlerinin üzerine yazar.
 */
export function DuzenleScreen({ productId }: { productId: string }) {
  const router = useRouter()
  const { user, token, canAddProduct, restoring } = useSession()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dropped, setDropped] = useState<string[]>([])
  const [saved, setSaved] = useState<{ barcode: string; published: boolean } | null>(null)

  useEffect(() => {
    if (!canAddProduct || !productId) return
    let active = true
    fetchProductDoc(productId)
      .then((doc) => {
        if (!active) return
        if (!doc) {
          setLoadError('Bu ürün bulunamadı; silinmiş olabilir.')
          return
        }
        setDraft(draftFromProduct(doc))
      })
      .catch((error: unknown) => {
        if (active) setLoadError(describe(error))
      })
    return () => {
      active = false
    }
  }, [canAddProduct, productId])

  const editForm = useCallback((form: ProductForm, field?: string) => {
    setDraft((current) => {
      if (!current) return current
      const touched =
        field && !current.touched.includes(field) ? [...current.touched, field] : current.touched
      return { ...current, form, touched }
    })
  }, [])

  async function addPhotos(files: File[], source: 'camera' | 'library') {
    if (!draft) return
    setFailure(null)
    setBusy(true)
    try {
      const photos: Draft['photos'] = []
      for (const file of files) {
        const resized = await preparePhoto(file)
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        await putPhotoBlob(id, resized.blob)
        photos.push({ id, role: 'unknown', source, url: URL.createObjectURL(resized.blob) })
      }
      setDraft((current) => (current ? { ...current, photos: [...current.photos, ...photos] } : current))
    } catch (error) {
      setFailure(`Fotoğraf hazırlanamadı: ${describe(error)}`)
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
        setFailure(`Bazı kayıtlar açılamadı: ${resolved.errors.map((error) => error.message).join(' · ')}`)
        setDraft(resolved.draft)
        return
      }

      const photos: UploadablePhoto[] = []
      for (const photo of resolved.draft.photos.filter((item) => item.role !== 'unknown')) {
        const blob = await getPhotoBlob(photo.id)
        if (!blob) throw new Error('Bir fotoğraf okunamadı; kaldırıp yeniden ekle.')
        photos.push({
          id: photo.id,
          blob,
          role: photo.role,
          alt: `${resolved.draft.form.name || 'Ürün'} — ${PHOTO_ROLE_NAMES[photo.role] ?? photo.role}`,
        })
      }

      const outcome = await saveProductEdits(resolved.draft, token, photos)
      setDropped(outcome.dropped)
      for (const photo of resolved.draft.photos) {
        await forgetPhoto(photo)
      }
      setSaved({ barcode: resolved.draft.barcode, published: resolved.draft.form.isPublished })
      router.refresh()
    } catch (error) {
      setFailure(describe(error))
    } finally {
      setBusy(false)
    }
  }

  if (restoring || (canAddProduct && !draft && !loadError)) {
    return (
      <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
        Ürün ve oturum hazırlanıyor…
      </p>
    )
  }

  if (!canAddProduct) {
    return (
      <CaseCard className="flex flex-col gap-3 p-5">
        <EvidenceTag variant="stamp">YETKİ</EvidenceTag>
        <WizardIntro eyebrow="DÜZENLEME" title="Bu ekran senin rolüne kapalı">
          {user
            ? `${user.role} rolüyle ürün düzenlenemez. Admin veya editör hesabıyla giriş yap.`
            : 'Admin veya editör hesabıyla giriş yapman gerekiyor.'}
        </WizardIntro>
        <Button asChild className="w-fit">
          <Link href={`/giris?next=${encodeURIComponent(`/duzenle/${productId}`)}`}>Giriş ekranına git</Link>
        </Button>
      </CaseCard>
    )
  }

  if (loadError) {
    return (
      <CaseCard className="flex flex-col gap-3 p-5">
        <EvidenceTag variant="stamp">KAYIT YOK</EvidenceTag>
        <WizardIntro eyebrow="DÜZENLEME" title="Ürün açılamadı">
          {loadError}
        </WizardIntro>
        <Button variant="ghost" className="w-fit" asChild>
          <Link href="/urunler">Ürünlere dön</Link>
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
              ? 'Değişiklikler kaydedildi; dosya yeniden okunur.'
              : 'Değişiklikler kaydedildi ama ürün taslak: dosya yalnız yayındayken açılır.'}
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
          <Button asChild>
            <Link href={`/urun/${saved.barcode}`}>Dosyaya dön</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/urunler">Ürünlere dön</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!draft) {
    return <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">Ürün açılıyor…</p>
  }

  const counts = resolutionCounts(draft)

  return (
    <div className="flex flex-col gap-5">
      <CaseCard className="flex flex-col gap-3 p-4">
        <EvidenceTag variant="stamp">KAYITLI ÜRÜN</EvidenceTag>
        <p className="font-display text-xl">{draft.form.name || 'İsimsiz ürün'}</p>
        <p className="text-sm text-muted-foreground">
          Kaydettiğinde formdaki değerler ürünün üzerine yazılır (Ekle’deki “yalnız boş alan” kuralı
          burada geçerli değil). Yeni fotoğraf eklemezsen mevcut görseller ve fiyat geçmişi korunur.
        </p>
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
                selected={(draft.form.isPublished ? 'published' : 'draft') === option.value}
                onClick={() =>
                  editForm(
                    { ...draft.form, isPublished: option.value === 'published' },
                    'isPublished',
                  )
                }
              />
            ))}
          </div>
        </div>
      </CaseCard>

      {failure ? <p className="text-sm text-stamp">{failure}</p> : null}
      {busy ? (
        <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">Kaydediliyor…</p>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
          YENİ FOTOĞRAF (İSTEĞE BAĞLI)
        </span>
        <PhotoTray
          photos={draft.photos}
          requests={[]}
          disabled={busy}
          onAdd={(files, source) => void addPhotos(files, source)}
          onRemove={(photoId) => {
            const photo = draft.photos.find((item) => item.id === photoId)
            if (photo) void forgetPhoto(photo)
            setDraft({ ...draft, photos: draft.photos.filter((item) => item.id !== photoId) })
          }}
          onRole={(photoId, role) =>
            setDraft({
              ...draft,
              photos: draft.photos.map((photo) =>
                photo.id === photoId ? { ...photo, role } : photo,
              ),
            })
          }
        />
      </div>

      <AnalysisSummary form={draft.form} touched={draft.touched} mode="edit" onEdit={editForm} />
      <MasterResolver form={draft.form} onEdit={editForm} />

      <p className="text-sm text-muted-foreground">
        {counts.matched} eşleşti · {counts.created} yeni · {counts.skipped} atlandı · {counts.pending}{' '}
        beklemede
      </p>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void save()}>
          {busy ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
        </Button>
        <Button variant="ghost" asChild>
          <Link href={draft.barcode ? `/urun/${draft.barcode}` : '/urunler'}>Vazgeç</Link>
        </Button>
      </div>
    </div>
  )
}
