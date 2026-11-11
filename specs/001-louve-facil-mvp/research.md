# Research: MVP do Louve Fácil

**Feature**: `001-louve-facil-mvp` | **Date**: 2026-11-11

Fase 0 do `/speckit-plan`: resolve as decisões técnicas abertas antes do
design. Cada decisão registra escolha, racional e alternativas consideradas.

## D-1. Parser e transpositor de cifras ChordPro

**Decision**: Parser ChordPro **próprio** (`src/features/chords/`), módulo
puro e testável, em vez de ChordSheetJS.

**Rationale**: O formato usado é um subconjunto simples e fechado — metatags
`{title: ...}`/`{key: ...}` no topo, seções `[Intro]`, acordes inline
`[Am]` antes da sílaba. Um parser próprio (~200 linhas) dá controle total
sobre: render em grade de duas linhas (acorde sobre a sílaba), preservação
exata do texto-fonte (Princípio IV), escolha sustenidos/bemóis pelo tom de
referência e degradação amigável para acordes malformados (edge case da spec:
exibir como texto, sem quebrar). Testes de unidade cobrem o comportamento
todo sem rede nem dependências.

**Alternatives considered**:
- **ChordSheetJS 18**: parser/render maduros, mas os alvos de render dele
  (HTML com espaçamento próprio, ChordPro lineage, textwidth) não batem com a
  grade de duas linhas do app; transposição dele não controla bem
  sharps/flats por tom; peso adicional para recortar. Descartado no MVP.
- **TJ transposer libs (ex. `chord-transposer`)**: restritas a transposição,
  sem parse das seções/metatags; não elimina o parser próprio.

## D-2. Cache offline (leitura) — estratégia de sincronização

**Decision**: **Read-through cache** com Dexie: toda leitura renderiza do
IndexedDB e, se online, dispara busca no Supabase em paralelo e sobrescreve o
cache (last-write-wins por linha, `fetched_at` por tabela). Escritas são
online-only (mútuo com a spec FR-032) e invalidam o cache local da entidade.

**Rationale**: Simples, sem filas nem resolução de conflito; atende "leitura
offline do já aberto" e mantém o app utilizável em sinal ruim (renderiza
primeiro do cache — percebido como instantâneo). Nenhum dado sensível além do
que a equipe já vê é armazenado no dispositivo; logout limpa o cache local.

**Alternatives considered**:
- **Cache só no service worker (Workbox runtime)**: cacheia JSON do PostgREST
  de forma opaca, sem modelar entidades; difícil invalidar por escrita e
  reagir a mudanças. Descartado como cache de dados (mantido apenas para
  app shell/assets).
- **Supabase Realtime + sync bidirecional**: escopo pós-MVP (escrita offline
  está fora do MVP).

## D-3. Reordenação de setlist (drag & drop)

**Decision**: `@dnd-kit/core` + `@dnd-kit/sortable`; persistência da ordem via
reposicionamento de `position` (renumeração 1..n após cada mudança).

**Rationale**: Acessível (teclado/leitores de tela), mantido ativamente,
leve e compatível com listas curtas (repertórios ~15 itens). Renumeração
inteira evita deltas fracionados e mantém a consulta por `position`
determinística.

**Alternatives considered**: `react-beautiful-dnd` (arquivado), HTML5 DnD
nativo (sem acessibilidade/toque decente).

## D-4. Ingresso na equipe por código de convite

**Decision**: RPC `join_team_with_code(p_code text) returns uuid` com
`SECURITY DEFINER` no banco; o código nunca é listável via API normal
(`invites` tem RLS restrita ao dono), apenas validável pela função.

**Rationale**: Evita expor a tabela `invites` a qualquer usuário autenticado
(códigos são segredos) e evita concatenação client-side de permissões: o
banco valida revogação/expiração e insere a participação atômica como
`member`. Alinha com Princípio I (o banco nega).

**Alternatives considered**: tabela `invites` legível por qualquer
autenticado filtrando por código (viola privacidade por enumeração), duas
chamadas encadeadas client-side (janela de corrida).

## D-5. Nome de exibição dos membros

**Decision**: Coluna `display_name` em `team_members` (preenchida ao entrar
na equipe; editável em `/config`), sem tabela `profiles`.

**Rationale**: A lista de membros já é legível pelos membros da equipe (RLS
existente), então o nome viaja no vínculo equipe–usuário; evita criar uma
tabela + políticas extra (`profiles`) só para um campo. O cadastro coleta o
nome e o entra-na-equipe o replica.

**Alternatives considered**: tabela `profiles` espelhando `auth.users`
(padrão comum, porém mais uma tabela/política para o MVP).

## D-6. Tema claro/escuro

**Decision**: Estratégia `class` do Tailwind com tokens shadcn/ui (CSS
variables); preferência `system` como padrão, com alternância manual
persistida localmente (localStorage); classe `dark` no `<html>`.

**Rationale**: Exatamente o padrão shadcn/ui; atende FR-023 (respeita SO +
toggle manual) sem lógica extra. Modo "tocar" herda o tema vigente.

**Alternatives considered**: media query isolada (sem toggle manual);
biblioteca de tema extra (desnecessária).

## D-7. Provisionamento Supabase sem acesso do desenvolvimento

**Decision**: Entregar **migrações SQL idempotentes** versionadas
(`supabase/migrations/`), `.env.example`, e no app um estado amigável
"projeto não configurado" quando `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
estiverem ausentes (build não quebra; tela orienta o dono do projeto).
`quickstart.md` documenta criação do projeto, execução das migrações e os
testes de isolamento (SC-003) a rodar na implantação.

**Rationale**: Decisão de esclarecimento de 2026-11-11 (o dono cria o projeto
depois). Migrações idempotentes ( guards `if not exists`) permitem rodar via
SQL Editor ou CLI sem ordem frágil. Toda mudança de acesso fica revisável em
diff de SQL (Princípio I e Fluxo de Qualidade da constituição).

**Alternatives considered**: projeto Supabase local (sem Docker no ambiente —
inviável); compartilhar credenciais no chat (descartado pelo dono).

## D-8. Ícones do PWA

**Decision**: Ícone mestre em SVG autoral (logo "Louve Fácil"), convertido
para PNG (192, 512, apple-touch 180, maskable) por script de build
`scripts/generate-icons.mjs` com `sharp` como **devDependency**.

**Rationale**: O ambiente não tem ImageMagick/rsvg/ffmpeg; PNG é exigido
praticamente pelo iOS (apple-touch-icon) e recomendado pelo Android.
`sharp` só existe no toolchain de desenvolvimento (zero peso no bundle).

**Alternatives considered**: só SVG no manifest (falha em iOS); serviço
online de geração (dependência externa de processo).

## D-9. Hospedagem e deploy

**Decision**: Configurar **Vercel** como alvo primário (`vercel.json` com
rewrite SPA) e incluir `netlify.toml` equivalente; deploy via dashboard do
dono (contas/credentials são do dono). Domínio e conta não são do escopo.

**Rationale**: Ambos gratuitos para este perfil; os dois arquivos são
minúsculos e o dono escolhe na implantação. O app é estático — nenhuma
configuração de servidor além do rewrite SPA.

**Alternatives considered**: escolher só uma (innecessariamente restritivo);
GitHub Pages (sem rewrite de SPA limpo/HTTP headers).

## D-10. Testes

**Decision**: Vitest + React Testing Library. Cobertura prioritária: parser
ChordPro (estruturas válidas/malformadas), transpositor (tons com
sustenido/bemol, wrap de oitava, acordes com baixo `/X` e sufixos `m7` etc.),
regras de papel (pode editar?), validade de convite (expiração/revogação),
componentes de preview do editor e visualizador. RLS e fluxos multiusuário:
validação manual roteirizada em `quickstart.md` contra o projeto real
(força do design: o banco é a barreira, e o SQL é revisável).

**Rationale**: Ambiente sem Docker/Supabase local (D-7); testes puros cobrem
a lógica com maior risco (cifras). Testes E2E browser seriam frágeis sem
backend real disponível no desenvolvimento.

**Alternatives considered**: Playwright E2E completo (adiado para quando o
projeto Supabase real existir); mock completo do Supabase (alto custo de
manutenção, baixo valor).

## D-11. Roteamento e guards

**Decision**: React Router 7 (modo biblioteca) com guards em camada de
componentes: rota exige sessão → redireciona `/login`; rota exige equipe
ativa → redireciona `/equipes`; rota exige papel editor/dono → tela de
"sem permissão". Rota extra `/convite/:code` (aceite de convite) somada ao
mapa de rotas do documento de arquitetura.

**Rationale**: Guardas na UI são conveniência; a autoridade continua no RLS
(Princípio I). React Router é o padrão de facto para SPA Vite.

**Alternatives considered**: TanStack Router (menos familiar, sem ganho
aqui); guards via loader (redundante com render guards e hooks de cache).

## D-12. Estado de formulários e validação

**Decision**: React Hook Form + zod nos formulários críticos (cadastro, cifra,
setlist, convite); mensagens de erro em PT-BR.

**Rationale**: Formulários com validação obrigatória clara (FR-003/US2),
re-render barato no editor (preview ao vivo com debounce); zod dá validação
compartilhada com tipos.

**Alternatives considered**: estado local manual (erros repetidos);
formik (menos mantido).
