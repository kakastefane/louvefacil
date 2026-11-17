/**
 * Paginação da biblioteca de cifras. Módulo puro para permitir testes de
 * unidade: não conhece React, rede ou localStorage.
 */

/** Opções de itens por página oferecidas na Biblioteca. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

/** Itens por página escolhidos pelo usuário (`all` = sem paginação). */
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number] | 'all'

/** Total de páginas para `total` itens (mínimo 1, inclusive sem paginação). */
export function totalPages(total: number, pageSize: PageSize): number {
  if (pageSize === 'all' || total <= 0) return 1
  return Math.ceil(total / pageSize)
}

/** Limita a página à faixa válida [1, totalPages]. */
export function clampPage(
  page: number,
  total: number,
  pageSize: PageSize,
): number {
  const pages = totalPages(total, pageSize)
  if (!Number.isFinite(page)) return 1
  return Math.min(pages, Math.max(1, Math.trunc(page)))
}

/** Fatia os itens da página pedida, clampando a página quando necessário. */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: PageSize,
): T[] {
  if (pageSize === 'all') return items
  const current = clampPage(page, items.length, pageSize)
  const start = (current - 1) * pageSize
  return items.slice(start, start + pageSize)
}
