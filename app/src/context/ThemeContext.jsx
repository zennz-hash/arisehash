import { createContext, useContext, useEffect, useMemo } from 'react'

// AriseHash is dark-only. The provider just locks data-theme="dark".
const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  // Keep the same API shape so existing callers don't break.
  const value = useMemo(() => ({ theme: 'dark', setTheme: () => {}, toggleTheme: () => {} }), [])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) return { theme: 'dark', setTheme: () => {}, toggleTheme: () => {} }
  return ctx
}
