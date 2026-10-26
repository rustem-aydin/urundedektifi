'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'
import { TextField, WizardIntro } from '@/components/wizard/controls'
import { ApiError } from '@/lib/wizard/api'

/**
 * Tüketici hesabı açma (web). Kayıt jeton döndürmez; kayıttan hemen sonra giriş yapılır.
 * Sunucu tarafında `users.create` herkese açıktır, rol hook'ta `user`'a sabitlenir.
 */
export function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, busy, restoring, signUp } = useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [failure, setFailure] = useState<string | null>(null)

  const next = searchParams.get('next') || '/'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setFailure(null)
    try {
      await signUp({ name: name.trim(), email: email.trim(), password })
      router.replace(next.startsWith('/') ? next : '/')
    } catch (error) {
      if (error instanceof ApiError && error.kind === 'server') {
        const conflict = /already|mevcut|unique/i.test(error.message)
        setFailure(conflict ? 'Bu e-posta ile bir hesap var.' : error.message)
      } else if (error instanceof ApiError && error.kind === 'unauthorized') {
        setFailure('Hesap açıldı ama giriş yapılamadı. Giriş sayfasından tekrar dene.')
      } else {
        setFailure('Hesap açılamadı. Bağlantını kontrol edip tekrar dene.')
      }
    }
  }

  if (restoring) {
    return (
      <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
        Oturum okunuyor…
      </p>
    )
  }

  if (user) {
    return (
      <CaseCard className="flex flex-col gap-3 p-5">
        <EvidenceTag variant="evidence">OTURUM AÇIK</EvidenceTag>
        <p className="font-display text-xl">{user.name}</p>
        <p className="text-sm text-muted-foreground">
          Zaten giriş yapmışsın. Takip ettiğin uzmanları profillerinden yönetebilirsin.
        </p>
        <Button asChild className="w-fit">
          <Link href="/uzmanlar">Uzmanlara git</Link>
        </Button>
      </CaseCard>
    )
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <WizardIntro eyebrow="HESAP" title="Hesap oluştur">
        Uzmanları takip et, yazılarını anasayfada hikâye rayında gör. Kayıt ücretsiz; ürün ekleme
        yetkisi vermez.
      </WizardIntro>
      <TextField
        label="Ad soyad"
        value={name}
        autoComplete="name"
        onChange={(value) => setName(value)}
      />
      <TextField
        label="E-posta"
        value={email}
        inputMode="email"
        autoComplete="email"
        onChange={(value) => setEmail(value.trim())}
      />
      <TextField
        label="Şifre"
        type="password"
        value={password}
        autoComplete="new-password"
        hint="En az 8 karakter önerilir."
        onChange={setPassword}
      />
      {failure ? (
        <p role="alert" className="text-sm text-stamp">
          {failure}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="w-fit" disabled={busy || !name || !email || !password}>
          {busy ? 'Hesap açılıyor…' : 'Hesap oluştur'}
        </Button>
        <Link
          href={`/giris${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Hesabın var mı? Giriş yap
        </Link>
      </div>
    </form>
  )
}
