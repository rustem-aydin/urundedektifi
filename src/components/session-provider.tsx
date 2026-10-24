'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { ApiError, fetchMe, login as requestLogin } from '@/lib/wizard/api'
import type { User, UserRole } from '@/lib/wizard/types'

/**
 * Web oturumu: Payload kullanıcısı + JWT.
 * Jeton, Payload admin panelinin de kullandığı `payload-token` anahtarında `localStorage`'da tutulur.
 * Ürün ekleme/düzenleme yetkisi admin + editördedir (ADR 0002).
 */

const TOKEN_KEY = 'payload-token'

export const CORPORATE_ROLES: UserRole[] = ['admin', 'editor']

type SessionValue = {
  user: User | null
  token: string | null
  /** Jeton okunana kadar true: bu sırada kapı kararı vermeyiz. */
  restoring: boolean
  busy: boolean
  canAddProduct: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const stored = window.localStorage.getItem(TOKEN_KEY)
    if (!stored) {
      setRestoring(false)
      return
    }
    fetchMe(stored)
      .then((me) => {
        if (cancelled) return
        setToken(stored)
        setUser(me)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // Yalnız yetkisiz jetonu temizle; ağ hatasında oturumu düşürme.
        if (error instanceof ApiError && error.kind === 'unauthorized') {
          window.localStorage.removeItem(TOKEN_KEY)
        }
      })
      .finally(() => {
        if (!cancelled) setRestoring(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setBusy(true)
    try {
      const result = await requestLogin(email, password)
      window.localStorage.setItem(TOKEN_KEY, result.token)
      setToken(result.token)
      setUser(result.user)
    } finally {
      setBusy(false)
    }
  }, [])

  const signOut = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo<SessionValue>(
    () => ({
      user,
      token,
      restoring,
      busy,
      canAddProduct: Boolean(user && CORPORATE_ROLES.includes(user.role)),
      signIn,
      signOut,
    }),
    [user, token, restoring, busy, signIn, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession, SessionProvider içinde kullanılmalı')
  return value
}
