import { parseChordPro } from '@/features/chords/parser'
import { normalizeThemes } from '@/lib/utils'
import { normalizeSongKey, type SongKey } from '@/features/songs/keys'
import {
  formatCifraReport,
  validateCifra,
  type CifraValidation,
} from '@/features/songs/validation'

/**
 * Importação do JSON gerado pela skill `cifras-chordpro` para os campos do
 * editor. O formato de entrada é o contrato da skill:
 *
 *   { title, artist, original_key, bpm, time_signature, themes, content }
 *
 * A importação é tolerante com metadados fora do padrão (tom enarmônico,
 * BPM como texto, compasso desconhecido): o que não dá para representar vira
 * aviso e o campo fica em branco, para a pessoa conferir e salvar. Só
 * `title` e `content` bloqueiam a importação quando ausentes/inválidos.
 */

export const SONG_IMPORT_MAX_BYTES = 1_000_000

const TITLE_MAX = 200
const ARTIST_MAX = 200
const CONTENT_MAX = 20000
const BPM_MIN = 20
const BPM_MAX = 400
const MAX_RECOMMENDED_THEMES = 4
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

/** Valores prontos para preencher o `SongEditorForm` (tipos dos campos). */
export interface ImportedSongValues {
  title: string
  artist: string
  original_key: SongKey | null
  bpm: string
  time_signature: string | null
  themes: string[]
  content: string
}

export interface SongImportResult {
  values: ImportedSongValues
  /** Pontos para a pessoa revisar antes de salvar (não impedem a importação). */
  warnings: string[]
  /** Ajustes automáticos de metadados (tom, BPM, temas) aplicados ao formulário. */
  adjustments: string[]
  /**
   * Relatório do validador da skill (o mesmo do script). Erros não bloqueiam
   * o preenchimento, mas indicam que o JSON precisa ser corrigido no agente.
   */
  validation: CifraValidation
  /** Relatório em texto, pronto para copiar e enviar ao agente. */
  report: string
}

/** Erro de importação: um ou mais motivos que impedem preencher os campos. */
export class SongImportError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(issues.join(' '))
    this.name = 'SongImportError'
    this.issues = issues
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

/** Avisos de conteúdo que o render exibe de forma inesperada (espelham a skill). */
function collectContentWarnings(content: string, warnings: string[]): void {
  if (content.includes('\t')) {
    warnings.push('O conteúdo tem tabulações (\\t) — troque por espaços.')
  }
  if (/&(nbsp|amp|lt|gt|quot|#\d+);/i.test(content)) {
    warnings.push('O conteúdo tem entidades HTML (&nbsp;, &amp;…) — decodifique antes de salvar.')
  }
  if (/<[a-z][^>]*>/i.test(content)) {
    warnings.push('O conteúdo tem tags HTML — remova a marcação.')
  }

  const meta = content.match(/^\s*\{\s*(title|artist|key)\s*:/im)
  if (meta) {
    warnings.push(
      `O conteúdo tem a metatag {${meta[1]}:…}, que duplica o cabeçalho — remova e mantenha o valor nos campos.`,
    )
  }
  if (/\|/m.test(content)) {
    warnings.push('O conteúdo tem barras de compasso "|" — elas viram letra; separe os acordes por espaços.')
  }
  if (/\[[^\]]*\d+\s*[xX]\]/.test(content)) {
    warnings.push('Marcadores como "[2x]" viram acordes literais — use {section: Refrão (2x)}.')
  }

  const unbalanced = content.split(/\r?\n/).findIndex((line) => {
    const open = (line.match(/\[/g) ?? []).length
    const close = (line.match(/\]/g) ?? []).length
    return open !== close
  })
  if (unbalanced !== -1) {
    warnings.push(
      `Linha ${unbalanced + 1}: colchetes desbalanceados — o texto após "[" pode aparecer literalmente.`,
    )
  }

  const parsed = parseChordPro(content)
  const sections = parsed.lines.filter((line) => line.type === 'section').length
  if (sections === 0) {
    warnings.push('Nenhuma seção marcada ({section: …}) — a cifra ficará sem os badges.')
  }

  // Linhas muito longas com vários acordes costumam indicar versos juntados
  // na conversão (cada verso da fonte deve ficar em sua própria linha).
  parsed.lines.forEach((line, index) => {
    if (
      line.type === 'lyric' &&
      line.text.length > 60 &&
      line.chords.length >= 3
    ) {
      warnings.push(
        `Linha ${index + 1}: ${line.chords.length} acordes em uma linha longa — confira se versos da fonte não foram juntados.`,
      )
    }
  })
}

/**
 * Lê e valida o texto de um arquivo JSON da skill. Lança `SongImportError`
 * quando o arquivo nem pode preencher os campos; caso contrário devolve os
 * valores prontos para o formulário + avisos para conferência.
 */
export function parseSongJson(raw: string): SongImportResult {
  let json: unknown
  try {
    // BOM (arquivos salvos no Windows) quebra o JSON.parse
    json = JSON.parse(raw.replace(/^\uFEFF/, ''))
  } catch {
    throw new SongImportError([
      'O arquivo não é um JSON válido. Gere novamente a cifra com a skill.',
    ])
  }

  const data = asRecord(json)
  if (!data) {
    throw new SongImportError([
      'O JSON precisa ser um objeto com os campos "title" e "content".',
    ])
  }

  const issues: string[] = []
  const warnings: string[] = []
  const adjustments: string[] = []
  /** Ajuste de metadado: aparece nos avisos e no bloco de ajustes da tela. */
  const adjust = (message: string) => {
    warnings.push(message)
    adjustments.push(message)
  }

  const title =
    typeof data.title === 'string' ? data.title.trim() : ''
  if (!title) {
    issues.push('O campo "title" está ausente ou vazio.')
  } else if (title.length > TITLE_MAX) {
    issues.push(`O título tem ${title.length} caracteres (máximo ${TITLE_MAX}).`)
  }

  let artist = ''
  if (data.artist != null) {
    if (typeof data.artist !== 'string') {
      adjust('O campo "artist" deveria ser texto ou null — foi ignorado.')
    } else {
      artist = data.artist.trim()
      if (artist.length > ARTIST_MAX) {
        issues.push(
          `O artista tem ${artist.length} caracteres (máximo ${ARTIST_MAX}).`,
        )
      }
    }
  }

  let originalKey: SongKey | null = null
  if (data.original_key != null) {
    const normalized = normalizeSongKey(data.original_key)
    originalKey = normalized.key
    const rawKey = String(data.original_key).trim()
    if (!normalized.key) {
      adjust(
        `Tom original "${rawKey}" não reconhecido — deixado em branco; escolha manualmente.`,
      )
    } else {
      if (normalized.converted) {
        adjust(
          `Tom "${rawKey}" convertido para "${normalized.key}" (grafia do seletor).`,
        )
      }
      if (normalized.droppedSuffix) {
        adjust(
          `Tom "${rawKey}" importado como "${normalized.key}": o seletor guarda só a raiz; o sufixo "${normalized.droppedSuffix}" fica nos acordes.`,
        )
      }
    }
  }

  let bpm = ''
  if (data.bpm != null) {
    const parsed =
      typeof data.bpm === 'number'
        ? data.bpm
        : typeof data.bpm === 'string' && data.bpm.trim() !== ''
          ? Number(data.bpm)
          : Number.NaN
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      adjust('BPM inválido (precisa ser um número inteiro) — deixado em branco.')
    } else if (parsed < BPM_MIN || parsed > BPM_MAX) {
      adjust(
        `BPM ${parsed} fora da faixa ${BPM_MIN}–${BPM_MAX} — deixado em branco.`,
      )
    } else {
      bpm = String(parsed)
    }
  }

  let timeSignature: string | null = null
  if (data.time_signature != null) {
    if (typeof data.time_signature !== 'string') {
      adjust('Compasso inválido — deixado em branco; escolha manualmente.')
    } else {
      const meter = data.time_signature.trim()
      if (VALID_METERS.has(meter)) {
        timeSignature = meter
      } else {
        adjust(
          `Compasso "${meter}" não suportado — deixado em branco; escolha manualmente.`,
        )
      }
    }
  }

  let themes: string[] = []
  if (data.themes != null) {
    if (!Array.isArray(data.themes)) {
      adjust('O campo "themes" deveria ser uma lista — foi ignorado.')
    } else {
      const rawThemes = data.themes.filter(
        (theme): theme is string => typeof theme === 'string',
      )
      if (rawThemes.length !== data.themes.length) {
        adjust('Alguns temas não eram texto e foram ignorados.')
      }
      themes = normalizeThemes(rawThemes)
      if (themes.length !== rawThemes.length) {
        adjust('Havia temas vazios ou duplicados; eles foram unificados.')
      }
      if (themes.length > MAX_RECOMMENDED_THEMES) {
        adjust(
          `A cifra veio com ${themes.length} temas (o recomendado é até ${MAX_RECOMMENDED_THEMES}).`,
        )
      }
    }
  }

  const content = typeof data.content === 'string' ? data.content : ''
  if (!content.trim()) {
    issues.push('O campo "content" está ausente ou vazio.')
  } else if (content.length > CONTENT_MAX) {
    issues.push(
      `O conteúdo tem ${content.length} caracteres (máximo ${CONTENT_MAX}).`,
    )
  } else {
    collectContentWarnings(content, warnings)
  }

  if (issues.length > 0) throw new SongImportError(issues)

  const validation = validateCifra(json)

  return {
    values: {
      title,
      artist,
      original_key: originalKey,
      bpm,
      time_signature: timeSignature,
      themes,
      content,
    },
    warnings,
    adjustments,
    validation,
    report: formatCifraReport(json, validation),
  }
}
