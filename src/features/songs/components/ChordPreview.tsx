import { useEffect, useMemo, useState } from 'react'

import { EmptyState } from '@/components/shared/states'
import { cn } from '@/lib/utils'
import { parseChordPro } from '@/features/chords/parser'
import { buildChordSegments, renderSong } from '@/features/chords/render'
import type { RenderedChord } from '@/features/chords/render'

/** Atraso do debounce de digitação (ms): evita reparse a cada tecla. */
const DEBOUNCE_MS = 250

/** Fonte base (px) quando `fontSize` não é informado. */
const DEFAULT_FONT_SIZE = 16

export interface ChordPreviewProps {
  /** Texto ChordPro cru — fonte da verdade, nunca alterada pelo render. */
  content: string
  /** Desvio em semitons aplicado somente ao render (default 0). */
  transpose?: number
  /** Tamanho base da fonte em px (projetado para o visualizador da US3). */
  fontSize?: number
  /** Classes extras no contêiner com scroll interno. */
  className?: string
}

/** Linha de acordes posicionados por coluna (grade de duas linhas — render.ts). */
function ChordLine({ chords, className }: { chords: RenderedChord[]; className?: string }) {
  const segments = buildChordSegments(chords)
  if (segments.length === 0) return null
  return (
    <div
      className={cn(
        'whitespace-pre font-mono text-[0.9em] font-semibold leading-relaxed text-primary/90',
        className,
      )}
    >
      {segments.map((segment, index) => (
        // índice é estável: os segmentos derivam do mesmo array de acordes
        <span key={index}>
          {' '.repeat(segment.pad)}
          {segment.label}
        </span>
      ))}
    </div>
  )
}

/**
 * Preview ao vivo da cifra: parse + render puros (parser.ts/render.ts),
 * com debounce de digitação e transposição aplicada apenas ao render
 * (Princípio IV — o texto-fonte nunca é alterado).
 */
export function ChordPreview({ content, transpose = 0, fontSize, className }: ChordPreviewProps) {
  const [debouncedContent, setDebouncedContent] = useState(content)

  // Debounce do parse (~250 ms) para não re-renderizar a cada tecla.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedContent(content), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [content])

  // Parse + render memoizados sobre o conteúdo debounced e o desvio.
  const song = useMemo(() => {
    const parsed = parseChordPro(debouncedContent)
    // renderSong já transpõe internamente via `semitones` (pipeline testado
    // em tests/unit/chords/render.test.ts) — equivalente a aplicar
    // transposeChord/transposeKey em cada acorde, sem mutar a fonte.
    return renderSong(parsed, { semitones: transpose })
  }, [debouncedContent, transpose])

  // Estado vazio imediato (sem esperar o debounce): digite algo…
  if (content.trim() === '') {
    return (
      <EmptyState
        className="h-full justify-center border-none bg-transparent py-8"
        title="Digite a cifra para ver o preview…"
        description="Use [Am] inline, linhas só de acordes e metatags {title: …} / {key: …}."
      />
    )
  }

  const hasHeader = song.title !== null || song.artist !== null || song.displayedKey !== null

  return (
    <div
      className={cn('h-full overflow-y-auto overflow-x-hidden px-4 py-4', className)}
      style={{ fontSize: `${fontSize ?? DEFAULT_FONT_SIZE}px` }}
    >
      {/* Cabeçalho compacto com metatags aceitas pelo parser */}
      {hasHeader ? (
        <header className="mb-4 border-b border-border pb-2">
          {song.title ? (
            <p className="text-[1.05em] font-semibold leading-snug">{song.title}</p>
          ) : null}
          <p className="text-[0.85em] text-muted-foreground">
            {[
              song.artist,
              song.displayedKey ? `Tom: ${song.displayedKey}` : null,
              transpose !== 0 ? `(${transpose > 0 ? '+' : ''}${transpose})` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </header>
      ) : null}

      <div className="font-mono leading-relaxed">
        {song.lines.map((line, index) => {
          switch (line.type) {
            case 'empty':
              // Respiro entre blocos, equivalente a uma linha em branco
              return <div key={index} aria-hidden className="h-[1.5em]" />
            case 'section':
              // Badge destacado: rótulo visual de seção da música (Intro, Verso, …)
              return (
                <div key={index} className="mt-4 first:mt-0">
                  <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[0.72em] font-semibold uppercase tracking-[0.09em] text-primary">
                    {line.label}
                  </span>
                  <ChordLine chords={line.chords} />
                </div>
              )
            case 'chords':
              // Linha só de acordes (ex.: pentagrama de introdução)
              return <ChordLine key={index} chords={line.chords} className="mt-2" />
            case 'lyric':
              return (
                <div key={index} className="mt-2">
                  <ChordLine chords={line.chords} />
                  <div className="whitespace-pre text-foreground">{line.text}</div>
                </div>
              )
            default:
              return null
          }
        })}
      </div>
    </div>
  )
}
