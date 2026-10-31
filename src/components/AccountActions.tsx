'use client'

import Link from 'next/link'

import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'

/**
 * Kendi profilindeki hesap işlemleri: kurumsal kısayollar + çıkış.
 * Yalnız profil sahibine görünür; başkasının profilinde null döner.
 */
export function AccountActions({ profileId }: { profileId: string }) {
  const { user, canAddProduct, signOut } = useSession()

  if (!user || String(user.id) !== profileId) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canAddProduct ? (
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href="/ekle">Ekle ekranına git</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/saglayici">Yapay zekâ sağlayıcısı</Link>
          </Button>
        </>
      ) : null}
      <Button variant="ghost" size="sm" onClick={() => signOut()}>
        Çıkış yap
      </Button>
    </div>
  )
}
