import { describe, expect, it } from 'vitest'

import {
  clampTranspose,
  renumberPositions,
  stepTranspose,
  transposeLabel,
} from '@/features/setlists/positions'

describe('renumberPositions (1..n após remoção/reordenação)', () => {
  it('numera de 1 a n na ordem fornecida', () => {
    const map = renumberPositions(['a', 'b', 'c'])
    expect(map.get('a')).toBe(1)
    expect(map.get('b')).toBe(2)
    expect(map.get('c')).toBe(3)
  })

  it('lista vazia gera mapa vazio', () => {
    expect(renumberPositions([]).size).toBe(0)
  })

  it('reordenação reflete a nova sequência', () => {
    const map = renumberPositions(['c', 'a', 'b'])
    expect(map.get('c')).toBe(1)
    expect(map.get('a')).toBe(2)
    expect(map.get('b')).toBe(3)
  })

  it('após remoção do item do meio, as posições ficam contíguas', () => {
    // antes: a=1, b=2, c=3 — removeu b → ordem restante a,c vira 1,2
    const map = renumberPositions(['a', 'c'])
    expect([...map.entries()]).toEqual([
      ['a', 1],
      ['c', 2],
    ])
  })

  it('ids repetidos: o último índice vence (contrato defensivo)', () => {
    const map = renumberPositions(['a', 'a', 'b'])
    expect(map.get('a')).toBe(2)
    expect(map.get('b')).toBe(3)
  })
})

describe('clampTranspose (limites −11..+11)', () => {
  it('mantém valores dentro da faixa', () => {
    expect(clampTranspose(0)).toBe(0)
    expect(clampTranspose(5)).toBe(5)
    expect(clampTranspose(-7)).toBe(-7)
    expect(clampTranspose(11)).toBe(11)
    expect(clampTranspose(-11)).toBe(-11)
  })

  it('corta valores acima e abaixo dos limites', () => {
    expect(clampTranspose(12)).toBe(11)
    expect(clampTranspose(99)).toBe(11)
    expect(clampTranspose(-12)).toBe(-11)
    expect(clampTranspose(-99)).toBe(-11)
  })

  it('arredonda decimais', () => {
    expect(clampTranspose(2.6)).toBe(3)
    expect(clampTranspose(-1.4)).toBe(-1)
  })

  it('valores não finitos viram 0', () => {
    expect(clampTranspose(Number.NaN)).toBe(0)
    expect(clampTranspose(Number.POSITIVE_INFINITY)).toBe(0)
    expect(clampTranspose(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})

describe('transposeLabel', () => {
  it('formata positivo com sinal, zero sem sinal e negativo com hífen', () => {
    expect(transposeLabel(2)).toBe('+2')
    expect(transposeLabel(0)).toBe('0')
    expect(transposeLabel(-1)).toBe('-1')
  })

  it('aplica clamp antes de formatar', () => {
    expect(transposeLabel(99)).toBe('+11')
    expect(transposeLabel(-99)).toBe('-11')
  })
})

describe('stepTranspose (incremento unitário com teto)', () => {
  it('incrementa e decrementa dentro da faixa', () => {
    expect(stepTranspose(0, 1)).toBe(1)
    expect(stepTranspose(0, -1)).toBe(-1)
  })

  it('não ultrapassa os limites', () => {
    expect(stepTranspose(11, 1)).toBe(11)
    expect(stepTranspose(-11, -1)).toBe(-11)
  })

  it('funciona a partir de valores fracionários', () => {
    expect(stepTranspose(1.6, 1)).toBe(3)
  })
})
