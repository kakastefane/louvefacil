import { describe, expect, it } from 'vitest'
import { normalizeThemes, themeKey } from '@/lib/utils'

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
