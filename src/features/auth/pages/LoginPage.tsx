import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2, Music2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'

import { LoadingState } from '@/components/shared/states'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { friendlyErrorMessage } from '@/lib/utils'

type AuthTab = 'entrar' | 'criar'

/** Mapeia erros do Supabase Auth para mensagens PT-BR amigáveis. */
function authErrorMessage(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? '')
  const lower = message.toLowerCase()

  if (lower.includes('invalid login credentials'))
    return 'E-mail ou senha incorretos.'
  if (lower.includes('email not confirmed'))
    return 'Confirme seu e-mail antes de entrar — verifique a caixa de entrada.'
  if (lower.includes('already registered'))
    return 'Este e-mail já está cadastrado. Use a aba “Entrar”.'
  if (lower.includes('password should be at least') || lower.includes('weak password'))
    return 'A senha deve ter pelo menos 8 caracteres.'
  if (lower.includes('too many requests') || lower.includes('rate limit'))
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (lower.includes('user not found'))
    return 'Não encontramos uma conta com este e-mail.'
  if (lower.includes('failed to fetch') || lower.includes('network'))
    return 'Sem conexão — entrar exige internet. Tente novamente quando estiver online.'
  return friendlyErrorMessage(error)
}

/** Só aceita caminhos internos (evita redirect para domínios externos). */
function resolveRedirect(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/biblioteca'
}

const signInSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe seu e-mail.')
    .email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
})
type SignInValues = z.infer<typeof signInSchema>

const signUpSchema = z.object({
  name: z
    .string()
    .min(1, 'Informe seu nome.')
    .max(60, 'O nome deve ter no máximo 60 caracteres.'),
  email: z
    .string()
    .min(1, 'Informe seu e-mail.')
    .email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
})
type SignUpValues = z.infer<typeof signUpSchema>

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

function SignInForm({ target }: { target: string }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await signIn(values.email.trim(), values.password)
      navigate(target, { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={error} />
      <div className="space-y-1.5">
        <Label htmlFor="signin-email">E-mail</Label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          {...register('email')}
        />
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signin-password">Senha</Label>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          placeholder="Sua senha"
          {...register('password')}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : null}
        Entrar
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link
          to="/recuperar-senha"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Esqueceu a senha?
        </Link>
      </p>
    </form>
  )
}

function SignUpForm({
  target,
  onNeedsConfirmation,
}: {
  target: string
  onNeedsConfirmation: () => void
}) {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const { needsConfirmation } = await signUp(
        values.email.trim(),
        values.password,
        values.name,
      )
      if (needsConfirmation) onNeedsConfirmation()
      else navigate(target, { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={error} />
      <div className="space-y-1.5">
        <Label htmlFor="signup-name">Nome</Label>
        <Input
          id="signup-name"
          type="text"
          autoComplete="name"
          placeholder="Como você se chama"
          {...register('name')}
        />
        <FieldError message={errors.name?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-email">E-mail</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          {...register('email')}
        />
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password">Senha</Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          {...register('password')}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : null}
        Criar conta
      </Button>
    </form>
  )
}

/** Tela de acesso: entrar ou criar conta (FR-001/FR-002, quickstart S1). */
export function LoginPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<AuthTab>('entrar')
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const target = resolveRedirect(searchParams.get('redirect'))

  // Já autenticado → vai direto ao destino preservado.
  useEffect(() => {
    if (!loading && user) navigate(target, { replace: true })
  }, [loading, user, navigate, target])

  if (loading || user) return <LoadingState fullScreen />

  if (needsConfirmation) {
    return (
      <AuthLayout>
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <div className="space-y-1">
              <p className="text-base font-semibold">Conta criada!</p>
              <p className="text-sm text-muted-foreground">
                Enviamos um e-mail de confirmação. Confirme para ativar sua
                conta e entrar no Louve Fácil — não esqueça de verificar o spam.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setNeedsConfirmation(false)
                setTab('entrar')
              }}
            >
              Voltar para entrar
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Acesse sua conta</CardTitle>
          <CardDescription>
            Entre ou crie sua conta para usar com sua equipe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(value) => setTab(value as AuthTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="criar">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="entrar" className="mt-4">
              <SignInForm target={target} />
            </TabsContent>
            <TabsContent value="criar" className="mt-4">
              <SignUpForm
                target={target}
                onNeedsConfirmation={() => setNeedsConfirmation(true)}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}

/** Layout compartilhado das telas de autenticação (fora do AppShell). */
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Music2 className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold">Louve Fácil</h1>
        <p className="text-sm text-muted-foreground">
          Cifras e setlists da sua equipe de louvor
        </p>
      </div>
      {children}
    </div>
  )
}
