import { describe, expect, it } from 'vitest'
import {
  defaultInviteExpiry,
  generateInviteCode,
  isInviteActive,
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
