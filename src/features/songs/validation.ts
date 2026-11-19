/**
 * Validação de cifras no contrato da skill `cifras-chordpro`.
 *
 * Este módulo é a fonte única das regras usadas pelo script
 * `scripts/validate-cifra.ts` e pela importação de JSON no editor. É puro e
 * roda igual no Node e no navegador: erros impedem a cifra de ser considerada
 * válida; avisos pedem conferência, mas não bloqueiam.
 *
 * As regras espelham o parser/render reais (`src/features/chords`) e as
 * validações do service/banco (`src/features/songs/service.ts`, migrações).
 */
import { isChordToken, parseChordPro } from '@/features/chords/parser'
import { buildChordSegments, renderSong } from '@/features/chords/render'
import type { RenderedChord } from '@/features/chords/render'
import { normalizeThemes, themeKey } from '@/lib/utils'

const TITLE_MAX = 200
const ARTIST_MAX = 200
const CONTENT_MAX = 20000
const BPM_MIN = 20
const BPM_MAX = 400
const MAX_THEMES = 4
const VALID_METERS = new Set([
  '2/4',
  '3/4',
  '4/4',
  '5/4',
  '6/4',
  '6/8',
  '7/8',
  '9/8',
  '12/8',
  '2/2',
])
const ORIGINAL_KEY_PATTERN = /^[A-G][#b]?$/
const META_LINE = /^\s*\{\s*([^}]*)\}\s*$/
const BRACKET_SECTION_LINE = /^\s*\[([^\]]+)\]\s*(.*)$/

interface SongInput {
  title?: unknown
  artist?: unknown
  original_key?: unknown
  bpm?: unknown
  time_signature?: unknown
  themes?: unknown
  content?: unknown
}

export interface CifraSummary {
  sections: number
  lyricLines: number
  chordLines: number
  inlineChords: number
}

export interface CifraValidation {
  /** Problemas que tornam a cifra inválida no contrato da skill. */
  errors: string[]
  /** Pontos para conferir; não impedem a importação. */
  warnings: string[]
  summary: CifraSummary
  /** Prévia em texto com os acordes acima da letra (mesma do script). */
  preview: string
}

type Push = (message: string) => void

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function validateMetadata(data: SongInput, error: Push, warn: Push): void {
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  if (!title) error('Título ausente ou vazio.')
  else if (title.length > TITLE_MAX)
    error(`Título com ${title.length} caracteres (máximo ${TITLE_MAX}).`)

  if (data.artist != null && typeof data.artist !== 'string')
    error('Artista deve ser texto ou null.')
  else if (
    typeof data.artist === 'string' &&
    data.artist.trim().length > ARTIST_MAX
  )
    error(`Artista com mais de ${ARTIST_MAX} caracteres.`)

  if (data.original_key != null) {
    if (
      typeof data.original_key !== 'string' ||
      !ORIGINAL_KEY_PATTERN.test(data.original_key.trim())
    ) {
      error(
        'Tom original inválido: use apenas a raiz (A–G, com # ou b). Ex.: "G", "Bb", "F#". Sem "m", "maj" nem "menor".',
      )
    }
  }

  if (data.bpm != null) {
    const bpm = data.bpm
    if (typeof bpm !== 'number' || !Number.isInteger(bpm))
      error('BPM deve ser um número inteiro (ou null quando desconhecido).')
    else if (bpm < BPM_MIN || bpm > BPM_MAX)
      error(`BPM ${bpm} fora da faixa ${BPM_MIN}–${BPM_MAX}.`)
  }

  if (data.time_signature != null) {
    const meter = data.time_signature
    if (typeof meter !== 'string' || !VALID_METERS.has(meter.trim()))
      error(
        `Compasso inválido. Aceitos: ${[...VALID_METERS].join(', ')}. Deixe null se não tiver certeza.`,
      )
  }

  if (!Array.isArray(data.themes)) {
    error('Temas deve ser uma lista de textos (pode ser vazia).')
    return
  }
  const rawThemes = data.themes.filter(
    (theme): theme is string => typeof theme === 'string',
  )
  if (rawThemes.length !== data.themes.length)
    error('Todos os temas devem ser textos.')
  const normalized = normalizeThemes(rawThemes)
  if (normalized.length !== rawThemes.length)
    warn(
      'Há temas vazios ou duplicados (comparação ignora maiúsculas/minúsculas e espaços); eles serão unificados ao salvar.',
    )
  const keys = new Set(normalized.map(themeKey))
  if (keys.size !== normalized.length)
    warn('Temas duplicados por diferença de grafia — mantenha apenas uma forma.')
  if (normalized.length > MAX_THEMES)
    warn(
      `${normalized.length} temas definidos; o recomendado é no máximo ${MAX_THEMES} para não poluir a biblioteca.`,
    )
  for (const theme of normalized) {
    if (theme.length > 40)
      warn(`Tema muito longo (${theme.length} caracteres): "${theme}".`)
  }
}

/** Verifica padrões que o parser aceita mas renderizam mal ou são ignorados. */
function validateContentSyntax(content: string, error: Push, warn: Push): void {
  if (content.includes('\t'))
    error('O conteúdo tem tabulações (\\t). Use apenas espaços.')

  if (/&(nbsp|amp|lt|gt|quot|#\d+);/i.test(content))
    error(
      'O conteúdo tem entidades HTML (&nbsp;, &amp;…). Decodifique antes de salvar.',
    )

  if (/<[a-z][^>]*>/i.test(content))
    error('O conteúdo tem tags HTML. Remova toda marcação.')

  if (/\bN\.?\s*C\.?\b/i.test(content))
    warn(
      '"N.C." não é acorde válido no formato: remova ou registre como observação na seção.',
    )

  if (/\|/m.test(content))
    warn(
      'Barras de compasso "|" não são suportadas: a linha vira letra. Separe acordes apenas por espaços.',
    )

  if (/\[[^\]]*\d+\s*[xX]\]/.test(content))
    warn(
      'Marcadores como "[2x]" viram acordes literais. Coloque a repetição no rótulo da seção: {section: Refrão (2x)}.',
    )

  const rawLines = content.split(/\r?\n/)
  for (const [index, rawLine] of rawLines.entries()) {
    const lineNo = index + 1

    const meta = rawLine.match(META_LINE)
    if (meta) {
      const body = meta[1]
      if (/^\s*(section|sec|seção|secao)\s*:/i.test(body)) {
        const label = (body.split(':').slice(1).join(':') ?? '').trim()
        if (!label) warn(`Linha ${lineNo}: seção sem rótulo.`)
        continue
      }
      if (/^\s*(title|artist|key)\s*:/i.test(body))
        warn(
          `Linha ${lineNo}: metatag "${body.trim()}" é aceita, mas duplica o cabeçalho do visualizador. Prefira os campos do formulário (título/artista/tom) e remova a metatag do conteúdo.`,
        )
      else
        warn(
          `Linha ${lineNo}: diretiva "{${body.trim()}}" será ignorada no render. Converta para {section: …} ou remova.`,
        )
      continue
    }

    const open = (rawLine.match(/\[/g) ?? []).length
    const close = (rawLine.match(/\]/g) ?? []).length
    if (open !== close)
      warn(
        `Linha ${lineNo}: colchetes desbalanceados — o texto após "[" será exibido literalmente.`,
      )
    const closeFirst = rawLine.indexOf(']')
    const openFirst = rawLine.indexOf('[')
    if (closeFirst !== -1 && (openFirst === -1 || closeFirst < openFirst))
      warn(`Linha ${lineNo}: "]" antes de "[" — o render pode ficar confuso.`)

    const sectionLine = rawLine.match(BRACKET_SECTION_LINE)
    if (sectionLine) {
      const label = sectionLine[1].trim()
      const remainder = sectionLine[2].trim()
      // "[G]Letra…" é acorde inline no início da linha — correto.
      if (isChordToken(label)) continue
      const allChords =
        remainder === '' ||
        remainder.split(/\s+/).every((token) => isChordToken(token))
      if (!allChords)
        error(
          `Linha ${lineNo}: rótulo de seção seguido de letra — "[${label}] ${remainder}". Isso NÃO vira seção: o rótulo é tratado como acorde literal. Use {section: ${label}} em uma linha e a letra na linha seguinte.`,
        )
      continue
    }

    if (!rawLine.includes('[') && rawLine.trim() !== '') {
      const tokens = rawLine.trim().split(/\s+/)
      const chordCount = tokens.filter((token) => isChordToken(token)).length
      if (chordCount >= 2 && chordCount < tokens.length)
        warn(
          `Linha ${lineNo}: parece linha de acordes, mas tem token inválido — será renderizada como letra: "${rawLine.trim()}"`,
        )
    }
  }
}

/** Avisa sobre acordes inline que o parser exibe literalmente (sem transpor). */
function validateChords(content: string, warn: Push): void {
  const parsed = parseChordPro(content)
  for (const [index, line] of parsed.lines.entries()) {
    if (line.type !== 'lyric') continue

    // Linha longa com muitos acordes costuma ser sinal de versos juntados na
    // conversão (cada verso da fonte deve continuar em sua própria linha).
    if (line.text.length > 60 && line.chords.length >= 3) {
      warn(
        `Linha de letra ${index + 1}: ${line.chords.length} acordes em ${line.text.length} caracteres — confira se você não juntou versos da fonte na mesma linha.`,
      )
    }

    for (const slot of line.chords) {
      if (!isChordToken(slot.chord.trim()))
        warn(
          `Acorde não reconhecido "${slot.chord}" (linha de letra ${index + 1}): será exibido literalmente e NÃO será transposto. Use notação latina: A–G, #/b, sufixos (m, 7, maj7, sus4…).`,
        )
    }
  }

  const sectionCount = parsed.lines.filter(
    (line) => line.type === 'section',
  ).length
  if (sectionCount === 0)
    warn(
      'Nenhuma seção marcada — o visualizador ficará sem os badges (Intro, Verso, Refrão…).',
    )
}

/** Mesma composição do ChordPreview: acordes posicionados por coluna. */
function chordRows(chords: RenderedChord[]): string[] {
  const segments = buildChordSegments(chords)
  if (segments.length === 0) return []
  return [segments.map(({ pad, label }) => ' '.repeat(pad) + label).join('')]
}

function buildPreview(content: string): string {
  const rendered = renderSong(parseChordPro(content), { semitones: 0 })
  const out: string[] = []
  for (const line of rendered.lines) {
    if (line.type === 'empty') {
      out.push('')
      continue
    }
    if (line.type === 'section') {
      out.push(`── ${line.label.toUpperCase()} ──`)
      out.push(...chordRows(line.chords))
      continue
    }
    if (line.type === 'chords') {
      out.push(...chordRows(line.chords))
      continue
    }
    const chords = chordRows(line.chords)
    out.push(...chords)
    out.push(line.text)
  }
  return out.join('\n')
}

/**
 * Valida um JSON no contrato da skill. Nunca lança: devolve listas vazias
 * quando está tudo certo. O mesmo resultado alimenta o script de linha de
 * comando e o diálogo de importação no app.
 */
export function validateCifra(input: unknown): CifraValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const error: Push = (message) => errors.push(message)
  const warn: Push = (message) => warnings.push(message)

  const data = asRecord(input) as SongInput
  validateMetadata(data, error, warn)

  const content = typeof data.content === 'string' ? data.content : ''
  if (!content.trim()) {
    error('Conteúdo ausente ou vazio.')
    return {
      errors,
      warnings,
      summary: { sections: 0, lyricLines: 0, chordLines: 0, inlineChords: 0 },
      preview: '',
    }
  }

  if (content.length > CONTENT_MAX)
    error(`Conteúdo com ${content.length} caracteres (máximo ${CONTENT_MAX}).`)
  validateContentSyntax(content, error, warn)
  validateChords(content, warn)

  const parsed = parseChordPro(content)
  const sections = parsed.lines.filter((line) => line.type === 'section').length
  const lyricLines = parsed.lines.filter((line) => line.type === 'lyric').length
  const chordLines = parsed.lines.filter((line) => line.type === 'chords').length
  const inlineChords = parsed.lines.reduce(
    (total, line) => total + (line.type === 'lyric' ? line.chords.length : 0),
    0,
  )

  return {
    errors,
    warnings,
    summary: { sections, lyricLines, chordLines, inlineChords },
    preview: buildPreview(content),
  }
}

/**
 * Relatório em texto pronto para copiar e enviar ao agente que gerou o JSON.
 * Inclui título, erros, avisos e o resumo da estrutura.
 */
export function formatCifraReport(
  input: unknown,
  report: CifraValidation,
  fileName?: string,
): string {
  const data = asRecord(input) as SongInput
  const title =
    typeof data.title === 'string' && data.title.trim()
      ? data.title.trim()
      : '(sem título)'

  const lines: string[] = []
  if (fileName) lines.push(`Arquivo: ${fileName}`)
  lines.push(`Cifra: ${title}`)
  lines.push('')

  if (report.errors.length > 0) {
    lines.push(`ERROS (${report.errors.length}):`)
    for (const [index, message] of report.errors.entries())
      lines.push(`${index + 1}. ${message}`)
    lines.push('')
  }

  if (report.warnings.length > 0) {
    lines.push(`AVISOS (${report.warnings.length}):`)
    for (const [index, message] of report.warnings.entries())
      lines.push(`${index + 1}. ${message}`)
    lines.push('')
  }

  if (report.errors.length === 0 && report.warnings.length === 0) {
    lines.push('Nenhum erro ou aviso.')
    lines.push('')
  }

  lines.push(
    `Resumo: ${report.summary.sections} seção(ões), ${report.summary.lyricLines} linha(s) de letra, ${report.summary.chordLines} linha(s) só de acordes, ${report.summary.inlineChords} acorde(s) inline.`,
  )

  return lines.join('\n')
}
