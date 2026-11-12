import Dexie, { type Table } from 'dexie'
import type {
  Invite,
  Setlist,
  SetlistItem,
  Song,
  Team,
  TeamMember,
} from '@/types/domain'

/**
 * Cache local (IndexedDB) espelhando as tabelas do banco (D-2):
 * leitura offline do conteúdo já aberto; `_fetched_at` marca a hora da
 * sincronização para last-write-wins do servidor sobre o cache.
 */
export type Cached<T> = T & { _fetched_at: number }

export type CachedTeam = Cached<Team>
export type CachedTeamMember = Cached<TeamMember>
export type CachedInvite = Cached<Invite>
export type CachedSong = Cached<Song>
export type CachedSetlist = Cached<Setlist>
export type CachedSetlistItem = Cached<SetlistItem>

export class LouveFacilDb extends Dexie {
  teams!: Table<CachedTeam, string>
  teamMembers!: Table<CachedTeamMember, string>
  invites!: Table<CachedInvite, string>
  songs!: Table<CachedSong, string>
  setlists!: Table<CachedSetlist, string>
  setlistItems!: Table<CachedSetlistItem, string>

  constructor() {
    super('louve-facil')
    this.version(1).stores({
      teams: 'id',
      teamMembers: 'id, team_id, user_id',
      invites: 'id, team_id, code',
      songs: 'id, team_id',
      setlists: 'id, team_id',
      setlistItems: 'id, setlist_id, song_id',
    })
  }
}

export const db = new LouveFacilDb()

/** Carimba as linhas com o instante da sincronização. */
export function stamped<T>(rows: T[]): Cached<T>[] {
  const now = Date.now()
  return rows.map((r) => ({ ...r, _fetched_at: now }))
}

/** Limpa todo o cache local (logout / troca de conta — T049). */
export async function clearAllCaches(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()))
}
