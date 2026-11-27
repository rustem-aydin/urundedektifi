'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { CaseSection } from '@/components/CaseSection'
import type { ExpertAvatar } from '@/components/ExpertVerdicts'
import { ProductVerdictProvider, VerdictSection } from '@/components/ProductVerdicts'
import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'

/**
 * Uzman görüşleri oturum şartına bağlıdır (sahip isteği, 27 Kas 2026).
 *
 * Hüküm verisi kişiselleştirilmiştir (yalnız takip edilen uzmanlar), bu yüzden
 * misafir için istek de atılmaz: sağlayıcı yalnız oturum doğrulandıktan sonra
 * bağlanır. Oturum okunurken bölüm bugünkü yükleme metnini korur; oturum
 * yoksa görüşlerin yerine giriş çağrısı basılır.
 */

const SECTION_ID = 'gorusler'
const SECTION_TITLE = 'Uzman görüşleri'

export function SessionVerdictProvider({
  barcode,
  children,
}: {
  barcode: string
  children: ReactNode
}) {
  const { user, restoring } = useSession()
  // Misafirde sağlayıcı yok: `/api/products/verdict` isteği atılmaz, rozet de boş kalır.
  if (restoring || !user) return <>{children}</>
  return <ProductVerdictProvider barcode={barcode}>{children}</ProductVerdictProvider>
}

export function ExpertVerdictsSection({ avatars }: { avatars: Record<string, ExpertAvatar> }) {
  const { user, restoring } = useSession()
  const pathname = usePathname()

  if (restoring) {
    return (
      <CaseSection
        id={SECTION_ID}
        eyebrow="Dosya 01"
        title={SECTION_TITLE}
        hasData={false}
        emptyMessage="Görüşler yükleniyor…"
      >
        <></>
      </CaseSection>
    )
  }

  if (!user) {
    const next = pathname && pathname.startsWith('/') ? pathname : '/'
    // Misafir: görüşlerin kendisi basılmaz; tek paragraf + giriş bağlantısı.
    return (
      <CaseSection
        id={SECTION_ID}
        eyebrow="Dosya 01"
        title={SECTION_TITLE}
        hasData={false}
        emptyMessage="Uzmanların görüşlerini görmek için oturum açmanız gerekiyor."
        emptyAction={
          <Button asChild size="lg" className="px-4">
            <Link href={`/giris?next=${encodeURIComponent(next)}`}>Giriş yap</Link>
          </Button>
        }
      >
        <></>
      </CaseSection>
    )
  }

  return <VerdictSection avatars={avatars} />
}
