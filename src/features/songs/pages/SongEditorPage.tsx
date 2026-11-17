import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'

import { RequireEditor } from '@/app/guards'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import {
  SongEditorForm,
  songDraftFromForm,
  type SongEditorFormValues,
} from '@/features/songs/components/SongEditorForm'
import {
  createSong,
  deleteSong,
  getSongById,
  listSongs,
  updateSong,
} from '@/features/songs/service'
import { useTeam } from '@/features/teams/TeamContext'
import { cn, friendlyErrorMessage } from '@/lib/utils'
import { collectThemes } from '@/features/songs/filter'
import type { Song } from '@/types/domain'

/**
 * Serviços de cifras lançam erros com mensagem PT-BR pronta — exibimos direto.
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

type EditorTab = 'edit' | 'preview'

/**
 * Editor de cifra (T033): criar em `/cifra/nova` e editar em `/cifra/:id/editar`.
 *
 * Layout: no desktop (≥lg) o `SongEditorForm` renderiza o editor e o preview
 * lado a lado (grid interno). No mobile alternamos entre as abas "Editar" e
 * "Preview" via CSS — a coluna do preview continua montada, então a digitação
 * e a prévia nunca desmontam e o rascunho jamais se perde ao trocar de aba.
 */
/** Chave do rascunho desta cifra no localStorage (fora da sessão do form). */
function songDraftKey(id: string | undefined): string {
  return `louve-facil:song-draft:${id ?? 'new'}`
}

/** Lê o rascunho salvo (se houver) — leitura síncrona antes da montagem do form. */
function loadDraft(key: string): Partial<SongEditorFormValues> | undefined {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Partial<SongEditorFormValues>
    return typeof parsed === 'object' && parsed !== null ? parsed : undefined
  } catch {
    return undefined
  }
}

function SongEditorContent() {
  const { id } = useParams<{ id: string }>()
  const isEdit = id !== undefined
  const navigate = useNavigate()
  const { activeTeam } = useTeam()

  // Rascunho local: restaura o que foi digitado se a aba foi recarregada
  const draftKey = songDraftKey(id)
  const [restoredDraft, setRestoredDraft] = useState<Partial<SongEditorFormValues> | undefined>(
    () => loadDraft(draftKey),
  )
  const [draftNonce, setDraftNonce] = useState(0)

  const [song, setSong] = useState<Song | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'error'>(
    isEdit ? 'loading' : 'ready',
  )
  const [tab, setTab] = useState<EditorTab>('edit')
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // Temas já usados na equipe: base do autocomplete no campo de temas.
  const [availableThemes, setAvailableThemes] = useState<string[]>([])
  const teamId = activeTeam?.id

  useEffect(() => {
    if (!teamId) {
      setAvailableThemes([])
      return
    }
    let active = true
    listSongs(teamId)
      .then((songs) => {
        if (active) setAvailableThemes(collectThemes(songs))
      })
      .catch(() => {
        // Sem rede/erro: o campo continua aceitando temas digitados livremente.
        if (active) setAvailableThemes([])
      })
    return () => {
      active = false
    }
  }, [teamId])

  const loadSong = useCallback(async () => {
    if (!id) return
    setLoadState('loading')
    try {
      const found = await getSongById(id)
      if (found) {
        setSong(found)
        setLoadState('ready')
      } else {
        setLoadState('missing')
      }
    } catch {
      setLoadState('error')
    }
  }, [id])

  useEffect(() => {
    if (isEdit) void loadSong()
  }, [isEdit, loadSong])

  async function handleSubmit(values: SongEditorFormValues) {
    if (!activeTeam) {
      setServerError('Selecione uma equipe para salvar a cifra.')
      return
    }
    setSubmitting(true)
    setServerError(null)
    try {
      const draft = songDraftFromForm(values)
      if (isEdit && id) {
        await updateSong(id, draft)
      } else {
        await createSong(activeTeam.id, draft)
      }
      localStorage.removeItem(draftKey)
      navigate('/biblioteca')
    } catch (error) {
      // o texto digitado permanece no formulário — nada é limpo aqui
      setServerError(describeError(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    setDeleteError(null)
    try {
      // o banco remove em cascata os itens desta cifra nas setlists
      await deleteSong(id)
      localStorage.removeItem(draftKey)
      setDeleteOpen(false)
      navigate('/biblioteca')
    } catch (error) {
      setDeleteError(describeError(error))
    } finally {
      setDeleting(false)
    }
  }

  // Rascunho restaurado tem prioridade sobre os dados salvos; descartar
  // remonta o formulário com os valores do servidor.
  const baseValues: Partial<SongEditorFormValues> | undefined = song
    ? {
        title: song.title,
        artist: song.artist ?? '',
        original_key: song.original_key,
        bpm: song.bpm != null ? String(song.bpm) : '',
        time_signature: song.time_signature,
        themes: song.themes,
        content: song.content,
      }
    : undefined
  const defaultValues: Partial<SongEditorFormValues> | undefined = restoredDraft
    ? { ...(baseValues ?? {}), ...restoredDraft }
    : baseValues

  function discardDraft() {
    localStorage.removeItem(draftKey)
    setRestoredDraft(undefined)
    setDraftNonce((nonce) => nonce + 1)
  }

  function renderBody() {
    if (isEdit && loadState === 'loading') {
      return <LoadingState label="Carregando cifra…" />
    }
    if (isEdit && loadState === 'error') {
      return (
        <ErrorState
          message="Não foi possível carregar a cifra. Verifique sua conexão e tente novamente."
          onRetry={() => void loadSong()}
        />
      )
    }
    if (isEdit && loadState === 'missing') {
      return (
        <EmptyState
          title="Cifra não encontrada"
          description="Ela pode ter sido excluída ou você não tem acesso a ela nesta equipe."
          action={
            <Button onClick={() => navigate('/biblioteca')}>
              Voltar para a biblioteca
            </Button>
          }
        />
      )
    }

    return (
      <>
        {/* Abas só no mobile; no desktop o grid do formulário fica visível */}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as EditorTab)}
          className="mb-3 lg:hidden"
        >
          <TabsList
            className="grid w-full grid-cols-2"
            aria-label="Alternar entre edição e preview"
          >
            <TabsTrigger value="edit">Editar</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
        </Tabs>

        {restoredDraft ? (
          <div
            role="status"
            className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
          >
            <span>Rascunho restaurado — você pode continuar de onde parou.</span>
            <Button variant="outline" size="sm" onClick={discardDraft}>
              Descartar rascunho
            </Button>
          </div>
        ) : null}

        {/*
         * Esconde uma das colunas internas do SongEditorForm no mobile via CSS
         * (a coluna de campos é o 1º div do <form>, a de preview o último).
         * As duas permanecem montadas — só a visibilidade muda — e no ≥lg
         * ambas aparecem lado a lado. O override de max-w-md no ≥lg abre espaço
         * para as duas colunas.
         */}
        <div
          className={cn(
            'lg:[&_.max-w-md]:max-w-none',
            tab === 'edit' && 'max-lg:[&_form>div:last-child]:hidden',
            tab === 'preview' && 'max-lg:[&_form>div:first-child]:hidden',
          )}
        >
          <SongEditorForm
            key={`${song?.id ?? 'nova'}:${draftNonce}`}
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            submitting={submitting}
            serverError={serverError}
            submitLabel={isEdit ? 'Salvar alterações' : 'Criar cifra'}
            draftKey={draftKey}
            availableThemes={availableThemes}
          />
        </div>
      </>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:py-8">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link
            to="/biblioteca"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Biblioteca
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? 'Editar cifra' : 'Nova cifra'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? `Atualizando${song ? ` “${song.title}”` : ''} — nada é salvo até você confirmar.`
              : 'Preencha os campos e acompanhe a prévia ao vivo.'}
          </p>
        </div>

        {isEdit && song ? (
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 aria-hidden />
            Excluir cifra
          </Button>
        ) : null}
      </header>

      {renderBody()}

      {/* Confirmação de exclusão: avisa a cascata em setlists */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleting) setDeleteOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cifra</DialogTitle>
            <DialogDescription>
              Excluir{song ? ` “${song.title}”` : ' esta cifra'}? Os itens desta
              cifra em todas as setlists serão removidos junto. Esta ação não
              pode ser desfeita.
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
              onClick={() => setDeleteOpen(false)}
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
                'Excluir cifra'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Exclusiva para dono/editor (a rota também passa por RequireEditor).
 */
export function SongEditorPage() {
  return (
    <RequireEditor>
      <SongEditorContent />
    </RequireEditor>
  )
}
