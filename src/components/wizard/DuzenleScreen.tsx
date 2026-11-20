'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'
import { AnalysisSummary } from '@/components/wizard/AnalysisSummary'
import { Chip, TextField, WizardIntro } from '@/components/wizard/controls'
import { MasterResolver } from '@/components/wizard/MasterResolver'
import { PhotoRequests } from '@/components/wizard/PhotoRequests'
import { PhotoTray } from '@/components/wizard/PhotoTray'
import { analyzeProduct } from '@/lib/wizard/ai'
import { fetchProductDoc, findProductByBarcode } from '@/lib/wizard/api'
import { PHOTO_ROLE_NAMES } from '@/lib/wizard/labels'
import { getPhotoBlob, putPhotoBlob } from '@/lib/wizard/photoStore'
import {
  draftFromProduct,
  forgetPhoto,
  mergeExtraction,
  resolutionCounts,
  type Draft,
  type ProductForm,
} from '@/lib/wizard/productDraft'
import {
  blobToBase64,
  preparePhoto,
  resolveCreatedMasters,
  saveProductEdits,
  type UploadablePhoto,
} from '@/lib/wizard/productWrite'
import { userMessage } from '@/lib/userMessages'

function describe(error: unknown): string {
  return userMessage(error, 'Bilinmeyen hata. Tekrar dene.')
}

/**
 * Mevcut ürünü düzenleme yüzeyi (ADR 0009, web uyarlaması). Form doğrudan `depth=2` ham
 * dokümandan doldurulur; kayıt form değerlerinin üzerine yazar.
 */
export function DuzenleScreen({ productId }: { productId: string }) {
  const router = useRouter()
  const { user, token, isPanel, restoring } = useSession()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dropped, setDropped] = useState<string[]>([])
  const [saved, setSaved] = useState<{ barcode: string; published: boolean } | null>(null)
  /** Yüklenen dosyanın barkodu: doğrulama yalnız barkod değiştiğinde uygulanır. */
  const [originalBarcode, setOriginalBarcode] = useState('')
  /** Fotoğraflardan etiket okuma: yalnız boş alanları doldurur (ADR 0034). */
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisNote, setAnalysisNote] = useState<string | null>(null)
  /** Bu oturumda fotoğraf eklendi ve analiz henüz yapılmadı: ekleme bitince kendiliğinden okunur. */
  const autoAnalyze = useRef(false)

  useEffect(() => {
    if (!isPanel || !productId || !token) return
    let active = true
    fetchProductDoc(productId, token)
      .then((doc) => {
        if (!active) return
        if (!doc) {
          setLoadError('Bu ürün bulunamadı. Silinmiş olabilir.')
          return
        }
        const next = draftFromProduct(doc)
        setDraft(next)
        setOriginalBarcode(next.barcode)
      })
      .catch((error: unknown) => {
        if (active) setLoadError(describe(error))
      })
    return () => {
      active = false
    }
  }, [isPanel, productId, token])

  const editForm = useCallback((form: ProductForm, field?: string) => {
    setDraft((current) => {
      if (!current) return current
      const touched =
        field && !current.touched.includes(field) ? [...current.touched, field] : current.touched
      return { ...current, form, touched }
    })
  }, [])

  /** Barkod kimliği taslakta ve formda ayrı durur; ikisi birlikte yazılır. */
  const setBarcode = useCallback((digits: string) => {
    setDraft((current) => {
      if (!current) return current
      const touched = current.touched.includes('barcode')
        ? current.touched
        : [...current.touched, 'barcode']
      return { ...current, barcode: digits, form: { ...current.form, barcode: digits }, touched }
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
      // Eklenen her fotoğraf partisi kendiliğinden okunur; sonuç yalnız boş alanları doldurur.
      autoAnalyze.current = true
    } catch (error) {
      const message = `Fotoğraf hazırlanamadı: ${describe(error)}`
      setFailure(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  /**
   * Eklenen fotoğraflardan etiket okur; sonuç `fill-missing` ile birleşir: kayıtlı ürünün
   * dolu alanları korunur, yalnız boş alanlar doldurulur (ADR 0034).
   */
  async function analyze() {
    if (!draft || !token || !draft.photos.length || analyzing) return
    setFailure(null)
    setAnalysisNote(null)
    setAnalyzing(true)
    try {
      const images: { index: number; base64: string }[] = []
      for (const [index, photo] of draft.photos.entries()) {
        const blob = await getPhotoBlob(photo.id)
        if (!blob) throw new Error('Bir fotoğraf okunamadı. Kaldırıp yeniden ekle.')
        images.push({ index, base64: await blobToBase64(blob) })
      }
      const result = await analyzeProduct({ token, images, previous: null, hints: [] })
      setDraft((current) =>
        current ? mergeExtraction(current, result.data, { mode: 'fill-missing' }) : current,
      )
      const requests = result.data.requests.length
      setAnalysisNote(
        `Etiket okuması tamamlandı: yalnız boş alanlar dolduruldu, dolu alanlar korundu.${
          requests ? ` ${requests} eksik fotoğraf talebi var.` : ''
        }`,
      )
      toast.success('Etiket okuması tamamlandı; eksik alanlar dolduruldu.')
    } catch (error) {
      const message = describe(error)
      setFailure(message)
      toast.error(message)
    } finally {
      setAnalyzing(false)
    }
  }

  /**
   * Fotoğraf eklenince analiz kendiliğinden başlar; düğme yalnız elle yeniden çalıştırmak için.
   */
  useEffect(() => {
    if (!autoAnalyze.current || !draft || !draft.photos.length || analyzing) return
    autoAnalyze.current = false
    void analyze()
    // `analyze` her render'da yeniden kurulur; bayrak ikinci çalıştırmayı engeller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, analyzing])

  async function save() {
    if (!draft || !token) return
    setFailure(null)
    setBusy(true)
    try {
      const digits = draft.form.barcode.trim()
      // Barkod değişmediyse eski değer olduğu gibi gönderilir (eski kayıtların biçimi
      // bu ekranın sorunu değil); değiştiyse geçerlilik ve tekillik burada sınanır.
      if (digits !== originalBarcode) {
        if (!/^\d{8,14}$/.test(digits)) {
          const message = 'Barkod 8–14 hane olmalı (yalnız rakam). Kaydetmeden önce düzelt.'
          setFailure(message)
          toast.error(message)
          return
        }
        // Barkod tekil: başka bir dosyaya ait kodu yazmak sunucuda unique hatası verir.
        // Hata mesajını anlaşılır kılmak için çakışma önceden sorulur.
        const clash = await findProductByBarcode(digits, token)
        if (clash && String(clash.id) !== String(draft.productId)) {
          const message = `${digits} barkodu başka bir ürün dosyasında kayıtlı.`
          setFailure(message)
          toast.error(message)
          return
        }
      }

      const resolved = await resolveCreatedMasters(draft, token)
      if (resolved.errors.length) {
        const message = `Bazı kayıtlar oluşturulamadı: ${resolved.errors.map((error) => error.message).join(' · ')}`
        setFailure(message)
        toast.error(message)
        setDraft(resolved.draft)
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

      const outcome = await saveProductEdits(resolved.draft, token, photos)
      setDropped(outcome.dropped)
      for (const photo of resolved.draft.photos) {
        await forgetPhoto(photo)
      }
      setSaved({ barcode: resolved.draft.barcode, published: resolved.draft.form.isPublished })
      toast.success('Değişiklikler kaydedildi.')
      router.refresh()
    } catch (error) {
      const message = describe(error)
      setFailure(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  if (restoring || (isPanel && !draft && !loadError)) {
    return (
      <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
        Ürün ve oturum hazırlanıyor…
      </p>
    )
  }

  if (!isPanel) {
    return (
      <CaseCard className="flex flex-col gap-3 p-5">
        <EvidenceTag variant="stamp">YETKİ</EvidenceTag>
        <WizardIntro eyebrow="DÜZENLEME" title="Bu ekran rolüne kapalı">
          {user
            ? `${user.role} rolüyle ürün düzenlenemez. Admin ya da editör hesabıyla giriş yap.`
            : 'Admin ya da editör hesabıyla giriş yapman gerekiyor.'}
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
              : 'Değişiklikler kaydedildi ama ürün taslak. Dosya yalnız yayındayken açılır.'}
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
          Kaydettiğinde formdaki değerler ürünün üzerine yazılır; boş bıraktığın alanlar silinir. Yeni
          fotoğraf eklemezsen mevcut görseller ve fiyat geçmişi korunur. Eklediğin fotoğrafları
          yapay zekâya okutup yalnız boş alanları doldurabilirsin.
        </p>
        <TextField
          label="Barkod (8–14 hane)"
          value={draft.form.barcode}
          inputMode="numeric"
          placeholder="8690123456789"
          hint="Barkodu değiştirirsen ürünün adresi de yeni barkoda taşınır; eski bağlantı açılmaz."
          onChange={(value) => setBarcode(value.replace(/\D/g, '').slice(0, 14))}
        />
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
      {busy || analyzing ? (
        <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
          {analyzing ? 'Etiket okunuyor…' : 'Kaydediliyor…'}
        </p>
      ) : null}
      {analysisNote ? <p className="text-sm text-evidence-green">{analysisNote}</p> : null}

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
          YENİ FOTOĞRAF (İSTEĞE BAĞLI)
        </span>
        <PhotoTray
          photos={draft.photos}
          disabled={busy || analyzing}
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
        {draft.photos.length ? (
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={busy || analyzing}
              onClick={() => void analyze()}
            >
              {analyzing
                ? 'Etiket okunuyor…'
                : draft.extraction
                  ? 'Fotoğrafları yeniden analiz et'
                  : 'Fotoğrafları analiz et · eksikleri doldur'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Yapay zekâ fotoğraflardaki etiketi okur ve yalnız boş alanları doldurur. Dolu
              alanlara, eşleşmelere ve ürünün barkoduna dokunmaz; sonucu kaydetmeden önce
              gözden geçir.
            </p>
          </div>
        ) : null}
      </div>

      {draft.extraction ? <PhotoRequests requests={draft.extraction.requests} /> : null}

      <AnalysisSummary form={draft.form} touched={draft.touched} mode="edit" onEdit={editForm} />
      <MasterResolver form={draft.form} onEdit={editForm} />

      <p className="text-sm text-muted-foreground">
        {counts.matched} eşleşti · {counts.created} yeni · {counts.skipped} atlandı · {counts.pending}{' '}
        beklemede
      </p>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || analyzing} onClick={() => void save()}>
          {busy ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
        </Button>
        <Button variant="ghost" asChild>
          <Link href={draft.barcode ? `/urun/${draft.barcode}` : '/urunler'}>Vazgeç</Link>
        </Button>
      </div>
    </div>
  )
}
