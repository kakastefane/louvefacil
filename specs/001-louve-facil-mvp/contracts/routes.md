# Contract: Rotas e guards da UI

**Feature**: `001-louve-facil-mvp` | **Date**: 2026-11-11

Mapa de rotas (interface PT-BR, identificadores em inglês). Estende o mapa do
documento de arquitetura com `/convite/:code` (aceite de convite) e
`/recuperar-senha` (FR-004). Guardas de UI são conveniência; a autoridade de
acesso é o RLS (Princípio I).

| Rota | Tela (PT-BR) | Guard | Papéis |
| --- | --- | --- | --- |
| `/setup` | Projeto não configurado (sem env do Supabase) | — | — |
| `/login` | Entrar / Criar conta (alternância na mesma tela) | sem sessão | — |
| `/recuperar-senha` | Recuperar senha (e-mail) + definir nova | sem sessão (definição: com token) | — |
| `/convite/:code` | Aceitar convite (entrar ou cadastrar) | — | — |
| `/equipes` | Seletor de equipes + criar equipe | sessão | todos |
| `/biblioteca` | Biblioteca: lista, busca, filtro por tema | sessão + equipe ativa | todos |
| `/cifra/nova` | Editor de cifra com preview ao vivo | sessão + equipe | editor, dono |
| `/cifra/:id` | Visualizador (transposição, fonte, tema) | sessão + equipe | todos |
| `/cifra/:id/editar` | Editor (mesma tela de `/cifra/nova`) | sessão + equipe | editor, dono |
| `/setlists` | Lista de repertórios | sessão + equipe | todos |
| `/setlist/:id` | Repertório: itens, reordenar, duplicar, tons | sessão + equipe | todos (editar: editor/dono) |
| `/setlist/:id/tocar` | Modo tocar (navegação música a música) | sessão + equipe | todos |
| `/config` | Perfil, membros e convites, aparência | sessão + equipe | todos (gerenciar: dono) |

## Comportamentos de guarda

- Sem sessão em rota protegida → `/login?redirect=<destino>`.
- Sessão sem equipe ativa → `/equipes` (estado vazio oferece criar/entrar).
- Papel insuficiente → tela "Sem permissão" com explicação do papel
  necessário (não redireciona para fora).
- Convite válido aberto com sessão → confirmação e entrada direta; sem sessão
  → fluxo de cadastro/entrada com o code preservado.
- 401 (sessão expirou) → `/login` preservando destino.
