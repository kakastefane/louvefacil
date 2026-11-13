import { requireSupabase } from '@/lib/supabase'
import { assertOnline, friendlyErrorMessage, normalizeThemes } from '@/lib/utils'
import type { Song, SongDraft } from '@/types/domain'
import {
  createSong as createSongInRepo,
  deleteSong as deleteSongInRepo,
  getSong as getSongInRepo,
  updateSong as updateSongInRepo,
} from '@/db/repos/songs'

/**
 * Service de cifras (T030, FR-006): orquestra o repositório read-through
 * (`src/db/repos/songs.ts`) e traduz os erros do banco para PT-BR. A escrita
 * é online-only — a validação de permissão (dono/editor) fica no RLS, e o
 * `content` é a fonte única da verdade: nada aqui altera o texto-fonte
 * (Princípio IV). A exclusão é em cascata no banco: remover uma cifra
 * apaga também os itens de setlists que a referenciam (migração 0001).
 */

/** Cifras de uma equipe, ordenadas por título (read-through). */
export { listSongs } from '@/db/repos/songs'

/** Id do usuário da sessão atual (leitura local; null quando desconectado). */
async function currentUserId(): Promise<string | null> {
  const supabase = requireSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/** Tom aceito pelo banco (check da migração 0001): raiz A–G com acidente opcional. */
const ORIGINAL_KEY_PATTERN = /^[A-G][#b]?$/

/** Limites do banco (checks da migração 0001). */
const TITLE_MAX = 200
const ARTIST_MAX = 200
const CONTENT_MAX = 20000

/**
 * Traduz os erros do banco/RLS para PT-BR (mesmo padrão de
 * `translateRpcError` em `src/features/teams/members.ts`): negação do RLS
 * (42501), violações de check (limites de tamanho/tom) e offline passam
 * por aqui; os demais caem no mapeamento central (`friendlyErrorMessage`).
 */
function translateSongError(error: unknown): Error {
  const raw =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? '')

  if (raw.includes('42501') || raw.includes('row-level security'))
    return new Error(
      'Você não tem permissão para alterar cifras nesta equipe — só o dono e editores podem.',
    )
  if (raw.includes('songs_title_check'))
    return new Error('O título da cifra deve ter entre 1 e 200 caracteres.')
  if (raw.includes('songs_artist_check'))
    return new Error('O nome do artista deve ter até 200 caracteres.')
  if (raw.includes('songs_original_key_check'))
    return new Error(
      'Tom original inválido — use uma letra de A a G, com # ou b (ex.: "C", "F#").',
    )
  if (raw.includes('songs_content_check'))
    return new Error('A cifra deve ter entre 1 e 20.000 caracteres.')

  // offline_write / rede / demais erros: mapeamento central em PT-BR
  return new Error(friendlyErrorMessage(error))
}

/**
 * Valida o rascunho contra os limites do banco e devolve a versão
 * normalizada (título/artista aparados, temas via `normalizeThemes`).
 * Lança erros amigáveis em PT-BR antes de qualquer chamada de rede.
 */
function validateAndNormalizeDraft(draft: SongDraft): SongDraft {
  const title = draft.title.trim()
  if (!title) throw new Error('Informe o título da cifra.')
  if (title.length > TITLE_MAX)
    throw new Error('O título da cifra deve ter até 200 caracteres.')

  const artist = draft.artist?.trim() ?? null
  if (artist && artist.length > ARTIST_MAX)
    throw new Error('O nome do artista deve ter até 200 caracteres.')

  const original_key = draft.original_key?.trim() || null
  if (original_key && !ORIGINAL_KEY_PATTERN.test(original_key))
    throw new Error(
      'Tom original inválido — use uma letra de A a G, com # ou b (ex.: "C", "F#").',
    )

  const content = draft.content
  if (!content.trim())
    throw new Error('A cifra não pode ficar vazia.')
  if (content.length > CONTENT_MAX)
    throw new Error('A cifra deve ter entre 1 e 20.000 caracteres.')

  // temas: trim, remove vazios/duplicatas (case-insensitive) — FR-018
  return {
    title,
    artist: artist || null,
    original_key: original_key || null,
    themes: normalizeThemes(draft.themes),
    content,
  }
}

/** Uma cifra por id (read-through; null quando não existe ou sem acesso). */
export async function getSongById(id: string): Promise<Song | null> {
  return getSongInRepo(id)
}

/**
 * Cria uma cifra na equipe. `created_by = auth.uid()`: o id vem da sessão
 * Supabase — o RLS recusa (42501) se não coincidir com o usuário logado ou
 * se ele não for dono/editor da equipe. Retorna a cifra gravada.
 */
export async function createSong(
  teamId: string,
  draft: SongDraft,
): Promise<Song> {
  assertOnline()
  const userId = await currentUserId()
  if (!userId)
    throw new Error('Sessão expirada — entre novamente para criar a cifra.')

  const normalized = validateAndNormalizeDraft(draft)
  try {
    return await createSongInRepo(teamId, userId, normalized)
  } catch (error) {
    throw translateSongError(error)
  }
}

/**
 * Atualiza uma cifra (RLS exige dono/editor da equipe). Retorna a cifra
 * atualizada; o repositório reflete o resultado no cache local.
 */
export async function updateSong(id: string, draft: SongDraft): Promise<Song> {
  assertOnline()
  const normalized = validateAndNormalizeDraft(draft)
  try {
    return await updateSongInRepo(id, normalized)
  } catch (error) {
    throw translateSongError(error)
  }
}

/**
 * Exclui uma cifra (RLS exige dono/editor). O banco remove em cascata os
 * itens de setlists que a referenciavam; o cache local é limpo pelo
 * repositório (cifra + itens das setlists abertas).
 */
export async function deleteSong(id: string): Promise<void> {
  assertOnline()
  try {
    await deleteSongInRepo(id)
  } catch (error) {
    throw translateSongError(error)
  }
}
