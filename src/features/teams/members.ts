import { requireSupabase } from '@/lib/supabase'
import { assertOnline } from '@/lib/utils'
import type { TeamRole } from '@/types/domain'
import { db, stamped } from '@/db/dexie'

/**
 * Service de membros (T022, FR-011): alterar papel, remover membro e sair
 * da equipe são online-only via RPCs SECURITY DEFINER — é o banco que
 * valida permissão (somente dono) e os limites de papel (migração 0002:
 * o papel do dono não muda, o dono não é removido e o dono não sai).
 * A listagem é read-through e vive no repositório — apenas reexportada.
 */

/** Papéis que o dono pode atribuir a um membro (o dono não é alternável). */
export type EditableRole = Exclude<TeamRole, 'owner'>

/** Membros de uma equipe (read-through via repositório). */
export { listMembers } from '@/db/repos/teams'

/** Id do usuário da sessão atual (leitura local, funciona offline). */
async function currentUserId(): Promise<string | null> {
  const supabase = requireSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/**
 * Traduz os códigos de exceção das RPCs (migração 0002) para PT-BR.
 * Erros conhecidos ganham mensagem amigável; os demais passam intactos
 * para o mapeamento central (`friendlyErrorMessage`).
 */
function translateRpcError(error: unknown): Error {
  const raw =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? '')

  if (raw.includes('not_authenticated'))
    return new Error('Sessão expirada — entre novamente para gerenciar a equipe.')
  if (raw.includes('forbidden'))
    return new Error('Você não tem permissão para esta ação.')
  if (raw.includes('member_not_found'))
    return new Error('Membro não encontrado — a lista pode estar desatualizada.')
  if (raw.includes('cannot_change_owner'))
    return new Error('O papel do dono da equipe não pode ser alterado.')
  if (raw.includes('invalid_role'))
    return new Error('Papel inválido para o membro da equipe.')
  if (raw.includes('cannot_remove_owner'))
    return new Error('O dono da equipe não pode ser removido.')
  if (raw.includes('not_a_member'))
    return new Error('Você não faz parte desta equipe.')
  if (raw.includes('owner_cannot_leave'))
    return new Error('O dono não pode sair da própria equipe.')

  return error instanceof Error
    ? error
    : new Error(raw || 'Erro inesperado ao gerenciar membros.')
}

/**
 * Altera o papel de um membro (editor <-> member, somente dono).
 * O papel `owner` não é alternável: a equipe tem um único dono
 * (índice único parcial) e a RPC recusa com `cannot_change_owner`.
 */
export async function updateMemberRole(
  memberId: string,
  role: EditableRole,
): Promise<void> {
  // valida antes de ir à rede (a RPC também recusa com `invalid_role`)
  if (role !== 'editor' && role !== 'member') {
    throw new Error('Papel inválido: o membro pode ser "editor" ou "member".')
  }

  assertOnline()
  const supabase = requireSupabase()
  const { error } = await supabase.rpc('update_member_role', {
    p_member_id: memberId,
    p_role: role,
  })
  if (error) throw translateRpcError(error)

  // reflete no cache: atualiza somente o registro alterado
  const cached = await db.teamMembers.get(memberId)
  if (cached) {
    await db.teamMembers.put(stamped([{ ...cached, role }])[0])
  }
}

/** Remove um membro da equipe (somente dono; a RPC recusa remover o dono). */
export async function removeMember(memberId: string): Promise<void> {
  assertOnline()
  const supabase = requireSupabase()
  const { error } = await supabase.rpc('remove_member', {
    p_member_id: memberId,
  })
  if (error) throw translateRpcError(error)

  // reflete no cache: o membro sai da lista local
  await db.teamMembers.delete(memberId)
}

/**
 * O usuário logado sai da equipe (não pode ser o dono — `owner_cannot_leave`).
 * A equipe tem um único dono (índice único parcial), então "último dono
 * não pode sair" equivale a "o dono não sai": ele precisaria transferir
 * ou excluir a equipe, caminhos fora do MVP.
 */
export async function leaveTeam(teamId: string): Promise<void> {
  assertOnline()
  const supabase = requireSupabase()
  const { error } = await supabase.rpc('leave_team', { p_team_id: teamId })
  if (error) throw translateRpcError(error)

  // reflete no cache: remove o vínculo do usuário com esta equipe
  const userId = await currentUserId()
  if (userId) {
    await db.teamMembers
      .where('user_id')
      .equals(userId)
      .filter((m) => m.team_id === teamId)
      .delete()
  }
}
