/**
 * Modelagem de render (contrato: contracts/chordpro-format.md):
 * transforma a cifra parseada em linhas prontas para a grade de duas
 * linhas (acorde acima, alinhado à coluna da sílaba). Puro — sem DOM.
 */

import type { ChordSlot, ParsedSong } from './parser'
import { transposeChord, transposeKey } from './transpose'

export interface RenderedChord {
  /** Acorde já transposto (ou literal, se malformado). */
  label: string
  /** Coluna alvo na linha de letra. */
  col: number
}

export type RenderedLine =
  | { type: 'empty' }
  | { type: 'section'; label: string; chords: RenderedChord[]; text: string }
  | { type: 'lyric'; chords: RenderedChord[]; text: string }
  | { type: 'chords'; chords: RenderedChord[]; text: string }

export interface RenderedSong {
  title: string | null
  artist: string | null
  /** Tom de referência original (sem desvio). */
  key: string | null
  /** Tom exibido (referência + desvio). */
  displayedKey: string | null
  lines: RenderedLine[]
}

export interface RenderOptions {
  /** Desvio em semitons (−11..+11). */
  semitones?: number
  /** Tom de referência (original_key da coluna ou metatag {key}). */
  referenceKey?: string | null
  /** Modo cantor: mantém só a letra e os rótulos de seção; acordes são omitidos. */
  hideChords?: boolean
}

function transposeAll(chords: string[], semitones: number, reference: string | null): RenderedChord[] {
  return chords.map((chord, index) => ({
    label: transposeChord(chord, semitones, reference),
    col: index * 6, // espaçamento fixo para linhas só de acordes
  }))
}

function transposeSlots(slots: ChordSlot[], semitones: number, reference: string | null): RenderedChord[] {
  return slots.map((slot) => ({
    label: transposeChord(slot.chord, semitones, reference),
    col: slot.col,
  }))
}

export function renderSong(parsed: ParsedSong, options: RenderOptions = {}): RenderedSong {
  const semitones = options.semitones ?? 0
  const reference = options.referenceKey ?? parsed.key ?? null
  const hideChords = options.hideChords ?? false

  const lines: RenderedLine[] = []
  for (const line of parsed.lines) {
    switch (line.type) {
      case 'empty':
        lines.push({ type: 'empty' })
        break
      case 'section':
        lines.push({
          type: 'section',
          label: line.label,
          chords: hideChords ? [] : transposeAll(line.chords, semitones, reference),
          text: '',
        })
        break
      case 'chords':
        // No modo cantor as linhas só de acordes somem por completo
        if (hideChords) break
        lines.push({
          type: 'chords',
          chords: transposeAll(line.chords, semitones, reference),
          text: '',
        })
        break
      case 'lyric':
        lines.push({
          type: 'lyric',
          chords: hideChords ? [] : transposeSlots(line.chords, semitones, reference),
          text: line.text,
        })
        break
      default:
        // metatags nunca chegam às linhas parseadas
        break
    }
  }
  // No modo cantor, linhas só-de-acordes somem; seções mantêm só o rótulo
  return {
    title: parsed.title,
    artist: parsed.artist,
    key: parsed.key,
    displayedKey: parsed.key ? transposeKey(parsed.key, semitones) : null,
    lines: lines.filter((line) => line.type !== 'chords'),
  }
}

/**
 * Converte os acordes de uma linha em segmentos com espaçamento, evitando
 * sobreposição: cada acorde anda ao menos 1 coluna após o anterior.
 */
export function buildChordSegments(
  chords: RenderedChord[],
): { label: string; pad: number }[] {
  const segments: { label: string; pad: number }[] = []
  let cursor = 0
  for (const chord of chords) {
    const pad = Math.max(chord.col - cursor, cursor === 0 && chord.col === 0 ? 0 : 1)
    segments.push({ label: chord.label, pad })
    cursor = chord.col + Math.max(chord.label.length, 1)
  }
  return segments
}
