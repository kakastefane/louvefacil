/**
 * Helpers puros de posições e desvios de transposição (T039/T040).
 * A renumeração é 1..n e o desvio respeita [-11, +11] (data-model).
 */

/** Posições 1..n para uma lista ordenada de ids. */
export function renumberPositions(orderedIds: string[]): Map<string, number> {
  const map = new Map<string, number>()
  orderedIds.forEach((id, index) => map.set(id, index + 1))
  return map
}

/** Normaliza o desvio para o intervalo [-11, +11] (inteiro). */
export function clampTranspose(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(-11, Math.min(11, Math.round(value)))
}

/** Rótulo legível do desvio (ex.: '+2', '0', '-1'). */
export function transposeLabel(value: number): string {
  const clamped = clampTranspose(value)
  return clamped > 0 ? `+${clamped}` : String(clamped)
}

/** Ajusta o desvio em ±1 sem ultrapassar os limites. */
export function stepTranspose(current: number, delta: 1 | -1): number {
  return clampTranspose(clampTranspose(current) + delta)
}
