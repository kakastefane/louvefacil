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

describe('renderSong com hideChords (modo cantor)', () => {
  it('oculta acordes inline, mantendo a letra intacta', () => {
    const parsed = parseChordPro('{key: G}\n[G]Cada [D/F#]palavra')
    const rendered = renderSong(parsed, { semitones: 0, hideChords: true })
    const lyric = rendered.lines.find((l) => l.type === 'lyric')
    if (!lyric || lyric.type !== 'lyric') throw new Error('linha de letra não encontrada')
    expect(lyric.text).toBe('Cada palavra')
    expect(lyric.chords).toEqual([])
  })

  it('remove linhas só de acordes e acordes de seções', () => {
    const parsed = parseChordPro('[Intro] G  D  Em\n[G]Refrão\n[C]Outra')
    const rendered = renderSong(parsed, { semitones: 0, hideChords: true })
    // Seções viram apenas o rótulo (sem acordes soltos)
    expect(rendered.lines.map((l) => l.type)).toEqual(['section', 'lyric', 'lyric'])
    const section = rendered.lines[0]
    if (section.type !== 'section') throw new Error('esperada seção')
    expect(section.label).toBe('Intro')
    expect(section.chords).toEqual([])
    // Letras mantêm o texto, sem acordes
    const lyrics = rendered.lines.filter((l) => l.type === 'lyric')
    expect(lyrics.map((l) => l.type === 'lyric' && l.text)).toEqual(['Refrão', 'Outra'])
    for (const l of lyrics) {
      if (l.type === 'lyric') expect(l.chords).toEqual([])
    }
  })

  it('linhas só de acordes desaparecem no modo cantor', () => {
    const parsed = parseChordPro('G  D  Em\n[G]Refrão')
    const rendered = renderSong(parsed, { semitones: 0, hideChords: true })
    expect(rendered.lines.map((l) => l.type)).toEqual(['lyric'])
  })

  it('sem hideChords mantém o comportamento original', () => {
    const parsed = parseChordPro('[Intro] G  D\n[G]Refrão')
    const rendered = renderSong(parsed, { semitones: 0 })
    expect(rendered.lines.map((l) => l.type)).toEqual(['section', 'lyric'])
    const section = rendered.lines[0]
    if (section.type !== 'section') throw new Error('esperada seção')
    expect(section.chords.map((c) => c.label)).toEqual(['G', 'D'])
  })

  it('sem hideChords mantém linhas só de acordes (intro/instrumental)', () => {
    const parsed = parseChordPro('{section: Intro}\nG  D  Em\n\n{section: Verso 1}\n[G]Letra')
    const rendered = renderSong(parsed, { semitones: 0 })
    expect(rendered.lines.map((l) => l.type)).toEqual([
      'section',
      'chords',
      'empty',
      'section',
      'lyric',
    ])
    const chords = rendered.lines[1]
    if (chords.type !== 'chords') throw new Error('esperada linha de acordes')
    expect(chords.chords.map((c) => c.label)).toEqual(['G', 'D', 'Em'])
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
