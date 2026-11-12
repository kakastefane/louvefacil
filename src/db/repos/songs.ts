import { requireSupabase } from '@/lib/supabase'
import { isOnline, normalizeThemes } from '@/lib/utils'
import type { Song, SongDraft } from '@/types/domain'
import { db, stamped } from '../dexie'

/**
 * Repositório read-through de cifras (D-2). `content` é a fonte única da
 * verdade; nenhuma operação aqui altera o texto (Princípio IV).
 */

export async function listSongs(teamId: string): Promise<Song[]> {
  const supabase = requireSupabase()

  if (isOnline()) {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('team_id', teamId)
      .order('title', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as Song[]
    // substitui o cache da equipe (removidas no servidor somem do cache)
    await db.transaction('rw', db.songs, async () => {
      await db.songs.where('team_id').equals(teamId).delete()
      await db.songs.bulkPut(stamped(rows))
    })
  }

  const cached = await db.songs.where('team_id').equals(teamId).toArray()
  return cached.map(({ _fetched_at: _f, ...s }) => s)
}

export async function getSong(id: string): Promise<Song | null> {
  const supabase = requireSupabase()

  if (isOnline()) {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (data) await db.songs.put(stamped([data as Song])[0])
  }

  const cached = await db.songs.get(id)
  if (!cached) return null
  const { _fetched_at: _f, ...song } = cached
  return song
}

export async function createSong(
  teamId: string,
  createdBy: string,
  draft: SongDraft,
): Promise<Song> {
  const supabase = requireSupabase()
  const payload = {
    team_id: teamId,
    created_by: createdBy,
    title: draft.title.trim(),
    artist: draft.artist?.trim() || null,
    original_key: draft.original_key || null,
    themes: normalizeThemes(draft.themes),
    content: draft.content,
  }
  const { data, error } = await supabase
    .from('songs')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  const row = data as Song
  await db.songs.put(stamped([row])[0])
  return row
}

export async function updateSong(
  id: string,
  draft: SongDraft,
): Promise<Song> {
  const supabase = requireSupabase()
  const payload = {
    title: draft.title.trim(),
    artist: draft.artist?.trim() || null,
    original_key: draft.original_key || null,
    themes: normalizeThemes(draft.themes),
    content: draft.content,
  }
  const { data, error } = await supabase
    .from('songs')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  const row = data as Song
  await db.songs.put(stamped([row])[0])
  return row
}

/** Exclui a cifra (cascata remove itens de setlists no banco). */
export async function deleteSong(id: string): Promise<void> {
  const supabase = requireSupabase()
  const { error } = await supabase.from('songs').delete().eq('id', id)
  if (error) throw error
  await db.songs.delete(id)
  const items = await db.setlistItems.where('song_id').equals(id).toArray()
  await db.setlistItems.bulkDelete(items.map((i) => i.id))
}
