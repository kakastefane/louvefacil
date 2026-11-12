import { describe, expect, it } from 'vitest'
import { parseChordPro } from '@/features/chords/parser'
import { buildChordSegments, renderSong } from '@/features/chords/render'

describe('renderSong', () => {
  it('renderiza acordes inline transpostos e preserva o texto', () => {
    const parsed = parseChordPro('{title: T}\n{key: G}\n\n[G]Cada [D/F#]palavra')
    const rendered = renderSong(parsed, { semitones: 2 })

    expect(rendered.displayedKey).toBe('A')
    const lyric = rendered.lines.find((l) => l.type === 'lyric')
    expect(lyric && lyric.type === 'lyric').toBe(true)
    if (!lyric || lyric.type !== 'lyric') return
    expect(lyric.text).toBe('Cada palavra') // texto-fonte intacto
    expect(lyric.chords[0].label).toBe('A')
    expect(lyric.chords[1].label).toBe('E/G#')
  })

  it('transpõe acordes soltos de seção', () => {
    const parsed = parseChordPro('[Intro] G  D/F#  Em7  C9')
    const rendered = renderSong(parsed, { semitones: -1 })
    const section = rendered.lines.find((l) => l.type === 'section')
    if (!section || section.type !== 'section') return
    expect(section.chords.map((c) => c.label)).toEqual([
      'F#',
      'C#/F',
      'D#m7',
      'B9',
    ])
  })

  it('semitones 0 mantém grafia original', () => {
    const parsed = parseChordPro('{key: F}\n[Bb]letra')
    const rendered = renderSong(parsed, { semitones: 0 })
    const lyric = rendered.lines.find((l) => l.type === 'lyric')
    if (!lyric || lyric.type !== 'lyric') return
    expect(lyric.chords[0].label).toBe('Bb')
    expect(rendered.displayedKey).toBe('F')
  })

  it('bemóis com tom de referência da coluna (original_key)', () => {
    const parsed = parseChordPro('[G]letra')
    const rendered = renderSong(parsed, {
      semitones: 1,
      referenceKey: 'F',
    })
    const lyric = rendered.lines.find((l) => l.type === 'lyric')
    if (!lyric || lyric.type !== 'lyric') return
    expect(lyric.chords[0].label).toBe('Ab')
  })
})

describe('buildChordSegments', () => {
  it('calcula espaçamento sem sobreposição', () => {
    const segments = buildChordSegments([
      { label: 'G', col: 0 },
      { label: 'D/F#', col: 5 },
      { label: 'Em7', col: 7 },
    ])
    expect(segments[0]).toEqual({ label: 'G', pad: 0 })
    expect(segments[1].pad).toBeGreaterThanOrEqual(1)
    expect(segments[2].pad).toBeGreaterThanOrEqual(1)
    // D/F# ocupa 4 colunas a partir da 5 → Em7 na 7 colide → clamp de 1
    expect(segments[1].pad).toBe(4)
    expect(segments[2].pad).toBe(1)
  })

  it('acordes na mesma coluna não sobrepõem', () => {
    const segments = buildChordSegments([
      { label: 'C', col: 0 },
      { label: 'G', col: 0 },
    ])
    expect(segments[0].pad).toBe(0)
    expect(segments[1].pad).toBeGreaterThanOrEqual(1)
  })

  it('lista vazia', () => {
    expect(buildChordSegments([])).toEqual([])
  })
})
