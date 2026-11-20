'use client'

import { useEffect, useRef } from 'react'

/**
 * Google Identity Services (GIS) düğmesi.
 *
 * Google'ın resmî `<script>` istemcisini yükler ve `renderButton` ile markalı düğmeyi basar;
 * düğme bir ID token üretir (`credential`). Oturum açma işini `onCredential` yapar.
 * `NEXT_PUBLIC_GOOGLE_CLIENT_ID` tanımlı değilse hiçbir şey basılmaz.
 */

type GoogleCredentialResponse = { credential?: string }

type GoogleAccounts = {
  id: {
    initialize: (options: {
      client_id: string
      callback: (response: GoogleCredentialResponse) => void
      ux_mode?: 'popup' | 'redirect'
      auto_select?: boolean
      cancel_on_tap_outside?: boolean
    }) => void
    renderButton: (
      parent: HTMLElement,
      options: {
        type?: 'standard' | 'icon'
        theme?: 'outline' | 'filled_blue' | 'filled_black'
        size?: 'large' | 'medium' | 'small'
        text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
        shape?: 'rectangular' | 'pill' | 'circle' | 'square'
        locale?: string
        width?: number
      },
    ) => void
  }
}

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts }
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let loader: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  if (loader) return loader
  // tsconfig `lib` ES2022: `Promise.withResolvers` tipi yok; çalışma zamanında da gerekmiyor.
  loader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      loader = null
      script.remove()
      reject(new Error('Google Identity Services yüklenemedi'))
    }
    document.head.appendChild(script)
  })
  return loader
}

/** Google düğmesinin genişliği 200–400 px olmak zorunda; dar ekranda kapsayıcıya sığdırılır. */
function buttonWidth(container: HTMLElement): number {
  const available = container.clientWidth || 320
  return Math.max(200, Math.min(400, Math.floor(available)))
}

export function GoogleSignInButton({
  onCredential,
  disabled = false,
}: {
  onCredential: (credential: string) => void
  disabled?: boolean
}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const containerRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onCredential)
  callbackRef.current = onCredential

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    let lastWidth = 0

    const render = async () => {
      await loadGoogleScript()
      const container = containerRef.current
      const accounts = window.google?.accounts
      if (cancelled || !container || !accounts) return

      const width = buttonWidth(container)
      if (width === lastWidth) return
      lastWidth = width
      accounts.id.initialize({
        client_id: clientId,
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: (response) => {
          if (response.credential) callbackRef.current(response.credential)
        },
      })
      container.replaceChildren()
      accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        locale: 'tr',
        width,
      })
    }

    render().catch(() => {
      // Betik yüklenemedi (çevrimdışı / engelleyici): düğme basılmaz, şifreli giriş çalışır.
    })

    const onResize = () => {
      void render().catch(() => {})
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
    }
  }, [clientId])

  if (!clientId) return null

  return (
    <div
      ref={containerRef}
      // GIS iframe'i kendi genişliğini taşır; dar ekranda taşmayı kırp.
      className="min-h-11 max-w-full overflow-hidden [&>div]:!w-full"
      aria-disabled={disabled}
    />
  )
}
