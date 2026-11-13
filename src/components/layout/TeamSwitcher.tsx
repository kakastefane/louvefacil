import { Check, ChevronsUpDown, Users } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'

import { useTeam } from '@/features/teams/TeamContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { TeamRole } from '@/types/domain'

/** Rótulos de papel (FR-029): restrições de papéis visíveis na UI. */
const ROLE_LABELS: Record<TeamRole, string> = {
  owner: 'Dono',
  editor: 'Editor',
  member: 'Membro',
}

/**
 * Rotas de conteúdo por equipe: ao trocar de equipe, o contexto já limpa os
 * caches de conteúdo, então redirecionamos para /biblioteca para re-render
 * da tela na nova equipe. Em /config a página observa activeTeam.
 */
const CONTENT_ROUTE_RE = /^\/(biblioteca(\/|$)|cifra(\/|$)|setlist(\/|$))/

const badgeClass = 'shrink-0 px-1.5 py-0 text-[10px]'

/**
 * Seletor de equipe ativa (FR-011 / T027). Dropdown com as equipes do
 * usuário marcando a ativa; trocar limpa os caches de conteúdo e, em rotas
 * de conteúdo, navega para /biblioteca. Mostra o papel do usuário (FR-029)
 * e degrada graciosamente quando ele não tem equipe nenhuma.
 */
export function TeamSwitcher() {
  const { memberships, activeTeam, activeMember, loading, setActiveTeamId } =
    useTeam()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const handleSelect = (teamId: string) => {
    if (teamId === activeTeam?.id) return
    // o TeamContext limpa os caches de conteúdo ao trocar (FR-011)
    setActiveTeamId(teamId)
    if (CONTENT_ROUTE_RE.test(pathname)) navigate('/biblioteca')
  }

  // sem equipe nenhuma: RequireTeam já redireciona para /equipes; aqui só
  // oferecemos o caminho de volta de forma acessível
  if (!loading && memberships.length === 0) {
    return (
      <Button variant="outline" size="sm" className="max-w-44 gap-1.5" asChild>
        <Link
          to="/equipes"
          aria-label="Sem equipe — ir para o gerenciamento de equipes"
        >
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Sem equipe</span>
        </Link>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="max-w-44 gap-1.5"
          disabled={loading}
          aria-label="Selecionar equipe ativa"
        >
          <span className="truncate">
            {loading ? 'Carregando…' : (activeTeam?.name ?? 'Sem equipe')}
          </span>
          {activeMember && (
            <Badge variant="secondary" className={badgeClass}>
              {ROLE_LABELS[activeMember.role]}
            </Badge>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Minhas equipes</DropdownMenuLabel>
        {memberships.map(({ member, team }) => {
          const active = team.id === activeTeam?.id
          return (
            <DropdownMenuItem
              key={team.id}
              onSelect={() => handleSelect(team.id)}
              aria-label={`Trocar para a equipe ${team.name}`}
              className="gap-2"
            >
              <span className="truncate">{team.name}</span>
              <Check
                className={cn('ml-auto h-4 w-4', !active && 'opacity-0')}
              />
              <Badge
                variant={active ? 'secondary' : 'outline'}
                className={badgeClass}
              >
                {ROLE_LABELS[member.role]}
              </Badge>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/equipes">
            <Users />
            Gerenciar equipes
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
