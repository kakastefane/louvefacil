import {
  listInvites as listInvitesRepo,
  revokeInvite as revokeInviteRepo,
  createInvite as createInviteRepo,
} from '@/db/repos/teams'
import { requireSupabase } from '@/lib/supabase'
import { assertOnline, generateInviteCode } from '@/lib/utils'
import type { Invite } from '@/types/domain'

/**
 * Service de convites (T021): geração/listagem/revogação delegam ao
 * repositório read-through; ingresso usa a RPC `join_team_with_code`,
 * o único caminho atômico para virar membro (data-model).
 */

/** Id do usuário da sessão atual (null quando desconectado). */
async function currentUserId(): Promise<string | null> {
  const supabase = requireSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/** Gera convite com código URL-safe e expiração default de 7 dias (repo). */
export async function generateInvite(
  teamId: string,
  expiresAt?: string,
): Promise<Invite> {
  const userId = await currentUserId()
  if (!userId)
    throw new Error('Sessão expirada — entre novamente para gerar o convite.')

  return createInviteRepo(teamId, userId, generateInviteCode(), expiresAt)
}

/** Convites da equipe (read-through — responde do cache offline). */
export function listInvites(teamId: string): Promise<Invite[]> {
  return listInvitesRepo(teamId)
}

/** Revoga um convite (online-only — escrita exige internet). */
export function revokeInvite(inviteId: string): Promise<Invite> {
  return revokeInviteRepo(inviteId)
}

/**
 * Motivos de falha da RPC `join_team_with_code`: a função levanta
 * exceções com estas mensagens exatas, que mapeamos para PT-BR.
 */
export type InviteJoinErrorCode =
  | 'invalid_code'
  | 'expired_code'
  | 'revoked_code'
  | 'not_authenticated'
  | 'invalid_display_name'

/** Erro tipado do ingresso: `code` deixa a UI reagir por caso (FR-007/009). */
export class InviteJoinError extends Error {
  readonly code: InviteJoinErrorCode

  constructor(code: InviteJoinErrorCode, message: string) {
    super(message)
    this.name = 'InviteJoinError'
    this.code = code
  }
}

/** Mensagens prontas para UI, uma por motivo (PT-BR, tom dos vizinhos). */
const JOIN_ERROR_MESSAGES: Record<InviteJoinErrorCode, string> = {
  invalid_code: 'Convite inválido.',
  expired_code: 'Este convite expirou. Peça um novo link ao responsável.',
  revoked_code: 'Este convite foi revogado. Peça um novo link ao responsável.',
  not_authenticated: 'Faça login para entrar em uma equipe.',
  invalid_display_name: 'Informe seu nome para exibição na equipe.',
}

/** Traduz a mensagem crua da RPC em erro tipado; null se não for um caso conhecido. */
function parseJoinError(raw: string): InviteJoinError | null {
  for (const code of Object.keys(JOIN_ERROR_MESSAGES) as InviteJoinErrorCode[]) {
    if (raw.includes(code)) {
      return new InviteJoinError(code, JOIN_ERROR_MESSAGES[code])
    }
  }
  return null
}

/**
 * Entra na equipe pelo código (idempotente: se já é membro, a RPC
 * devolve a própria equipe). Ingresso é escrita no servidor — offline
 * falha rápido com o erro amigável de conexão.
 */
export async function joinTeamWithCode(
  code: string,
  displayName: string,
): Promise<string> {
  assertOnline()
  const supabase = requireSupabase()

  const name = displayName.trim()
  if (!name) throw new InviteJoinError('invalid_display_name', JOIN_ERROR_MESSAGES.invalid_display_name)

  const { data, error } = await supabase.rpc('join_team_with_code', {
    p_code: code.trim(),
    p_display_name: name,
  })
  if (error) {
    const mapped = parseJoinError(error.message)
    if (mapped) throw mapped
    throw error
  }
  return data as string
}
