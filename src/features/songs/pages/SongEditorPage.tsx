import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, FileJson, Loader2, Trash2, TriangleAlert } from 'lucide-react'

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
import {
  SONG_IMPORT_MAX_BYTES,
  SongImportError,
  parseSongJson,
  type ImportedSongValues,
} from '@/features/songs/import'
import { useTeam } from '@/features/teams/TeamContext'
import { cn, friendlyErrorMessage } from '@/lib/utils'
import { collectThemes } from '@/features/songs/filter'
import type { Song } from '@/types/domain'

type ImportFeedback =
  | {
      kind: 'success'
      fileName: string
      values: ImportedSongValues
      warnings: string[]
    }
  | { kind: 'error'; fileName: string; issues: string[] }

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

  // Importação do JSON gerado pela skill (apenas em "Nova cifra").
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importedValues, setImportedValues] =
    useState<ImportedSongValues | null>(null)
  const [importFeedback, setImportFeedback] = useState<ImportFeedback | null>(
    null,
  )

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

  /**
   * Importa o JSON da skill: só preenche os campos do formulário — nada é
   * salvo até a pessoa conferir e tocar em "Criar cifra". O nome do arquivo e
   * os avisos ficam no diálogo de conferência.
   */
  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // limpa o input para permitir escolher o mesmo arquivo de novo
    event.target.value = ''
    if (!file) return

    if (file.size > SONG_IMPORT_MAX_BYTES) {
      setImportFeedback({
        kind: 'error',
        fileName: file.name,
        issues: ['O arquivo é muito grande — o limite é 1 MB.'],
      })
      return
    }

    setImporting(true)
    try {
      const result = parseSongJson(await file.text())
      setImportedValues(result.values)
      // o arquivo substitui o rascunho restaurado: esconde o banner antigo
      setRestoredDraft(undefined)
      setServerError(null)
      setImportFeedback({
        kind: 'success',
        fileName: file.name,
        values: result.values,
        warnings: result.warnings,
      })
    } catch (error) {
      setImportFeedback({
        kind: 'error',
        fileName: file.name,
        issues:
          error instanceof SongImportError
            ? error.issues
            : ['Não foi possível ler o arquivo. Tente novamente.'],
      })
    } finally {
      setImporting(false)
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
    setImportedValues(null)
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
            importedValues={importedValues}
          />
        </div>
      </>
    )
  }

  return (
    <div className="w-full">
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
              : 'Preencha os campos ou importe o JSON gerado pela skill — a prévia acompanha.'}
          </p>
        </div>

        {isEdit ? (
          song ? (
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 aria-hidden />
              Excluir cifra
            </Button>
          ) : null
        ) : (
          <div className="flex items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Selecionar arquivo JSON da cifra"
              onChange={(event) => void handleImportFile(event)}
            />
            <Button
              variant="outline"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              aria-busy={importing}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <FileJson aria-hidden />
              )}
              {importing ? 'Lendo arquivo…' : 'Importar JSON'}
            </Button>
          </div>
        )}
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

      {/* Conferência da importação: nada é salvo sem revisar os campos */}
      <Dialog
        open={importFeedback !== null}
        onOpenChange={(open) => {
          if (!open) setImportFeedback(null)
        }}
      >
        <DialogContent>
          {importFeedback?.kind === 'success' ? (
            <>
              <DialogHeader>
                <DialogTitle>Cifra importada</DialogTitle>
                <DialogDescription>
                  Os campos foram preenchidos com “{importFeedback.fileName}”.
                  Confira os dados e os avisos antes de salvar.
                </DialogDescription>
              </DialogHeader>

              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Título</dt>
                <dd className="font-medium">{importFeedback.values.title}</dd>
                <dt className="text-muted-foreground">Artista</dt>
                <dd>{importFeedback.values.artist || '—'}</dd>
                <dt className="text-muted-foreground">Tom</dt>
                <dd>{importFeedback.values.original_key ?? 'Sem tom'}</dd>
                <dt className="text-muted-foreground">BPM</dt>
                <dd>{importFeedback.values.bpm || '—'}</dd>
                <dt className="text-muted-foreground">Compasso</dt>
                <dd>{importFeedback.values.time_signature ?? '—'}</dd>
                <dt className="text-muted-foreground">Temas</dt>
                <dd>
                  {importFeedback.values.themes.length > 0
                    ? importFeedback.values.themes.join(', ')
                    : '—'}
                </dd>
                <dt className="text-muted-foreground">Conteúdo</dt>
                <dd>
                  {importFeedback.values.content.length.toLocaleString('pt-BR')}{' '}
                  caracteres
                </dd>
              </dl>

              {importFeedback.warnings.length > 0 ? (
                <div
                  role="status"
                  className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
                >
                  <p className="flex items-center gap-1.5 font-medium">
                    <TriangleAlert className="h-4 w-4" aria-hidden />
                    Revise antes de salvar
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {importFeedback.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum aviso automático. Confira a prévia ao lado e salve.
                </p>
              )}

              <DialogFooter>
                <Button onClick={() => setImportFeedback(null)}>
                  Revisar campos
                </Button>
              </DialogFooter>
            </>
          ) : importFeedback?.kind === 'error' ? (
            <>
              <DialogHeader>
                <DialogTitle>Não foi possível importar</DialogTitle>
                <DialogDescription>
                  “{importFeedback.fileName}” não pôde ser usado.
                </DialogDescription>
              </DialogHeader>
              <ul
                role="alert"
                className="list-disc space-y-1 pl-5 text-sm text-destructive"
              >
                {importFeedback.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setImportFeedback(null)}
                >
                  Fechar
                </Button>
                <Button
                  onClick={() => {
                    setImportFeedback(null)
                    importInputRef.current?.click()
                  }}
                >
                  Escolher outro arquivo
                </Button>
              </DialogFooter>
            </>
          ) : null}
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
