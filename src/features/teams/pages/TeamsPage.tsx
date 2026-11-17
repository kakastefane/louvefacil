import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, Loader2, Plus, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'

import { ErrorState, LoadingState, EmptyState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { useAuth } from '@/hooks/useAuth'
import { useTeam } from '@/features/teams/TeamContext'
import {
  InviteJoinError,
  joinTeamWithCode,
} from '@/features/teams/invites'
import { createTeam } from '@/features/teams/service'
import {
  friendlyErrorMessage,
  formatDatePtBr,
  normalizeInviteCode,
} from '@/lib/utils'
import type { TeamRole } from '@/types/domain'

const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome da equipe.')
    .max(120, 'O nome da equipe deve ter até 120 caracteres.'),
})

type CreateTeamForm = z.infer<typeof createTeamSchema>

const joinTeamSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Informe o código do convite.')
    .max(300, 'Cole apenas o código ou o link do convite.'),
  displayName: z
    .string()
    .trim()
    .min(1, 'Informe seu nome para exibição na equipe.')
    .max(80, 'O nome deve ter até 80 caracteres.'),
})

type JoinTeamForm = z.infer<typeof joinTeamSchema>

const roleLabels: Record<TeamRole, string> = {
  owner: 'Dono',
  editor: 'Editor',
  member: 'Membro',
}

const roleBadgeVariants: Record<TeamRole, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  editor: 'secondary',
  member: 'outline',
}

/**
 * Erros da RPC create_team (invalid_name, invalid_display_name,
 * not_authenticated) com mensagens próprias; demais caem no mapeamento
 * amigável comum (offline, rede, permissão etc.).
 */
function friendlyCreateTeamError(error: unknown): string {
  const raw =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? '')

  if (raw.includes('invalid_name'))
    return 'Nome de equipe inválido. Use de 1 a 120 caracteres.'
  if (raw.includes('invalid_display_name'))
    return 'Seu nome de exibição está inválido. Ajuste-o nas configurações e tente novamente.'
  if (raw.includes('not_authenticated'))
    return 'Sua sessão expirou. Faça login novamente.'
  if (raw.includes('duplicate') || raw.includes('unique'))
    return 'Você já possui uma equipe com esse nome.'
  return friendlyErrorMessage(error)
}

/** Nome de exibição do perfil (user_metadata.name definido no cadastro). */
function resolveDisplayName(
  user: ReturnType<typeof useAuth>['user'],
): string {
  const metaName = user?.user_metadata?.['name']
  if (typeof metaName === 'string' && metaName.trim()) return metaName.trim()
  const email = user?.email
  if (email) return email.split('@')[0]
  return 'Membro'
}

export function TeamsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { memberships, loading, refresh, setActiveTeamId } = useTeam()

  const [loadError, setLoadError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [joinOpen, setJoinOpen] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const form = useForm<CreateTeamForm>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: { name: '' },
  })

  const joinForm = useForm<JoinTeamForm>({
    resolver: zodResolver(joinTeamSchema),
    defaultValues: { code: '', displayName: '' },
  })

  // carrega/tenta de novo as memberships (o contexto não expõe o erro)
  const load = useCallback(async () => {
    setLoadError(null)
    try {
      await refresh()
    } catch (error) {
      setLoadError(friendlyErrorMessage(error))
    }
  }, [refresh])

  useEffect(() => {
    if (!user) return
    void load()
  }, [user, load])

  const handleRetry = useCallback(async () => {
    setRetrying(true)
    await load()
    setRetrying(false)
  }, [load])

  const handleSelectTeam = useCallback(
    (teamId: string) => {
      // troca de equipe limpa os caches de conteúdo (FR-011)
      setActiveTeamId(teamId)
      navigate('/biblioteca')
    },
    [setActiveTeamId, navigate],
  )

  const openCreateDialog = useCallback(() => {
    setCreateError(null)
    form.reset({ name: '' })
    setCreateOpen(true)
  }, [form])

  const openJoinDialog = useCallback(() => {
    setJoinError(null)
    joinForm.reset({
      code: '',
      displayName: resolveDisplayName(user),
    })
    setJoinOpen(true)
  }, [joinForm, user])

  const handleCreateTeam = form.handleSubmit(async (values) => {
    setCreating(true)
    setCreateError(null)
    try {
      const teamId = await createTeam(
        values.name.trim(),
        resolveDisplayName(user),
      )
      // revalida o cache de memberships no contexto antes de trocar de equipe
      await refresh()
      setCreateOpen(false)
      form.reset({ name: '' })
      handleSelectTeam(teamId)
    } catch (error) {
      setCreateError(friendlyCreateTeamError(error))
    } finally {
      setCreating(false)
    }
  })

  const handleJoinTeam = joinForm.handleSubmit(async (values) => {
    const code = normalizeInviteCode(values.code)
    if (code.length < 8) {
      joinForm.setError('code', {
        message: 'Código incompleto — confira e tente novamente.',
      })
      return
    }

    setJoining(true)
    setJoinError(null)
    try {
      const teamId = await joinTeamWithCode(code, values.displayName)
      // o ingresso cria a membership no servidor: atualiza o cache antes de
      // ativar a equipe para os dados já carregarem filtrados por ela
      await refresh()
      setJoinOpen(false)
      joinForm.reset()
      handleSelectTeam(teamId)
    } catch (error) {
      setJoinError(
        error instanceof InviteJoinError
          ? error.message
          : friendlyErrorMessage(error),
      )
    } finally {
      setJoining(false)
    }
  })

  if (loading) {
    return <LoadingState label="Carregando suas equipes…" />
  }

  if (loadError) {
    return (
      <div className="w-full space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Equipes</h1>
          <p className="text-sm text-muted-foreground">
            Crie sua equipe ou acesse uma em que você participa.
          </p>
        </header>
        <ErrorState
          message={loadError}
          onRetry={retrying ? undefined : () => void handleRetry()}
        />
        {retrying ? <LoadingState label="Tentando novamente…" /> : null}
      </div>
    )
  }

  const hasTeams = memberships.length > 0

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipes</h1>
          <p className="text-sm text-muted-foreground">
            Escolha a equipe em que quer trabalhar, entre com um código de
            convite ou crie uma nova.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={openJoinDialog}>
            <KeyRound className="h-4 w-4" />
            Tenho um código
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Criar equipe
          </Button>
        </div>
      </header>

      {hasTeams ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {memberships.map(({ member, team }) => (
            <li key={team.id} className="list-none">
              <Card className="flex h-full flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="leading-snug">{team.name}</CardTitle>
                    <Badge variant={roleBadgeVariants[member.role]}>
                      {roleLabels[member.role]}
                    </Badge>
                  </div>
                  <CardDescription>
                    Equipe desde {formatDatePtBr(member.joined_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleSelectTeam(team.id)}
                  >
                    Acessar biblioteca
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Você ainda não participa de nenhuma equipe"
          description="Recebeu um convite? Entre com o código (ou abra o link enviado). Se preferir começar do zero, crie sua própria equipe."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={openJoinDialog}>
                <KeyRound className="h-4 w-4" />
                Tenho um código de convite
              </Button>
              <Button variant="outline" onClick={openCreateDialog}>
                <Plus className="h-4 w-4" />
                Criar uma equipe
              </Button>
            </div>
          }
          className="py-16"
        />
      )}

      <section className="rounded-xl border bg-muted/30 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Recebeu um convite? Use o código ou o link enviado pelo responsável
            pela equipe.
          </p>
          <Button variant="ghost" size="sm" onClick={openJoinDialog}>
            <KeyRound className="h-4 w-4" />
            Entrar com código
          </Button>
        </div>
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar equipe</DialogTitle>
            <DialogDescription>
              Você será o dono da equipe e poderá convidar outras pessoas.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTeam} className="grid gap-4" noValidate>
            <div className="grid gap-2">
              <Label htmlFor="team-name">Nome da equipe</Label>
              <Input
                id="team-name"
                placeholder="Ex.: Equipe de louvor"
                maxLength={120}
                autoFocus
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register('name')}
              />
              {form.formState.errors.name ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>
            {createError ? (
              <p className="text-sm text-destructive" role="alert">
                {createError}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando…
                  </>
                ) : (
                  'Criar equipe'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrar com código de convite</DialogTitle>
            <DialogDescription>
              Digite o código enviado pelo responsável pela equipe. Você também
              pode colar o link completo do convite.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleJoinTeam} className="grid gap-4" noValidate>
            <div className="grid gap-2">
              <Label htmlFor="invite-code">Código do convite</Label>
              <Input
                id="invite-code"
                placeholder="Ex.: ABC7DEF9GH"
                maxLength={300}
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="font-mono uppercase tracking-wider"
                aria-invalid={Boolean(joinForm.formState.errors.code)}
                {...joinForm.register('code', {
                  onChange: () => setJoinError(null),
                })}
              />
              {joinForm.formState.errors.code ? (
                <p className="text-sm text-destructive">
                  {joinForm.formState.errors.code.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Maiúsculas, minúsculas e espaços não fazem diferença.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-display-name">Seu nome na equipe</Label>
              <Input
                id="invite-display-name"
                placeholder="Ex.: Maria Silva"
                maxLength={80}
                autoComplete="name"
                aria-invalid={Boolean(
                  joinForm.formState.errors.displayName,
                )}
                {...joinForm.register('displayName', {
                  onChange: () => setJoinError(null),
                })}
              />
              {joinForm.formState.errors.displayName ? (
                <p className="text-sm text-destructive">
                  {joinForm.formState.errors.displayName.message}
                </p>
              ) : null}
            </div>
            {joinError ? (
              <p className="text-sm text-destructive" role="alert">
                {joinError}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setJoinOpen(false)}
                disabled={joining}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={joining}>
                {joining ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando…
                  </>
                ) : (
                  'Entrar na equipe'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
