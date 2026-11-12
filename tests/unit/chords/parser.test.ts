import { describe, expect, it } from 'vitest'
import { isChordToken, parseChordPro } from '@/features/chords/parser'

describe('parseChordPro', () => {
  it('extrai metatags de título, tom e artista', () => {
    const parsed = parseChordPro(
      '{title: Exemplo}\n{key: G}\n{artist: Equipe}\n\n[G]letra',
    )
    expect(parsed.title).toBe('Exemplo')
    expect(parsed.key).toBe('G')
    expect(parsed.artist).toBe('Equipe')
  })

  it('ignora metatags desconhecidas', () => {
    const parsed = parseChordPro('{comment: nota}\n[G]letra')
    expect(parsed.lines).toHaveLength(1)
    expect(parsed.lines[0]).toMatchObject({ type: 'lyric' })
  })

  it('detecta seção com acordes soltos (exemplo da arquitetura)', () => {
    const parsed = parseChordPro('[Intro] G  D/F#  Em7  C9')
    expect(parsed.lines[0]).toEqual({
      type: 'section',
      label: 'Intro',
      chords: ['G', 'D/F#', 'Em7', 'C9'],
    })
  })

  it('detecta seção sem acordes', () => {
    const parsed = parseChordPro('[Coro]')
    expect(parsed.lines[0]).toEqual({
      type: 'section',
      label: 'Coro',
      chords: [],
    })
  })

  it('ancora acordes inline nas colunas corretas', () => {
    const parsed = parseChordPro('[G]Cada [D/F#]palavra')
    const line = parsed.lines[0]
    expect(line.type).toBe('lyric')
    if (line.type !== 'lyric') return
    expect(line.text).toBe('Cada palavra')
    expect(line.chords[0]).toEqual({ chord: 'G', col: 0 })
    // "Cada " tem 5 caracteres → coluna 5
    expect(line.chords[1]).toEqual({ chord: 'D/F#', col: 5 })
  })

  it('mantém texto com espaços internos intacto', () => {
    const parsed = parseChordPro('[Am]  texto   com   espaços')
    const line = parsed.lines[0]
    if (line.type !== 'lyric') return
    expect(line.text).toBe('  texto   com   espaços')
  })

  it('trata colchete sem par como texto literal', () => {
    const parsed = parseChordPro('letra com [ colchete aberto')
    const line = parsed.lines[0]
    if (line.type !== 'lyric') return
    expect(line.text).toBe('letra com [ colchete aberto')
  })

  it('linha só de acordes sem colchetes', () => {
    const parsed = parseChordPro('G  D/F#  Em7  C9')
    expect(parsed.lines[0]).toEqual({
      type: 'chords',
      chords: ['G', 'D/F#', 'Em7', 'C9'],
    })
  })

  it('letra sem acordes vira linha lyric', () => {
    const parsed = parseChordPro('Cada palavra em seu lugar')
    expect(parsed.lines[0]).toMatchObject({
      type: 'lyric',
      chords: [],
      text: 'Cada palavra em seu lugar',
    })
  })

  it('acorde malformado na letra é capturado como acorde literal', () => {
    const parsed = parseChordPro('[Xy]letra')
    const line = parsed.lines[0]
    if (line.type !== 'lyric') return
    expect(line.chords[0]).toEqual({ chord: 'Xy', col: 0 })
  })

  it('linhas vazias são preservadas (estrutura da cifra)', () => {
    const parsed = parseChordPro('[G]um\n\n[G]dois')
    expect(parsed.lines).toHaveLength(3)
    expect(parsed.lines[1]).toEqual({ type: 'empty' })
  })

  it('suporta CRLF e texto vazio', () => {
    const parsed = parseChordPro('')
    expect(parsed.lines).toHaveLength(0)
    const crlf = parseChordPro('{key: G}\r\n[G]letra')
    expect(crlf.key).toBe('G')
    expect(crlf.lines).toHaveLength(1)
  })
})

describe('isChordToken', () => {
  it.each(['G', 'Em7', 'C9', 'D/F#', 'Bb6/9', 'F#m7', 'Gsus4', 'Cadd9', 'A7', 'Bm7b5', 'D#m'])(
    'reconhece acorde %s',
    (token) => {
      expect(isChordToken(token)).toBe(true)
    },
  )

  it.each(['Cada', 'amor', 'palavra', 'letra', 'Xy', 'Deus', 'sol'])(
    'rejeita palavra comum %s',
    (token) => {
      expect(isChordToken(token)).toBe(false)
    },
  )
})
