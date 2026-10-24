'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { CORPORATE_ROLES, useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'
import { TextField, WizardIntro } from '@/components/wizard/controls'
import { ApiError } from '@/lib/wizard/api'

/** Payload hesabıyla web girişi (mobildeki Profil ekranının web karşılığı). */
export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, busy, restoring, canAddProduct, signIn, signOut } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [failure, setFailure] = useState<string | null>(null)

  const next = searchParams.get('next') || '/ekle'
  const corporate = Boolean(user && CORPORATE_ROLES.includes(user.role))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setFailure(null)
    try {
      await signIn(email.trim(), password)
      router.replace(next.startsWith('/') ? next : '/ekle')
    } catch (error) {
      setFailure(
        error instanceof ApiError && error.kind === 'unauthorized'
          ? 'E-posta veya şifre hatalı.'
          : 'Giriş yapılamadı. Bağlantını kontrol et.',
      )
    }
  }

  if (restoring) {
    return <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">Oturum okunuyor…</p>
  }

  if (user) {
    return (
      <div className="flex flex-col gap-4">
        <CaseCard className="flex flex-col gap-2 p-5">
          <EvidenceTag variant="evidence">OTURUM</EvidenceTag>
          <p className="font-display text-xl">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="flex flex-wrap gap-2">
            <EvidenceTag variant={corporate ? 'stamp' : 'default'}>{user.role}</EvidenceTag>
            {corporate ? <EvidenceTag variant="tape">Ürün ekleyebilir</EvidenceTag> : null}
          </div>
        </CaseCard>

        {corporate ? (
          <>
            <Button asChild className="w-fit">
              <Link href="/ekle">Ekle ekranına git</Link>
            </Button>
            <Button variant="outline" asChild className="w-fit">
              <Link href="/saglayici">Yapay zekâ sağlayıcısı</Link>
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Bu rolle ürün eklenemez; okuma yüzeyleri açık kalır.
          </p>
        )}

        <Button variant="ghost" className="w-fit" onClick={() => signOut()}>
          Çıkış yap
        </Button>
      </div>
    )
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <WizardIntro eyebrow="SİSTEM KULLANICISI" title="Giriş">
        Payload hesabınla giriş yap. Yalnız admin ve editör rolleri ürün ekleyip düzenleyebilir; diğer
        kullanıcılar tarama ve okuma yüzeylerini kullanmaya devam eder.
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
      <Button type="submit" className="w-fit" disabled={busy || !email || !password}>
        {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
      </Button>
    </form>
  )
}
