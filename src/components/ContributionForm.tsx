'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { CameraCapture } from '@/components/CameraCapture'
import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'
import { submitContribution } from '@/lib/wizard/api'
import { resizeImage } from '@/lib/wizard/productWrite'
import { userMessage } from '@/lib/userMessages'

/** Katkı fotoğrafı sınırı (sunucu da `CONTRIBUTION_PHOTOS` ile aynı sınırı uygular). */
const MAX_PHOTOS = 6

type Picked = { id: string; blob: Blob; url: string }

function describe(error: unknown): string {
  return userMessage(error, 'Katkı gönderilemedi. Tekrar dene.')
}

/**
 * Katkı formu (ADR 0024): taramada bulunamayan barkod için fotoğraf gönderimi.
 * Ürün taslak olarak açılır; yayına alınınca profilde "Katkılarım" altında görünür.
 */
export function ContributionForm({ barcode }: { barcode: string }) {
  const pathname = usePathname()
  const { user, token, restoring } = useSession()
  const [photos, setPhotos] = useState<Picked[]>([])
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const galleryInput = useRef<HTMLInputElement>(null)

  async function addFiles(picked: File[]) {
    if (picked.length === 0) return
    setFailure(null)
    const room = MAX_PHOTOS - photos.length
    if (room <= 0) {
      const message = `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin.`
      setFailure(message)
      toast.error(message)
      return
    }
    setBusy(true)
    try {
      const next: Picked[] = []
      for (const file of picked.slice(0, room)) {
        if (!file.type.startsWith('image/')) continue
        const resized = await resizeImage(file)
        next.push({
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          blob: resized.blob,
          url: URL.createObjectURL(resized.blob),
        })
      }
      setPhotos((current) => [...current, ...next].slice(0, MAX_PHOTOS))
      if (picked.length > room) {
        const message = `Yalnız ilk ${room} fotoğraf eklendi; en fazla ${MAX_PHOTOS} fotoğraf gönderilebilir.`
        setFailure(message)
        toast.error(message)
      }
    } catch (error) {
      const message = describe(error)
      setFailure(message)
      toast.error(message)
    } finally {
      setBusy(false)
      if (galleryInput.current) galleryInput.current.value = ''
    }
  }

  function remove(id: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return current.filter((photo) => photo.id !== id)
    })
  }

  function move(id: string, direction: -1 | 1) {
    setPhotos((current) => {
      const index = current.findIndex((photo) => photo.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      const [row] = next.splice(index, 1)
      next.splice(target, 0, row)
      return next
    })
  }

  async function send() {
    if (!token) return
    setFailure(null)
    setBusy(true)
    try {
      await submitContribution(
        barcode,
        photos.map((photo) => photo.blob),
        token,
      )
      photos.forEach((photo) => URL.revokeObjectURL(photo.url))
      setPhotos([])
      setDone(true)
      toast.success('Fotoğrafların incelemeye gönderildi. Onaylanınca profilinde görünecek.')
    } catch (error) {
      const message = describe(error)
      setFailure(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <CaseCard className="flex flex-col items-start gap-3 p-5">
        <EvidenceTag variant="stamp">İNCELEMEDE</EvidenceTag>
        <h2 className="font-display text-xl">Ürün incelemeye alındı</h2>
        <p className="text-sm text-muted-foreground">
          {barcode} barkoduyla açtığın dosya editör incelemesinde. Onaylandığında profilinde
          görünecek.
        </p>
        <div className="flex flex-wrap gap-2">
          {user ? (
            <Button asChild>
              <Link href={`/profil/${user.id}`}>Profilime git</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/tara">Taramaya dön</Link>
          </Button>
        </div>
      </CaseCard>
    )
  }

  if (restoring) {
    return (
      <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
        Oturum okunuyor…
      </p>
    )
  }

  if (!user) {
    return (
      <CaseCard className="flex flex-col items-start gap-3 p-5">
        <EvidenceTag variant="stamp">GİRİŞ GEREKLİ</EvidenceTag>
        <h2 className="font-display text-xl">Katkı için hesap gerekli</h2>
        <p className="text-sm text-muted-foreground">
          Fotoğraf göndermek için giriş yapmalısın; katkın kendi profilinde görünecek.
        </p>
        <Button asChild>
          <Link href={`/giris?next=${encodeURIComponent(pathname || `/katki/${barcode}`)}`}>
            Giriş yap
          </Link>
        </Button>
      </CaseCard>
    )
  }

  return (
    <CaseCard className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <EvidenceTag variant="tape">{barcode}</EvidenceTag>
        <span className="font-mono text-[0.65rem] tracking-[0.14em] text-faded uppercase">
          {photos.length}/{MAX_PHOTOS} fotoğraf
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <li
            key={photo.id}
            className="relative overflow-hidden rounded-md border border-border bg-muted"
          >
            {/* Yerel önizleme (blob: URL): next/image yalnız sunucudaki medyayı optimize eder. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={`Katkı fotoğrafı ${index + 1}`} className="aspect-square w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-background/85 px-1.5 py-1">
              <span className="font-mono text-[0.6rem] tracking-[0.12em] uppercase text-muted-foreground">
                {index === 0 ? 'ÖN YÜZ' : index + 1}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  aria-label="Sola al"
                  disabled={index === 0}
                  onClick={() => move(photo.id, -1)}
                  className="rounded-sm px-1 text-xs text-muted-foreground disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="Sağa al"
                  disabled={index === photos.length - 1}
                  onClick={() => move(photo.id, 1)}
                  className="rounded-sm px-1 text-xs text-muted-foreground disabled:opacity-30"
                >
                  →
                </button>
                <button
                  type="button"
                  aria-label="Fotoğrafı sil"
                  onClick={() => remove(photo.id)}
                  className="rounded-sm px-1 text-xs text-stamp"
                >
                  ✕
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>

      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => void addFiles(Array.from(event.target.files ?? []))}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || photos.length >= MAX_PHOTOS}
          onClick={() => setCameraOpen(true)}
        >
          Fotoğraf çek
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || photos.length >= MAX_PHOTOS}
          onClick={() => galleryInput.current?.click()}
        >
          Galeriden seç
        </Button>
      </div>

      <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
        <li>İlk fotoğraf ürünün ön yüzü olsun. İçindekiler ve besin tablosunu ayrı karelerde çek.</li>
        <li>Fotoğraflar gönderildiğinde ürün incelemeye alınır, hemen yayına girmez.</li>
      </ul>

      {failure ? (
        <p role="alert" className="text-sm text-stamp">
          {failure}
        </p>
      ) : null}

      <Button type="button" disabled={busy || photos.length === 0} onClick={() => void send()}>
        {busy ? 'Gönderiliyor…' : 'Fotoğrafları gönder'}
      </Button>

      <CameraCapture
        open={cameraOpen}
        max={Math.max(0, MAX_PHOTOS - photos.length)}
        onClose={() => setCameraOpen(false)}
        onDone={(files) => {
          setCameraOpen(false)
          void addFiles(files)
        }}
      />
    </CaseCard>
  )
}
