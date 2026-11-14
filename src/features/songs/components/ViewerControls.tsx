import type { JSX } from 'react'
import { Minus, Plus, RotateCcw, EyeOff, Eye } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { transposeKey } from '@/features/chords/transpose'

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

/** Persistência de ocultação de acordes (modo cantor) */
const HIDE_CHORDS_STORAGE_KEY = 'louve-facil:viewer-hide-chords'

/** Lê o estado de ocultação de acordes (true = acordes ocultos, só letra) */
export function loadViewerHideChords(): boolean {
  try {
    return localStorage.getItem(HIDE_CHORDS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Persiste o estado de ocultação de acordes */
export function saveViewerHideChords(value: boolean): void {
  try {
    localStorage.setItem(HIDE_CHORDS_STORAGE_KEY, value ? '1' : '0')
  } catch {
    // ignora silenciosamente
  }
}

export interface TransposeControlsProps {
  /** Desvio atual em semitons (−11..+11). */
  transpose: number
  /** Chamado com o próximo desvio, sempre clampado em [TRANSPOSE_MIN, TRANSPOSE_MAX]. */
  onTransposeChange: (next: number) => void
  /** Tom de referência da cifra (ex.: 'G'); usado para mostrar o tom atual. */
  referenceKey?: string | null
  /** Valor de redefinição (padrão 0); botão só aparece quando o atual é diferente. */
  resetTo?: number
  /** Classes extras no contêiner. */
  className?: string
}

/**
 * Alterador de tom em semitons (FR-019/FR-022): botões no estilo padrão do app.
 * O indicador central mostra o tom atual (ex.: `A`), calculado a partir do tom
 * de referência da cifra; ao transpor, o desvio aparece em destaque menor
 * (ex.: `+2`). Sem tom de referência, volta ao indicador numérico.
 * Componente 100% controlado — a persistência fica a cargo da página.
 */
export function TransposeControls({
  transpose,
  onTransposeChange,
  referenceKey,
  resetTo = 0,
  className,
}: TransposeControlsProps): JSX.Element {
  const clampedTranspose = clampTranspose(transpose)
  const canDecreaseTranspose = clampedTranspose > TRANSPOSE_MIN
  const canIncreaseTranspose = clampedTranspose < TRANSPOSE_MAX

  const handleTranspose = (delta: number) => {
    onTransposeChange(clampTranspose(clampedTranspose + delta))
  }

  const currentKey = referenceKey ? transposeKey(referenceKey, clampedTranspose) : null
  const mainLabel = currentKey ?? formatTranspose(clampedTranspose)
  const subLabel = currentKey && clampedTranspose !== 0 ? formatTranspose(clampedTranspose) : null

  return (
    <div
      className={cn('flex items-center gap-2', className)}
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
        className="flex min-w-[4ch] flex-col items-center justify-center leading-none"
        aria-live="polite"
        aria-label={`Tom atual: ${mainLabel}${subLabel ? ` (desvio ${subLabel})` : ''}`}
      >
        <span className="font-mono text-base font-bold tabular-nums">{mainLabel}</span>
        {subLabel ? (
          <span className="mt-0.5 text-[0.625rem] font-semibold text-muted-foreground">
            {subLabel}
          </span>
        ) : null}
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
      {clampedTranspose !== resetTo && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Redefinir transposição"
          onClick={() => onTransposeChange(resetTo)}
        >
          <RotateCcw aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

/**
 * Barra única renderizada acima da cifra (abaixo dos temas), na mesma linha:
 * seletor de tom à esquerda e, à direita, tamanho da letra + botão "esconder cifras"
 * (modo cantor) (FR-019/FR-021/FR-022/FR-023).
 * Componentes 100% controlados — a persistência fica a cargo da página.
 */
export interface ViewerToolbarProps {
  transpose: number
  onTransposeChange: (next: number) => void
  /** Tom de referência da cifra (ex.: 'G'); usado para mostrar o tom atual. */
  referenceKey?: string | null
  /** Valor de redefinição do tom (padrão 0). */
  transposeResetTo?: number
  fontSize: number
  onFontSizeChange: (next: number) => void
  /** Oculta os acordes, exibindo apenas a letra (modo cantor). */
  hideChords: boolean
  onHideChordsChange: (next: boolean) => void
  /** Classes extras no contêiner. */
  className?: string
}

export function ViewerToolbar({
  transpose,
  onTransposeChange,
  referenceKey,
  transposeResetTo,
  fontSize,
  onFontSizeChange,
  hideChords,
  onHideChordsChange,
  className,
}: ViewerToolbarProps): JSX.Element {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <TransposeControls
        transpose={transpose}
        onTransposeChange={onTransposeChange}
        referenceKey={referenceKey}
        resetTo={transposeResetTo}
      />
      <div className="flex items-center gap-2">
        <FontSizeControls fontSize={fontSize} onFontSizeChange={onFontSizeChange} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={hideChords ? 'Mostrar cifras' : 'Ocultar cifras'}
          aria-pressed={hideChords}
          className={cn(hideChords && 'border-primary/40 bg-primary/10 text-primary')}
          onClick={() => onHideChordsChange(!hideChords)}
        >
          {hideChords ? (
            <Eye aria-hidden="true" />
          ) : (
            <EyeOff aria-hidden="true" />
          )}
        </Button>
      </div>
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
      className={cn('flex items-center gap-2', className)}
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
