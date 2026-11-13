import { requireSupabase } from '@/lib/supabase'
import { assertOnline, friendlyErrorMessage } from '@/lib/utils'
import { clampTranspose } from '@/features/setlists/positions'
import type { Setlist, SetlistItem } from '@/types/domain'
import {
  addItem as addItemInRepo,
  createSetlist as createSetlistInRepo,
  deleteSetlist as deleteSetlistInRepo,
  duplicateSetlist as duplicateSetlistInRepo,
  listItems,
  listSetlists,
  getSetlist,
  removeItem as removeItemInRepo,
  reorderItems as reorderItemsInRepo,
  setItemTranspose as setItemTransposeInRepo,
  updateSetlist as updateSetlistInRepo,
} from '@/db/repos/setlists'

/**
 * Service de setlists (T040, FR-024/FR-025/FR-026/FR-027). Orquestra o
 * repositório read-through (`src/db/repos/setlists.ts`) e traduz os erros
 * do banco/RPC para PT-BR. Mutações são online-only; permissões são
 * validadas no servidor (RLS + RPCs security definer) — o papel na UI
 * apenas esconde controles (FR-029).
 */

// Leituras puras passam direto (já são read-through no repo).
export { getSetlist, listItems, listSetlists }
export type { Setlist, SetlistItem }

/** Limites do banco (check da migração 0001). */
const NAME_MAX = 160
const EVENT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Id do usuário da sessão (leitura local; null quando desconectado). */
async function currentUserId(): Promise<string | null> {
  const supabase = requireSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/** Valida e normaliza o nome do setlist (obrigatório, ≤160). */
function validateName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('Informe um nome para o setlist.')
  if (name.length > NAME_MAX)
    throw new Error('O nome do setlist deve ter até 160 caracteres.')
  return name
}

/** Valida a data do evento (opcional, formato AAAA-MM-DD). */
function validateEventDate(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const value = raw.trim()
  if (!value) return null
  if (!EVENT_DATE_PATTERN.test(value))
    throw new Error('Data inválida — use o formato AAAA-MM-DD.')
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime()))
    throw new Error('Data inválida — verifique dia, mês e ano.')
  return value
}

/**
 * Traduz erros do banco/RLS/RPC para PT-BR (mesmo padrão do service de
 * cifras): negação do RLS (42501/forbidden), unique(setlist_id, song_id),
 * validações das RPCs (items_mismatch/item_not_in_setlist) e offline_write.
 */
function translateSetlistError(error: unknown): Error {
  const raw =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? '')

  if (raw.includes('42501') || raw.includes('forbidden') || raw.includes('row-level security'))
    return new Error(
      'Você não tem permissão para alterar setlists nesta equipe — só o dono e editores podem.',
    )
  if (raw.includes('setlist_items_setlist_id_song_id_key') || raw.includes('duplicate key'))
    return new Error('Esta música já está no setlist.')
  if (raw.includes('setlists_name_check') || raw.includes('invalid_name'))
    return new Error('O nome do setlist deve ter entre 1 e 160 caracteres.')
  if (raw.includes('setlist_not_found'))
    return new Error('Setlist não encontrado — recarregue a página.')
  if (raw.includes('items_mismatch') || raw.includes('item_not_in_setlist'))
    return new Error('A ordem do setlist está desatualizada — recarregue a página e tente de novo.')
  if (raw.includes('song_not_found'))
    return new Error('Uma das músicas do setlist não existe mais.')

  return new Error(friendlyErrorMessage(error))
}

/** Cria um setlist (nome obrigatório; data do evento opcional). */
export async function createSetlist(
  teamId: string,
  draft: { name: string; event_date?: string | null },
): Promise<Setlist> {
  assertOnline()
  const userId = await currentUserId()
  if (!userId)
    throw new Error('Sessão expirada — entre novamente para criar o setlist.')

  const name = validateName(draft.name)
  const eventDate = validateEventDate(draft.event_date)
  try {
    return await createSetlistInRepo(teamId, userId, name, eventDate)
  } catch (error) {
    throw translateSetlistError(error)
  }
}

/** Atualiza nome e/ou data do evento de um setlist (RLS: dono/editor). */
export async function updateSetlist(
  id: string,
  patch: { name?: string; event_date?: string | null },
): Promise<Setlist> {
  assertOnline()
  const normalized: { name?: string; event_date?: string | null } = {}
  if (patch.name !== undefined) normalized.name = validateName(patch.name)
  if (patch.event_date !== undefined)
    normalized.event_date = validateEventDate(patch.event_date)
  try {
    return await updateSetlistInRepo(id, normalized)
  } catch (error) {
    throw translateSetlistError(error)
  }
}

/** Exclui um setlist (cascata remove itens; RLS: dono/editor). */
export async function deleteSetlist(id: string): Promise<void> {
  assertOnline()
  try {
    await deleteSetlistInRepo(id)
  } catch (error) {
    throw translateSetlistError(error)
  }
}

/** Adiciona música ao fim do setlist (unique(setlist_id, song_id)). */
export async function addItem(setlistId: string, songId: string): Promise<SetlistItem> {
  assertOnline()
  try {
    return await addItemInRepo(setlistId, songId)
  } catch (error) {
    throw translateSetlistError(error)
  }
}

/** Remove um item e renumera 1..n (ordem contígua). */
export async function removeItem(itemId: string): Promise<void> {
  assertOnline()
  try {
    await removeItemInRepo(itemId)
  } catch (error) {
    throw translateSetlistError(error)
  }
}

/** Define o desvio de transposição do item (clamped −11..+11). */
export async function setItemTranspose(
  itemId: string,
  transpose: number,
): Promise<SetlistItem> {
  assertOnline()
  try {
    return await setItemTransposeInRepo(itemId, clampTranspose(transpose))
  } catch (error) {
    throw translateSetlistError(error)
  }
}

/** Reordena os itens atomicamente via RPC (`reorder_setlist`). */
export async function reorderItems(
  setlistId: string,
  orderedItemIds: string[],
): Promise<void> {
  assertOnline()
  try {
    await reorderItemsInRepo(setlistId, orderedItemIds)
  } catch (error) {
    throw translateSetlistError(error)
  }
}

/** Duplica um setlist (cópia independente) via RPC. */
export async function duplicateSetlist(
  setlistId: string,
  newName: string,
): Promise<Setlist> {
  assertOnline()
  const name = validateName(newName)
  try {
    return await duplicateSetlistInRepo(setlistId, name)
  } catch (error) {
    throw translateSetlistError(error)
  }
}
