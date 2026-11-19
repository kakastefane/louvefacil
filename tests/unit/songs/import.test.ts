import { describe, expect, it } from 'vitest'

import {
  SongImportError,
  parseSongJson,
  type ImportedSongValues,
} from '@/features/songs/import'
import { normalizeSongKey } from '@/features/songs/keys'

/** JSON válido no contrato da skill (exemplo do SKILL.md). */
const VALID = JSON.stringify({
  title: 'Exemplo — Canção Nova',
  artist: 'Equipe de Louvor',
  original_key: 'G',
  bpm: null,
  time_signature: null,
  themes: ['Adoração', 'Celebração'],
  content:
    '{section: Intro}\nG  D/F#  Em7  C9\n\n{section: Verso 1}\n[G]Ao raiar da manhã [D/F#]eu quero ouvir\n',
})

function issuesOf(raw: string): string[] {
  try {
    parseSongJson(raw)
  } catch (error) {
    if (error instanceof SongImportError) return error.issues
    throw error
  }
  throw new Error('A importação deveria ter falhado.')
}

function valuesOf(raw: string): ImportedSongValues {
  return parseSongJson(raw).values
}

describe('parseSongJson — contrato da skill', () => {
  it('preenche todos os campos de um JSON válido sem avisos', () => {
    const result = parseSongJson(VALID)
    expect(result.values).toEqual({
      title: 'Exemplo — Canção Nova',
      artist: 'Equipe de Louvor',
      original_key: 'G',
      bpm: '',
      time_signature: null,
      themes: ['Adoração', 'Celebração'],
      content:
        '{section: Intro}\nG  D/F#  Em7  C9\n\n{section: Verso 1}\n[G]Ao raiar da manhã [D/F#]eu quero ouvir\n',
    })
    expect(result.warnings).toEqual([])
  })

  it('converte null em campos vazios do formulário', () => {
    const values = valuesOf(
      JSON.stringify({
        title: 'Só título',
        artist: null,
        original_key: null,
        bpm: null,
        time_signature: null,
        themes: [],
        content: '{section: Verso 1}\nLetra sem acordes\n',
      }),
    )
    expect(values.artist).toBe('')
    expect(values.bpm).toBe('')
    expect(values.original_key).toBeNull()
    expect(values.time_signature).toBeNull()
    expect(values.themes).toEqual([])
  })

  it('aceita BPM como texto numérico e ignora campos desconhecidos', () => {
    const values = valuesOf(
      JSON.stringify({
        title: 'Canção',
        bpm: '72',
        time_signature: '4/4',
        themes: ['Louvor'],
        content: '{section: Verso 1}\n[G]Letra\n',
        extra: 'ignorado',
      }),
    )
    expect(values.bpm).toBe('72')
    expect(values.time_signature).toBe('4/4')
  })

  it('ignora BOM no início do arquivo', () => {
    const values = valuesOf(`\uFEFF${VALID}`)
    expect(values.title).toBe('Exemplo — Canção Nova')
  })
})

describe('parseSongJson — metadados tolerantes', () => {
  it('converte tom enarmônico para a grafia do seletor com aviso', () => {
    const result = parseSongJson(
      JSON.stringify({ title: 'T', original_key: 'D#', content: '{section: Verso 1}\n[Eb]Letra\n' }),
    )
    expect(result.values.original_key).toBe('Eb')
    expect(result.warnings.join(' ')).toContain('convertido para "Eb"')
  })

  it('guarda só a raiz de um tom com sufixo e avisa', () => {
    const result = parseSongJson(
      JSON.stringify({ title: 'T', original_key: 'Am', content: '{section: Verso 1}\n[Am]Letra\n' }),
    )
    expect(result.values.original_key).toBe('A')
    expect(result.warnings.join(' ')).toContain('sufixo "m"')
  })

  it('deixa o tom em branco quando não reconhece', () => {
    const result = parseSongJson(
      JSON.stringify({ title: 'T', original_key: 'H', content: '{section: Verso 1}\nLetra\n' }),
    )
    expect(result.values.original_key).toBeNull()
    expect(result.warnings.join(' ')).toContain('não reconhecido')
  })

  it('ignora BPM inválido ou fora da faixa e avisa', () => {
    const invalid = parseSongJson(
      JSON.stringify({ title: 'T', bpm: 72.5, content: '{section: Verso 1}\nLetra\n' }),
    )
    expect(invalid.values.bpm).toBe('')
    expect(invalid.warnings.join(' ')).toContain('BPM inválido')

    const outOfRange = parseSongJson(
      JSON.stringify({ title: 'T', bpm: 500, content: '{section: Verso 1}\nLetra\n' }),
    )
    expect(outOfRange.values.bpm).toBe('')
    expect(outOfRange.warnings.join(' ')).toContain('fora da faixa')
  })

  it('descarta compasso não suportado com aviso', () => {
    const result = parseSongJson(
      JSON.stringify({ title: 'T', time_signature: '5/8', content: '{section: Verso 1}\nLetra\n' }),
    )
    expect(result.values.time_signature).toBeNull()
    expect(result.warnings.join(' ')).toContain('não suportado')
  })

  it('normaliza temas duplicados e avisa quando passa do recomendado', () => {
    const result = parseSongJson(
      JSON.stringify({
        title: 'T',
        themes: [' louvor ', 'Louvor', 'Adoração', 'Natal', 'Páscoa', 'Missões'],
        content: '{section: Verso 1}\nLetra\n',
      }),
    )
    expect(result.values.themes).toEqual([
      'louvor',
      'Adoração',
      'Natal',
      'Páscoa',
      'Missões',
    ])
    expect(result.warnings.join(' ')).toContain('unificados')
    expect(result.warnings.join(' ')).toContain('recomendado é até 4')
  })

  it('ignora temas quando o campo não é lista', () => {
    const result = parseSongJson(
      JSON.stringify({ title: 'T', themes: 'Louvor', content: '{section: Verso 1}\nLetra\n' }),
    )
    expect(result.values.themes).toEqual([])
    expect(result.warnings.join(' ')).toContain('deveria ser uma lista')
  })
})

describe('parseSongJson — erros que impedem a importação', () => {
  it('rejeita JSON inválido', () => {
    expect(issuesOf('{ não é json')).toEqual([
      'O arquivo não é um JSON válido. Gere novamente a cifra com a skill.',
    ])
  })

  it('rejeita raiz que não é objeto', () => {
    expect(issuesOf('[]')).toEqual([
      'O JSON precisa ser um objeto com os campos "title" e "content".',
    ])
  })

  it('exige título e conteúdo', () => {
    const issues = issuesOf(
      JSON.stringify({ title: '   ', artist: 'X', content: '' }),
    )
    expect(issues).toContain('O campo "title" está ausente ou vazio.')
    expect(issues).toContain('O campo "content" está ausente ou vazio.')
  })

  it('rejeita título e artista acima do limite', () => {
    const issues = issuesOf(
      JSON.stringify({
        title: 'T'.repeat(201),
        artist: 'A'.repeat(201),
        content: '{section: Verso 1}\nLetra\n',
      }),
    )
    expect(issues.some((issue) => issue.includes('máximo 200'))).toBe(true)
  })

  it('rejeita conteúdo acima de 20.000 caracteres', () => {
    const issues = issuesOf(
      JSON.stringify({ title: 'T', content: 'a'.repeat(20001) }),
    )
    expect(issues.some((issue) => issue.includes('máximo 20000'))).toBe(true)
  })
})

describe('parseSongJson — avisos de conteúdo', () => {
  it('avisa sobre tabulações, metatag e ausência de seções', () => {
    const result = parseSongJson(
      JSON.stringify({
        title: 'T',
        content: '{key: G}\n[G]Letra\tcom tab',
      }),
    )
    const warnings = result.warnings.join(' ')
    expect(warnings).toContain('tabulações')
    expect(warnings).toContain('metatag {key:')
    expect(warnings).toContain('Nenhuma seção')
  })

  it('avisa sobre barras de compasso e marcadores de repetição', () => {
    const result = parseSongJson(
      JSON.stringify({
        title: 'T',
        content: '{section: Refrão}\n| G | D |\n[2x] Letra',
      }),
    )
    const warnings = result.warnings.join(' ')
    expect(warnings).toContain('barras de compasso')
    expect(warnings).toContain('[2x]')
  })
})

describe('normalizeSongKey', () => {
  it('mantém tons canônicos', () => {
    expect(normalizeSongKey('G')).toEqual({
      key: 'G',
      converted: false,
      droppedSuffix: null,
    })
    expect(normalizeSongKey('Bb').key).toBe('Bb')
  })

  it('resolve enarmonia e aceita símbolos unicode', () => {
    expect(normalizeSongKey('G#').key).toBe('Ab')
    expect(normalizeSongKey('Gb').key).toBe('F#')
    expect(normalizeSongKey('F♯').key).toBe('F#')
    expect(normalizeSongKey('D♭').key).toBe('C#')
  })

  it('aceita minúsculas e devolve o sufixo descartado', () => {
    expect(normalizeSongKey('am')).toEqual({
      key: 'A',
      converted: false,
      droppedSuffix: 'm',
    })
    expect(normalizeSongKey('Gmaj7').droppedSuffix).toBe('maj7')
  })

  it('devolve null para entradas que não são tom', () => {
    expect(normalizeSongKey('').key).toBeNull()
    expect(normalizeSongKey('H').key).toBeNull()
    expect(normalizeSongKey(42).key).toBeNull()
  })
})
