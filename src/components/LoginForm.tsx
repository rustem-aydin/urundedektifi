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

/** Payload hesabıyla web girişi (mobildeki Profil ekranının web karşılığı). */
export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, busy, restoring, signIn } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [failure, setFailure] = useState<string | null>(null)

  const next = searchParams.get('next') || '/'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setFailure(null)
    try {
      await signIn(email.trim(), password)
      router.replace(next.startsWith('/') ? next : '/ekle')
    } catch (error) {
      setFailure(
        error instanceof ApiError && error.kind === 'unauthorized'
          ? 'E-posta ya da şifre hatalı.'
          : 'Giriş yapılamadı. Bağlantını kontrol edip tekrar dene.',
      )
    }
  }

  if (restoring) {
    return <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">Oturum okunuyor…</p>
  }

  if (user) {
    return (
      <CaseCard className="flex flex-col gap-2 p-5">
        <EvidenceTag variant="evidence">OTURUM</EvidenceTag>
        <p className="font-display text-xl">{user.name}</p>
        <p className="text-sm text-muted-foreground">
          Zaten giriş yapmış durumdasın. Hesap işlemleri (çıkış, kurumsal kısayollar) kendi
          profilinde.
        </p>
        <Button asChild variant="outline" className="w-fit">
          <Link href={`/profil/${user.id}`}>Profilime git</Link>
        </Button>
      </CaseCard>
    )
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <WizardIntro eyebrow="HESAP" title="Giriş">
        Hesabınla giriş yap. Uzmanları takip etmek ve yazılarını anasayfada görmek için ücretsiz
        hesap yeterli; ürün ekleme yalnız admin ve editör rollerine açık.
      </WizardIntro>
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
        autoComplete="current-password"
        onChange={setPassword}
      />
      {failure ? <p className="text-sm text-stamp">{failure}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="w-fit" disabled={busy || !email || !password}>
          {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </Button>
        <Link
          href={`/kayit${next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Hesabın yok mu? Hesap oluştur
        </Link>
      </div>
    </form>
  )
}
