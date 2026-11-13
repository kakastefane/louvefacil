# Quickstart: validação do MVP do Louve Fácil

**Feature**: `001-louve-facil-mvp` | **Date**: 2026-11-11

Guia de validação executável. Comandos assumem `npm` (Node ≥ 20) na raiz do
repositório. Referências: [contracts](./contracts/),
[data-model.md](./data-model.md), [spec.md](./spec.md).

## 0. Pré-requisitos

- Node.js ≥ 20 e npm.
- (Opcional, para validação completa) Projeto Supabase criado pelo dono +
  conta Vercel **ou** Netlify.

## 1. Desenvolvimento sem Supabase (sem credenciais)

```bash
npm install
npm run dev        # abre o app → tela "Projeto não configurado" (/setup)
npm test           # suíte de unidade (parser, transpositor, regras) passa
npm run build      # build de produção sem credenciais não quebra
```

**Esperado**: app roda em modo "não configurado"; testes verdes; build ok.

## 2. Com projeto Supabase (dono do projeto)

1. Crie o projeto em supabase.com (região próxima, ex. South America).
2. Autenticação → Providers → **Email** habilitado (confirmação de e-mail
   conforme preferência; default habilitada).
3. SQL Editor → execute, em ordem:
   `supabase/migrations/0001_schema.sql`,
   `supabase/migrations/0002_rls_policies.sql`.
4. `cp .env.example .env.local` → preencha `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` (Settings → API do projeto).
5. `npm run dev` → o app abre em `/login`.

## 3. Cenários de validação (por história da spec)

### S1 — Acesso à equipe e isolamento (US1 / SC-001..003)

1. Conta A: cadastre-se → crie equipe "Equipe A" → gere convite (7 dias).
2. Conta B (outro navegador/aba anônima): cadastre-se → crie "Equipe B".
3. Conta A: cadastre 1 cifra em "Equipe A".
4. Conta B: abra o link da cifra da Equipe A (copiado da API/URL) →
   **esperado**: acesso negado; busca não encontra nada da Equipe A.
5. Conta B: abra o convite da Equipe A → entra como membro → vê a biblioteca
   da Equipe A ao alternar de equipe (seletor em `/equipes`).
6. Dono (Conta A): revogue o convite → novo acesso ao link → inválido.
   Remova a Conta B → ela perde acesso imediatamente.

### S1b — Negação no banco (SC-003, SQL direto no Supabase)

```sql
-- logado como usuário de outra equipe (ou anon):
select * from songs;          -- só linhas de equipes do usuário (ou 0)
select * from invites;        -- só convites de equipes onde é dono (ou 0)
```

#### Revisão estática de RLS/RPCs (T053, 2026-11-13)

Revisão de `supabase/migrations/0002_rls_policies.sql` contra a matriz do
`data-model.md`:

- **RLS habilitado nas 6 tabelas** (teams, team_members, invites, songs,
  setlists, setlist_items). ✔
- **teams**: SELECT por membro; UPDATE/DELETE por dono; **sem política de
  INSERT** (criação só via RPC `create_team`). ✔
- **team_members**: SELECT por membro; **sem INSERT/UPDATE/DELETE diretos**
  (gestão só via RPCs `update_member_role`/`remove_member`/`leave_team`);
  `join_team_with_code` é o único caminho de ingresso. ✔
- **invites**: SELECT/INSERT/UPDATE/DELETE só pelo dono — convite é segredo,
  membro comum não consegue ler códigos. ✔
- **songs/setlists**: SELECT por membro; INSERT/UPDATE/DELETE por
  editor/dono (insert exige `created_by = auth.uid()`). ✔
- **setlist_items**: acesso via papel na equipe do setlist pai. ✔
- **RPCs**: todas com `security definer`, `set search_path = public`,
  validação interna (`auth.uid()`, papel na equipe, limites de nome,
  `items_mismatch`/`item_not_in_setlist`), `execute` revogado de
  `public`/`anon` e liberado só para `authenticated`. ✔
- **Achado (corrigido)**: o `revoke`/`grant` de `reorder`/`create_team` usava
  assinatura inexistente `create_team(uuid, text)`; o correto é
  `create_team(text, text)` (p_name text, p_display_name text). Sem a correção,
  a execução do 0002 abortava nesse ponto e o `create_team` ficava com
  EXECUTE padrão (PUBLIC). Corrigido no próprio 0002.
- **Índice `team_members_single_owner`** garante no máximo um dono por equipe. ✔
- **Ordem das migrations**: 0001 antes de 0002 (helpers/RPCs referenciam as
  tabelas). O 0002 e idempotente (drop policy if exists / create or replace).

Pendência (fora do escopo estático): validar no Supabase real que as RPCs
rejeitam chamadas anônimas e que a matriz acima se cumpre com dois usuários
de verdade (S1 completo).

### S2 — Editor com preview (US2 / SC-004)

1. Como editor/dono: `/cifra/nova` → cole uma cifra com `[Am]` inline e
   `{key: G}` → **esperado**: preview ao vivo com acordes acima da letra.
2. Salve sem título → **esperado**: bloqueio com erro de campo obrigatório.
3. Salve completa → aparece em `/biblioteca`; edite e confirme atualização;
   exclua com confirmação → some da biblioteca e dos setlists.

### S3 — Biblioteca, busca, visualizador (US3 / SC-005/006)

1. Cadastre 3+ cifras com temas distintos → filtre por tema; busque por
   parte do título e do artista.
2. Abra uma cifra → transponha +2 / −1 → acordes mudam, texto-fonte não
   (edite a cifra e confirme conteúdo original intacto).
3. Ajuste a fonte (maior/menor) mantendo alinhamento; alterne claro/escuro
   (e verifique seguir o SO quando em "sistema").

### S4 — Setlists e modo tocar (US4 / SC-007)

1. Crie setlist com data → adicione 3 músicas → reordene arrastando →
   recarregue: ordem persistida.
2. Transponha um item (+2) → feche e reabra: desvio mantido.
3. Duplique o setlist → mude a cópia → original intacto.
4. Modo tocar: navegue próxima/anterior com tom salvo por item.

### S5 — PWA e offline (US5 / SC-008)

1. Desktop Chrome: instale pelo ícone da barra de endereço → abre em janela
   própria com ícone/nome do app.
2. Abra 2 cifras e 1 setlist → DevTools → Network → Offline → navegue:
   conteúdo já aberto continua legível; criar/editar avisa que exige
   conexão e preserva o texto digitado.
3. iOS Safari (se disponível): Compartilhar → Adicionar à Tela de Início →
   ícone PNG correto (apple-touch).

## 4. Deploy

1. `npm run build` sem erros + `npm test` verde.
2. Vercel (primário): importe o repo, framework Vite, adicione as env vars
   do passo 2.4 → deploy. Netlify: `netlify.toml` equivalente já no repo.
3. Após o deploy, repita S1..S5 no domínio publicado.

## 5. Critério de aceite final

Todos os cenários S1–S5 passam no ambiente implantado + `npm test` verde +
lint limpo (`npm run lint`) + duas equipes sem qualquer vazamento cruzado
(SC-003).

## 6. Evidências de validação automática (T054, 2026-11-13)

Executado no repositório (Node 26, Linux), sem credenciais Supabase:

- `npm run lint` — **limpo** (zero erros).
- `npm test` — **129/129 testes passando** (8 arquivos: parser, transpõe,
  render, temas, filter, posições, limites de desvio…).
- `npm run build` — **verde**; PWA gerado (`precache 18 entries`,
  `dist/sw.js` + `workbox-*.js`).
- `npm run icons` — declarado e disponível; ícones PNGs presentes em
  `public/icons/` (192/512/maskable/apple-touch).
- Artefatos do roteiro conferidos: migrations 0001/0002,
  `supabase/seed_sample_songs.sql`, `.env.example` (modo /setup sem
  credenciais), `netlify.toml` (SPA fallback + cache headers), README.
- Revisão estática de RLS/RPCs (seção S1b) — 1 achado corrigido.
- Rotas `/biblioteca`, `/cifra/*`, `/setlists`, `/setlist/:id`,
  `/setlist/:id/tocar` cabeados com guards de papel; UI esconde controles
  de escrita para membros (FR-029); bloqueio efetivo é do RLS.

**Não automatizável aqui** (exige projeto Supabase real + deploy):
S1 (duas equipes/convites), S1b (negativa via SQL), S2–S5 (preview, offline
real), PWA instalado (Chrome/iOS). Esses passos ficam com o dono do projeto
no domínio publicado. Nenhuma informação foi simulada como executada.
