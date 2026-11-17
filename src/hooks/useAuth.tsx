import type { User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { getSupabase, requireSupabase } from '@/lib/supabase'
import { clearAllCaches } from '@/db/dexie'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Sessão com Supabase Auth (e-mail/senha no MVP — FR-001..FR-004).
 * Logout limpa o cache local (T049: troca de conta não vaza conteúdo).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => Boolean(getSupabase()))

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return

    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'SIGNED_OUT') {
        void clearAllCaches()
      }
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      const supabase = requireSupabase()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name.trim() },
          // O e-mail de confirmação deve voltar para o app que a pessoa está
          // usando (produção ou localhost). Sem isso o Supabase usa o "Site
          // URL" do projeto e pode cair em localhost. Esse destino também
          // precisa estar em Authentication → URL Configuration → Redirect
          // URLs no painel do Supabase.
          emailRedirectTo:
            typeof window === 'undefined'
              ? undefined
              : `${window.location.origin}/biblioteca`,
        },
      })
      if (error) throw error
      return { needsConfirmation: data.session === null }
    },
    [],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = requireSupabase()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const supabase = requireSupabase()
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    await clearAllCaches()
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const supabase = requireSupabase()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/recuperar-senha`,
    })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const supabase = requireSupabase()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signOut,
        requestPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
