import { describe, expect, it } from 'vitest'

import { formatCifraReport, validateCifra } from '@/features/songs/validation'
import { parseSongJson } from '@/features/songs/import'

const VALID = {
  title: 'Exemplo — Canção Nova',
  artist: 'Equipe de Louvor',
  original_key: 'G',
  bpm: 72,
  time_signature: '4/4',
  themes: ['Adoração', 'Celebração'],
  content:
    '{section: Verso 1}\n[G]Ao raiar da manhã [D/F#]eu quero ouvir\n',
}

describe('validateCifra — contrato da skill', () => {
  it('aprova uma cifra válida e resume a estrutura', () => {
    const report = validateCifra(VALID)
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
    expect(report.summary).toEqual({
      sections: 1,
      lyricLines: 1,
      chordLines: 0,
      inlineChords: 2,
    })
    expect(report.preview).toContain('── VERSO 1 ──')
    expect(report.preview).toContain('Ao raiar da manhã')
  })

  it('rejeita título, artista, tom, BPM, compasso e temas inválidos', () => {
    const report = validateCifra({
      title: '   ',
      artist: 42,
      original_key: 'Am',
      bpm: '72',
      time_signature: '5/8',
      themes: 'Louvor',
      content: '{section: Verso 1}\n[G]Letra\n',
    })
    const errors = report.errors.join(' ')
    expect(errors).toContain('Título ausente')
    expect(errors).toContain('Artista deve ser texto')
    expect(errors).toContain('Tom original inválido')
    expect(errors).toContain('BPM deve ser um número inteiro')
    expect(errors).toContain('Compasso inválido')
    expect(errors).toContain('Temas deve ser uma lista')
  })

  it('rejeita conteúdo ausente e conteúdo acima do limite', () => {
    expect(validateCifra({ title: 'T', themes: [] }).errors).toContain(
      'Conteúdo ausente ou vazio.',
    )

    const long = validateCifra({
      title: 'T',
      themes: [],
      content: 'a'.repeat(20001),
    })
    expect(long.errors.join(' ')).toContain('máximo 20000')
  })

  it('rejeita tabulações, entidades e tags HTML', () => {
    const tab = validateCifra({
      title: 'T',
      themes: [],
      content: '{section: Verso 1}\n[G]Le\tra\n',
    })
    expect(tab.errors.join(' ')).toContain('tabulações')

    const entity = validateCifra({
      title: 'T',
      themes: [],
      content: '{section: Verso 1}\n[G]Le&nbsp;tra\n',
    })
    expect(entity.errors.join(' ')).toContain('entidades HTML')

    const html = validateCifra({
      title: 'T',
      themes: [],
      content: '{section: Verso 1}\n<b>[G]Letra</b>\n',
    })
    expect(html.errors.join(' ')).toContain('tags HTML')
  })

  it('rejeita rótulo de seção seguido de letra na mesma linha', () => {
    const report = validateCifra({
      title: 'T',
      themes: [],
      content: '[Refrão] Tu és bom\n',
    })
    expect(report.errors.join(' ')).toContain('rótulo de seção seguido de letra')
  })

  it('avisa sobre acordes não reconhecidos e ausência de seções', () => {
    const report = validateCifra({
      title: 'T',
      themes: [],
      content: '[H7]Letra sem seção\n',
    })
    const warnings = report.warnings.join(' ')
    expect(warnings).toContain('Acorde não reconhecido "H7"')
    expect(warnings).toContain('Nenhuma seção marcada')
  })

  it('avisa sobre versos juntados em uma linha longa', () => {
    const report = validateCifra({
      title: 'T',
      themes: [],
      content:
        '{section: Verso 1}\n[C]Rei do meu coração [Am]Seja o monte que percorro [F9]A fonte que eu bebo [C]És minha canção\n',
    })
    expect(report.warnings.join(' ')).toContain('versos da fonte')
  })
})

describe('formatCifraReport', () => {
  it('monta um relatório copiável com erros, avisos e resumo', () => {
    const input = {
      title: 'Teste',
      themes: [],
      content: '[H7]Letra\n',
    }
    const report = validateCifra(input)
    const text = formatCifraReport(input, report, 'teste.json')
    expect(text).toContain('Arquivo: teste.json')
    expect(text).toContain('Cifra: Teste')
    expect(text).toContain('AVISOS (')
    expect(text).toContain('Acorde não reconhecido')
    expect(text).toContain('Resumo:')
  })

  it('indica quando não há nada para corrigir', () => {
    const text = formatCifraReport(VALID, validateCifra(VALID))
    expect(text).toContain('Nenhum erro ou aviso.')
  })
})

describe('parseSongJson — integração com o validador', () => {
  it('devolve o relatório do validador e os ajustes de metadados', () => {
    const result = parseSongJson(
      JSON.stringify({
        title: 'Canção',
        artist: 'Artista',
        original_key: 'Am',
        bpm: null,
        time_signature: null,
        themes: ['Louvor'],
        content: '{section: Verso 1}\n[Am]Letra\n',
      }),
    )
    expect(result.validation.errors.join(' ')).toContain('Tom original inválido')
    expect(result.adjustments.join(' ')).toContain('sufixo "m"')
    expect(result.report).toContain('ERROS (')
    expect(result.report).toContain('Tom original inválido')
  })
})
