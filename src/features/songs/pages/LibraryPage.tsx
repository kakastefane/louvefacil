import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, Music, Pencil, Plus, Search, SearchX, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { listSongs, deleteSong } from '@/features/songs/service'
import { filterSongs, collectThemes } from '@/features/songs/filter'
import { useTeam } from '@/features/teams/TeamContext'
import { canEdit } from '@/types/domain'
import { friendlyErrorMessage, themeKey } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Song } from '@/types/domain'

type LoadStatus = 'loading' | 'ready' | 'error'

/** Mensagem amigável de erro de exclusão (services já lançam PT-BR). */
function describeDeleteError(error: unknown): string {
  return error instanceof Error ? error.message : friendlyErrorMessage(error)
}

/**
 * Biblioteca de cifras (T036): listagem com busca (debounce ~200ms),
 * filtro por tema via chips e exclusão com confirmação (T034).
 * Dono/editor veem as ações de escrita; membros só consultam (FR-029).
 */
export function LibraryPage() {
  const navigate = useNavigate()
  const { activeTeam, activeMember, loading: teamLoading } = useTeam()
  const editable = activeMember ? canEdit(activeMember.role) : false

  const [songs, setSongs] = useState<Song[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [reloadToken, setReloadToken] = useState(0)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  // forma canônica do tema (themeKey) — o filterSongs também normaliza
  const [activeTheme, setActiveTheme] = useState<string | null>(null)

  const [pendingDelete, setPendingDelete] = useState<Song | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Debounce da busca (~200ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(timer)
  }, [query])

  const teamId = activeTeam?.id ?? null

  useEffect(() => {
    if (!teamId) {
      setSongs([])
      setStatus('ready')
      return
    }
    let cancelled = false
    setStatus('loading')
    listSongs(teamId)
      .then((list) => {
        if (cancelled) return
        setSongs(list)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [teamId, reloadToken])

  const themes = collectThemes(songs)
  const visibleSongs = filterSongs(songs, {
    query: debouncedQuery,
    theme: activeTheme,
  })
  const hasActiveFilters =
    debouncedQuery.trim().length > 0 || activeTheme !== null

  function clearFilters() {
    setQuery('')
    setDebouncedQuery('')
    setActiveTheme(null)
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      // o banco remove em cascata os itens desta cifra nas setlists
      await deleteSong(pendingDelete.id)
      setPendingDelete(null)
      setReloadToken((token) => token + 1)
    } catch (error) {
      // erro inline no dialog — ele permanece aberto
      setDeleteError(describeDeleteError(error))
    } finally {
      setDeleting(false)
    }
  }

  function openDeleteDialog(song: Song) {
    setDeleteError(null)
    setPendingDelete(song)
  }

  function renderBody() {
    if (teamLoading || status === 'loading') {
      return <LoadingState label="Carregando biblioteca…" />
    }

    if (status === 'error') {
      return (
        <ErrorState
          message="Não foi possível carregar a biblioteca. Verifique sua conexão e tente novamente."
          onRetry={() => setReloadToken((token) => token + 1)}
        />
      )
    }

    // Repertório vazio (sem cifras na equipe)
    if (songs.length === 0) {
      return (
        <EmptyState
          icon={<Music className="h-8 w-8" aria-hidden />}
          title="Nenhuma cifra na biblioteca"
          description="Sua equipe ainda não tem cifras cadastradas. Adicione a primeira para montar o repertório."
          action={
            editable ? (
              <Button onClick={() => navigate('/cifra/nova')}>
                <Plus aria-hidden />
                Nova cifra
              </Button>
            ) : undefined
          }
        />
      )
    }

    // Busca/filtro sem resultados
    if (visibleSongs.length === 0) {
      return (
        <EmptyState
          icon={<SearchX className="h-8 w-8" aria-hidden />}
          title="Nenhuma cifra encontrada"
          description="Tente outra busca ou remova os filtros aplicados."
          action={
            <Button variant="outline" onClick={clearFilters}>
              Limpar filtros
            </Button>
          }
        />
      )
    }

    return (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleSongs.map((song) => {
          return (
            <li key={song.id}>
              <Card className="flex h-full items-stretch overflow-hidden">
                <button
                  type="button"
                  onClick={() => navigate(`/cifra/${song.id}`)}
                  aria-label={`Abrir cifra ${song.title}`}
                  className="flex-1 rounded-l-xl p-4 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="block font-medium leading-snug">
                    {song.title}
                  </span>
                  {song.artist ? (
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {song.artist}
                    </span>
                  ) : null}
                  {song.original_key || song.bpm !== null || song.time_signature ? (
                    <span className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Tom, andamento e compasso">
                      {song.original_key ? (
                        <Badge variant="outline">Tom: {song.original_key}</Badge>
                      ) : null}
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
                    </span>
                  ) : null}
                </button>
                {editable ? (
                  <div className="flex flex-col items-center gap-1 self-stretch border-l p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/cifra/${song.id}/editar`)}
                      aria-label={`Editar cifra ${song.title}`}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => openDeleteDialog(song)}
                      aria-label={`Excluir cifra ${song.title}`}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </Card>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:py-8">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Biblioteca</h1>
          <p className="text-sm text-muted-foreground">
            Cifras da sua equipe — busque, filtre por tema e abra para tocar.
          </p>
        </div>
        {editable && status === 'ready' && songs.length > 0 ? (
          <Button onClick={() => navigate('/cifra/nova')}>
            <Plus aria-hidden />
            Nova cifra
          </Button>
        ) : null}
      </header>

      {/* Busca + chips de tema (só quando há conteúdo ou filtros ativos) */}
      {!teamLoading && status === 'ready' && songs.length > 0 ? (
        <div className="mb-4 space-y-3">
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por título ou artista…"
              aria-label="Buscar cifra por título ou artista"
              className="pl-9"
            />
          </div>

          {themes.length > 0 ? (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filtrar por tema"
            >
              <Button
                size="sm"
                variant={activeTheme === null ? 'default' : 'outline'}
                onClick={() => setActiveTheme(null)}
                aria-pressed={activeTheme === null}
              >
                Todos
              </Button>
              {themes.map((theme) => {
                const key = themeKey(theme)
                const active = activeTheme === key
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    onClick={() => setActiveTheme(active ? null : key)}
                    aria-pressed={active}
                    className={cn(active && 'shadow-sm')}
                  >
                    {theme}
                  </Button>
                )
              })}
            </div>
          ) : null}

          {hasActiveFilters ? (
            <p className="text-xs text-muted-foreground" role="status">
              {visibleSongs.length === 1
                ? '1 cifra encontrada'
                : `${visibleSongs.length} cifras encontradas`}
            </p>
          ) : null}
        </div>
      ) : null}

      {renderBody()}

      {/* Confirmação de exclusão: avisa a cascata em setlists */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setPendingDelete(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cifra</DialogTitle>
            <DialogDescription>
              Excluir{pendingDelete ? ` “${pendingDelete.title}”` : ' esta cifra'}?
              Os itens desta cifra em todas as setlists também serão removidos.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={deleting}
              aria-busy={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Excluindo…
                </>
              ) : (
                'Excluir cifra'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
