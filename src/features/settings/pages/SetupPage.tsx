import { KeyRound } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** Tela "projeto não configurado" (D-7): orienta o dono do projeto. */
export function SetupPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <CardTitle>Configure o projeto para começar</CardTitle>
          <CardDescription>
            O Louve Fácil precisa das credenciais do seu projeto Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Crie um projeto gratuito em{' '}
              <a
                className="font-medium text-primary underline underline-offset-2"
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer"
              >
                supabase.com
              </a>
              .
            </li>
            <li>
              No SQL Editor do projeto, execute os arquivos{' '}
              <code className="rounded bg-muted px-1 py-0.5">
                supabase/migrations/0001_schema.sql
              </code>{' '}
              e{' '}
              <code className="rounded bg-muted px-1 py-0.5">
                supabase/migrations/0002_rls_policies.sql
              </code>{' '}
              (nesta ordem).
            </li>
            <li>
              Copie <code className="rounded bg-muted px-1 py-0.5">.env.example</code>{' '}
              para <code className="rounded bg-muted px-1 py-0.5">.env.local</code> e
              preencha <code className="rounded bg-muted px-1 py-0.5">VITE_SUPABASE_URL</code> e{' '}
              <code className="rounded bg-muted px-1 py-0.5">VITE_SUPABASE_ANON_KEY</code>{' '}
              (Settings → API).
            </li>
            <li>Reinicie o app (npm run dev) e faça o primeiro cadastro.</li>
          </ol>
          <p>
            Guia completo de validação:{' '}
            <code className="rounded bg-muted px-1 py-0.5">
              specs/001-louve-facil-mvp/quickstart.md
            </code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
