import { describe, expect, it } from 'vitest'
import { canEdit, canManage, type TeamRole } from '@/types/domain'
import { normalizeThemes, themeKey } from '@/lib/utils'

describe('regras de papel (FR-006)', () => {
  it.each(['owner', 'editor'] as TeamRole[])('%s pode criar/editar', (role) => {
    expect(canEdit(role)).toBe(true)
  })

  it('membro apenas visualiza', () => {
    expect(canEdit('member')).toBe(false)
  })

  it('somente o dono gerencia membros e convites', () => {
    expect(canManage('owner')).toBe(true)
    expect(canManage('editor')).toBe(false)
    expect(canManage('member')).toBe(false)
  })
})

describe('normalização de temas (edge case da spec)', () => {
  it('remove vazios e espaços extras', () => {
    expect(normalizeThemes(['  adoração ', '', '   ', 'louvor'])).toEqual([
      'adoração',
      'louvor',
    ])
  })

  it('agrupa duplicados case-insensitive mantendo a primeira grafia', () => {
    expect(normalizeThemes(['Natal', 'NATAL', 'natal ', 'Páscoa'])).toEqual([
      'Natal',
      'Páscoa',
    ])
  })

  it('colapsa espaços internos', () => {
    expect(normalizeThemes(['vida    nova'])).toEqual(['vida nova'])
  })
})

describe('themeKey', () => {
  it('é canônico e case-insensitive', () => {
    expect(themeKey('  Adoração ')).toBe(themeKey('adoração'))
  })
})
