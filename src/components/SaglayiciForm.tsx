'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'
import { WizardIntro } from '@/components/wizard/controls'
import { fetchProviderStatus, type ProviderStatus } from '@/lib/wizard/provider'

/**
 * Yapay zekâ sağlayıcısı (ADR 0008/0021): ayar tek merkezde, Payload panelindeki
 * `ai-settings` global'inde. Bu ekran yalnız durumu gösterir — anahtar tarayıcıya inmez,
 * model seçimi buradan yapılmaz.
 */
export function SaglayiciForm() {
  const { token, canAddProduct, restoring } = useSession()
  const [status, setStatus] = useState<ProviderStatus | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus({ configured: false, baseUrl: null, model: null })
      return
    }
    let active = true
    fetchProviderStatus(token)
      .then((next) => {
        if (active) setStatus(next)
      })
      .catch(() => {
        if (active) setStatus({ configured: false, baseUrl: null, model: null })
      })
    return () => {
      active = false
    }
  }, [token])

  if (restoring || status === null) {
    return <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">Ayarlar okunuyor…</p>
  }

  if (!canAddProduct) {
    return (
      <CaseCard className="flex flex-col gap-3 p-5">
        <EvidenceTag variant="stamp">YETKİ</EvidenceTag>
        <WizardIntro eyebrow="SAĞLAYICI" title="Bu ekran rolüne kapalı">
          Admin ya da editör hesabıyla giriş yap; sağlayıcı ayarı yalnız ürün ekleyen roller için
          gerekir.
        </WizardIntro>
        <Button asChild className="w-fit">
          <Link href={`/giris?next=${encodeURIComponent('/saglayici')}`}>Giriş ekranına git</Link>
        </Button>
      </CaseCard>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <CaseCard className="flex flex-col gap-2 p-4">
        <EvidenceTag variant={status.configured ? 'evidence' : 'stamp'}>YAPAY ZEKÂ</EvidenceTag>
        <WizardIntro
          eyebrow="SAĞLAYICI"
          title={status.configured ? 'Sağlayıcı hazır' : 'Sağlayıcı ayarlanmadı'}
        >
          {status.configured
            ? 'Ürün fotoğrafları sunucu üzerinden bu sağlayıcıya gönderilir. API anahtarı yalnız sunucuda tutulur.'
            : 'Ekle sihirbazının fotoğraf analizi çalışmadan önce yönetici sağlayıcıyı tanımlamalı.'}
        </WizardIntro>
      </CaseCard>

      {status.configured ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              SERVİS ADRESİ
            </dt>
            <dd className="break-all text-sm">{status.baseUrl}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">MODEL</dt>
            <dd className="break-all text-sm">{status.model}</dd>
          </div>
        </dl>
      ) : (
        <CaseCard className="flex flex-col gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            Yönetici panelinde <strong className="text-foreground">Sistem → Yapay zekâ sağlayıcısı</strong>{' '}
            bölümünü doldur: servis adresi, API anahtarı ve model. Ayar tüm istemciler (web + mobil)
            için geçerli olur.
          </p>
          <Button asChild className="w-fit">
            <a href="/admin/globals/ai-settings">Yönetim panelini aç</a>
          </Button>
        </CaseCard>
      )}

      <Button variant="ghost" asChild className="w-fit">
        <Link href="/ekle">Ekle ekranına dön</Link>
      </Button>
    </div>
  )
}
