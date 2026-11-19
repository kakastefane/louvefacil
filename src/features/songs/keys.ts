/**
 * Tons oferecidos no seletor do editor, com enarmonia já resolvida para uma
 * única grafia (o banco aceita a raiz A–G com # ou b, mas o seletor tem uma
 * lista fixa). Compartilhado entre o formulário e o importador de JSON.
 */
export const SONG_KEYS = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const

export type SongKey = (typeof SONG_KEYS)[number]

/** Grafias aceitas na importação → grafia do seletor. */
const KEY_ALIASES: Record<string, SongKey> = {
  C: 'C',
  'C#': 'C#',
  Db: 'C#',
  D: 'D',
  'D#': 'Eb',
  Eb: 'Eb',
  E: 'E',
  'E#': 'F',
  Fb: 'E',
  F: 'F',
  'F#': 'F#',
  Gb: 'F#',
  G: 'G',
  'G#': 'Ab',
  Ab: 'Ab',
  A: 'A',
  'A#': 'Bb',
  Bb: 'Bb',
  B: 'B',
  Cb: 'B',
  'B#': 'C',
}

export interface NormalizedSongKey {
  /** Tom na grafia do seletor; null quando não foi possível reconhecer. */
  key: SongKey | null
  /** true quando a grafia de origem virou outra (ex.: `D#` → `Eb`). */
  converted: boolean
  /** Sufixo descartado (ex.: `m` em `Am`, `maj7` em `Gmaj7`). */
  droppedSuffix: string | null
}

/**
 * Normaliza o `original_key` de um JSON importado para a grafia do seletor.
 *
 * Tolera o que a skill evita mas aparece na prática: acidentes enarmônicos
 * (`D#`, `Gb`), símbolos `♯`/`♭`, minúsculas e sufixos (`Am`, `Gmaj7`).
 * Apenas a raiz é mantida — o sufixo é devolvido para a UI avisar.
 */
export function normalizeSongKey(raw: unknown): NormalizedSongKey {
  if (typeof raw !== 'string') {
    return { key: null, converted: false, droppedSuffix: null }
  }

  const cleaned = raw
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
  const match = cleaned.match(/^([A-Ga-g])([#b]?)(.*)$/)
  if (!match) {
    return { key: null, converted: false, droppedSuffix: null }
  }

  const spelling = `${match[1].toUpperCase()}${match[2]}`
  const suffix = match[3].trim()
  const key = KEY_ALIASES[spelling] ?? null

  return {
    key,
    converted: key !== null && key !== spelling,
    droppedSuffix: suffix || null,
  }
}
