import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { listMyMemberships } from '@/db/repos/teams'
import { db } from '@/db/dexie'
import { useAuth } from '@/hooks/useAuth'
import type { Team, TeamMember } from '@/types/domain'

const ACTIVE_TEAM_KEY = 'louve-facil:activeTeamId'

interface TeamContextValue {
  memberships: { member: TeamMember; team: Team }[]
  activeTeam: Team | null
  activeMember: TeamMember | null
  loading: boolean
  setActiveTeamId: (teamId: string) => void
  refresh: () => Promise<void>
}

const TeamContext = createContext<TeamContextValue | null>(null)

/**
 * Equipes do usuário + equipe ativa (FR-011). Trocar de equipe limpa os
 * caches de conteúdo para nunca misturar dados de equipes diferentes.
 */
export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [memberships, setMemberships] = useState<
    { member: TeamMember; team: Team }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_TEAM_KEY),
  )

  const refresh = useCallback(async () => {
    try {
      const list = await listMyMemberships()
      setMemberships(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setMemberships([])
      setLoading(false)
      return
    }
    setLoading(true)
    void refresh()
  }, [user, refresh])

  // equipe ativa válida: a escolhida, senão a primeira disponível
  useEffect(() => {
    if (memberships.length === 0) return
    const exists = memberships.some((m) => m.team.id === activeTeamId)
    if (!exists) {
      const first = memberships[0].team.id
      setActiveTeamIdState(first)
      localStorage.setItem(ACTIVE_TEAM_KEY, first)
    }
  }, [memberships, activeTeamId])

  const setActiveTeamId = useCallback((teamId: string) => {
    localStorage.setItem(ACTIVE_TEAM_KEY, teamId)
    setActiveTeamIdState(teamId)
    // troca de equipe: zera caches de conteúdo (FR-011)
    void db.transaction(
      'rw',
      db.songs,
      db.setlists,
      db.setlistItems,
      async () => {
        await Promise.all([
          db.songs.clear(),
          db.setlists.clear(),
          db.setlistItems.clear(),
        ])
      },
    )
  }, [])

  const value = useMemo<TeamContextValue>(() => {
    const active = memberships.find((m) => m.team.id === activeTeamId)
    return {
      memberships,
      activeTeam: active?.team ?? null,
      activeMember: active?.member ?? null,
      loading,
      setActiveTeamId,
      refresh,
    }
  }, [memberships, activeTeamId, loading, setActiveTeamId, refresh])

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>
}

export function useTeam(): TeamContextValue {
  const ctx = useContext(TeamContext)
  if (!ctx) throw new Error('useTeam deve ser usado dentro de TeamProvider')
  return ctx
}
