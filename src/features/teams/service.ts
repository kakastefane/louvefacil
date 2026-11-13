import { requireSupabase } from '@/lib/supabase'
import { assertOnline } from '@/lib/utils'
import type { Team } from '@/types/domain'
import { listMyMemberships } from '@/db/repos/teams'

/**
 * Service de equipes (FR-011). A criação é online-only via RPC
 * SECURITY DEFINER `create_team`, que insere equipe + vínculo owner
 * atômicos no banco (único caminho permitido para `team_members`).
 * A listagem é read-through e vive no repositório — apenas reexportada.
 */

export { listMyMemberships } from '@/db/repos/teams'

/**
 * Cria uma equipe e o vínculo `owner` do usuário logado. Retorna o id
 * (uuid) da equipe e revalida o cache de memberships pela rede, para a
 * nova equipe aparecer sem precisar recarregar.
 */
export async function createTeam(
  name: string,
  displayName: string,
): Promise<string> {
  assertOnline()
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('create_team', {
    p_name: name,
    p_display_name: displayName,
  })
  if (error) throw error
  const teamId = data as string

  // sincroniza o cache local com a nova equipe + vínculo criados no servidor
  await listMyMemberships()

  return teamId
}

/** Dados da equipe a partir do id (usa o cache já sincronizado). */
export async function getTeamById(teamId: string): Promise<Team | null> {
  const memberships = await listMyMemberships()
  const found = memberships.find((m) => m.team.id === teamId)
  return found?.team ?? null
}
