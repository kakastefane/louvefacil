# Implementation Plan: MVP do Louve Fácil

**Branch**: `001-louve-facil-mvp` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-louve-facil-mvp/spec.md`

## Summary

PWA para equipes de louvor compartilharem cifras padronizadas: autenticação
e-mail/senha, equipes com papéis (dono/editor/membro) e convite por link,
biblioteca de cifras ChordPro com busca e temas, editor com preview ao vivo,
visualizador com transposição (render-only) e fonte ajustável, setlists com
reordenação/duplicação e transposição por item, modo tocar, instalação PWA e
leitura offline do conteúdo já aberto. Abordagem técnica: SPA React + Vite
hospedada estaticamente, falando direto com Supabase (Postgres + Auth + RLS)
via SDK; isolamento entre equipes garantido por políticas RLS no banco;
cache local em IndexedDB (Dexie) para leitura offline; transposição calculada
na renderização, sem alterar o texto-fonte.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) + React 19 + Vite 7; Node.js >= 20

**Primary Dependencies**: react-router (rotas), Tailwind CSS 4 + shadcn/ui
(componentes no repo), @supabase/supabase-js, dexie + dexie-react-hooks,
vite-plugin-pwa, @dnd-kit/core + @dnd-kit/sortable (reordenação), parser
ChordPro próprio (peso mínimo, ver research.md), vitest + @testing-library/react

**Storage**: Supabase (Postgres + Auth + RLS) como fonte da verdade; IndexedDB
(Dexie) como cache de leitura offline no dispositivo

**Testing**: Vitest (unidade: parser/transpositor ChordPro, helpers de
convites, regras de papel), React Testing Library (componentes-chave:
preview do editor, visualizador); validação de RLS e fluxos ponta a ponta via
`quickstart.md` no projeto Supabase real (provido pelo dono)

**Target Platform**: Navegadores evergreen (Chrome/Edge/Firefox/Safari 16+),
responsivo de ~360 px a desktop; instalável como PWA; hospedagem estática
(Vercel ou Netlify) com deploy automático do GitHub

**Project Type**: SPA/PWA (sem backend próprio)

**Performance Goals**: troca de música no modo tocar percebida como instantânea
(<1 s); abertura offline de conteúdo já aberto <3 s; busca/filtro respondem em
tempo real para bibliotecas de uma equipe (centenas de cifras)

**Constraints**: escrita exige conexão (leitura offline apenas do já aberto);
texto-fonte da cifra imutável sob transposição; custo de infraestrutura zero
(free tiers); interface PT-BR; credenciais Supabase só via variáveis de
ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)

**Scale/Scope**: uso de uma equipe por vez — dezenas de membros, centenas de
cifras e setlists; 9 rotas do documento de arquitetura + 1 rota de aceite de
convite; 6 tabelas + 2 funções RPC no banco

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Status | Evidência no design |
| --- | --- | --- | --- |
| I | O banco nega, não a aplicação (RLS) | ✅ PASS | `supabase/migrations/` com RLS habilitada em todas as tabelas, helpers `is_team_member`/`is_team_editor` (SECURITY DEFINER) e políticas select/mutate por papel (ver data-model.md) |
| II | Sem backend próprio | ✅ PASS | SPA + `@supabase/supabase-js` apenas; nenhuma API própria; ingresso por convite via RPC no banco |
| III | Offline-first na leitura | ✅ PASS | `vite-plugin-pwa` (app shell precacheado) + Dexie com padrão read-through: renderiza do cache, sincroniza do servidor quando online |
| IV | Transposição é render, não dado | ✅ PASS | Transpositor puro aplicado na renderização; persistido só o desvio `transpose` em `setlist_items` |
| V | Stack fixa e gratuita | ✅ PASS | Exatamente a stack da constituição; novas libs (dnd-kit, dexie, router) são necessárias à stack declarada e gratuitas |
| VI | PT-BR na interface, inglês no código | ✅ PASS | Textos/rótulos PT-BR; código, tabelas, colunas e commits em inglês |
| VII | Simplicidade e entrega incremental | ✅ PASS | Escopo = MVP da spec; nada de pós-MVP (sem PDF, importação, telão, pedal); 1 projeto, sem monorepo |

Re-checagem pós-design (Phase 1): mantém-se PASS em todos os itens; a única
extensão de modelo é a coluna `display_name` em `team_members` (evita tabela
`profiles` extra — mais simples, ver data-model.md).

## Project Structure

### Documentation (this feature)

```text
specs/001-louve-facil-mvp/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── supabase-schema.md
│   ├── chordpro-format.md
│   └── routes.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (/speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   ├── 0001_schema.sql        # tabelas, índices, triggers, RPC
│   └── 0002_rls_policies.sql  # RLS habilitada + políticas por tabela
└── seed_sample_songs.sql      # (opcional) cifras de exemplo p/ testes manuais

public/
├── icons/                     # PWA: ícones 192/512 + maskable
└── manifest/ assets gerados pelo vite-plugin-pwa

src/
├── main.tsx                   # bootstrap: router + theme + PWA
├── App.tsx                    # rotas + guards (auth, sem-equipe)
├── lib/
│   ├── supabase.ts            # client único (env vars)
│   ├── env.ts                 # leitura/validação de env + estado "não configurado"
│   └── utils.ts               # cn(), datas, códigos de convite
├── db/
│   ├── dexie.ts               # schema IndexedDB (versões/tabelas)
│   └── repos/                 # read-through cache por entidade (songs, setlists, teams)
├── features/
│   ├── auth/                  # /login, /cadastro, /recuperar-senha
│   ├── teams/                 # /equipes, convites, /config (membros+convites)
│   ├── songs/                 # /biblioteca, /cifra/nova (editor), /cifra/:id
│   ├── chords/                # parser ChordPro + transpositor (lógica pura)
│   ├── setlists/              # /setlists, /setlist/:id, /setlist/:id/tocar
│   └── settings/              # perfil, aparência (claro/escuro)
├── components/
│   ├── ui/                    # shadcn/ui (componentes próprios no repo)
│   ├── layout/                # shell do app, navegação, seletor de equipe
│   └── shared/                # estados vazios, erros, offline banner
├── hooks/                     # useAuth, useCurrentTeam, useTheme, useOnline
└── types/                     # tipos de domínio compartilhados (entity types)

tests/                         # espelha src/ (unit + component, vitest)
```

**Structure Decision**: Projeto único de SPA na raiz do repositório (sem
monorepo, sem backend) — a aplicação inteira é o frontend; as regras de
acesso vivem em `supabase/migrations/`. A lógica de cifras
(`src/features/chords/`) é isolada como módulo puro, testável sem rede.

## Complexity Tracking

> Sem violações de constituição a justificar — seção vazia.
