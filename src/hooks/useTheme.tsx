import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'louve-facil:theme'

interface ThemeContextValue {
  preference: ThemePreference
  setTheme: (preference: ThemePreference) => void
  /** Alterna claro/escuro fixando a escolha manual (FR-023). */
  toggle: () => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyPreference(preference: ThemePreference): boolean {
  const dark =
    preference === 'dark' ||
    (preference === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  return dark
}

function readPreference(): ThemePreference {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(readPreference)
  const [isDark, setIsDark] = useState(() => applyPreference(readPreference()))

  useEffect(() => {
    setIsDark(applyPreference(preference))
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (preference === 'system') setIsDark(applyPreference('system'))
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  const setTheme = useCallback((next: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, next)
    setPreferenceState(next)
  }, [])

  const toggle = useCallback(() => {
    const dark = document.documentElement.classList.contains('dark')
    setTheme(dark ? 'light' : 'dark')
  }, [setTheme])

  return (
    <ThemeContext.Provider value={{ preference, setTheme, toggle, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider')
  return ctx
}
