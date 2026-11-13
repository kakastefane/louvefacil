import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { SongViewer } from '@/features/songs/components/SongViewer'
import {
  ViewerControls,
  loadViewerFontSize,
  saveViewerFontSize,
} from '@/features/songs/components/ViewerControls'
import { getSongById } from '@/features/songs/service'
import type { Song } from '@/types/domain'

type LoadState = 'loading' | 'ready' | 'missing' | 'error'

/**
 * Visualizador de cifra (T037) — rota /cifra/:id, leitura confortável.
 * A transposição vale só em memória (nunca é salva na cifra nem enviada ao
 * servidor); o tamanho da fonte persiste localmente em
 * `louve-facil:viewer-font-size`. Membros podem ler — sem RequireEditor.
 */
export function SongViewerPage() {
  const { id } = useParams<{ id: string }>()

  const [song, setSong] = useState<Song | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  // Desvio aplicado apenas ao render desta página (inicia em 0)
  const [transpose, setTranspose] = useState(0)
  // Tamanho da fonte: carregado do localStorage no mount (padrão 16 px)
  const [fontSize, setFontSize] = useState<number>(() => loadViewerFontSize())

  const loadSong = useCallback(async () => {
    if (!id) {
      setSong(null)
      setLoadState('missing')
      return
    }
    setLoadState('loading')
    try {
      const found = await getSongById(id)
      if (found) {
        setSong(found)
        setLoadState('ready')
      } else {
        setSong(null)
        setLoadState('missing')
      }
    } catch {
      setLoadState('error')
    }
  }, [id])

  useEffect(() => {
    void loadSong()
  }, [loadSong])

  // Ao trocar de cifra, o desvio de transposição volta para zero
  useEffect(() => {
    setTranspose(0)
  }, [id])

  function handleFontSizeChange(px: number) {
    setFontSize(px)
    saveViewerFontSize(px)
  }

  function renderBody() {
    if (loadState === 'loading') {
      return <LoadingState label="Carregando cifra…" />
    }
    if (loadState === 'error') {
      return (
        <ErrorState
          message="Não foi possível carregar a cifra. Verifique sua conexão e tente novamente."
          onRetry={() => void loadSong()}
        />
      )
    }
    if (loadState === 'missing' || !song) {
      return (
        <EmptyState
          title="Cifra não encontrada"
          description="Ela pode ter sido excluída ou você não tem acesso a ela nesta equipe."
          action={
            <Button asChild>
              <Link to="/biblioteca">Voltar para a biblioteca</Link>
            </Button>
          }
        />
      )
    }
    return <SongViewer song={song} transpose={transpose} fontSize={fontSize} />
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col">
      <header className="mb-2 shrink-0">
        <Link
          to="/biblioteca"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Biblioteca
        </Link>
      </header>

      {/* Área do viewer com scroll interno */}
      <div className="min-h-0 flex-1">{renderBody()}</div>

      {loadState === 'ready' && song ? (
        <ViewerControls
          transpose={transpose}
          onTransposeChange={setTranspose}
          fontSize={fontSize}
          onFontSizeChange={handleFontSizeChange}
          className="mt-2 shrink-0"
        />
      ) : null}
    </div>
  )
}
