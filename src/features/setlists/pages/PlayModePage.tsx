import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChevronLeft, ChevronRight, ListMusic, Music, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { SongViewer } from '@/features/songs/components/SongViewer'
import {
  ViewerToolbar,
  clampTranspose,
  loadViewerFontSize,
  saveViewerFontSize,
} from '@/features/songs/components/ViewerControls'
import { listSongs } from '@/features/songs/service'
import { getSetlist, listItems } from '@/features/setlists/service'
import { useTeam } from '@/features/teams/TeamContext'
import type { Setlist, SetlistItem, Song } from '@/types/domain'

type LoadState = 'loading' | 'ready' | 'missing' | 'error'

/** Largura mínima horizontal (px) para reconhecer um swipe. */
const SWIPE_THRESHOLD_PX = 48

/** localStorage: ajuste de tom por item, por setlist e por dispositivo. */
function transposeStorageKey(setlistId: string): string {
  return `louve-facil:playmode-transpose:${setlistId}`
}

function loadTransposeOverrides(setlistId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(transposeStorageKey(setlistId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: Record<string, number> = {}
    for (const [itemId, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        result[itemId] = clampTranspose(value)
      }
    }
    return result
  } catch {
    return {}
  }
}

function saveTransposeOverrides(setlistId: string, overrides: Record<string, number>): void {
  try {
    localStorage.setItem(transposeStorageKey(setlistId), JSON.stringify(overrides))
  } catch {
    // armazenamento indisponível: segue só em memória
  }
}

/**
 * Modo tocar (T043) — rota /setlist/:id/tocar. Uma música por vez, ocupando
 * a tela, para apresentar no culto. O alterador de tom (acima da cifra,
 * abaixo dos temas) grava o ajuste no localStorage deste dispositivo, por
 * setlist e por música — sai, recarrega, volta: o ajuste permanece.
 * Nunca grava no banco; o tom salvo no detalhe do setlist é o padrão.
 * Todos os papéis (inclusive 'member') podem usar — sem RequireEditor.
 * A posição na lista não persiste: refresh volta para a primeira música.
 */
export function PlayModePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { activeTeam, loading: teamLoading } = useTeam()
  const teamId = activeTeam?.id ?? null

  const [setlist, setSetlist] = useState<Setlist | null>(null)
  const [items, setItems] = useState<SetlistItem[]>([])
  const [songsById, setSongsById] = useState<Map<string, Song>>(new Map())
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [index, setIndex] = useState(0)
  // Ajustes de tom por item: persistem neste dispositivo (localStorage, por setlist)
  const [transposeOverrides, setTransposeOverrides] = useState<Record<string, number>>(() =>
    id ? loadTransposeOverrides(id) : {},
  )
  const [fontSize, setFontSize] = useState<number>(() => loadViewerFontSize())
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Uma carga só: setlist + itens + cifras da equipe montadas em Map (id→Song).
  // 3 queries no total (listSongs é read-through via Dexie) em vez de 1 getSongById por item.
  const load = useCallback(async () => {
    if (!id) {
      setSetlist(null)
      setItems([])
      setSongsById(new Map())
      setLoadState('missing')
      return
    }
    setLoadState('loading')
    try {
      const [found, itemList, songList] = await Promise.all([
        getSetlist(id),
        listItems(id),
        teamId ? listSongs(teamId) : Promise.resolve([]),
      ])
      if (!found) {
        setSetlist(null)
        setItems([])
        setSongsById(new Map())
        setLoadState('missing')
        return
      }
      setSetlist(found)
      setItems(itemList)
      setSongsById(new Map(songList.map((song) => [song.id, song])))
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [id, teamId])

  useEffect(() => {
    void load()
  }, [load])

  // Ao trocar de setlist, volta para a primeira música e recarrega os ajustes do dispositivo
  useEffect(() => {
    setIndex(0)
    setTransposeOverrides(id ? loadTransposeOverrides(id) : {})
  }, [id])

  // Índice sempre dentro dos limites da lista (itens podem mudar após reload)
  const safeIndex = items.length === 0 ? 0 : Math.min(Math.max(index, 0), items.length - 1)
  const canPrev = safeIndex > 0
  const canNext = safeIndex < items.length - 1

  const goPrev = useCallback(() => {
    setIndex((current) => {
      if (items.length === 0) return 0
      const clamped = Math.min(Math.max(current, 0), items.length - 1)
      return Math.max(0, clamped - 1)
    })
  }, [items.length])

  const goNext = useCallback(() => {
    setIndex((current) => {
      if (items.length === 0) return 0
      const clamped = Math.min(Math.max(current, 0), items.length - 1)
      return Math.min(items.length - 1, clamped + 1)
    })
  }, [items.length])

  // Setas ← / → do teclado; ignoradas quando um campo editável está focado
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable)
          return
      }
      if (event.key === 'ArrowLeft') goPrev()
      else if (event.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goPrev, goNext])

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    const touch = event.touches[0]
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  // Swipe horizontal > 48px e dominante sobre o vertical: ← próxima, → anterior
  function handleTouchEnd(event: React.TouchEvent<HTMLElement>) {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    if (!touch) return
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return
    if (Math.abs(deltaX) <= SWIPE_THRESHOLD_PX) return
    if (deltaX < 0) goNext()
    else goPrev()
  }

  const currentItem = items[safeIndex] ?? null
  const currentSong = currentItem ? (songsById.get(currentItem.song_id) ?? null) : null
  // Ajuste de tom por item persistido no localStorage deste dispositivo.
  // O banco nunca é tocado — o tom salvo no setlist (detalhe) é só o ponto de partida.
  const currentTranspose = currentItem
    ? (transposeOverrides[currentItem.id] ?? currentItem.transpose)
    : 0
  const setCurrentTranspose = (next: number) => {
    if (!currentItem || !id) return
    const clamped = clampTranspose(next)
    const nextMap = { ...transposeOverrides }
    // ajuste igual ao tom salvo no setlist → limpamos o override (volta ao padrão)
    if (clamped === currentItem.transpose) delete nextMap[currentItem.id]
    else nextMap[currentItem.id] = clamped
    setTransposeOverrides(nextMap)
    saveTransposeOverrides(id, nextMap)
  }

  const handleFontSizeChange = (next: number) => {
    setFontSize(next)
    saveViewerFontSize(next)
  }

  function renderBody() {
    if (teamLoading || loadState === 'loading') {
      return <LoadingState label="Carregando modo tocar…" />
    }
    if (loadState === 'error') {
      return (
        <ErrorState
          message="Não foi possível carregar o setlist. Verifique sua conexão e tente novamente."
          onRetry={() => void load()}
        />
      )
    }
    if (loadState === 'missing' || !setlist) {
      return (
        <EmptyState
          title="Setlist não encontrado"
          description="Ele pode ter sido excluído ou você não tem acesso a ele nesta equipe."
          action={
            <Button asChild>
              <Link to="/setlists">Voltar para os setlists</Link>
            </Button>
          }
        />
      )
    }
    if (items.length === 0) {
      return (
        <EmptyState
          icon={<ListMusic className="h-8 w-8" aria-hidden />}
          title="Setlist vazio"
          description="Adicione músicas no detalhe do setlist."
          action={
            <Button onClick={() => navigate(`/setlist/${setlist.id}`)}>
              Adicionar músicas
            </Button>
          }
        />
      )
    }
    if (!currentItem || !currentSong) {
      // Cifra fora do cache/biblioteca — mantém a navegação funcionando
      return (
        <EmptyState
          className="h-full justify-center"
          icon={<Music className="h-8 w-8" aria-hidden />}
          title="Cifra indisponível"
          description="Esta música não está mais na biblioteca da equipe. Use Anterior ou Próxima para continuar."
        />
      )
    }
    return (
      <SongViewer
        song={currentSong}
        transpose={currentTranspose}
        fontSize={fontSize}
        controls={
          <ViewerToolbar
            transpose={currentTranspose}
            onTransposeChange={setCurrentTranspose}
            transposeResetTo={currentItem.transpose}
            fontSize={fontSize}
            onFontSizeChange={handleFontSizeChange}
          />
        }
      />
    )
  }

  const showChrome = loadState === 'ready' && setlist !== null
  const showControls = showChrome && items.length > 0

  return (
    <div
      role="region"
      aria-label="Modo tocar"
      className="flex h-full min-h-[70vh] flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Barra superior: nome do setlist + sair */}
      {showChrome ? (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border pb-2">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-sm font-semibold leading-tight" title={setlist.name}>
              {setlist.name}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/setlist/${setlist.id}`)}
            aria-label="Sair do modo tocar"
          >
            <X aria-hidden />
            Sair
          </Button>
        </header>
      ) : null}

      {/* Área da música: scroll interno do viewer */}
      <div className="flex min-h-0 flex-1 flex-col justify-center py-2">{renderBody()}</div>

      {/* Indicador + botões de navegação grandes (fixos na base) */}
      {showControls ? (
        <footer className="shrink-0 space-y-2 border-t border-border pt-2">
          <p
            className="text-center text-sm font-medium tabular-nums text-muted-foreground"
            aria-live="polite"
          >
            {safeIndex + 1} de {items.length}
          </p>
          <div className="flex items-center justify-between gap-3">
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              onClick={goPrev}
              disabled={!canPrev}
              aria-label="Música anterior"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden />
              Anterior
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              onClick={goNext}
              disabled={!canNext}
              aria-label="Próxima música"
            >
              Próxima
              <ChevronRight className="h-6 w-6" aria-hidden />
            </Button>
          </div>
        </footer>
      ) : null}
    </div>
  )
}
