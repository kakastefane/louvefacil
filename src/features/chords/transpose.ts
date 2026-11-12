/**
 * Transpositor de acordes (Princípio IV: transposição é render, não dado).
 * Módulo puro. Sufixos nunca mudam; raiz e baixo transpõem módulo 12;
 * a grafia (sustenidos/bemóis) segue o tom de referência da cifra.
 */

const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const LETTER_INDEX: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

const CHORD_RE = /^([A-G])([#b]?)([\s\S]*)$/

const FLAT_MAJOR_KEYS = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']
// menores naturais com bemol: Dm, Gm, Cm, Fm (Bbm/Ebm têm acidental 'b')
const FLAT_MINOR_LETTERS = ['D', 'G', 'C', 'F']

export interface ParsedKey {
  /** Letra original (A–G). */
  letter: string
  /** '#' | 'b' | '' (grafia original). */
  accidental: string
  /** Resto do tom (ex.: 'm7' em 'Bm7'). */
  suffix: string
  /** Índice cromático 0-11 (C=0). */
  rootIndex: number
}

export function parseKey(key: string | null | undefined): ParsedKey | null {
  if (!key) return null
  const match = CHORD_RE.exec(key.trim())
  if (!match) return null
  const letter = match[1]
  const accidental = match[2]
  const rootIndex =
    (((LETTER_INDEX[letter] ?? 0) + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0)) % 12 + 12) % 12
  return { letter, accidental, suffix: match[3], rootIndex }
}

/** Menor (ex.: 'm', 'm7') — não confunde com 'M'/'maj'. */
export function isMinorKeySuffix(suffix: string): boolean {
  return /^m(?!aj)/.test(suffix)
}

/**
 * Tons que preferem bemóis (assunção da spec): maiores F/Bb/Eb/Ab/Db/Gb/Cb,
 * menores Dm/Gm/Cm/Fm e qualquer tom menor com acidental bemol (Bbm, Ebm...).
 * Demais tons usam sustenidos.
 */
export function keyPrefersFlats(key: string | null | undefined): boolean {
  const parsed = parseKey(key)
  if (!parsed) return false
  if (isMinorKeySuffix(parsed.suffix)) {
    if (parsed.accidental === 'b') return true
    // Dm/Gm/Cm/Fm naturais; F#m/C#m etc. ficam com sustenidos
    return parsed.accidental === '' && FLAT_MINOR_LETTERS.includes(parsed.letter)
  }
  return FLAT_MAJOR_KEYS.includes(`${parsed.letter}${parsed.accidental}`)
}

function spell(index: number, useFlats: boolean): string {
  const normalized = ((index % 12) + 12) % 12
  return useFlats ? FLAT_SCALE[normalized] : SHARP_SCALE[normalized]
}

/**
 * Transpõe um acorde. A referência decide a grafia (sustenidos ou bemóis).
 * Acorde malformado volta inalterado (edge case da spec); desvio 0 mantém
 * a grafia original do usuário.
 */
export function transposeChord(
  chord: string,
  semitones: number,
  referenceKey: string | null | undefined,
): string {
  if (semitones === 0 || chord.trim() === '') return chord

  const useFlats = keyPrefersFlats(referenceKey)
  const slash = chord.indexOf('/')
  const main = slash === -1 ? chord : chord.slice(0, slash)
  const bass = slash === -1 ? null : chord.slice(slash + 1)

  const mainMatch = CHORD_RE.exec(main.trim())
  if (!mainMatch) return chord

  const mainIndex =
    (((LETTER_INDEX[mainMatch[1]] ?? 0) +
      (mainMatch[2] === '#' ? 1 : mainMatch[2] === 'b' ? -1 : 0)) %
      12 +
      12) %
    12
  const newMain =
    spell((mainIndex + semitones) % 12, useFlats) + mainMatch[3]

  if (bass === null) return newMain
  const bassMatch = CHORD_RE.exec(bass.trim())
  if (!bassMatch) return `${newMain}/${bass}`
  const bassIndex =
    (((LETTER_INDEX[bassMatch[1]] ?? 0) +
      (bassMatch[2] === '#' ? 1 : bassMatch[2] === 'b' ? -1 : 0)) %
      12 +
      12) %
    12
  const newBass =
    spell((bassIndex + semitones) % 12, useFlats) + bassMatch[3]
  return `${newMain}/${newBass}`
}

/** Tom exibido após o desvio (ex.: 'G' +2 → 'A'; 'F' +1 → 'Gb'). */
export function transposeKey(
  key: string | null | undefined,
  semitones: number,
): string | null {
  if (!key) return null
  const parsed = parseKey(key)
  if (!parsed) return key
  const useFlats = keyPrefersFlats(key)
  const root = spell((parsed.rootIndex + semitones) % 12, useFlats)
  return `${root}${parsed.suffix}`
}
