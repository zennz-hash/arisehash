import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { api } from '../api.js'

const AuthContext = createContext(null)
const SESSION_KEY = 'arisehash_session'

const avatarFor = (name) =>
  (name || 'U')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

const withInitials = (u) => (u ? { ...u, initials: avatarFor(u.name) } : null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  // Saat mount: jika ada token, validasi ke backend (/me) & ambil profil terbaru.
  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        const cached = JSON.parse(localStorage.getItem(SESSION_KEY))
        if (cached) setUser(withInitials(cached))
      } catch { /* ignore */ }

      try {
        const { user: fresh } = await api.me()
        if (!cancelled) {
          setUser(withInitials(fresh))
          localStorage.setItem(SESSION_KEY, JSON.stringify(fresh))
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem(SESSION_KEY)
          setUser(null)
        }
      }
      if (!cancelled) setReady(true)
    }
    boot()
    return () => { cancelled = true }
  }, [])

  // Login Google: kirim credential JWT GSI ke backend untuk diverifikasi.
  const loginWithGoogle = useCallback(async (credential) => {
    const { user: u } = await api.googleLogin(credential)
    localStorage.setItem(SESSION_KEY, JSON.stringify(u))
    setUser(withInitials(u))
    return u
  }, [])

  const logout = useCallback(async () => {
    try { await api.logout() } catch { /* ignore server logout failures */ }
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  // Merge fresh user fields (e.g. after profile update) into state + cache.
  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      const next = withInitials({ ...(prev || {}), ...patch })
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ user, ready, isAdmin: user?.role === 'ADMIN', loginWithGoogle, logout, updateUser }),
    [user, ready, loginWithGoogle, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
