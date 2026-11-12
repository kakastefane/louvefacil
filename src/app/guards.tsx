import { Navigate, useLocation } from 'react-router'
import type { ReactNode } from 'react'

import { LoadingState } from '@/components/shared/states'
import { useAuth } from '@/hooks/useAuth'
import { useTeam } from '@/features/teams/TeamContext'
import { isConfigured } from '@/lib/env'
import { canEdit, type TeamRole } from '@/types/domain'

/** Sem env do Supabase → /setup (modo "não configurado", D-7). */
export function RequireConfig({ children }: { children: ReactNode }) {
  if (!isConfigured) return <Navigate to="/setup" replace />
  return children
}

/** Rota protegida: exige sessão (redireciona com destino preservado). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingState fullScreen />
  if (!user) {
    const target = encodeURIComponent(
      location.pathname + location.search,
    )
    return <Navigate to={`/login?redirect=${target}`} replace />
  }
  return children
}

/** Exige equipe ativa (usuário autenticado sem equipe → /equipes). */
export function RequireTeam({ children }: { children: ReactNode }) {
  const { activeTeam, loading } = useTeam()

  if (loading) return <LoadingState fullScreen />
  if (!activeTeam) return <Navigate to="/equipes" replace />
  return children
}

/** Exige papel editor/dono para ações de escrita (FR-006/FR-029). */
export function RequireEditor({ children }: { children: ReactNode }) {
  const { activeMember } = useTeam()
  const role: TeamRole | null = activeMember?.role ?? null

  if (role && !canEdit(role)) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <h1 className="text-lg font-semibold">Sem permissão</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Apenas donos e editores podem criar ou alterar conteúdo. Você tem o
          papel de <strong>{role === 'member' ? 'membro (somente leitura)' : role}</strong>.
        </p>
      </div>
    )
  }
  return children
}
