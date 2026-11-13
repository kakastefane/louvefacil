# Tasks: MVP do Louve Fácil

**Input**: Design documents from `/specs/001-louve-facil-mvp/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Incluídos conforme o plano (research.md D-10): unidade para lógica
pura (parser/transpositor, papéis, convites, filtros, posições) e componentes
chave. RLS e fluxos multiusuário: validação manual via `quickstart.md`.

**Organization**: Tarefas agrupadas por história de usuário (US1–US5 da spec),
com fases de setup e fundação bloqueantes antes das histórias.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: História à qual a tarefa pertence (US1…US5)
- Caminhos exatos de arquivo em cada tarefa

## Path Conventions

Projeto único de SPA na raiz: `src/`, `tests/`, `supabase/migrations/`
(conforme plan.md — sem backend próprio).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialização do projeto Vite + React + TS e toolchain

- [x] T001 Scaffold do projeto Vite (react-ts) na raiz: `index.html`, `vite.config.ts`, `tsconfig.json` (strict, alias `@/` → `src/`), `src/main.tsx` e `src/App.tsx` mínimos
- [x] T002 Instalar dependências por plan.md: react-router, @supabase/supabase-js, dexie + dexie-react-hooks, @dnd-kit/core + @dnd-kit/sortable, zod, react-hook-form, tailwindcss 4, shadcn/ui (init, componentes base button/input/dialog/label/select/tabs), dev: vitest, @testing-library/react, jsdom, vite-plugin-pwa, sharp
- [x] T003 [P] Configurar qualidade: `.eslintrc`/`eslint.config.js` + script `npm run lint`, scripts `dev`/`build`/`test`/`preview` no `package.json`, `.gitignore` (node_modules, dist, .env.local) e `.env.example` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- [x] T004 [P] Configurar vite-plugin-pwa base em `vite.config.ts` (registerType autoUpdate, manifest inicial PT-BR com ícones placeholder, workbox generateSW)

**Checkpoint**: `npm run dev`, `npm run build`, `npm test`, `npm run lint` executam sem erro

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura usada por TODAS as histórias — schema/RLS do
banco, cliente Supabase, cache Dexie, módulo de cifras (puro), tema, shell e
roteamento. **⚠️ Nenhuma história começa antes desta fase.**

**⚠️ CRITICAL**: Bloqueia todas as user stories

- [x] T005 Criar `supabase/migrations/0001_schema.sql` conforme data-model.md: tabelas teams, team_members (unique(team_id,user_id) + unique parcial de um owner), invites (code unique, expires_at, revoked), songs (themes text[] default '{}', content ≤20000 chars, original_key), setlists (event_date), setlist_items (unique(setlist_id,song_id), unique(setlist_id,position) deferrable), índices por team_id, trigger set_updated_at em songs/setlists — tudo idempotente (if not exists)
- [x] T006 Criar `supabase/migrations/0002_rls_policies.sql`: enable RLS em todas as tabelas; helpers SECURITY DEFINER `is_team_member/is_team_editor/is_team_owner` (search_path fixo); políticas por tabela conforme matriz do data-model.md (`team_members` sem insert direto); RPCs `create_team` (equipe + owner atômicos), `join_team_with_code`, `update_member_role`, `remove_member`, `leave_team`, `reorder_setlist`, `duplicate_setlist` com validações de papel
- [x] T007 [P] Criar `src/lib/env.ts` (leitura/validação das env vars + flag `isConfigured`) e `src/lib/supabase.ts` (client único exportado; factory protegida quando não configurado)
- [x] T008 [P] Criar `src/types/domain.ts` com os tipos de domínio das 6 entidades (Team, TeamMember, Invite, Song, Setlist, SetlistItem) + `TeamRole`, conformes contracts/supabase-schema.md
- [x] T009 Criar cache offline: `src/db/dexie.ts` (IndexedDB v1 espelhando as 6 tabelas com `_fetched_at`) e `src/db/repos/{teams,songs,setlists}.ts` com padrão read-through (renderiza do cache; busca online e sobrescreve; mutações online-only conforme D-2)
- [x] T010 [P] Criar `src/lib/utils.ts`: `cn()`, geração de código de convite (URL-safe ≥8 chars), normalização de temas (trim, dedupe case-insensitive), formatação de datas PT-BR, helpers de validade de convite
- [x] T011 Implementar parser ChordPro puro em `src/features/chords/parser.ts` (gramática de contracts/chordpro-format.md: metatags, seções, acordes inline, linhas só de acordes, acorde malformado → literal) + testes `tests/unit/chords/parser.test.ts` (casos válidos, malformados, seções, espaçamento)
- [x] T012 Implementar transpositor puro em `src/features/chords/transpose.ts` (raiz e baixo módulo 12; sufixos intactos; bemóis para F/Bb/Eb/Ab/Db/Gb e menores; `transpose ∈ [-11,+11]`) + testes `tests/unit/chords/transpose.test.ts` (wrap de oitava, enharmonia, acordes com baixo `/X`)
- [x] T013 Implementar modelagem de render em `src/features/chords/render.ts` (grade de duas linhas: acorde na coluna da sílaba; preservação do texto-fonte) + testes `tests/unit/chords/render.test.ts`
- [x] T014 Configurar tema: tokens shadcn/ui em `src/index.css`, estratégia `class` de dark mode, `src/hooks/useTheme.tsx` (system | light | dark persistido, classe no `<html>`) — atende FR-023
- [x] T015 Criar shell do app `src/components/layout/AppShell.tsx` (cabeçalho com título da tela, navegação inferior no mobile/lateral no desktop, slot do seletor de equipe, área de conteúdo responsiva ~360px+)
- [x] T016 Criar roteamento com guards em `src/App.tsx` + `src/app/guards.tsx`: RequireAuth (→ `/login?redirect=`), RequireTeam (→ `/equipes`), RequireRole (→ tela "Sem permissão"); declarar todas as rotas de contracts/routes.md apontando para páginas placeholder; modo não configurado → `/setup` (página `src/features/settings/pages/SetupPage.tsx`)
- [x] T017 [P] Criar componentes compartilhados `src/components/shared/{EmptyState,ErrorState,LoadingState,OfflineBanner}.tsx` + hook `src/hooks/useOnline.ts` (navigator.onLine + listeners)
- [x] T018 Criar `src/hooks/useAuth.tsx` (provider de sessão: getSession, onAuthStateChange, signUp com options.data.name, signInWithPassword, resetPasswordForEmail, updateUser password, signOut) — infra de auth usada por US1

**Checkpoint**: Fundação pronta — histórias podem começar (US1 primeiro)

---

## Phase 3: User Story 1 — Acesso à equipe e isolamento de dados (Priority: P1) 🎯 MVP

**Goal**: Cadastro/login e-mail+senha, criar equipe, convite por link com
expiração/revogação, papéis dono/editor/membro, várias equipes com seletor e
isolamento garantido por RLS

**Independent Test**: Duas contas + duas equipes: dono gera convite →
convidado entra e vê a biblioteca (vazia) da equipe; acesso cruzado por URL/
busca é negado; convite revogado/expirado falha. Roteiro completo em
quickstart.md S1/S1b

### Tests for User Story 1

- [x] T019 [P] [US1] Testes de unidade das regras de papel (owner/editor/member: pode editar? gerenciar convites?) e validade de convite (expiração/revogação) em `tests/unit/teams/roles.test.ts` e `tests/unit/teams/invites.test.ts`

### Implementation for User Story 1

- [x] T020 [P] [US1] Criar service de equipes `src/features/teams/service.ts`: criar equipe via RPC `create_team(name, display_name)` (equipe + vínculo owner atômicos no banco), listar equipes do usuário (read-through), equipe ativa persistida em localStorage
- [x] T021 [P] [US1] Criar service de convites `src/features/teams/invites.ts`: gerar (code + expires_at default 7 dias), listar por equipe, revogar; ingresso via RPC `join_team_with_code(code, display_name)`; mapear erros `invalid_code/expired_code/revoked_code`
- [x] T022 [P] [US1] Criar service de membros `src/features/teams/members.ts`: listar membros da equipe (read-through), alterar papel e remover via RPCs, `leave_team`
- [x] T023 [US1] Criar páginas de autenticação `src/features/auth/pages/LoginPage.tsx` (alternância entrar/criar conta, react-hook-form + zod, erros PT-BR, redirect preservado) e `src/features/auth/pages/RecoverPasswordPage.tsx` (solicitar por e-mail + definir nova senha com token)
- [x] T024 [US1] Criar `src/features/teams/pages/TeamsPage.tsx` (`/equipes`): lista de minhas equipes, criar equipe (nome), estado vazio com CTA criar/entrar via convite; define equipe ativa → `/biblioteca`
- [x] T025 [US1] Criar `src/features/teams/pages/InvitePage.tsx` (`/convite/:code`): válido+sem sessão → cadastro/entrada com code preservado; válido+com sessão → entrar direto; inválido/expirado/revogado → mensagem com CTA contactar o dono
- [x] T026 [US1] Criar `src/features/teams/pages/SettingsPage.tsx` (`/config`): perfil (editar display_name), gerenciar membros (alterar papel, remover — só dono), convites (gerar com prazo, copiar link, revogar — só dono), sair da equipe (não-dono) e logout
- [x] T027 [US1] Integrar seletor de equipe no AppShell (`src/components/layout/TeamSwitcher.tsx`): troca de equipe ativa, exibição do papel do usuário, limpeza de caches de conteúdo ao trocar; restrições de papéis visíveis na UI (membro não vê botões de escrita)
- [x] T028 [US1] Adicionar validação e tratamento de erro amigável nos fluxos US1 (e-mail já cadastrado, senha fraca, RLS negada → "Você não tem permissão") + empty/loading states

**Checkpoint**: US1 funcional e testável isoladamente (quickstart S1 + S1b)

---

## Phase 4: User Story 2 — Cifra padronizada com preview ao vivo (Priority: P2)

**Goal**: Editor de cifra (título obrigatório, artista/tom/temas opcionais,
letra com acordes ChordPro obrigatória) com preview ao vivo; CRUD de cifras
por editor/dono; fonte da verdade intacta

**Independent Test**: Editor digita cifra com `[Am]` inline e `{key: G}` →
preview renderiza acordes sobre a letra em tempo real; salvar sem título
bloqueia; cifra salva aparece na biblioteca e é editável/excluível
(confirmação). Roteiro em quickstart.md S2

### Tests for User Story 2

- [x] T029 [P] [US2] Testes de unidade da normalização de temas (trim, dedupe case-insensitive, agrupamento) em `tests/unit/songs/themes.test.ts` (usa `src/lib/utils.ts`)

### Implementation for User Story 2

- [x] T030 [P] [US2] Criar service de cifras `src/features/songs/service.ts`: listar por equipe (ordenado por título), obter por id, criar (created_by = auth.uid()), atualizar, excluir (confirmação na UI; cascata remove itens de setlists) — tudo read-through via `src/db/repos/songs.ts`
- [x] T031 [US2] Criar componente `src/features/songs/components/ChordPreview.tsx`: parse + render (T011/T013) com debounce de digitação, scroll sincronizado, seção/estilo dos rótulos
- [x] T032 [US2] Criar `src/features/songs/components/SongEditorForm.tsx`: campos título/artista/original_key (select de notas)/themes (tag input)/content (textarea mono com autocomplete de colchetes), validação zod (title 1–200, content obrigatório ≤20000), mensagens PT-BR
- [x] T033 [US2] Criar páginas de edição: `src/features/songs/pages/SongEditorPage.tsx` (`/cifra/nova`) e modo edição (`/cifra/:id/editar`): layout editor+preview (lateral no desktop ≥lg, alternância por abas no mobile), guarda RequireRole editor/dono, estados de salvamento/erro de rede com texto preservado
- [ ] T034 [US2] Adicionar exclusão de cifra com dialog de confirmação (avisa remoção de setlists) integrada à página de edição e à biblioteca (US3)

**Checkpoint**: US1 + US2 funcionam independentemente (quickstart S2)

---

## Phase 5: User Story 3 — Biblioteca, busca e visualizador (Priority: P3)

**Goal**: Biblioteca com busca (título/artista) e filtro por tema; leitura
confortável: transposição em tempo real sem alterar a fonte, fonte ajustável,
claro/escuro

**Independent Test**: 3+ cifras com temas: busca/filtro respondem; visualizador
transpõe ±N com acordes legíveis (bemóis em tons de bemol); texto-fonte intacto
(verificar editando). Roteiro em quickstart.md S3

### Tests for User Story 3

- [x] T035 [P] [US3] Testes de unidade da busca/filtro (case-insensitive título/artista, filtro por tema canônico, resultado vazio) em `tests/unit/songs/filter.test.ts`

### Implementation for User Story 3

- [ ] T036 [US3] Criar `src/features/songs/pages/LibraryPage.tsx` (`/biblioteca`): lista com título/artista/tom/temas, input de busca com debounce, chips de tema, estado vazio (com CTA para editor/dono), abre `/cifra/:id`
- [ ] T037 [US3] Criar `src/features/songs/pages/SongViewerPage.tsx` + `src/features/songs/components/SongViewer.tsx`: header (título/artista/tom exibido/temas), corpo renderizado por render.ts, aplicação de desvio de transposição apenas em memória (nunca salva na cifra)
- [ ] T038 [US3] Criar `src/features/songs/components/ViewerControls.tsx`: transposição +/− com indicador (`+2`/`0`/`−1`, reset), tamanho da fonte em passos discretos persistido localmente, respeita tema claro/escuro vigente (FR-021/FR-022/FR-023)

**Checkpoint**: US1–US3 funcionam (quickstart S3) — corresponde ao "Núcleo" da arquitetura

---

## Phase 6: User Story 4 — Setlists e modo tocar (Priority: P4)

**Goal**: Setlists com nome/data, itens reordenáveis por drag, duplicação,
desvio de transposição por item salvo, modo tocar navegável

**Independent Test**: Setlist com 3 músicas: reordenar persiste; transposição
por item persiste; duplicar cria cópia independente; modo tocar navega
próxima/anterior com tom salvo. Roteiro em quickstart.md S4

### Tests for User Story 4

- [ ] T039 [P] [US4] Testes de unidade de renumeração de posições (1..n após remoção/reordenação) e limites de desvio (−11..+11) em `tests/unit/setlists/positions.test.ts`

### Implementation for User Story 4

- [ ] T040 [P] [US4] Criar service de setlists `src/features/setlists/service.ts`: listar/criar (name obrigatório, event_date opcional)/atualizar/excluir, adicionar/remover item (unique(setlist_id,song_id)), `reorder_setlist` e `duplicate_setlist` via RPC, definir `transpose` por item — read-through via `src/db/repos/setlists.ts`
- [ ] T041 [US4] Criar `src/features/setlists/pages/SetlistsPage.tsx` (`/setlists`): lista com nome/data/contagem, criar (dialog com validação), estado vazio
- [ ] T042 [US4] Criar `src/features/setlists/pages/SetlistDetailPage.tsx` (`/setlist/:id`): itens com tom exibido, dialog para adicionar músicas da biblioteca (com busca), reordenação drag-and-drop com @dnd-kit/sortable (persistindo via RPC), ações editor/dono (duplicar, excluir setlist, editar nome/data), excluir item com renumeração
- [ ] T043 [US4] Criar `src/features/setlists/pages/PlayModePage.tsx` (`/setlist/:id/tocar`): render de cada música com o `transpose` do item, navegação próxima/anterior (botões grandes + setas do teclado + swipe), indicador "3 de 12", saída para o setlist; setlist vazio → CTA para adicionar músicas
- [ ] T044 [US4] Aplicar guards de papel nas telas US4: membro vê itens/tom e usa modo tocar, sem controles de escrita; tentativa de escrita por membro → bloqueio com explicação (FR-029)

**Checkpoint**: US1–US4 funcionam (quickstart S4)

---

## Phase 7: User Story 5 — App instalável e leitura offline (Priority: P5)

**Goal**: PWA instalável (manifest+ícones, iOS/Android/desktop) e leitura
offline do conteúdo já aberto; escrita online-only com avisos claros

**Independent Test**: Instalar no Chrome → janela própria; abrir cifras/setlist,
ficar offline (DevTools) → conteúdo já aberto legível; criar/editar avisa e
preserva texto. Roteiro em quickstart.md S5

### Implementation for User Story 5

- [x] T045 [P] [US5] Criar ícone mestre `scripts/icon.svg` (logo "Louve Fácil") + script `scripts/generate-icons.mjs` (sharp) gerando `public/icons/{icon-192.png,icon-512.png,icon-maskable-192.png,icon-maskable-512.png,apple-touch-icon.png}`
- [x] T046 [US5] Finalizar manifest em `vite.config.ts` (nome "Louve Fácil", short_name, display standalone, theme/background color, ícones T045, lang pt-BR) + metas iOS (apple-touch-icon, capable) em `index.html`
- [x] T047 [US5] Configurar service worker (generateSW): precache do app shell + fallback de navegação offline para `index.html`; verificar atualização silenciosa (autoUpdate)
- [x] T048 [US5] Completar garantias offline nos repos (T009): biblioteca/cifra/setlist/tocar renderizam de Dexie sem rede; conteúdo nunca aberto offline → estado informativo com CTA abrir online (FR-033); escrita offline → aviso "Sem conexão — a alteração exige internet" com texto preservado (FR-032); banner global offline (OfflineBanner) no AppShell
- [x] T049 [US5] Garantir logout/limpeza: `signOut` apaga base Dexie local e reseta equipe ativa; troca de conta não vaza conteúdo da equipe anterior

**Checkpoint**: US1–US5 funcionam (quickstart S5)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Refinamentos que afetam todas as histórias

- [ ] T050 Criar `README.md` na raiz: visão, setup (Supabase passo a passo, env vars, migrações), scripts, deploy Vercel/Netlify, link para quickstart.md e arquitetura em `.docs/`
- [ ] T051 [P] Criar `supabase/seed_sample_songs.sql` (opcional): 3–4 cifras de exemplo em ChordPro com temas, para testes manuais rápidos
- [ ] T052 [P] Pass de acessibilidade/UX: labels e aria em dialogs/forms (shadcn), foco visível, navegação por teclado no modo tocar e no dnd-kit, contraste nos dois temas
- [ ] T053 Revisão de segurança final: reler `supabase/migrations/0002_rls_policies.sql` contra a matriz do data-model.md (Princípio I da constituição), conferir RPCs (search_path fixo, validação de papel) e anotar resultado no quickstart S1b
- [ ] T054 Executar validação completa: `npm run lint` + `npm test` + `npm run build` verdes; percorrer `specs/001-louve-facil-mvp/quickstart.md` S1–S5 e registrar evidências
- [ ] T055 Limpeza final: remover TODOs/debug, revisar textos PT-BR (Princípio VI), conferir commits pequenos e descritivos (convenções da constituição)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — iniciar imediatamente
- **Foundational (Phase 2)**: depende do Setup; **BLOQUEIA todas as histórias**
  - T005/T006 (migrações) podem ser escritas em paralelo com o front (T007–T018), mas a validação de US1 depende delas rodarem no Supabase real
- **US1 (Phase 3)**: depende da Fundação; nada de outras histórias
- **US2 (Phase 4)**: depende de US1 (equipes/papéis definem permissão de escrita) e da Fundação (parser T011/T013)
- **US3 (Phase 5)**: depende de US2 (cifras existem) e Fundação (transpositor T012)
- **US4 (Phase 6)**: depende de US2/US3 (cifras para compor setlists)
- **US5 (Phase 7)**: depende de todas as telas existirem; integração offline com repos da Fundação
- **Polish (Phase 8)**: após todas as histórias desejadas

### User Story Dependencies

- **US1 (P1)**: Fundação → independente
- **US2 (P2)**: Fundação + US1 → independente de US3/US4/US5
- **US3 (P3)**: Fundação + US1 + (dados de US2 para validar com conteúdo)
- **US4 (P4)**: US2 (cifras) + US3 (padrões de visualização)
- **US5 (P5)**: todas as anteriores (fecha o ciclo offline)

### Within Each User Story

- Testes (quando presentes) escritos antes da implementação correspondente
- Services antes de páginas; componentes antes de páginas; integração por último
- Checkpoint de história = validar pelo quickstart.md antes de avançar

### Parallel Opportunities

- Phase 1: T003, T004 em paralelo
- Phase 2: T007/T008/T010/T017/T011/T012/T013/T014/T015/T016 em paralelo (arquivos distintos); T005/T006 em paralelo entre si
- Dentro das histórias: tasks marcadas [P] (services e testes) em paralelo
- Entre histórias: sequencial por prioridade (P1→P5) neste plano (time = 1)

---

## Parallel Example: Foundational + US1

```text
# Lote 1 (frente, arquivos distintos):
Task T007 "src/lib/env.ts + src/lib/supabase.ts"
Task T008 "src/types/domain.ts"
Task T010 "src/lib/utils.ts"
Task T011 "src/features/chords/parser.ts + testes"
# Lote 2 (banco):
Task T005 "supabase/migrations/0001_schema.sql"
Task T006 "supabase/migrations/0002_rls_policies.sql"
# Lote 3 (services US1, após Fundação):
Task T020 "src/features/teams/service.ts"
Task T021 "src/features/teams/invites.ts"
Task T022 "src/features/teams/members.ts"
```

---

## Implementation Strategy

### MVP First (US1 completo)

1. Phase 1 (Setup) + Phase 2 (Fundação) → fundação pronta
2. Phase 3 (US1) → **STOP e validar**: quickstart S1/S1b (isolamento!)
3. Deploy/demo se pronto — com biblioteca vazia, mas equipes funcionando

### Incremental Delivery (alvo do MVP completo)

1. Fundação → US1 (acesso/equipe/isolamento) ✅ validar
2. + US2 (editor/preview) → + US3 (biblioteca/leitura) → **"Núcleo" da arquitetura** ✅ validar
3. + US4 (setlists/modo tocar) ✅ validar
4. + US5 (PWA/offline) ✅ validar → **MVP completo**
5. Polish (Phase 8) → revisão RLS + acessibilidade + release

### Notes

- [P] = arquivos diferentes, sem dependências pendentes
- Commits pequenos e descritivos por tarefa (convenção da constituição)
- Toda mudança de acesso (T006 e ajustes) exige revisão RLS antes do merge
- Validações de RLS/multiusuário só completam com o projeto Supabase real do dono (quickstart S1b)
