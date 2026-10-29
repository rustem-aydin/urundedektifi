'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, updateProfile, uploadMedia } from '@/lib/wizard/api'

/**
 * Kendi profilini düzenleme (yalnız profil sahibine görünür).
 *
 * Herkese açık alanlar: ad, kısa tanıtım, avatar. E-posta/rol burada değişmez;
 * rol zaten alan düzeyinde admin'e kilitli. Avatar dosyası önce `/api/media`'ya
 * yüklenir, sonra kullanıcı dokümanına bağlanır.
 */
export function ProfileEditor({
  profileId,
  name,
  bio,
  avatarUrl,
}: {
  profileId: string
  name: string
  bio: string | null
  avatarUrl: string | null
}) {
  const { user, token, refreshUser } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nextName, setNextName] = useState(name)
  const [nextBio, setNextBio] = useState(bio ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  if (!user || !token || String(user.id) !== profileId) return null

  async function save() {
    setFailure(null)
    if (nextName.trim().length < 2) {
      setFailure('Ad en az 2 karakter olmalı.')
      return
    }
    setBusy(true)
    try {
      let avatarId: string | number | undefined
      if (file) {
        const media = await uploadMedia(file, file.name, token as string, nextName.trim())
        avatarId = media.id
      }
      await updateProfile(
        profileId,
        {
          name: nextName.trim(),
          bio: nextBio.trim() ? nextBio.trim() : null,
          ...(avatarId === undefined ? {} : { avatar: avatarId }),
        },
        token as string,
      )
      await refreshUser()
      // Sunucu bileşeni (profil sayfası) yeni ad/bio'yu yeniden çizsin.
      router.refresh()
      setFile(null)
      setOpen(false)
    } catch (error) {
      setFailure(
        error instanceof ApiError
          ? error.message || 'Profil kaydedilemedi.'
          : 'Profil kaydedilemedi. Tekrar dene.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          Profili düzenle
        </Button>
        <span className="font-mono text-[0.65rem] tracking-[0.16em] text-faded uppercase">
          {avatarUrl ? 'Avatar yüklü' : 'Avatar yok'}
        </span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Profili düzenle</DialogTitle>
            <DialogDescription>
              Bu alanlar herkese açık profilde görünür. E-posta adresin asla profilde gösterilmez.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-name">Ad Soyad</Label>
              <Input
                id="profile-name"
                value={nextName}
                maxLength={80}
                onChange={(event) => setNextName(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-bio">Kısa tanıtım</Label>
              <Textarea
                id="profile-bio"
                value={nextBio}
                maxLength={280}
                rows={4}
                placeholder="Örn. Etiket okumayı seven bir gönüllü."
                onChange={(event) => setNextBio(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{nextBio.length}/280</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-avatar">Profil fotoğrafı</Label>
              <Input
                id="profile-avatar"
                type="file"
                accept="image/*"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Kare format önerilir. Yükleme profil kaydedilince tamamlanır.
              </p>
            </div>

            {failure ? (
              <p className="rounded-md border border-stamp/50 bg-stamp/10 px-3 py-2 text-sm text-stamp">
                {failure}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Vazgeç
              </Button>
              <Button type="button" onClick={() => void save()} disabled={busy}>
                {busy ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
