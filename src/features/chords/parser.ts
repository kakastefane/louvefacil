/**
 * Parser ChordPro adaptado (contrato: contracts/chordpro-format.md).
 * Módulo puro — sem rede, sem DOM. O texto-fonte nunca é alterado.
 */

export interface ChordSlot {
  /** Acorde exatamente como escrito no texto-fonte. */
  chord: string
  /** Coluna (offset de caractere) onde o acorde ancora na linha de letra. */
  col: number
}

export type ParsedLine =
  | { type: 'empty' }
  | { type: 'meta'; key: string; value: string }
  | { type: 'section'; label: string; chords: string[] }
  | { type: 'lyric'; chords: ChordSlot[]; text: string }
  | { type: 'chords'; chords: string[] }

export interface ParsedSong {
  title: string | null
  artist: string | null
  key: string | null
  lines: ParsedLine[]
}

// raiz válida + sufixo de acorde (palavras conhecidas ou símbolos) + baixo opcional
const CHORD_TOKEN =
  /^([A-G][#b]?)((?:(?:maj|min|dim|aug|sus|add|mmaj|alt|no)|[mM0-9#b/()+-])*)(?:\/([A-G][#b]?))?$/

const SECTION_LINE = /^\s*\[([^\]]+)\]\s*(.*)$/
const ANY_META_LINE = /^\s*\{[^}]*\}\s*$/
const META_LINE = /^\s*\{\s*(title|key|artist)\s*:\s*([^}]*)\}\s*$/i
// tag específica de seção: {section: Intro} (aliases {sec}, {seção}, {secao})
const SECTION_META_LINE =
  /^\s*\{\s*(?:section|sec|seção|secao)\s*:\s*([^}]*)\}\s*$/i

/** Um token isolado parece acorde? (usado p/ linhas só de acordes/seções) */
export function isChordToken(token: string): boolean {
  return CHORD_TOKEN.test(token)
}

function allChordTokens(remainder: string): boolean {
  const trimmed = remainder.trim()
  if (trimmed === '') return false
  return trimmed.split(/\s+/).every(isChordToken)
}

/** Analisa uma linha de letra com acordes inline [Am] antes da sílaba. */
function parseLyricLine(line: string): ParsedLine {
  const chords: ChordSlot[] = []
  let text = ''
  let rest = line
  for (;;) {
    const open = rest.indexOf('[')
    if (open === -1) {
      text += rest
      break
    }
    const close = rest.indexOf(']', open + 1)
    if (close === -1) {
      // colchete sem par: mantém literal
      text += rest
      break
    }
    text += rest.slice(0, open)
    const chord = rest.slice(open + 1, close)
    if (chord.trim() !== '') {
      chords.push({ chord, col: text.length })
    }
    rest = rest.slice(close + 1)
  }
  return { type: 'lyric', chords, text }
}

export function parseChordPro(content: string): ParsedSong {
  const song: ParsedSong = {
    title: null,
    artist: null,
    key: null,
    lines: [],
  }

  if (content.trim() === '') return song

  for (const rawLine of content.split(/\r?\n/)) {
    const meta = rawLine.match(META_LINE)
    if (meta) {
      const metaKey = meta[1].toLowerCase()
      const value = meta[2].trim()
      if (metaKey === 'title') song.title = value
      else if (metaKey === 'artist') song.artist = value
      else if (metaKey === 'key') song.key = value
      continue
    }

    // tag de seção {section: …}: vira linha de seção (badge no render)
    const sectionMeta = rawLine.match(SECTION_META_LINE)
    if (sectionMeta) {
      const label = sectionMeta[1].trim()
      if (label !== '') {
        song.lines.push({ type: 'section', label, chords: [] })
      }
      continue
    }

    // metatags desconhecidas (ex.: {comment: ...}) são ignoradas no render
    if (ANY_META_LINE.test(rawLine)) continue

    if (rawLine.trim() === '') {
      song.lines.push({ type: 'empty' })
      continue
    }

    const section = rawLine.match(SECTION_LINE)
    if (section) {
      const remainder = section[2]
      if (remainder.trim() === '' || allChordTokens(remainder)) {
        song.lines.push({
          type: 'section',
          label: section[1].trim(),
          chords: remainder.trim() === '' ? [] : remainder.trim().split(/\s+/),
        })
        continue
      }
      // rótulo seguido de letra: cai no parser de letra (rótulo vira acorde literal)
    }

    if (!rawLine.includes('[')) {
      const tokens = rawLine.trim().split(/\s+/)
      if (tokens.length > 1 && tokens.every(isChordToken)) {
        song.lines.push({ type: 'chords', chords: tokens })
        continue
      }
      if (tokens.length === 1 && isChordToken(tokens[0])) {
        // palavra única: só é acorde se a linha inteira for curta e sem pontuação
        // (ex.: "Em" no meio da letra vira letra; linha só "Em" é acorde)
        song.lines.push({ type: 'chords', chords: tokens })
        continue
      }
      song.lines.push({ type: 'lyric', chords: [], text: rawLine.trimEnd() })
      continue
    }

    song.lines.push(parseLyricLine(rawLine))
  }

  return song
}
