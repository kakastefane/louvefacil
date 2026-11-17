import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  Copy,
  GripVertical,
  Loader2,
  Minus,
  Music,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import {
  addItem,
  deleteSetlist,
  duplicateSetlist,
  getSetlist,
  listItems,
  removeItem,
  reorderItems,
  setItemTranspose,
  updateSetlist,
} from '@/features/setlists/service'
import {
  clampTranspose,
  stepTranspose,
  transposeLabel,
} from '@/features/setlists/positions'
import { transposeKey } from '@/features/chords/transpose'
import { listSongs } from '@/features/songs/service'
import { filterSongs } from '@/features/songs/filter'
import { useTeam } from '@/features/teams/TeamContext'
import { canEdit } from '@/types/domain'
import { cn, formatDateOnlyPtBr, friendlyErrorMessage } from '@/lib/utils'
import type { Setlist, SetlistItem, Song } from '@/types/domain'

/**
 * Services lançam erros com mensagem PT-BR pronta — exibimos direto.
 * Códigos crus (offline_write, rede, Postgres) caem no mapa central amigável.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message
    const looksReadyPtBr =
      message.length > 0 &&
      /\s/.test(message) &&
      !/failed|fetch|network|denied|permission|token|jwt|duplicate|violat|schema|column|relation|invalid|expired|not_/i.test(
        message,
      )
    if (looksReadyPtBr) return message
  }
  return friendlyErrorMessage(error)
}

/** Linha "Tom:" exibida em cada item (FR-017/FR-020). */
function keyLine(originalKey: string | null, transpose: number): string {
  if (!originalKey) {
    return transpose === 0
      ? 'Tom não informado'
      : `Tom não informado (${transposeLabel(transpose)})`
  }
  if (transpose === 0) return `Tom: ${originalKey}`
  const displayed = transposeKey(originalKey, transpose) ?? originalKey
  return `Tom: ${originalKey} → ${displayed} (${transposeLabel(transpose)})`
}

type LoadStatus = 'loading' | 'ready' | 'missing' | 'error'
type DialogKind = 'edit' | 'duplicate' | 'delete' | 'add'

interface SortableItemRowProps {
  item: SetlistItem
  position: number
  song: Song | undefined
  editable: boolean
  busy: string | null
  onStepTranspose: (item: SetlistItem, delta: 1 | -1) => void
  onRemove: (item: SetlistItem) => void
}

/** Linha ordenável do setlist — drag apenas pelo handle (GripVertical). */
function SortableItemRow({
  item,
  position,
  song,
  editable,
  busy,
  onStepTranspose,
  onRemove,
}: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: item.id,
      disabled: !editable || busy === 'reorder',
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const transposeBusy = busy === `transpose:${item.id}`
  const removeBusy = busy === `remove:${item.id}`
  const rowBusy = transposeBusy || removeBusy

  // Tom atual exibido no seletor (ex.: `A`) + desvio pequeno abaixo (`+2`),
  // mesmo padrão do alterador de tom do modo tocar (ViewerControls).
  const displayedKey = song?.original_key
    ? transposeKey(song.original_key, item.transpose)
    : null
  const offsetLabel =
    item.transpose === 0 ? null : transposeLabel(item.transpose)

  // Item órfão (cifra excluída antes da cascata propagar): linha desabilitada
  if (!song) {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 px-3 py-3 opacity-70"
      >
        <span className="w-6 text-center text-sm font-semibold text-muted-foreground">
          {position}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-muted-foreground">Cifra removida</p>
          <p className="text-xs text-muted-foreground">
            Esta música não está mais na biblioteca.
          </p>
        </div>
        <Badge variant="outline">{transposeLabel(item.transpose)}</Badge>
      </li>
    )
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-xl border bg-card px-2 py-2 shadow-sm sm:gap-3 sm:px-3',
        isDragging && 'z-10 opacity-80 shadow-md',
      )}
    >
      {editable ? (
        <button
          type="button"
          className="cursor-grab touch-none rounded-md p-1.5 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Arrastar para reordenar"
          disabled={busy === 'reorder'}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" aria-hidden />
        </button>
      ) : null}

      <span className="w-6 text-center text-sm font-semibold tabular-nums text-muted-foreground">
        {position}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-snug">{song.title}</p>
        {song.artist ? (
          <p className="truncate text-xs text-muted-foreground">{song.artist}</p>
        ) : null}
        <p className="mt-0.5 truncate text-xs font-medium text-foreground/90">
          {keyLine(song.original_key, item.transpose)}
        </p>
      </div>

      {editable ? (
        <div
          className="flex shrink-0 items-center gap-1"
          role="group"
          aria-label={`Transposição de ${song.title}`}
        >
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onStepTranspose(item, -1)}
            disabled={rowBusy || item.transpose <= -11}
            aria-label={`Diminuir um semitom em ${song.title}`}
          >
            <Minus aria-hidden />
          </Button>
          <span
            className="flex min-w-[4ch] flex-col items-center justify-center leading-none"
            aria-live="polite"
            aria-label={
              displayedKey
                ? `Tom atual: ${displayedKey}${offsetLabel ? ` (desvio ${offsetLabel})` : ''}`
                : `Desvio ${transposeLabel(item.transpose)} semitons`
            }
          >
            {transposeBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <>
                <span className="font-mono text-base font-bold tabular-nums">
                  {displayedKey ?? transposeLabel(item.transpose)}
                </span>
                {displayedKey && offsetLabel ? (
                  <span className="mt-0.5 text-[0.625rem] font-semibold text-muted-foreground">
                    {offsetLabel}
                  </span>
                ) : null}
              </>
            )}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onStepTranspose(item, 1)}
            disabled={rowBusy || item.transpose >= 11}
            aria-label={`Aumentar um semitom em ${song.title}`}
          >
            <Plus aria-hidden />
          </Button>
        </div>
      ) : (
        <Badge variant="secondary" className="shrink-0 gap-1">
          {displayedKey ? (
            <>
              <span className="font-mono font-semibold">{displayedKey}</span>
              {offsetLabel ? (
                <span className="text-[0.625rem] font-semibold text-muted-foreground">
                  {offsetLabel}
                </span>
              ) : null}
            </>
          ) : (
            <span className="tabular-nums">
              Desvio {transposeLabel(item.transpose)}
            </span>
          )}
        </Badge>
      )}

      {editable ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemove(item)}
          disabled={rowBusy}
          aria-label={`Remover ${song.title} do setlist`}
        >
          {removeBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 aria-hidden />
          )}
        </Button>
      ) : null}
    </li>
  )
}

export function SetlistDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { activeTeam, activeMember, loading: teamLoading } = useTeam()
  const editable = activeMember ? canEdit(activeMember.role) : false

  const [setlist, setSetlist] = useState<Setlist | null>(null)
  const [items, setItems] = useState<SetlistItem[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [reloadToken, setReloadToken] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogKind | null>(null)

  // Diálogo "Editar nome/data"
  const [editName, setEditName] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  // Diálogo "Duplicar"
  const [duplicateName, setDuplicateName] = useState('')
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState(false)

  // Diálogo "Excluir"
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Diálogo "Adicionar músicas"
  const [addQuery, setAddQuery] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const teamId = activeTeam?.id ?? null

  useEffect(() => {
    if (!id) return
    if (teamLoading) return
    if (!teamId) {
      setStatus('error')
      return
    }
    let cancelled = false
    setStatus('loading')
    Promise.all([getSetlist(id), listItems(id), listSongs(teamId)])
      .then(([found, itemList, songList]) => {
        if (cancelled) return
        if (!found) {
          setStatus('missing')
          return
        }
        setSetlist(found)
        setItems([...itemList].sort((a, b) => a.position - b.position))
        setSongs(songList)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [id, teamId, teamLoading, reloadToken])

  const songMap = useMemo(
    () => new Map<string, Song>(songs.map((song) => [song.id, song])),
    [songs],
  )
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.position - b.position),
    [items],
  )

  const reloadItems = useCallback(async () => {
    if (!id) return
    try {
      const list = await listItems(id)
      setItems([...list].sort((a, b) => a.position - b.position))
    } catch {
      setActionError('Não foi possível recarregar os itens do setlist.')
    }
  }, [id])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ---- Reordenação otimista (drag-and-drop) ------------------------------
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !id) return
    const oldIndex = sortedItems.findIndex((item) => item.id === active.id)
    const newIndex = sortedItems.findIndex((item) => item.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const previous = items
    const reordered = arrayMove(sortedItems, oldIndex, newIndex).map(
      (item, index) => ({ ...item, position: index + 1 }),
    )
    setItems(reordered)
    setBusy('reorder')
    setActionError(null)
    reorderItems(
      id,
      reordered.map((item) => item.id),
    )
      .catch((error) => {
        setItems(previous)
        setActionError(
          `${describeError(error)} A lista foi recarregada.`,
        )
        void reloadItems()
      })
      .finally(() => setBusy(null))
  }

  // ---- Transposição por item ----------------------------------------------
  async function handleStepTranspose(item: SetlistItem, delta: 1 | -1) {
    const next = stepTranspose(item.transpose, delta)
    if (next === clampTranspose(item.transpose)) return
    setBusy(`transpose:${item.id}`)
    setActionError(null)
    try {
      const updated = await setItemTranspose(item.id, next)
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === updated.id ? { ...entry, transpose: updated.transpose } : entry,
        ),
      )
    } catch (error) {
      setActionError(describeError(error))
    } finally {
      setBusy(null)
    }
  }

  // ---- Remoção por item ----------------------------------------------------
  async function handleRemoveItem(item: SetlistItem) {
    setBusy(`remove:${item.id}`)
    setActionError(null)
    try {
      await removeItem(item.id)
      setItems((prev) =>
        [...prev]
          .filter((entry) => entry.id !== item.id)
          .sort((a, b) => a.position - b.position)
          .map((entry, index) => ({ ...entry, position: index + 1 })),
      )
    } catch (error) {
      setActionError(describeError(error))
    } finally {
      setBusy(null)
    }
  }

  // ---- Adição de cifras -----------------------------------------------------
  async function handleAddSong(song: Song) {
    if (!setlist) return
    setBusy(`add:${song.id}`)
    setAddError(null)
    try {
      const created = await addItem(setlist.id, song.id)
      setItems((prev) =>
        [...prev, created].sort((a, b) => a.position - b.position),
      )
    } catch (error) {
      setAddError(describeError(error))
    } finally {
      setBusy(null)
    }
  }

  // ---- Ações do setlist (dono/editor, FR-029) ------------------------------
  function openEditDialog() {
    if (!setlist) return
    setEditName(setlist.name)
    setEditDate(setlist.event_date ?? '')
    setEditError(null)
    setDialog('edit')
  }

  async function handleSaveEdit() {
    if (!setlist) return
    const name = editName.trim()
    if (!name) {
      setEditError('Informe um nome para o setlist.')
      return
    }
    if (name.length > 160) {
      setEditError('O nome do setlist deve ter até 160 caracteres.')
      return
    }
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await updateSetlist(setlist.id, {
        name,
        event_date: editDate || null,
      })
      setSetlist(updated)
      setDialog(null)
    } catch (error) {
      setEditError(describeError(error))
    } finally {
      setEditSaving(false)
    }
  }

  function openDuplicateDialog() {
    if (!setlist) return
    setDuplicateName(`Cópia de ${setlist.name}`)
    setDuplicateError(null)
    setDialog('duplicate')
  }

  async function handleDuplicate() {
    if (!setlist) return
    const name = duplicateName.trim()
    if (!name) {
      setDuplicateError('Informe um nome para a cópia.')
      return
    }
    setDuplicating(true)
    setDuplicateError(null)
    try {
      const created = await duplicateSetlist(setlist.id, name)
      setDialog(null)
      navigate(`/setlist/${created.id}`)
    } catch (error) {
      setDuplicateError(describeError(error))
    } finally {
      setDuplicating(false)
    }
  }

  function openDeleteDialog() {
    setDeleteError(null)
    setDialog('delete')
  }

  async function handleDelete() {
    if (!setlist) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteSetlist(setlist.id)
      setDialog(null)
      navigate('/setlists')
    } catch (error) {
      setDeleteError(describeError(error))
    } finally {
      setDeleting(false)
    }
  }

  function openAddDialog() {
    setAddQuery('')
    setAddError(null)
    setDialog('add')
  }

  // ---- Estados de carregamento / erro / inexistente -------------------------
  if (teamLoading || status === 'loading') {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 lg:py-8">
        <LoadingState label="Carregando setlist…" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 lg:py-8">
        <ErrorState
          message="Não foi possível carregar o setlist. Verifique sua conexão e tente novamente."
          onRetry={() => setReloadToken((token) => token + 1)}
        />
      </div>
    )
  }

  if (status === 'missing' || !setlist) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 lg:py-8">
        <EmptyState
          icon={<Music className="h-8 w-8" aria-hidden />}
          title="Setlist não encontrado"
          description="Ele pode ter sido excluído ou você não tem acesso a ele nesta equipe."
          action={
            <Button onClick={() => navigate('/setlists')}>
              Voltar para setlists
            </Button>
          }
        />
      </div>
    )
  }

  const songCount = items.length
  const addFiltered = filterSongs(songs, { query: addQuery })
  const availableSongs = addFiltered.filter(
    (song) => !items.some((item) => item.song_id === song.id),
  )
  const adding = busy?.startsWith('add:') ?? false
  let addEmptyMessage: string | null = null
  if (availableSongs.length === 0) {
    if (songs.length === 0) {
      addEmptyMessage = 'Sua equipe ainda não tem cifras cadastradas.'
    } else if (addQuery.trim()) {
      addEmptyMessage =
        addFiltered.length === 0
          ? `Nenhuma cifra encontrada para “${addQuery.trim()}”.`
          : 'Todas as cifras encontradas já estão no setlist.'
    } else {
      addEmptyMessage = 'Todas as cifras da equipe já estão neste setlist.'
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 lg:py-8">
      {/* Cabeçalho */}
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link
            to="/setlists"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Setlists
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{setlist.name}</h1>
          <p className="text-sm text-muted-foreground">
            {setlist.event_date
              ? formatDateOnlyPtBr(setlist.event_date)
              : 'Sem data de evento'}
            {' · '}
            {songCount} {songCount === 1 ? 'música' : 'músicas'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <>
              <Button variant="outline" size="sm" onClick={openEditDialog}>
                <Pencil aria-hidden />
                Editar
              </Button>
              <Button variant="outline" size="sm" onClick={openDuplicateDialog}>
                <Copy aria-hidden />
                Duplicar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={openDeleteDialog}
              >
                <Trash2 aria-hidden />
                Excluir
              </Button>
            </>
          ) : null}
          <Button
            size="lg"
            onClick={() => navigate(`/setlist/${setlist.id}/tocar`)}
            disabled={songCount === 0}
          >
            <Play aria-hidden />
            Tocar
          </Button>
        </div>
      </header>

      {/* Erro de ação inline, acima da lista */}
      {actionError ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {/* Barra de ações da lista */}
      <div className="mb-3 flex items-center justify-end gap-2">
        {editable ? (
          <Button variant="outline" onClick={openAddDialog}>
            <Plus aria-hidden />
            Adicionar músicas
          </Button>
        ) : null}
      </div>

      {/* Itens do setlist */}
      {sortedItems.length === 0 ? (
        <EmptyState
          icon={<Music className="h-8 w-8" aria-hidden />}
          title="Nenhuma música ainda"
          description={
            editable
              ? 'Adicione a primeira música ao setlist para montar a ordem do culto.'
              : 'Peça a um editor para adicionar músicas.'
          }
          action={
            editable ? (
              <Button onClick={openAddDialog}>
                <Plus aria-hidden />
                Adicionar músicas
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedItems.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-2">
              {sortedItems.map((item, index) => (
                <SortableItemRow
                  key={item.id}
                  item={item}
                  position={index + 1}
                  song={songMap.get(item.song_id)}
                  editable={editable}
                  busy={busy}
                  onStepTranspose={(entry, delta) =>
                    void handleStepTranspose(entry, delta)
                  }
                  onRemove={(entry) => void handleRemoveItem(entry)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {/* Diálogo: editar nome/data */}
      <Dialog
        open={dialog === 'edit'}
        onOpenChange={(open) => {
          if (!open && !editSaving) setDialog(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar setlist</DialogTitle>
            <DialogDescription>
              Altere o nome e a data do evento. Nada é salvo até você confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="setlist-edit-name">Nome</Label>
              <Input
                id="setlist-edit-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                maxLength={160}
                disabled={editSaving}
                placeholder="Ex.: Culto de domingo"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="setlist-edit-date">Data do evento (opcional)</Label>
              <Input
                id="setlist-edit-date"
                type="date"
                value={editDate}
                onChange={(event) => setEditDate(event.target.value)}
                disabled={editSaving}
              />
            </div>
          </div>
          {editError ? (
            <p role="alert" className="text-sm text-destructive">
              {editError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog(null)}
              disabled={editSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSaveEdit()}
              disabled={editSaving}
              aria-busy={editSaving}
            >
              {editSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                'Salvar alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: duplicar */}
      <Dialog
        open={dialog === 'duplicate'}
        onOpenChange={(open) => {
          if (!open && !duplicating) setDialog(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicar setlist</DialogTitle>
            <DialogDescription>
              Cria uma cópia independente deste setlist, com a mesma ordem e
              as mesmas transposições.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="setlist-duplicate-name">Nome da cópia</Label>
            <Input
              id="setlist-duplicate-name"
              value={duplicateName}
              onChange={(event) => setDuplicateName(event.target.value)}
              maxLength={160}
              disabled={duplicating}
            />
          </div>
          {duplicateError ? (
            <p role="alert" className="text-sm text-destructive">
              {duplicateError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog(null)}
              disabled={duplicating}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleDuplicate()}
              disabled={duplicating}
              aria-busy={duplicating}
            >
              {duplicating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Duplicando…
                </>
              ) : (
                'Duplicar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: excluir (destrutivo) */}
      <Dialog
        open={dialog === 'delete'}
        onOpenChange={(open) => {
          if (!open && !deleting) setDialog(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir setlist</DialogTitle>
            <DialogDescription>
              Excluir “{setlist.name}”? A ordem das músicas e as transposições
              serão perdidas. Esta ação não pode ser desfeita.
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
              onClick={() => setDialog(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleting}
              aria-busy={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Excluindo…
                </>
              ) : (
                'Excluir setlist'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: adicionar músicas */}
      <Dialog
        open={dialog === 'add'}
        onOpenChange={(open) => {
          if (!open && !adding) setDialog(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar músicas</DialogTitle>
            <DialogDescription>
              Busque cifras da equipe para adicionar ao setlist.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={addQuery}
              onChange={(event) => setAddQuery(event.target.value)}
              placeholder="Buscar por título ou artista…"
              aria-label="Buscar cifra por título ou artista"
              className="pl-9"
              autoFocus
            />
          </div>
          {addError ? (
            <p role="alert" className="text-sm text-destructive">
              {addError}
            </p>
          ) : null}
          <div className="max-h-72 overflow-y-auto">
            {addEmptyMessage ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {addEmptyMessage}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {availableSongs.map((song) => {
                  const isAdding = busy === `add:${song.id}`
                  return (
                    <li
                      key={song.id}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {song.title}
                        </p>
                        {song.artist ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {song.artist}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => void handleAddSong(song)}
                        disabled={adding}
                        aria-label={`Adicionar ${song.title} ao setlist`}
                      >
                        {isAdding ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Plus aria-hidden />
                        )}
                        Adicionar
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
