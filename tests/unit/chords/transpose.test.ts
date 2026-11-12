import { describe, expect, it } from 'vitest'
import {
  isMinorKeySuffix,
  keyPrefersFlats,
  parseKey,
  transposeChord,
  transposeKey,
} from '@/features/chords/transpose'

describe('transposeChord', () => {
  it('sobe sustenidos em tom de referência com sustenidos (G +2 → A)', () => {
    expect(transposeChord('G', 2, 'G')).toBe('A')
    expect(transposeChord('G', 2, null)).toBe('A') // padrão: sustenidos
  })

  it('usa bemóis em tom de referência com bemóis (F +1 → Gb)', () => {
    expect(transposeChord('G', 1, 'F')).toBe('Ab')
    expect(transposeChord('G', 1, 'Bb')).toBe('Ab')
    expect(transposeChord('F', 1, 'F')).toBe('Gb')
  })

  it('desvio 0 preserva a grafia original do usuário', () => {
    expect(transposeChord('A#', 0, 'F')).toBe('A#')
    expect(transposeChord('Bb', 0, 'G')).toBe('Bb')
  })

  it('transpõe o baixo em acordes com barra (D/F# +2 → E/G#)', () => {
    expect(transposeChord('D/F#', 2, 'G')).toBe('E/G#')
  })

  it('preserva sufixos (m7, maj7, sus4, add9, 6/9, dim)', () => {
    expect(transposeChord('Em7', 2, 'G')).toBe('F#m7')
    expect(transposeChord('Cmaj7', 2, 'G')).toBe('Dmaj7')
    expect(transposeChord('Gsus4', 2, 'G')).toBe('Asus4')
    expect(transposeChord('Cadd9', 2, 'G')).toBe('Dadd9')
    expect(transposeChord('C6/9', 2, 'G')).toBe('D6/9')
    expect(transposeChord('Bdim', 1, 'C')).toBe('Cdim')
  })

  it('envolve a oitava (B +2 → C#; C -1 → B; F -1 → E)', () => {
    expect(transposeChord('B', 2, 'G')).toBe('C#')
    expect(transposeChord('C', -1, 'G')).toBe('B')
    expect(transposeChord('F', -1, 'G')).toBe('E')
  })

  it('usa bemóis em menores com bemol (Dm referência → G vira Ab)', () => {
    expect(transposeChord('G', 1, 'Dm')).toBe('Ab')
  })

  it('não altera a fonte: desvio maior que 12 também envolve', () => {
    expect(transposeChord('G', 14, 'G')).toBe('A')
    expect(transposeChord('G', -13, 'G')).toBe('F#')
  })

  it('acorde malformado volta inalterado', () => {
    expect(transposeChord('Xy', 2, 'G')).toBe('Xy')
    expect(transposeChord('Intro', 2, 'G')).toBe('Intro')
  })

  it('acorde com baixo malformado mantém o baixo', () => {
    expect(transposeChord('C/Xy', 2, 'G')).toBe('D/Xy')
  })
})

describe('transposeKey', () => {
  it('exibe o tom deslocado (G +2 → A; G -2 → F)', () => {
    expect(transposeKey('G', 2)).toBe('A')
    expect(transposeKey('G', -2)).toBe('F')
  })

  it('sempre exibe sustenidos fora dos tons de bemol', () => {
    expect(transposeKey('F', 1)).toBe('Gb')
    expect(transposeKey('F', 1, )).toBe('Gb')
  })

  it('retorna null sem tom e mantém tom inválido', () => {
    expect(transposeKey(null, 2)).toBeNull()
    expect(transposeKey('abc', 2)).toBe('abc')
  })
})

describe('keyPrefersFlats', () => {
  it.each(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'])('%s prefere bemóis', (key) => {
    expect(keyPrefersFlats(key)).toBe(true)
  })

  it.each(['G', 'D', 'A', 'E', 'B', 'C', 'F#'])('%s prefere sustenidos', (key) => {
    expect(keyPrefersFlats(key)).toBe(false)
  })

  it('menores com bemol: Dm, Gm, Cm, Fm, Bbm, Ebm', () => {
    for (const key of ['Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']) {
      expect(keyPrefersFlats(key)).toBe(true)
    }
  })

  it('menores com sustenidos: Em, Bm, F#m', () => {
    for (const key of ['Em', 'Bm', 'F#m', 'Am']) {
      expect(keyPrefersFlats(key)).toBe(false)
    }
  })

  it('sem tom → sustenidos', () => {
    expect(keyPrefersFlats(null)).toBe(false)
  })
})

describe('parseKey', () => {
  it('parseia acidentais e sufixos', () => {
    expect(parseKey('Bb')).toMatchObject({ letter: 'B', accidental: 'b', suffix: '', rootIndex: 10 })
    expect(parseKey('F#m7')).toMatchObject({ letter: 'F', accidental: '#', suffix: 'm7', rootIndex: 6 })
    expect(parseKey('C')).toMatchObject({ letter: 'C', accidental: '', suffix: '', rootIndex: 0 })
  })

  it('retorna null para entradas inválidas', () => {
    expect(parseKey('')).toBeNull()
    expect(parseKey('sol')).toBeNull()
  })
})

describe('isMinorKeySuffix', () => {
  it.each(['m', 'm7', 'm9'])('"%s" é menor', (suffix) => {
    expect(isMinorKeySuffix(suffix)).toBe(true)
  })

  it.each(['maj7', 'M', '', 'sus4'])('"%s" não é menor', (suffix) => {
    expect(isMinorKeySuffix(suffix)).toBe(false)
  })
})
