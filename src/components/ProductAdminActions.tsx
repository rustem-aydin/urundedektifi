'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'
import { ApiError, deleteProduct } from '@/lib/wizard/api'

/**
 * Ürün dosyasının kurumsal eylemleri (ADR 0009): yalnız admin/editör görür.
 * Mobil uygulamadaki Dosya ekranındaki "Düzenle"/"Sil" düğmelerinin web karşılığı.
 */
export function ProductAdminActions({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const { canAddProduct, token } = useSession()
  const [deleting, setDeleting] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  if (!canAddProduct) return null

  async function remove() {
    if (!token) return
    const confirmed = window.confirm(
      `${name} kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`,
    )
    if (!confirmed) return
    setDeleting(true)
    setFailure(null)
    try {
      await deleteProduct(id, token)
      router.push('/urunler')
      router.refresh()
    } catch (error) {
      setFailure(
        error instanceof ApiError || error instanceof Error ? error.message : 'Ürün silinemedi.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/duzenle/${id}`}>Düzenle</Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={deleting}
          onClick={() => void remove()}
        >
          {deleting ? 'Siliniyor…' : 'Sil'}
        </Button>
      </div>
      {failure ? <p className="text-xs text-stamp">{failure}</p> : null}
    </div>
  )
}
