'use client'

import { useEffect, useState } from 'react'

/**
 * Hesap silme paneli: Play mağaza girişindeki "Hesap silme URL'si" bu sayfayı gösterir.
 * Oturum jetonu `payload-token` localStorage'da durur (web oturumuyla aynı yer).
 */
export function DeleteAccountPanel() {
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setToken(localStorage.getItem('payload-token'))
    setReady(true)
  }, [])

  async function remove() {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      const base = (process.env.NEXT_PUBLIC_PAYLOAD_API_URL || '/api').replace(/\/+$/, '')
      const response = await fetch(`${base}/users/delete-account`, {
        method: 'POST',
        headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Hesap silinemedi. Tekrar dene.')
      }
      localStorage.removeItem('payload-token')
      setToken(null)
      setDone(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Hesap silinemedi. Tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return null

  if (done) {
    return (
      <p className="mt-6 rounded border border-border bg-card px-4 py-3 text-sm">
        Hesabınız ve kişisel verileriniz silindi. Uygulamayı kullanmaya devam etmek isterseniz
        yeni bir hesap açabilirsiniz.
      </p>
    )
  }

  if (!token) {
    return (
      <div className="mt-6 rounded border border-border bg-card px-4 py-3 text-sm">
        <p>Silmek istediğiniz hesaba giriş yapın, sonra bu sayfaya dönün.</p>
        <a
          href="/giris"
          className="mt-2 inline-block underline underline-offset-4 hover:text-foreground"
        >
          Giriş yap
        </a>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded border border-border bg-card px-4 py-3">
      <p className="text-sm">
        Bu tarayıcıda açık bir oturum var. Hesabı silmek istediğinizden eminseniz onaylayın.
      </p>
      <button
        type="button"
        onClick={() => void remove()}
        disabled={busy}
        className="mt-3 rounded bg-primary px-4 py-2 font-mono text-[0.7rem] tracking-[0.14em] text-white uppercase disabled:opacity-60"
      >
        {busy ? 'Siliniyor…' : 'Hesabı kalıcı olarak sil'}
      </button>
      {error ? <p className="mt-2 text-sm text-primary">{error}</p> : null}
    </div>
  )
}
