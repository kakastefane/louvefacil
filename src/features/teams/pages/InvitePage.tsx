import { Link2Off, Loader2, Users } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/shared/states'
import { useAuth } from '@/hooks/useAuth'
import { useTeam } from '@/features/teams/TeamContext'
import {
  InviteJoinError,
  joinTeamWithCode,
  type InviteJoinErrorCode,
} from '@/features/teams/invites'
import { friendlyErrorMessage } from '@/lib/utils'

/**
 * Página de convite (T025, FR-007/009): fluxo por estado —
 * sem sessão → login com redirect preservado; com sessão → entra
 * direto na equipe (RPC idempotente) e vai para a biblioteca;
 * inválido/expirado/revogado → mensagem com orientação de novo link.
 */

/** Título amigável por motivo de falha do convite. */
const ERROR_TITLES: Record<InviteJoinErrorCode, string> = {
  invalid_code: 'Convite inválido',
  expired_code: 'Convite expirado',
  revoked_code: 'Convite revogado',
  not_authenticated: 'Sessão necessária',
  invalid_display_name: 'Nome necessário',
}

/** Lê o nome de exibição conhecido salvo no cadastro (user_metadata). */
function knownDisplayName(user: { user_metadata?: Record<string, unknown> }): string {
  const metadata = user.user_metadata ?? {}
  const candidates = [metadata.name, metadata.display_name, metadata.full_name]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return ''
}

const nameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Informe seu nome para exibição na equipe.')
    .max(80, 'O nome deve ter até 80 caracteres.'),
})

type NameForm = z.infer<typeof nameSchema>

type PageStatus =
  | 'idle' // resolvendo: decidir entre entrar direto ou pedir o nome
  | 'name' // formulário de nome de exibição
  | 'joining' // RPC em andamento (idempotente)
  | 'error' // convite indisponível ou falha inesperada

export function InvitePage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { refresh, setActiveTeamId } = useTeam()

  const [status, setStatus] = useState<PageStatus>('idle')
  const [errorCode, setErrorCode] = useState<InviteJoinErrorCode | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [formError, setFormError] = useState('')

  const nameForm = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    defaultValues: { displayName: '' },
  })

  // guarda o último nome usado para permitir "tentar novamente" sem o formulário
  const lastDisplayName = useRef('')

  const join = useCallback(
    async (displayName: string) => {
      if (!code) return
      lastDisplayName.current = displayName
      setFormError('')
      setStatus('joining')
      try {
        const teamId = await joinTeamWithCode(code, displayName)
        await refresh()
        setActiveTeamId(teamId)
        navigate('/biblioteca', { replace: true })
      } catch (error) {
        if (error instanceof InviteJoinError) {
          if (error.code === 'invalid_display_name') {
            // a RPC recusou o nome → volta ao formulário com o motivo
            setFormError(error.message)
            setStatus('name')
            return
          }
          setErrorCode(error.code)
          setErrorMessage(error.message)
        } else {
          // falha inesperada (ex.: rede) → mensagem amigável com retry
          setErrorCode(null)
          setErrorMessage(friendlyErrorMessage(error))
        }
        setStatus('error')
      }
    },
    [code, navigate, refresh, setActiveTeamId],
  )

  // ao autenticar: nome conhecido → entra direto; senão → pede o nome
  const autoJoinAttempted = useRef(false)
  useEffect(() => {
    if (status !== 'idle' || authLoading || !user || !code) return
    const known = knownDisplayName(user)
    if (!known) {
      setStatus('name')
      return
    }
    if (autoJoinAttempted.current) return
    autoJoinAttempted.current = true
    void join(known)
  }, [status, authLoading, user, code, join])

  // link sem código → tratado como convite inválido
  if (!code) {
    return (
      <InviteErrorView
        title={ERROR_TITLES.invalid_code}
        message="Este link de convite está incompleto."
      />
    )
  }

  // resolvendo a sessão (evita flicker de redirect)
  if (authLoading) return <LoadingState fullScreen label="Verificando sessão…" />

  // sem sessão → login preservando o destino (FR-007)
  if (!user) {
    const target = encodeURIComponent(`/convite/${code}`)
    return <Navigate to={`/login?redirect=${target}`} replace />
  }

  if (status === 'joining') {
    return (
      <LoadingState
        fullScreen
        label="Entrando na equipe…"
      />
    )
  }

  if (status === 'error') {
    return (
      <InviteErrorView
        title={
          errorCode
            ? ERROR_TITLES[errorCode]
            : 'Não foi possível entrar na equipe'
        }
        message={errorMessage || friendlyErrorMessage(new Error('invalid_code'))}
        showContactCta={errorCode !== null}
        onRetry={errorCode === null ? () => void join(lastDisplayName.current) : undefined}
      />
    )
  }

  if (status === 'name') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <CardTitle>Falta pouco para entrar na equipe</CardTitle>
            <CardDescription>
              Confirme como você aparecerá para os outros membros.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={nameForm.handleSubmit((values) => void join(values.displayName))}
              className="space-y-4"
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="displayName">Seu nome na equipe</Label>
                <Input
                  id="displayName"
                  placeholder="Ex.: Maria Silva"
                  maxLength={80}
                  autoComplete="name"
                  disabled={nameForm.formState.isSubmitting}
                  {...nameForm.register('displayName')}
                />
                {nameForm.formState.errors.displayName ? (
                  <p className="text-sm text-destructive">
                    {nameForm.formState.errors.displayName.message}
                  </p>
                ) : formError ? (
                  <p className="text-sm text-destructive">{formError}</p>
                ) : null}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={nameForm.formState.isSubmitting}
              >
                {nameForm.formState.isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando…
                  </>
                ) : (
                  'Entrar na equipe'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // status 'idle' com usuário e código: aguardando o efeito decidir
  return <LoadingState fullScreen label="Verificando convite…" />
}

/** Tela de erro do convite: motivo claro + CTA de contatar o responsável. */
function InviteErrorView({
  title,
  message,
  showContactCta = false,
  onRetry,
}: {
  title: string
  message: string
  showContactCta?: boolean
  onRetry?: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-destructive/30">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Link2Off className="h-6 w-6" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="text-base">{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showContactCta ? (
            <div className="rounded-lg border border-dashed bg-muted/50 px-4 py-3 text-center">
              <p className="text-sm font-medium">
                Contacte o responsável pela equipe
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Peça a ele um novo link de convite para participar.
              </p>
            </div>
          ) : null}
          {onRetry ? (
            <Button variant="outline" className="w-full" onClick={onRetry}>
              Tentar novamente
            </Button>
          ) : null}
          <Button variant="ghost" className="w-full" onClick={() => navigate('/', { replace: true })}>
            Voltar ao início
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
