import { ChevronsUpDown } from 'lucide-react'

import { useTeam } from '@/features/teams/TeamContext'
import { Button } from '@/components/ui/button'

/**
 * Seletor de equipe ativa (FR-011). Implementação completa em US1 (T027);
 * por ora exibe a equipe vigente e navega para /equipes.
 */
export function TeamSwitcher() {
  const { activeTeam } = useTeam()
  return (
    <Button variant="outline" size="sm" className="max-w-40 gap-1 truncate" asChild>
      <a href="/equipes">
        <span className="truncate">{activeTeam?.name ?? 'Sem equipe'}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </a>
    </Button>
  )
}
