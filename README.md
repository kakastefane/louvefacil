# Louve Fácil

PWA colaborativo para equipes de louvor compartilharem cifras padronizadas.
Curadoria centralizada (fonte única da verdade em ChordPro), biblioteca com
busca, visualizador com transposição em tempo real, setlists reordenáveis e
modo tocar — funcionando offline no celular do culto.

> Projeto privado. Especificação completa em `specs/001-louve-facil-mvp/`;
> arquitetura em `.docs/louve-facil-arquitetura.md`.

## Funcionalidades

- **Acesso à equipe** — cadastro/login por e-mail (Supabase Auth); equipes com
  papéis **dono / editor / membro**; ingresso por convite com código (expira em
  7 dias, revogável); isolamento de dados por equipe no banco (RLS).
- **Cifra padronizada (ChordPro)** — editor com validação, acordes `[Am]`
  inline, linhas só de acordes, metatags `{key: …}`, pré-visualização ao vivo;
  editor/dono criam e excluem; membros apenas leem.
- **Biblioteca** — busca instantânea por título/artista, filtro por tema
  (chips), ordenação alfabética, atalho para criar cifra.
- **Visualizador** — leitura confortável, transposição em semitons sem alterar
  a cifra (desvio aplicado só na renderização), fonte em passos discretos,
  tema claro/escuro (segue o SO).
- **Setlists** — nome/data, músicas adicionadas da biblioteca, reordenação
  por arrastar e soltar, desvio de transposição por item, duplicar setlist,
  numeração sempre contígua (RPC atômica).
- **Modo tocar** — uma música por vez em tela cheia, tom do item aplicado,
  navegação por botões grandes, setas do teclado ou swipe; indicador "3 de 12".
- **Offline / instalável** — PWA com service worker (precache) e leitura de
  cifras/setlists já abertas sem rede (cache local Dexie); toda escrita
  exige conexão e avisa quando estiver offline.

## Stack

Vite 7 · React 19 · TypeScript · Tailwind CSS v4 · shadcn-style UI ·
react-hook-form + zod · Supabase (Auth, Postgres, RLS, RPC) ·
Dexie (IndexedDB read-through) · vite-plugin-pwa (Workbox) · Vitest

## Pré-requisitos

- Node.js ≥ 20 e npm
- Um projeto Supabase gratuito (supabase.com)

## Setup local

1. **Crie o projeto no Supabase** (região próxima, ex.: South America).
2. **Authentication → Providers** → Email habilitado (confirmação de e-mail
   conforme sua preferência).
3. **Authentication → URL Configuration** (importante para os links de
   confirmação e recuperação de senha):
   - **Site URL**: a URL pública do app (ex.: `https://louvefacil.vercel.app`).
   - **Redirect URLs**: adicione os ambientes usados, por exemplo
     `https://louvefacil.vercel.app/**` e `http://localhost:5173/**`.
   > Se o e-mail de confirmação abrir em `localhost` mesmo em produção, é
   > porque o **Site URL** ainda aponta para o ambiente local ou a URL do app
   > não está na lista de **Redirect URLs**.
4. **SQL Editor** → execute, em ordem:
   `supabase/migrations/0001_schema.sql`, depois
   `supabase/migrations/0002_rls_policies.sql` e por fim
   `supabase/migrations/0003_bpm_meter.sql` (adiciona BPM e compasso às cifras).
5. **Variáveis de ambiente**:
   ```bash
   cp .env.example .env.local
   ```
   Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   (Supabase → Settings → API).
   > Sem estas variáveis o app abre em modo "Projeto não configurado" (`/setup`).
6. **Instale e rode**:
   ```bash
   npm install
   npm run dev
   ```
   Abra http://localhost:5173/ → crie sua conta → crie a primeira equipe.

### Dados de exemplo (opcional)

Após criar sua equipe, rode no SQL Editor:
`supabase/seed_sample_songs.sql` — insere 4 cifras com temas na primeira
equipe do projeto.

## Scripts

| Comando              | O que faz                                        |
|----------------------|--------------------------------------------------|
| `npm run dev`        | Servidor de desenvolvimento (Vite)                |
| `npm run build`      | Type-check (`tsc --noEmit`) + build de produção  |
| `npm run preview`    | Serve o build de produção localmente             |
| `npm test`           | Testes de unidade (Vitest, 129 testes)           |
| `npm run test:watch` | Testes em modo watch                             |
| `npm run lint`       | ESLint (zero erros exigido)                      |
| `npm run icons`      | Regenera os ícones PWA a partir de `public/icons/icon.svg` |

## Deploy

### Vercel (recomendado)

1. Importe o repositório; framework **Vite** (detectado automaticamente).
2. Adicione as env vars `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Deploy. As rotas client-side são servidas via SPA fallback do preset Vite.

### Netlify

`netlify.toml` incluído no repo (build `npm run build`, publish `dist`,
SPA fallback `/* → /index.html`). Configure as mesmas env vars no painel.

Após o deploy, publique as migrações no Supabase de produção e rode o roteiro
em `specs/001-louve-facil-mvp/quickstart.md` (S1–S5) no domínio publicado.

## Validação e qualidade

- `npm run lint` — limpo
- `npm test` — 129 testes de unidade (parser/transpõe/filtro/posições/temas)
- `npm run build` — build verde (PWA gerado em `dist/`)
- Roteiro completo de validação manual: [`specs/001-louve-facil-mvp/quickstart.md`](specs/001-louve-facil-mvp/quickstart.md)
  (inclui revisão de RLS e plano de testes com duas equipes reais)

## Estrutura

```
src/
  app/          # rotas + guards de papel (RequireTeam/RequireEditor/…)
  components/   # ui (shadcn-style) + layout (AppShell, TeamSwitcher) + shared
  features/     # songs, setlists, teams, auth — services + pages + components
  db/           # Dexie (cache local) + repositórios read-through
  hooks/        # useAuth, useTheme
  lib/          # supabase client, utils (PT-BR), env
supabase/
  migrations/   # 0001_schema.sql → 0002_rls_policies.sql → 0003_bpm_meter.sql (idempotentes)
  seed_sample_songs.sql
specs/          # especificação, plano, tarefas e contratos
```
