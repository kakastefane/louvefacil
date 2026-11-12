import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Invite } from '@/types/domain'

/** Merge de classes Tailwind (padrão shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Estado online (usado por repos e UI; simples e sem estado). */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}

/** Escrita exige conexão (FR-032): lança erro amigável quando offline. */
export function assertOnline(): void {
  if (!isOnline()) {
    throw new Error('offline_write')
  }
}

const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sem 0/O/1/I/L confusos

/** Código de convite URL-safe, >= 8 caracteres (contrato do banco). */
export function generateInviteCode(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let code = ''
  for (const b of bytes) code += INVITE_ALPHABET[b % INVITE_ALPHABET.length]
  return code
}

/**
 * Normaliza temas: trim, colapsa espaços, remove vazios e duplicatas
 * equivalentes (case-insensitive) — mantém a primeira grafia (FR-018).
 */
export function normalizeThemes(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const value = item.trim().replace(/\s+/g, ' ')
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

/** Chave canônica de um tema (case-insensitive). */
export function themeKey(theme: string): string {
  return theme.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Convite válido = não revogado e não expirado (data-model). */
export function isInviteActive(
  invite: Pick<Invite, 'expires_at' | 'revoked'>,
  now: Date = new Date(),
): boolean {
  if (invite.revoked) return false
  return new Date(invite.expires_at).getTime() > now.getTime()
}

/** Prazo default de convite: 7 dias (assunção da spec). */
export const INVITE_DEFAULT_EXPIRY_DAYS = 7

export function defaultInviteExpiry(): string {
  const d = new Date()
  d.setDate(d.getDate() + INVITE_DEFAULT_EXPIRY_DAYS)
  return d.toISOString()
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const dateOnlyFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** Datas completas em PT-BR (ex.: "11 de nov." curto). */
export function formatDatePtBr(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d)
}

/** Datas "só dia" em PT-BR (event_date de setlist). */
export function formatDateOnlyPtBr(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(`${value}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '' : dateOnlyFmt.format(d)
}

/** Mensagem amigável para erros comuns (UI PT-BR, FR/edge cases). */
export function friendlyErrorMessage(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? '')

  if (message.includes('not_configured'))
    return 'O projeto ainda não está configurado. Verifique as variáveis de ambiente.'
  if (message.includes('invalid_code')) return 'Convite inválido.'
  if (message.includes('expired_code')) return 'Este convite expirou.'
  if (message.includes('revoked_code')) return 'Este convite foi revogado.'
  if (message.includes('forbidden') || message.includes('42501'))
    return 'Você não tem permissão para esta ação.'
  if (message.includes('owner_cannot_leave'))
    return 'O dono não pode sair da própria equipe.'
  if (message.includes('cannot_remove_owner') || message.includes('cannot_change_owner'))
    return 'Ação não permitida sobre o dono da equipe.'
  if (message.includes('offline_write'))
    return 'Sem conexão — criar e editar exige internet. O que você digitou continua na tela.'
  if (
    message.includes('Failed to fetch') ||
    message.toLowerCase().includes('network')
  )
    return 'Sem conexão — a alteração exige internet. Tente novamente quando estiver online.'
  if (message.includes('Invalid login credentials'))
    return 'E-mail ou senha incorretos.'
  if (message.includes('already registered'))
    return 'Este e-mail já está cadastrado. Faça login.'
  if (message.includes('Password should be at least'))
    return 'A senha deve ter pelo menos 6 caracteres.'
  return 'Ocorreu um erro inesperado. Tente novamente.'
}
