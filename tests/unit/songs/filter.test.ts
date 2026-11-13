import { describe, expect, it } from 'vitest'

import { collectThemes, filterSongs } from '@/features/songs/filter'
import type { Song } from '@/types/domain'

function song(partial: Partial<Song> & Pick<Song, 'id' | 'title'>): Song {
  return {
    team_id: 'team-1',
    artist: null,
    original_key: null,
    bpm: null,
    time_signature: null,
    themes: [],
    content: '[G]letra',
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

const REPERTORY: Song[] = [
  song({ id: '1', title: 'Água Viva', artist: 'Ministério Adoração', themes: ['Adoração'] }),
  song({ id: '2', title: 'santo', artist: null, themes: ['adoração', 'Ceia'] }),
  song({ id: '3', title: 'Veja', artist: 'Renascer Praise', themes: ['Ceia'] }),
  song({ id: '4', title: 'sem temas', artist: 'Outro Artista', themes: [] }),
]

describe('busca/filtro da biblioteca (FR-013/FR-014)', () => {
  it('retorna tudo quando não há busca nem tema', () => {
    expect(filterSongs(REPERTORY).map((s) => s.id)).toEqual(['1', '2', '3', '4'])
  })

  it('busca por título é case-insensitive', () => {
    expect(filterSongs(REPERTORY, { query: 'SANTO' }).map((s) => s.id)).toEqual(['2'])
    expect(filterSongs(REPERTORY, { query: 'água viva' }).map((s) => s.id)).toEqual(['1'])
  })

  it('busca por artista é case-insensitive', () => {
    expect(filterSongs(REPERTORY, { query: 'renascer' }).map((s) => s.id)).toEqual(['3'])
  })

  it('ignora espaços nas bordas da busca', () => {
    expect(filterSongs(REPERTORY, { query: '  santo  ' }).map((s) => s.id)).toEqual(['2'])
  })

  it('artista nulo não quebra a busca', () => {
    expect(filterSongs(REPERTORY, { query: 'outronada' }).map((s) => s.id)).toEqual([])
  })

  it('filtra por tema canônico ignorando maiúsculas/minúsculas', () => {
    expect(filterSongs(REPERTORY, { theme: 'Adoração' }).map((s) => s.id)).toEqual(['1', '2'])
    expect(filterSongs(REPERTORY, { theme: 'CEIA' }).map((s) => s.id)).toEqual(['2', '3'])
  })

  it('combina busca e tema', () => {
    expect(filterSongs(REPERTORY, { query: 'santo', theme: 'Ceia' }).map((s) => s.id)).toEqual(['2'])
    expect(filterSongs(REPERTORY, { query: 'santo', theme: 'Adoração' }).map((s) => s.id)).toEqual(['2'])
    expect(filterSongs(REPERTORY, { query: 'renascer', theme: 'Adoração' })).toEqual([])
  })

  it('tema inexistente retorna vazio', () => {
    expect(filterSongs(REPERTORY, { theme: 'Natal' })).toEqual([])
  })

  it('busca sem correspondência retorna vazio', () => {
    expect(filterSongs(REPERTORY, { query: 'xyz' })).toEqual([])
  })

  it('preserva a ordem de entrada (já ordenada por título)', () => {
    expect(filterSongs(REPERTORY, { theme: 'Ceia' }).map((s) => s.title)).toEqual(['santo', 'Veja'])
  })
})

describe('collectThemes (chips da biblioteca)', () => {
  it('dedupe pela forma canônica mantendo a primeira grafia', () => {
    expect(collectThemes(REPERTORY)).toEqual(['Adoração', 'Ceia'])
  })

  it('ordena em PT-BR', () => {
    const songs = [
      song({ id: 'a', title: 'a', themes: ['dístico'] }),
      song({ id: 'b', title: 'b', themes: ['Álbum'] }),
      song({ id: 'c', title: 'c', themes: ['zelo'] }),
    ]
    expect(collectThemes(songs)).toEqual(['Álbum', 'dístico', 'zelo'])
  })

  it('retorna vazio para repertório sem temas', () => {
    expect(collectThemes([song({ id: '1', title: 'sem', themes: [] })])).toEqual([])
  })

  it('ignora temas vazios ou só com espaços', () => {
    const songs = [song({ id: '1', title: 't', themes: ['  ', 'Ceia'] })]
    expect(collectThemes(songs)).toEqual(['Ceia'])
  })
})
