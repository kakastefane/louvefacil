import { describe, expect, it } from 'vitest'
import { normalizeThemes, themeKey } from '@/lib/utils'
import { suggestThemes } from '@/features/songs/filter'

describe('normalização de temas (FR-018)', () => {
  it('remove espaços nas bordas e colapsa espaços internos', () => {
    expect(normalizeThemes(['  Natal  ', 'Queima  de\nJoão'])).toEqual([
      'Natal',
      'Queima de João',
    ])
  })

  it('descarta entradas vazias ou só com espaços', () => {
    expect(normalizeThemes(['', '   ', '\t', 'Adoração'])).toEqual(['Adoração'])
  })

  it('remove duplicatas equivalentes ignorando maiúsculas/minúsculas', () => {
    expect(normalizeThemes(['Natal', 'NATAL', 'natal'])).toEqual(['Natal'])
  })

  it('mantém a grafia da primeira ocorrência', () => {
    expect(normalizeThemes(['queima de joão', 'Queima de João'])).toEqual([
      'queima de joão',
    ])
  })

  it('deduplica mesmo com espaçamento diferente', () => {
    expect(normalizeThemes(['Natal', '  Natal  '])).toEqual(['Natal'])
  })

  it('preserva temas distintos que diferem só em espaçamento interno', () => {
    expect(normalizeThemes(['Dia das Mães', 'Dia dasMães'])).toEqual([
      'Dia das Mães',
      'Dia dasMães',
    ])
  })

  it('retorna array vazio para entrada vazia', () => {
    expect(normalizeThemes([])).toEqual([])
  })

  it('não muta o array de entrada', () => {
    const entrada = ['Natal', ' NATAL ']
    normalizeThemes(entrada)
    expect(entrada).toEqual(['Natal', ' NATAL '])
  })
})

describe('chave canônica de tema (themeKey)', () => {
  it('normaliza ignorando maiúsculas/minúsculas', () => {
    expect(themeKey('Natal')).toBe('natal')
    expect(themeKey('NATAL')).toBe('natal')
  })

  it('aplica trim e colapsa espaços internos', () => {
    expect(themeKey('  Queima   de  João ')).toBe('queima de joão')
  })

  it('coerência com normalizeThemes: chaves iguais para grafias equivalentes', () => {
    const a = themeKey('Queima de João')
    const b = themeKey('  QUEIMA  DE JOÃO')
    expect(a).toBe(b)
    // normalizeThemes mantém só a primeira ocorrência dessa chave
    expect(normalizeThemes(['Queima de João', '  QUEIMA  DE JOÃO'])).toEqual([
      'Queima de João',
    ])
  })
})

describe('sugestões do autocomplete de temas', () => {
  const existentes = ['Adoração', 'Natal', 'Santa Ceia', 'Ceia do Senhor']

  it('retorna vazio quando o texto digitado é vazio ou só espaços', () => {
    expect(suggestThemes(existentes, [], '')).toEqual([])
    expect(suggestThemes(existentes, [], '   ')).toEqual([])
  })

  it('busca por substring ignorando maiúsculas/minúsculas', () => {
    expect(suggestThemes(existentes, [], 'CEI')).toEqual([
      'Ceia do Senhor',
      'Santa Ceia',
    ])
  })

  it('exclui temas já selecionados (comparação canônica)', () => {
    expect(suggestThemes(existentes, ['NATAL'], 'a')).toEqual([
      'Adoração',
      'Ceia do Senhor',
      'Santa Ceia',
    ])
  })

  it('coloca correspondências por prefixo antes das demais', () => {
    expect(suggestThemes(['Ceia do Senhor', 'Santa Ceia'], [], 'ceia')).toEqual([
      'Ceia do Senhor',
      'Santa Ceia',
    ])
  })

  it('respeita o limite de sugestões', () => {
    expect(suggestThemes(existentes, [], 'a', 2)).toHaveLength(2)
  })

  it('não muta o array de temas disponíveis', () => {
    const entrada = ['Santa Ceia', 'Ceia do Senhor']
    suggestThemes(entrada, [], 'ceia')
    expect(entrada).toEqual(['Santa Ceia', 'Ceia do Senhor'])
  })
})
