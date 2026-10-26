'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'
import { Chip, TextField, WizardIntro } from '@/components/wizard/controls'
import { AiError, listModels } from '@/lib/wizard/ai'
import {
  readApiKey,
  readProviderSettings,
  writeApiKey,
  writeProviderSettings,
} from '@/lib/wizard/provider'

function maskKey(key: string): string {
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

function describe(error: unknown): string {
  if (error instanceof AiError) return error.message
  return error instanceof Error ? error.message : 'Bilinmeyen hata.'
}

/**
 * Yapay zekâ sağlayıcısı (ADR 0008): OpenAI uyumlu base URL + API anahtarı + model.
 * Anahtar `sessionStorage`'da tutulur (sekme kapanınca silinir) ve bir daha gösterilmez.
 */
export function SaglayiciForm() {
  const { canAddProduct, restoring } = useSession()
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [storedKey, setStoredKey] = useState<string | null>(null)
  const [model, setModel] = useState('')
  const [models, setModels] = useState<string[] | null>(null)
  const [manualModel, setManualModel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const settings = readProviderSettings()
    if (settings) {
      setBaseUrl(settings.baseUrl)
      setModel(settings.model)
    }
    setStoredKey(readApiKey())
    setLoaded(true)
  }, [])

  const effectiveKey = apiKey.trim() || storedKey || ''
  const canConnect = baseUrl.trim().length > 0 && effectiveKey.length > 0
  const canSave = canConnect && model.trim().length > 0

  const maskedKey = useMemo(() => (storedKey ? maskKey(storedKey) : null), [storedKey])

  async function fetchModels() {
    setFailure(null)
    setNotice(null)
    setBusy(true)
    try {
      const found = await listModels({ baseUrl, model }, effectiveKey)
      setModels(found)
      setManualModel(false)
      if (!found.length) {
        setNotice('Sağlayıcı model listesi döndürmedi. Model adını elle yaz.')
      } else if (!found.includes(model)) {
        setModel(found[0])
      }
    } catch (error) {
      setModels(null)
      setManualModel(true)
      setFailure('Model listesi alınamadı. Model adını elle yazabilirsin.')
    } finally {
      setBusy(false)
    }
  }

  function save() {
    setFailure(null)
    setNotice(null)
    try {
      if (apiKey.trim()) {
        writeApiKey(apiKey)
        setStoredKey(apiKey.trim())
        setApiKey('')
      }
      writeProviderSettings({ baseUrl, model })
      setNotice('Sağlayıcı kaydedildi. Ekle ekranındaki analiz artık bu sağlayıcıyı kullanıyor.')
    } catch (error) {
      setFailure(describe(error))
    }
  }

  if (restoring) {
    return <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">Oturum okunuyor…</p>
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

  if (!loaded) {
    return <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">Ayarlar okunuyor…</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <CaseCard className="flex flex-col gap-2 p-4">
        <EvidenceTag variant="evidence">YAPAY ZEKÂ</EvidenceTag>
        <WizardIntro eyebrow="SAĞLAYICI" title="OpenAI uyumlu servis">
          Ürün fotoğrafları bu adrese gönderilir. Adresi tam yaz (örn.
          https://api.openai.com/v1). Anahtar yalnız bu sekmede saklanır; sunucuya gitmez.
        </WizardIntro>
      </CaseCard>

      <TextField
        label="Servis adresi"
        value={baseUrl}
        placeholder="https://api.openai.com/v1"
        onChange={setBaseUrl}
      />
      <TextField
        label={maskedKey ? `API anahtarı (kayıtlı: ${maskedKey})` : 'API anahtarı'}
        type="password"
        value={apiKey}
        placeholder={maskedKey ? 'Yeni anahtar yazarsan eskisinin yerine geçer' : 'sk-…'}
        onChange={(value) => setApiKey(value.trim())}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy || !canConnect} onClick={() => void fetchModels()}>
          {busy ? 'Bağlanıyor…' : 'Modelleri getir'}
        </Button>
        {models === null && !manualModel ? (
          <Chip label="Modeli elle yaz" onClick={() => setManualModel(true)} />
        ) : null}
      </div>

      {models?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {models.slice(0, 30).map((id) => (
            <Chip key={id} label={id} selected={id === model} onClick={() => setModel(id)} />
          ))}
        </div>
      ) : null}

      {manualModel || !models?.length ? (
        <TextField
          label="Model"
          value={model}
          placeholder="gpt-4.1-mini, gemini-2.0-flash…"
          onChange={(value) => setModel(value.trim())}
        />
      ) : null}

      {failure ? <p className="text-sm text-stamp">{failure}</p> : null}
      {notice ? <p className="text-sm text-evidence-green">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!canSave} onClick={save}>
          Kaydet
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/ekle">Ekle ekranına dön</Link>
        </Button>
      </div>
    </div>
  )
}
