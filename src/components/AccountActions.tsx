'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'

/**
 * Kendi profilindeki hesap işlemleri: çıkış.
 * Yalnız profil sahibine görünür; başkasının profilinde null döner.
 * Çıkış sonrası giriş sayfasına yönlendirilir.
 */
export function AccountActions({ profileId }: { profileId: string }) {
  const router = useRouter()
  const { user, signOut } = useSession()

  if (!user || String(user.id) !== profileId) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          signOut()
          toast.success('Çıkış yapıldı. Tekrar görüşmek üzere!')
          router.replace('/giris')
        }}
      >
        Çıkış yap
      </Button>
    </div>
  )
}
