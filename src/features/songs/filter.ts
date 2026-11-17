import { themeKey } from '@/lib/utils'
import type { Song } from '@/types/domain'

export interface SongFilterOptions {
  /** Texto livre: busca por título/artista, case-insensitive (substring). */
  query?: string
  /** Tema selecionado — comparado pela forma canônica (case-insensitive). */
  theme?: string | null
}

/**
 * Busca de cifras da biblioteca (T035, FR-013/FR-014): filtra por
 * título/artista (case-insensitive, substring) e por tema canônico.
 * A entrada já chega ordenada por título (`listSongs`); a ordem é preservada.
 */
export function filterSongs(
  songs: Song[],
  options: SongFilterOptions = {},
): Song[] {
  const query = (options.query ?? '').trim().toLowerCase()
  const theme = options.theme ? themeKey(options.theme) : ''

  return songs.filter((song) => {
    if (theme && !song.themes.some((t) => themeKey(t) === theme)) {
      return false
    }
    if (!query) return true
    const haystack = `${song.title} ${song.artist ?? ''}`.toLowerCase()
    return haystack.includes(query)
  })
}

/**
 * Temas presentes no repertório para os chips de filtro: deduplicados pela
 * forma canônica (mantém a primeira grafia) e ordenados em PT-BR.
 */
export function collectThemes(songs: Song[]): string[] {
  const seen = new Map<string, string>()
  for (const song of songs) {
    for (const theme of song.themes) {
      const value = theme.trim()
      if (!value) continue
      const key = themeKey(value)
      if (!seen.has(key)) seen.set(key, value)
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/**
 * Sugestões do autocomplete de temas: temas já existentes que contêm o texto
 * digitado (case-insensitive), excluindo os já selecionados. Correspondências
 * por prefixo vêm primeiro; empate resolvido em ordem alfabética PT-BR.
 */
export function suggestThemes(
  availableThemes: string[],
  selectedThemes: string[],
  query: string,
  limit = 8,
): string[] {
  const needle = themeKey(query)
  if (!needle) return []
  const selected = new Set(selectedThemes.map((theme) => themeKey(theme)))
  return availableThemes
    .filter((theme) => {
      const key = themeKey(theme)
      return !selected.has(key) && key.includes(needle)
    })
    .sort((a, b) => {
      const aPrefix = themeKey(a).startsWith(needle) ? 0 : 1
      const bPrefix = themeKey(b).startsWith(needle) ? 0 : 1
      if (aPrefix !== bPrefix) return aPrefix - bPrefix
      return a.localeCompare(b, 'pt-BR')
    })
    .slice(0, limit)
}
