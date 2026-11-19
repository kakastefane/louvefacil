import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  ChevronRight,
  Clock,
  ListMusic,
  Loader2,
  Plus,
  CheckCircle2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { listSetlists, listItems, createSetlist } from '@/features/setlists/service'
import { useTeam } from '@/features/teams/TeamContext'
import { canEdit } from '@/types/domain'
import { formatDateOnlyPtBr, friendlyErrorMessage } from '@/lib/utils'
import type { Setlist } from '@/types/domain'

type LoadStatus = 'loading' | 'ready' | 'error'

interface SetlistRow {
  setlist: Setlist
  count: number
}

const NAME_MAX = 160

/** Erros dos services de setlist já vêm em PT-BR — exibimos direto. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : friendlyErrorMessage(error)
}

/** Validação inline do nome (obrigatório, até 160 caracteres). */
function validateNameInline(value: string): string | null {
  const name = value.trim()
  if (!name) return 'Informe um nome para o setlist.'
  if (name.length > NAME_MAX)
    return `O nome do setlist deve ter até ${NAME_MAX} caracteres.`
  return null
}

/** Texto de contagem de músicas ("Nenhuma música" / "1 música" / "N músicas"). */
function countLabel(count: number): string {
  if (count === 0) return 'Nenhuma música'
  if (count === 1) return '1 música'
  return `${count} músicas`
}

/** Um setlist é "próximo" quando não tem data definida ou a data é futura. */
function isUpcoming(eventDate: string | null): boolean {
  if (!eventDate) return true
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const event = new Date(eventDate)
  event.setHours(0, 0, 0, 0)
  return event >= today
}

/** Ordena setlists futuros por data crescente (o mais próximo primeiro) e
 * passados por data decrescente (o mais recente primeiro). Setlists sem data
 * ficam no fim da lista dos próximos. */
function sortRows(rows: SetlistRow[], upcoming: boolean): SetlistRow[] {
  return [...rows].sort((a, b) => {
    const da = a.setlist.event_date
    const db = b.setlist.event_date
    if (!da && !db) return 0
    if (!da) return 1 // sem data vai para o fim
    if (!db) return -1
    const diff = new Date(da).getTime() - new Date(db).getTime()
    return upcoming ? diff : -diff
  })
}

/**
 * Setlists da equipe ativa (T041): lista com data do evento, contagem de
 * músicas e criação via dialog (T044 — membros não veem as ações de escrita).
 * Exclusão e duplicação ficam no detalhe do setlist (T042).
 */
export function SetlistsPage() {
  const navigate = useNavigate()
  const { activeTeam, activeMember, loading: teamLoading } = useTeam()
  const editable = activeMember ? canEdit(activeMember.role) : false

  const [rows, setRows] = useState<SetlistRow[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [reloadToken, setReloadToken] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const teamId = activeTeam?.id ?? null

  useEffect(() => {
    if (!teamId) {
      setRows([])
      setStatus('ready')
      return
    }
    let cancelled = false
    setStatus('loading')
    listSetlists(teamId)
      .then(async (list) => {
        // Conta as músicas de cada setlist (ok para o MVP); falha total cai no catch
        const counts = await Promise.all(
          list.map((setlist) => listItems(setlist.id).then((items) => items.length)),
        )
        if (cancelled) return
        setRows(list.map((setlist, index) => ({ setlist, count: counts[index] })))
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

  function openCreateDialog() {
    setName('')
    setDate('')
    setNameError(null)
    setCreateError(null)
    setCreateOpen(true)
  }

  function closeCreateDialog() {
    if (creating) return
    setCreateOpen(false)
    setCreateError(null)
    setNameError(null)
  }

  function handleNameChange(value: string) {
    setName(value)
    // validação inline: só mostra erro depois da primeira tentativa de envio
    if (nameError !== null) setNameError(validateNameInline(value))
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!teamId) {
      setCreateError('Selecione uma equipe para criar o setlist.')
      return
    }
    const validation = validateNameInline(name)
    setNameError(validation)
    if (validation) return

    setCreating(true)
    setCreateError(null)
    try {
      const created = await createSetlist(teamId, {
        name: name.trim(),
        event_date: date ? date : null,
      })
      setCreateOpen(false)
      navigate(`/setlist/${created.id}`)
    } catch (error) {
      // erro inline no dialog — ele permanece aberto com o texto digitado
      setCreateError(describeError(error))
    } finally {
      setCreating(false)
    }
  }

  function renderSetlistCard({
    setlist,
    count,
    upcoming,
  }: {
    setlist: Setlist
    count: number
    upcoming: boolean
  }) {
    const eventDate = setlist.event_date ? formatDateOnlyPtBr(setlist.event_date) : ''

    // Card de evento futuro: maior, mais destaque, borda e ícone destacados.
    if (upcoming) {
      return (
        <li key={setlist.id}>
          <Card className="h-full overflow-hidden p-0 border-lg shadow-sm">
            <button
              type="button"
              onClick={() => navigate(`/setlist/${setlist.id}`)}
              aria-label={`Abrir setlist ${setlist.name}`}
              className="flex h-full w-full items-center gap-4 rounded-xl p-5 text-left outline-none transition-all hover:bg-accent/100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                aria-hidden
              >
                <ListMusic className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="block truncate font-medium leading-snug text-foreground">
                    {setlist.name}
                  </span>
                  {eventDate && (
                    <span className="text-xs font-medium text-primary">
                      Próximo ·
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  {eventDate ? (
                    <>
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      <span className="text-sm text-muted-foreground">
                        {eventDate}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      Sem data definida
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    ·
                    {countLabel(count)}
                  </span>
                </div>
              </span>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </button>
          </Card>
        </li>
      )
    }

    // Card de evento passado: menor, menos destaque, cores sutis, só consulta.
    return (
      <li key={setlist.id}>
        <Card className="h-full overflow-hidden p-0 border-border/50 bg-muted/50">
          <button
            type="button"
            onClick={() => navigate(`/setlist/${setlist.id}`)}
            aria-label={`Abrir setlist ${setlist.name}`}
            className="flex h-full w-full items-center gap-3 rounded-lg p-3 text-left outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground"
              aria-hidden
            >
              <ListMusic className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="block truncate font-medium text-sm text-foreground/80 leading-snug">
                  {setlist.name}
                </span>
                {eventDate && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Passado ·
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {eventDate ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-muted-foreground/60" aria-hidden />
                    <span className="text-xs text-muted-foreground/80">
                      {eventDate}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground/60 italic">
                    Sem data definida
                  </span>
                )}
                <span className="text-xs text-muted-foreground/60">
                  ·
                  {countLabel(count)}
                </span>
              </div>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-muted-foreground/50"
              aria-hidden
            />
          </button>
        </Card>
      </li>
    )
  }

  function renderBody() {
    if (teamLoading || status === 'loading') {
      return <LoadingState label="Carregando setlists…" />
    }

    if (status === 'error') {
      return (
        <ErrorState
          message="Não foi possível carregar os setlists. Verifique sua conexão e tente novamente."
          onRetry={() => setReloadToken((token) => token + 1)}
        />
      )
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          icon={<ListMusic className="h-8 w-8" aria-hidden />}
          title="Nenhum setlist ainda"
          description={
            editable
              ? 'Monte o repertório do próximo culto: crie um setlist e adicione as cifras na ordem certa.'
              : 'Peça a um editor para criar o primeiro setlist.'
          }
          action={
            editable ? (
              <Button onClick={openCreateDialog}>
                <Plus aria-hidden />
                Novo setlist
              </Button>
            ) : undefined
          }
        />
      )
    }

    const upcomingRows = sortRows(rows.filter((row) => isUpcoming(row.setlist.event_date)), true)
    const pastRows = sortRows(rows.filter((row) => !isUpcoming(row.setlist.event_date)), false)

    return (
      <div className="space-y-6">
        {upcomingRows.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-foreground tracking-tight uppercase">
              Próximos eventos
            </h2>
            <ul className="grid gap-3 lg:grid-cols-2 mt-2">
              {upcomingRows.map(({ setlist, count }) =>
                renderSetlistCard({ setlist, count, upcoming: true })
              )}
            </ul>
          </section>
        )}

        {pastRows.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground tracking-tight uppercase">
              Eventos passados
            </h2>
            <ul className="grid gap-2 lg:grid-cols-3 mt-2">
              {pastRows.map(({ setlist, count }) =>
                renderSetlistCard({ setlist, count, upcoming: false })
              )}
            </ul>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="w-full">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Setlists</h1>
          <p className="text-sm text-muted-foreground">
            Repertórios dos cultos e ensaios da sua equipe.
          </p>
        </div>
        {editable && status === 'ready' && rows.length > 0 ? (
          <Button onClick={openCreateDialog}>
            <Plus aria-hidden />
            Novo setlist
          </Button>
        ) : null}
      </header>

      {renderBody()}

      {/* Criação de setlist — membro não vê o botão (FR-029; RLS garante no servidor) */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) closeCreateDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo setlist</DialogTitle>
            <DialogDescription>
              Dê um nome ao repertório. A data do evento é opcional.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void handleCreate(event)} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="setlist-name">Nome</Label>
                <span
                  className="text-xs text-muted-foreground"
                  aria-hidden
                >
                  {name.length}/{NAME_MAX}
                </span>
              </div>
              <Input
                id="setlist-name"
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Ex.: Culto de domingo"
                maxLength={NAME_MAX}
                autoFocus
                disabled={creating}
                aria-invalid={nameError !== null}
                aria-describedby={nameError ? 'setlist-name-error' : undefined}
              />
              {nameError ? (
                <p id="setlist-name-error" role="alert" className="text-sm text-destructive">
                  {nameError}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="setlist-date">Data do evento (opcional)</Label>
              <Input
                id="setlist-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                disabled={creating}
              />
            </div>
            {createError ? (
              <p role="alert" className="text-sm text-destructive">
                {createError}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeCreateDialog}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creating} aria-busy={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Criando…
                  </>
                ) : (
                  'Criar setlist'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
