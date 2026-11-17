import { describe, expect, it } from 'vitest'

import {
  PAGE_SIZE_OPTIONS,
  clampPage,
  paginate,
  totalPages,
} from '@/features/songs/pagination'

describe('totalPages', () => {
  it('usa no mínimo 1 página, mesmo sem itens', () => {
    expect(totalPages(0, 10)).toBe(1)
    expect(totalPages(0, 'all')).toBe(1)
  })

  it('calcula páginas cheias e parciais', () => {
    expect(totalPages(10, 10)).toBe(1)
    expect(totalPages(11, 10)).toBe(2)
    expect(totalPages(60, 25)).toBe(3)
    expect(totalPages(100, 50)).toBe(2)
  })

  it('sem paginação há uma única página', () => {
    expect(totalPages(1234, 'all')).toBe(1)
  })

  it('as opções de página são 10, 25, 50 e 100', () => {
    expect([...PAGE_SIZE_OPTIONS]).toEqual([10, 25, 50, 100])
  })
})

describe('clampPage', () => {
  it('limita a página ao intervalo válido', () => {
    expect(clampPage(0, 60, 25)).toBe(1)
    expect(clampPage(-3, 60, 25)).toBe(1)
    expect(clampPage(2, 60, 25)).toBe(2)
    expect(clampPage(9, 60, 25)).toBe(3)
  })

  it('valores não finitos caem na primeira página', () => {
    expect(clampPage(Number.NaN, 60, 25)).toBe(1)
    expect(clampPage(Number.POSITIVE_INFINITY, 60, 25)).toBe(1)
  })
})

describe('paginate', () => {
  const items = Array.from({ length: 60 }, (_, index) => index + 1)

  it('fatia a primeira e a última página', () => {
    expect(paginate(items, 1, 25)).toEqual(items.slice(0, 25))
    expect(paginate(items, 3, 25)).toEqual(items.slice(50, 60))
  })

  it('clampa páginas fora do intervalo', () => {
    expect(paginate(items, 99, 25)).toEqual(items.slice(50, 60))
    expect(paginate(items, -1, 25)).toEqual(items.slice(0, 25))
  })

  it('sem paginação devolve todos os itens', () => {
    expect(paginate(items, 4, 'all')).toEqual(items)
  })

  it('lista vazia devolve vazio', () => {
    expect(paginate<number>([], 2, 10)).toEqual([])
  })
})
