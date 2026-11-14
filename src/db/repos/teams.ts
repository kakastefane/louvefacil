import { requireSupabase } from '@/lib/supabase'
import { assertOnline, defaultInviteExpiry, isOnline } from '@/lib/utils'
import type { Invite, Team, TeamMember } from '@/types/domain'
import { db, stamped } from '../dexie'

/**
 * Repositório read-through de equipes, membros e convites (D-2):
 * responde do cache e sincroniza do servidor quando online.
 */

/** Id do usuário da sessão atual (leitura local, funciona offline). */
async function currentUserId(): Promise<string | null> {
  const supabase = requireSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/** Equipes + vínculos do usuário logado (RLS filtra no servidor). */
export async function listMyMemberships(): Promise<
  { member: TeamMember; team: Team }[]
> {
  const supabase = requireSupabase()

  if (isOnline()) {
    const { data, error } = await supabase
      .from('team_members')
      .select('*, team:teams(*)')
      .order('joined_at', { ascending: true })
    if (error) throw error

    const rows = (data ?? []) as unknown as (TeamMember & {
      team: Team | null
    })[]

    const userId = await currentUserId()
    const teams: Team[] = []
    const membersClean: TeamMember[] = []
    for (const row of rows) {
      membersClean.push({
        id: row.id,
        team_id: row.team_id,
        user_id: row.user_id,
        role: row.role,
        display_name: row.display_name,
        joined_at: row.joined_at,
      })
      if (row.team) teams.push(row.team)
    }

    if (userId) {
      await db.transaction('rw', db.teamMembers, db.teams, async () => {
        await db.teamMembers.where('user_id').equals(userId).delete()
        await db.teamMembers.bulkPut(stamped(membersClean))
      })
      await db.teams.bulkPut(stamped(teams))
    }
  }

  return cachedMemberships()
}

async function cachedMemberships(): Promise<
  { member: TeamMember; team: Team }[]
> {
  const userId = await currentUserId()
  const members = userId
    ? (await db.teamMembers.where('user_id').equals(userId).toArray())
    : []
  const teams = await db.teams.toArray()
  return members.flatMap((member) => {
    const team = teams.find((t) => t.id === member.team_id)
    return team ? [{ member, team }] : []
  })
}

/** Membros de uma equipe (read-through). */
export async function listMembers(teamId: string): Promise<TeamMember[]> {
  const supabase = requireSupabase()

  if (isOnline()) {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as TeamMember[]
    await db.teamMembers.bulkPut(stamped(rows))
  }

  const cached = await db.teamMembers.where('team_id').equals(teamId).toArray()
  return cached.map(({ _fetched_at: _f, ...m }) => m)
}

/** Atualiza o nome exibido do próprio vínculo (perfil em /config). */
export async function updateDisplayName(
  memberId: string,
  displayName: string,
): Promise<TeamMember> {
  assertOnline()
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('team_members')
    .update({ display_name: displayName.trim() })
    .eq('id', memberId)
    .select('*')
    .single()
  if (error) throw error
  const row = data as TeamMember
  await db.teamMembers.put(stamped([row])[0])
  return row
}

/** Convites da equipe (somente dono — RLS). */
export async function listInvites(teamId: string): Promise<Invite[]> {
  const supabase = requireSupabase()

  if (isOnline()) {
    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
    if (error) throw error
    const rows = (data ?? []) as Invite[]
    await db.invites.bulkPut(stamped(rows))
  }

  const cached = await db.invites.where('team_id').equals(teamId).toArray()
  return cached.map(({ _fetched_at: _f, ...i }) => i)
}

/** Gera um convite (código gerado no client; RLS valida o papel). */
export async function createInvite(
  teamId: string,
  createdBy: string,
  code: string,
  expiresAt?: string,
): Promise<Invite> {
  assertOnline()
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('invites')
    .insert({
      team_id: teamId,
      created_by: createdBy,
      code,
      expires_at: expiresAt ?? defaultInviteExpiry(),
    })
    .select('*')
    .single()
  if (error) throw error
  const row = data as Invite
  await db.invites.put(stamped([row])[0])
  return row
}

/** Revoga um convite. */
export async function revokeInvite(inviteId: string): Promise<Invite> {
  assertOnline()
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('invites')
    .update({ revoked: true })
    .eq('id', inviteId)
    .select('*')
    .single()
  if (error) throw error
  const row = data as Invite
  await db.invites.put(stamped([row])[0])
  return row
}
