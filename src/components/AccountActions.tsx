'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'

/**
 * Kendi profilindeki hesap işlemleri: katkı kısayolu + çıkış (ADR 0026 — her rol katkı verir).
 * Yalnız profil sahibine görünür; başkasının profilinde null döner.
 * Çıkış sonrası giriş sayfasına yönlendirilir.
 */
export function AccountActions({ profileId }: { profileId: string }) {
  const router = useRouter()
  const { user, signOut } = useSession()

  if (!user || String(user.id) !== profileId) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href="/katki">Katkı yap</Link>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          signOut()
          router.replace('/giris')
        }}
      >
        Çıkış yap
      </Button>
    </div>
  )
}
