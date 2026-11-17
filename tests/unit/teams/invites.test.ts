import { describe, expect, it } from 'vitest'
import {
  defaultInviteExpiry,
  generateInviteCode,
  isInviteActive,
  normalizeInviteCode,
} from '@/lib/utils'

describe('validade de convite (FR-007/FR-009)', () => {
  it('convite ativo dentro do prazo', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    expect(isInviteActive({ expires_at: future, revoked: false })).toBe(true)
  })

  it('convite expirado', () => {
    const past = new Date(Date.now() - 86400000).toISOString()
    expect(isInviteActive({ expires_at: past, revoked: false })).toBe(false)
  })

  it('convite revogado mesmo dentro do prazo', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    expect(isInviteActive({ expires_at: future, revoked: true })).toBe(false)
  })

  it('prazo default é ~7 dias no futuro', () => {
    const expires = new Date(defaultInviteExpiry())
    const sevenDaysMs = 7 * 86400000
    const diff = expires.getTime() - Date.now()
    expect(diff).toBeGreaterThan(sevenDaysMs - 60000)
    expect(diff).toBeLessThanOrEqual(sevenDaysMs + 60000)
  })
})

describe('geração de código de convite', () => {
  it('tem o tamanho pedido e usa alfabeto URL-safe sem confusões', () => {
    const code = generateInviteCode()
    expect(code).toHaveLength(10)
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/)
    expect(code).not.toMatch(/[OIL01]/)
  })

  it('não gera códigos iguais em sequência (aleatoriedade razoável)', () => {
    const a = generateInviteCode()
    const b = generateInviteCode()
    expect(a).not.toBe(b)
  })

  it('respeita o mínimo de 8 caracteres exigido pelo banco', () => {
    expect(generateInviteCode(8)).toHaveLength(8)
  })
})

describe('código de convite digitado', () => {
  it('remove espaços/hífens e converte para maiúsculas', () => {
    expect(normalizeInviteCode(' abc7def9gh ')).toBe('ABC7DEF9GH')
    expect(normalizeInviteCode('ABC7 DEF9 GH')).toBe('ABC7DEF9GH')
    expect(normalizeInviteCode('abc7-def9-gh')).toBe('ABC7DEF9GH')
    expect(normalizeInviteCode('ABC7\nDEF9GH')).toBe('ABC7DEF9GH')
  })

  it('extrai o código quando a pessoa cola o link completo', () => {
    expect(
      normalizeInviteCode('https://louvefacil.vercel.app/convite/abc7def9gh'),
    ).toBe('ABC7DEF9GH')
    expect(
      normalizeInviteCode('https://louvefacil.vercel.app/convite/ABC7DEF9GH/'),
    ).toBe('ABC7DEF9GH')
    expect(
      normalizeInviteCode('https://louvefacil.vercel.app/convite/ABC7DEF9GH?utm=1'),
    ).toBe('ABC7DEF9GH')
  })

  it('ignora espaços/codificação de URL ao redor do código', () => {
    expect(
      normalizeInviteCode('…/convite/ABC7DEF9GH%20'),
    ).toBe('ABC7DEF9GH')
  })

  it('devolve vazio quando não há código', () => {
    expect(normalizeInviteCode('')).toBe('')
    expect(normalizeInviteCode('   ')).toBe('')
    expect(normalizeInviteCode('- -')).toBe('')
  })

  it('não altera um código já normalizado', () => {
    const code = generateInviteCode()
    expect(normalizeInviteCode(code)).toBe(code)
  })
})
