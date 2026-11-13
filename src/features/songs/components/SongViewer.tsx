import { transposeKey } from '@/features/chords/transpose'
import { Badge } from '@/components/ui/badge'
import { ChordPreview } from '@/features/songs/components/ChordPreview'
import type { Song } from '@/types/domain'

export interface SongViewerProps {
  /** Cifra carregada — fonte da verdade, nunca alterada pelo render. */
  song: Song
  /** Desvio em semitons aplicado apenas à exibição (-11..+11). */
  transpose: number
  /** Tamanho base da fonte em px. */
  fontSize: number
}

function formatSemitoneOffset(transpose: number): string {
  return `${transpose > 0 ? '+' : ''}${transpose}`
}

/** Texto da linha "Tom:" conforme FR-017/FR-020. */
function keyLine(originalKey: string | null, transpose: number): string {
  if (!originalKey) return 'Tom não informado'
  if (transpose === 0) return `Tom: ${originalKey}`
  const displayed = transposeKey(originalKey, transpose) ?? originalKey
  return `Tom: ${originalKey} → ${displayed} (${formatSemitoneOffset(transpose)})`
}

/**
 * Visualizador de cifra (T037): leitura confortável em /cifra/:id.
 * O desvio de transposição e o tamanho da fonte afetam somente o render —
 * o texto-fonte da cifra permanece intacto.
 */
export function SongViewer({ song, transpose, fontSize }: SongViewerProps) {
  return (
    <article className="flex h-full min-h-0 flex-col">
      {/* Cabeçalho: título, artista, tom exibido e temas */}
      <header className="shrink-0 space-y-1 border-b border-border pb-3">
        <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
          {song.title}
        </h1>
        {song.artist ? (
          <p className="text-sm text-muted-foreground">{song.artist}</p>
        ) : null}
        <p className="text-sm font-medium text-foreground">
          {keyLine(song.original_key, transpose)}
        </p>
        {song.bpm !== null || song.time_signature ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5" aria-label="Andamento e compasso">
            {song.bpm !== null ? (
              <Badge variant="outline" aria-label={`Andamento de ${song.bpm} BPM`}>
                ♩ = {song.bpm}
              </Badge>
            ) : null}
            {song.time_signature ? (
              <Badge variant="outline" aria-label={`Compasso ${song.time_signature}`}>
                {song.time_signature}
              </Badge>
            ) : null}
          </div>
        ) : null}
        {song.themes.length > 0 ? (
          <ul
            className="flex flex-wrap gap-1.5 pt-1"
            aria-label="Temas da cifra"
          >
            {song.themes.map((theme) => (
              <li key={theme}>
                <Badge variant="secondary">{theme}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {/* Corpo: render puro do texto-fonte via ChordPreview */}
      <div className="min-h-0 flex-1">
        <ChordPreview
          content={song.content}
          transpose={transpose}
          fontSize={fontSize}
          className="h-full"
        />
      </div>
    </article>
  )
}
