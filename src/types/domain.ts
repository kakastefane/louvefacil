export type TeamRole = 'owner' | 'editor' | 'member'

export interface Team {
  id: string
  name: string
  created_by: string
  created_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: TeamRole
  display_name: string
  joined_at: string
}

export interface Invite {
  id: string
  team_id: string
  code: string
  expires_at: string
  revoked: boolean
  created_by: string
  created_at: string
}

export interface Song {
  id: string
  team_id: string
  title: string
  artist: string | null
  original_key: string | null
  themes: string[]
  content: string
  created_by: string
  created_at: string
  updated_at: string
}

export type SongDraft = Pick<
  Song,
  'title' | 'artist' | 'original_key' | 'themes' | 'content'
>

export interface Setlist {
  id: string
  team_id: string
  name: string
  event_date: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface SetlistItem {
  id: string
  setlist_id: string
  song_id: string
  position: number
  transpose: number
}

/** Dono/editor podem criar e editar cifras e setlists (FR-006). */
export function canEdit(role: TeamRole): boolean {
  return role === 'owner' || role === 'editor'
}

/** Somente o dono gerencia membros e convites (FR-006). */
export function canManage(role: TeamRole): boolean {
  return role === 'owner'
}
