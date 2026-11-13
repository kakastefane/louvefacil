import type { JSX } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Passos discretos de tamanho de fonte do visualizador (px). */
export const VIEWER_FONT_STEPS: readonly number[] = [14, 16, 18, 20, 24]
/** Tamanho de fonte padrão do visualizador (px). */
export const VIEWER_FONT_DEFAULT = 16
/** Desvio mínimo de transposição (semitons). */
export const TRANSPOSE_MIN = -11
/** Desvio máximo de transposição (semitons). */
export const TRANSPOSE_MAX = 11

const FONT_SIZE_STORAGE_KEY = 'louve-facil:viewer-font-size'
const MINUS_SIGN = '−' // U+2212

/** Limita o desvio de transposição à faixa [TRANSPOSE_MIN, TRANSPOSE_MAX]. */
export function clampTranspose(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(TRANSPOSE_MAX, Math.max(TRANSPOSE_MIN, Math.trunc(value)))
}

/** Índice do passo mais próximo de `px` em VIEWER_FONT_STEPS. */
function nearestFontStepIndex(px: number): number {
  let best = 0
  for (let i = 1; i < VIEWER_FONT_STEPS.length; i += 1) {
    if (Math.abs(VIEWER_FONT_STEPS[i] - px) < Math.abs(VIEWER_FONT_STEPS[best] - px)) {
      best = i
    }
  }
  return best
}

/** Formata o desvio de transposição: `+2`, `0` ou `−1` (U+2212). */
function formatTranspose(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `${MINUS_SIGN}${Math.abs(value)}`
  return '0'
}

/**
 * Lê o tamanho de fonte persistido (`localStorage['louve-facil:viewer-font-size']`).
 * Retorna VIEWER_FONT_DEFAULT quando ausente, inválido, fora dos passos
 * conhecidos ou em ambientes sem localStorage (SSR/erros).
 */
export function loadViewerFontSize(): number {
  try {
    const raw = localStorage.getItem(FONT_SIZE_STORAGE_KEY)
    if (raw === null) return VIEWER_FONT_DEFAULT
    const parsed = Number.parseInt(raw, 10)
    return VIEWER_FONT_STEPS.includes(parsed) ? parsed : VIEWER_FONT_DEFAULT
  } catch {
    return VIEWER_FONT_DEFAULT
  }
}

/**
 * Persiste o tamanho de fonte em `localStorage['louve-facil:viewer-font-size']`.
 * Ignora erros silenciosamente (SSR/quota/modo privado).
 */
export function saveViewerFontSize(px: number): void {
  try {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(px))
  } catch {
    // ignora silenciosamente
  }
}

export interface TransposeControlsProps {
  /** Desvio atual em semitons (−11..+11). */
  transpose: number
  /** Chamado com o próximo desvio, sempre clampado em [TRANSPOSE_MIN, TRANSPOSE_MAX]. */
  onTransposeChange: (next: number) => void
  /** Classes extras no contêiner. */
  className?: string
}

/**
 * Alterador de tom em semitons (FR-019/FR-022): botões grandes com reset.
 * Feito para ficar visível — renderize entre o cabeçalho (temas) e a cifra.
 * Componente 100% controlado — a persistência fica a cargo da página.
 */
export function TransposeControls({
  transpose,
  onTransposeChange,
  className,
}: TransposeControlsProps): JSX.Element {
  const clampedTranspose = clampTranspose(transpose)
  const canDecreaseTranspose = clampedTranspose > TRANSPOSE_MIN
  const canIncreaseTranspose = clampedTranspose < TRANSPOSE_MAX

  const handleTranspose = (delta: number) => {
    onTransposeChange(clampTranspose(clampedTranspose + delta))
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5',
        className,
      )}
      role="group"
      aria-label="Transposição"
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Diminuir transposição"
        disabled={!canDecreaseTranspose}
        onClick={() => handleTranspose(-1)}
      >
        <Minus aria-hidden="true" />
      </Button>
      <span
        className="min-w-[3ch] text-center font-mono text-base font-bold tabular-nums"
        aria-live="polite"
        aria-label="Desvio de transposição em semitons"
      >
        {formatTranspose(clampedTranspose)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Aumentar transposição"
        disabled={!canIncreaseTranspose}
        onClick={() => handleTranspose(1)}
      >
        <Plus aria-hidden="true" />
      </Button>
      {clampedTranspose !== 0 && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Redefinir transposição"
          onClick={() => onTransposeChange(0)}
        >
          <RotateCcw aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

export interface FontSizeControlsProps {
  /** Tamanho de fonte atual em px (idealmente um dos VIEWER_FONT_STEPS). */
  fontSize: number
  /** Chamado com o próximo passo de fonte (sem ultrapassar os extremos). */
  onFontSizeChange: (next: number) => void
  /** Classes extras no contêiner. */
  className?: string
}

/**
 * Controle de tamanho de fonte em passos discretos (FR-021/FR-023).
 * Componente 100% controlado — a persistência fica a cargo da página.
 */
export function FontSizeControls({
  fontSize,
  onFontSizeChange,
  className,
}: FontSizeControlsProps): JSX.Element {
  const fontIndex = nearestFontStepIndex(fontSize)
  const canDecreaseFont = fontIndex > 0
  const canIncreaseFont = fontIndex < VIEWER_FONT_STEPS.length - 1

  const handleFontSize = (delta: number) => {
    const nextIndex = Math.min(
      VIEWER_FONT_STEPS.length - 1,
      Math.max(0, fontIndex + delta),
    )
    onFontSizeChange(VIEWER_FONT_STEPS[nextIndex])
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 border-t border-border bg-background/95 px-3 py-2 backdrop-blur',
        className,
      )}
      role="group"
      aria-label="Tamanho da fonte"
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Diminuir fonte"
        disabled={!canDecreaseFont}
        onClick={() => handleFontSize(-1)}
      >
        <span aria-hidden="true" className="text-xs font-semibold">
          A{MINUS_SIGN}
        </span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Aumentar fonte"
        disabled={!canIncreaseFont}
        onClick={() => handleFontSize(1)}
      >
        <span aria-hidden="true" className="text-base font-semibold">
          A+
        </span>
      </Button>
    </div>
  )
}
