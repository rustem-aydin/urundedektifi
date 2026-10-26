'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { ApiError, fetchMe, login as requestLogin, register, updateFollowing } from '@/lib/wizard/api'
import { consumeFollow } from '@/lib/followIntent'
import type { FollowingRef, User, UserRole } from '@/lib/wizard/types'

/**
 * Web oturumu: Payload kullanıcısı + JWT.
 * Jeton, Payload admin panelinin de kullandığı `payload-token` anahtarında `localStorage`'da tutulur.
 * Ürün ekleme/düzenleme yetkisi admin + editördedir (ADR 0002).
 */

const TOKEN_KEY = 'payload-token'

export const CORPORATE_ROLES: UserRole[] = ['admin', 'editor']

/** `following` alanı derinliğe göre id ya da { id } döndürür; tek biçime indirilir. */
export function normalizeFollowing(refs: FollowingRef[] | null | undefined): string[] {
  return (refs ?? [])
    .map((ref) => (typeof ref === 'object' && ref !== null ? String(ref.id) : String(ref)))
    .filter(Boolean)
}

type SessionValue = {
  user: User | null
  token: string | null
  /** Jeton okunana kadar true: bu sırada kapı kararı vermeyiz. */
  restoring: boolean
  busy: boolean
  canAddProduct: boolean
  /** Takip edilen uzman kimlikleri (oturum sahibinin `users.following` alanı). */
  followingIds: string[]
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: { name: string; email: string; password: string }) => Promise<void>
  signOut: () => void
  isFollowing: (expertId: string | number) => boolean
  /** İyimser güncelleme; sunucu yazımı başarısızsa geri alınır. */
  toggleFollow: (expertId: string | number) => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [followingIds, setFollowingIds] = useState<string[]>([])
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
        setFollowingIds(normalizeFollowing(me.following))
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

  /** Girişsizken "Takip et"e basılmışsa giriş/kayıt sonrası takibi tamamlar. */
  const completePendingFollow = useCallback(async (current: User, sessionToken: string) => {
    const pending = consumeFollow()
    if (!pending) return
    const next = Array.from(new Set([...normalizeFollowing(current.following), pending]))
    try {
      await updateFollowing(current.id, next, sessionToken)
      setFollowingIds(next)
    } catch {
      // Niyet düştü; kullanıcı takibi profilden tekrar başlatabilir.
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setBusy(true)
    try {
      const result = await requestLogin(email, password)
      window.localStorage.setItem(TOKEN_KEY, result.token)
      setToken(result.token)
      setUser(result.user)
      setFollowingIds(normalizeFollowing(result.user.following))
      await completePendingFollow(result.user, result.token)
    } finally {
      setBusy(false)
    }
  }, [completePendingFollow])

  const signUp = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      setBusy(true)
      try {
        await register(input)
        const result = await requestLogin(input.email, input.password)
        window.localStorage.setItem(TOKEN_KEY, result.token)
        setToken(result.token)
        setUser(result.user)
        setFollowingIds(normalizeFollowing(result.user.following))
        await completePendingFollow(result.user, result.token)
      } finally {
        setBusy(false)
      }
    },
    [completePendingFollow],
  )

  const signOut = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    setFollowingIds([])
  }, [])

  const toggleFollow = useCallback(
    async (expertId: string | number) => {
      if (!user || !token) {
        throw new ApiError('unauthorized', 401, 'Takip etmek için giriş yapman gerekiyor.')
      }
      // API'den gelen ilişki kimlikleri sayı, listede tutulanlar dizedir: tek biçime indir.
      const id = String(expertId)
      const previous = followingIds
      const next = previous.includes(id)
        ? previous.filter((entry) => entry !== id)
        : [...previous, id]
      // İyimser: buton anında tepki verir, hata olursa geri alınır.
      setFollowingIds(next)
      try {
        await updateFollowing(user.id, next, token)
      } catch (error) {
        setFollowingIds(previous)
        throw error
      }
    },
    [followingIds, token, user],
  )

  const isFollowing = useCallback(
    (expertId: string | number) => followingIds.includes(String(expertId)),
    [followingIds],
  )

  const value = useMemo<SessionValue>(
    () => ({
      user,
      token,
      restoring,
      busy,
      canAddProduct: Boolean(user && CORPORATE_ROLES.includes(user.role)),
      followingIds,
      signIn,
      signUp,
      signOut,
      isFollowing,
      toggleFollow,
    }),
    [user, token, restoring, busy, followingIds, signIn, signUp, signOut, isFollowing, toggleFollow],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession, SessionProvider içinde kullanılmalı')
  return value
}
