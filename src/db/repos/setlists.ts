import { requireSupabase } from '@/lib/supabase'
import { isOnline } from '@/lib/utils'
import type { Setlist, SetlistItem } from '@/types/domain'
import { db, stamped } from '../dexie'

/**
 * Repositório read-through de setlists e itens (D-2).
 * Reordenação e duplicação são atômicas via RPCs no banco.
 */

export async function listSetlists(teamId: string): Promise<Setlist[]> {
  const supabase = requireSupabase()

  if (isOnline()) {
    const { data, error } = await supabase
      .from('setlists')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
    if (error) throw error
    const rows = (data ?? []) as Setlist[]
    await db.transaction('rw', db.setlists, async () => {
      await db.setlists.where('team_id').equals(teamId).delete()
      await db.setlists.bulkPut(stamped(rows))
    })
  }

  const cached = await db.setlists.where('team_id').equals(teamId).toArray()
  return cached.map(({ _fetched_at: _f, ...s }) => s)
}

export async function getSetlist(id: string): Promise<Setlist | null> {
  const supabase = requireSupabase()

  if (isOnline()) {
    const { data, error } = await supabase
      .from('setlists')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (data) await db.setlists.put(stamped([data as Setlist])[0])
  }

  const cached = await db.setlists.get(id)
  if (!cached) return null
  const { _fetched_at: _f, ...setlist } = cached
  return setlist
}

export async function createSetlist(
  teamId: string,
  createdBy: string,
  name: string,
  eventDate: string | null,
): Promise<Setlist> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('setlists')
    .insert({
      team_id: teamId,
      created_by: createdBy,
      name: name.trim(),
      event_date: eventDate,
    })
    .select('*')
    .single()
  if (error) throw error
  const row = data as Setlist
  await db.setlists.put(stamped([row])[0])
  return row
}

export async function updateSetlist(
  id: string,
  patch: { name?: string; event_date?: string | null },
): Promise<Setlist> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('setlists')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  const row = data as Setlist
  await db.setlists.put(stamped([row])[0])
  return row
}

export async function deleteSetlist(id: string): Promise<void> {
  const supabase = requireSupabase()
  const { error } = await supabase.from('setlists').delete().eq('id', id)
  if (error) throw error
  await db.setlists.delete(id)
  const items = await db.setlistItems.where('setlist_id').equals(id).toArray()
  await db.setlistItems.bulkDelete(items.map((i) => i.id))
}

export async function listItems(setlistId: string): Promise<SetlistItem[]> {
  const supabase = requireSupabase()

  if (isOnline()) {
    const { data, error } = await supabase
      .from('setlist_items')
      .select('*')
      .eq('setlist_id', setlistId)
      .order('position', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as SetlistItem[]
    await db.transaction('rw', db.setlistItems, async () => {
      await db.setlistItems.where('setlist_id').equals(setlistId).delete()
      await db.setlistItems.bulkPut(stamped(rows))
    })
  }

  const cached = await db.setlistItems
    .where('setlist_id')
    .equals(setlistId)
    .toArray()
  return cached
    .map(({ _fetched_at: _f, ...i }) => i)
    .sort((a, b) => a.position - b.position)
}

/** Adiciona música ao fim do setlist (unique(setlist_id, song_id)). */
export async function addItem(
  setlistId: string,
  songId: string,
): Promise<SetlistItem> {
  const supabase = requireSupabase()
  const existing = await db.setlistItems
    .where('setlist_id')
    .equals(setlistId)
    .toArray()
  const next = existing.reduce((max, i) => Math.max(max, i.position), 0) + 1

  const { data, error } = await supabase
    .from('setlist_items')
    .insert({ setlist_id: setlistId, song_id: songId, position: next })
    .select('*')
    .single()
  if (error) throw error
  const row = data as SetlistItem
  await db.setlistItems.put(stamped([row])[0])
  return row
}

export async function removeItem(itemId: string): Promise<void> {
  const supabase = requireSupabase()
  const cached = await db.setlistItems.get(itemId)
  const { error } = await supabase
    .from('setlist_items')
    .delete()
    .eq('id', itemId)
  if (error) throw error
  await db.setlistItems.delete(itemId)

  if (cached) {
    await renumberLocal(supabase, cached.setlist_id)
  }
}

/** Define o desvio de transposição do item (Princípio IV). */
export async function setItemTranspose(
  itemId: string,
  transpose: number,
): Promise<SetlistItem> {
  const supabase = requireSupabase()
  const clamped = Math.max(-11, Math.min(11, Math.round(transpose)))
  const { data, error } = await supabase
    .from('setlist_items')
    .update({ transpose: clamped })
    .eq('id', itemId)
    .select('*')
    .single()
  if (error) throw error
  const row = data as SetlistItem
  await db.setlistItems.put(stamped([row])[0])
  return row
}

/** Reordena via RPC (renumeração 1..n atômica no banco). */
export async function reorderItems(
  setlistId: string,
  orderedItemIds: string[],
): Promise<void> {
  const supabase = requireSupabase()
  const { error } = await supabase.rpc('reorder_setlist', {
    p_setlist_id: setlistId,
    p_ordered_item_ids: orderedItemIds,
  })
  if (error) throw error
  // reflete no cache
  const items = await db.setlistItems
    .where('setlist_id')
    .equals(setlistId)
    .toArray()
  await db.setlistItems.bulkPut(
    stamped(
      items.map((i) => {
        const pos = orderedItemIds.indexOf(i.id)
        return { ...i, position: pos >= 0 ? pos + 1 : i.position }
      }),
    ),
  )
}

/** Duplica via RPC (cópia independente); retorna o novo setlist. */
export async function duplicateSetlist(
  setlistId: string,
  newName: string,
): Promise<Setlist> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('duplicate_setlist', {
    p_setlist_id: setlistId,
    p_new_name: newName,
  })
  if (error) throw error
  const newId = data as string
  const created = await getSetlist(newId)
  if (!created) throw new Error('duplicate_failed')
  await listItems(newId) // popula cache dos itens
  return created
}

/** Renumera 1..n após remoção (edge case da spec: manter ordem). */
async function renumberLocal(
  supabase: NonNullable<ReturnType<typeof requireSupabase>>,
  setlistId: string,
): Promise<void> {
  const remaining = await db.setlistItems
    .where('setlist_id')
    .equals(setlistId)
    .toArray()
  remaining.sort((a, b) => a.position - b.position)
  const orderedIds: string[] = []
  const updates: SetlistItem[] = []
  for (const [index, item] of remaining.entries()) {
    const position = index + 1
    orderedIds.push(item.id)
    if (item.position !== position) {
      updates.push({ ...item, position })
    }
  }
  if (updates.length === 0) return
  const { error } = await supabase.rpc('reorder_setlist', {
    p_setlist_id: setlistId,
    p_ordered_item_ids: orderedIds,
  })
  if (error) {
    // sem permissão ou offline: apenas reflete a ordem local
    await db.setlistItems.bulkPut(stamped(updates))
    return
  }
  await db.setlistItems.bulkPut(stamped(updates))
}
