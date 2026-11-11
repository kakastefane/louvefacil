# Contract: Supabase Schema & API

**Feature**: `001-louve-facil-mvp` | **Date**: 2026-11-11

Contrato externo entre o SPA e o banco. Tipos TypeScript do cliente derivam
desta superfície (ver `src/types/` na implementação). Detalhes de colunas:
[data-model.md](../data-model.md).

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | URL do projeto (obrigatória em runtime) |
| `VITE_SUPABASE_ANON_KEY` | chave anônima (obrigatória em runtime; proteção = RLS) |

Ausentes → app entra em modo "não configurado" (tela de setup, sem crash).

## Tabelas (schema `public`)

`teams`, `team_members`, `invites`, `songs`, `setlists`, `setlist_items` —
conforme [data-model.md](../data-model.md). Índices exigidos:
`songs(team_id)`, `setlists(team_id)`, `team_members(user_id)`,
`unique(team_id, user_id)` em `team_members`, `unique(code)` em `invites`,
`unique(team_id) where role='owner'` em `team_members`,
`unique(setlist_id, song_id)` e `unique(setlist_id, position) deferrable`
em `setlist_items`. Triggers `set_updated_at` em `songs` e `setlists`.

## RPC (SECURITY DEFINER, `search_path = public`)

| Função | Entrada | Saída / efeito |
| --- | --- | --- |
| `create_team` | `p_name text, p_display_name text` | `uuid` (team_id); insere equipe + vínculo `owner` do chamador atômicos (único caminho de criação; `team_members` não aceita insert direto) |
| `join_team_with_code` | `p_code text, p_display_name text` | `uuid` (team_id) ou erro `invalid_code` / `expired_code` / `revoked_code`; idempotente se já membro |
| `update_member_role` | `p_member_id uuid, p_role text` | ok; erro se chamador não é dono, alvo é dono ou role inválida |
| `remove_member` | `p_member_id uuid` | ok; erro se chamador não é dono ou alvo é o dono |
| `leave_team` | `p_team_id uuid` | ok; erro se chamador é o dono |
| `reorder_setlist` | `p_setlist_id uuid, p_ordered_item_ids uuid[]` | renumera `position` 1..n atomicamente |
| `duplicate_setlist` | `p_setlist_id uuid, p_new_name text` | `uuid` do novo setlist com itens/ordem/`transpose` copiados |

## Auth (Supabase Auth, e-mail/senha)

| Operação | API |
| --- | --- |
| Cadastro | `signUp({ email, password, options: { data: { name } } })` |
| Login | `signInWithPassword({ email, password })` |
| Recuperar senha | `resetPasswordForEmail(email)` + `updateUser({ password })` |
| Sessão | `getSession()` / `onAuthStateChange()` (persistida pelo SDK) |
| Logout | `signOut()` + limpeza do cache Dexie |

Confirmação de e-mail segue a configuração do projeto Supabase (default:
habilitada; `quickstart.md` cobre os dois casos).

## Erros de API e UX

| Condição | Expectativa no app |
| --- | --- |
| `42501` / violação de RLS | mensagem "Você não tem permissão" (PT-BR), sem detalhes internos |
| RPC `invalid_code`/`expired_code`/`revoked_code` | tela de convite inválido com CTA para pedir novo link |
| Rede indisponível na escrita | banner/aviso "Sem conexão — a alteração exige internet", texto digitado preservado |
| Sessão expirada (401) | redireciona para `/login` preservando destino original |
