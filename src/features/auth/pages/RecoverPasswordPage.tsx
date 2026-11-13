import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'

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
import { useAuth } from '@/hooks/useAuth'
import { friendlyErrorMessage } from '@/lib/utils'

/** Mapeia erros do Supabase Auth para mensagens PT-BR amigáveis. */
function authErrorMessage(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? '')
  const lower = message.toLowerCase()

  if (lower.includes('auth session') || lower.includes('session missing'))
    return 'Este link de recuperação expirou ou já foi usado. Solicite um novo e-mail.'
  if (lower.includes('invalid claim') || lower.includes('invalid token'))
    return 'Este link de recuperação expirou ou já foi usado. Solicite um novo e-mail.'
  if (lower.includes('password should be at least') || lower.includes('weak password'))
    return 'A senha deve ter pelo menos 8 caracteres.'
  if (lower.includes('too many requests') || lower.includes('rate limit'))
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (lower.includes('failed to fetch') || lower.includes('network'))
    return 'Sem conexão — esta ação exige internet. Tente novamente quando estiver online.'
  return friendlyErrorMessage(error)
}

const requestResetSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe seu e-mail.')
    .email('Informe um e-mail válido.'),
})
type RequestResetValues = z.infer<typeof requestResetSchema>

const newPasswordSchema = z
  .object({
    password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })
type NewPasswordValues = z.infer<typeof newPasswordSchema>

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      role="alert"
    >
      {message}
    </div>
  )
}

function AuthLayout({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold">Louve Fácil</h1>
      </div>
      {children}
    </div>
  )
}

/** Modo (a): solicitar e-mail de recuperação (FR-004). */
function RequestResetForm() {
  const { requestPasswordReset } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestResetValues>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await requestPasswordReset(values.email.trim())
      setSent(true)
    } catch (err) {
      setError(authErrorMessage(err))
    }
  })

  if (sent) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-primary" />
          <div className="space-y-1">
            <p className="text-base font-semibold">E-mail enviado</p>
            <p className="text-sm text-muted-foreground">
              Se este e-mail tiver uma conta, você receberá um link para
              definir uma nova senha. Confira também a caixa de spam.
            </p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
            Usar outro e-mail
          </Button>
          <Link
            to="/login"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Voltar para o login
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Recuperar senha</CardTitle>
        <CardDescription>
          Informe seu e-mail e enviaremos um link para você definir uma nova
          senha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormError message={error} />
          <div className="space-y-1.5">
            <Label htmlFor="recover-email">E-mail</Label>
            <Input
              id="recover-email"
              type="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              {...register('email')}
            />
            <FieldError message={errors.email?.message} />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : null}
            Enviar link de recuperação
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link
              to="/login"
              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar para o login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

/** Modo (b): definir nova senha (com sessão/token do e-mail de recuperação). */
function NewPasswordForm({
  onRequestNewEmail,
}: {
  onRequestNewEmail: () => void
}) {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [updated, setUpdated] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await updatePassword(values.password)
      setUpdated(true)
    } catch (err) {
      setError(authErrorMessage(err))
    }
  })

  if (updated) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-primary" />
          <div className="space-y-1">
            <p className="text-base font-semibold">Senha atualizada!</p>
            <p className="text-sm text-muted-foreground">
              Sua nova senha já está ativa nesta conta.
            </p>
          </div>
          <Button className="w-full" onClick={() => navigate('/biblioteca', { replace: true })}>
            Ir para a biblioteca
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Definir nova senha</CardTitle>
        <CardDescription>
          Escolha uma nova senha com pelo menos 8 caracteres para sua conta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormError message={error} />
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              {...register('password')}
            />
            <FieldError message={errors.password?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              {...register('confirmPassword')}
            />
            <FieldError message={errors.confirmPassword?.message} />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : null}
            Salvar nova senha
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {onRequestNewEmail ? (
              <button
                type="button"
                className="font-medium text-primary underline-offset-2 hover:underline"
                onClick={onRequestNewEmail}
              >
                Link expirou? Solicitar novo e-mail de recuperação
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para o login
              </Link>
            )}
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

/**
 * Recuperação de senha (FR-004): detecta o modo pela URL.
 * - Sessão/token de recuperação (hash `#...type=recovery` do Supabase) →
 *   definir nova senha (`updateUser({ password })`).
 * - Caso contrário → solicitar e-mail de recuperação (`resetPasswordForEmail`).
 */
export function RecoverPasswordPage() {
  const { user } = useAuth()
  // Captura o hash na montagem (o SDK do Supabase consome/remove o fragmento).
  const [capturedHash] = useState(() => window.location.hash)
  /** Permite alternar manualmente entre os modos (ex.: link expirado). */
  const [modeOverride, setModeOverride] = useState<'request' | 'new' | null>(
    null,
  )

  const isRecoveryMode =
    modeOverride !== null
      ? modeOverride === 'new'
      : user !== null || capturedHash.includes('type=recovery')

  return (
    <AuthLayout icon={KeyRound}>
      {isRecoveryMode ? (
        <NewPasswordForm onRequestNewEmail={() => setModeOverride('request')} />
      ) : (
        <RequestResetForm />
      )}
    </AuthLayout>
  )
}
