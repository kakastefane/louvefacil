# Louve Fácil Constitution

Constituição do projeto Louve Fácil — PWA multiplataforma para equipes de
louvor compartilharem cifras e letras padronizadas. Fonte primária de
contexto: `.docs/louve-facil-arquitetura.md`.

## Core Principles

### I. O banco nega, não a aplicação (RLS obrigatória)

Isolamento entre equipes é garantido por Row Level Security no Postgres.
A aplicação NUNCA decide sozinha quem vê o quê: toda tabela multi-equipe
(`songs`, `setlists`, `setlist_items`, `invites`, `team_members`, `teams`)
deve ter políticas RLS — `select` apenas para membros da própria equipe;
`insert/update/delete` apenas para dono/editor, com as exceções próprias de
`teams`/`team_members` (dono gerencia). Toda mudança de acesso exige revisão
das políticas RLS correspondentes. Racional: qualquer falha de UI não vaza
dados entre equipes; a última linha de defesa está no banco.

### II. Sem backend próprio

O SPA (React + TypeScript) fala diretamente com o Supabase (Postgres + Auth
+ Storage) via SDK JS. Não há API intermediária própria: regra de acesso no
banco (RLS), regra de negócio no cliente. Edge Functions só entram quando
estritamente necessário (ex.: importação por link) e permanecem fora do
escopo do MVP. Racional: menos superfície de deploy e custo zero.

### III. Offline-first na leitura

O service worker (vite-plugin-pwa) mantém o app shell; cifras e setlists já
abertos ficam em IndexedDB (Dexie). A leitura DEVE funcionar sem conexão
para dados previamente abertos; a escrita exige conexão (aceitável no MVP).
O app DEVE ser instalável como PWA (manifest + ícones). Racional: músico lê
cifra no palco/culto mesmo sem sinal.

### IV. Transposição é render, não dado

O texto-fonte ChordPro de uma cifra NUNCA é alterado pela transposição. A
transposição é calculada na renderização (escolhendo sustenidos ou bemóis
conforme a tonalidade) e o desvio (`+2`, `-1`, `0`) é salvo apenas no item
do setlist. A fonte da verdade da cifra é `songs.content`. Racional: o
texto original permanece íntegro para qualquer membro, tom e contexto.

### V. Stack fixa e gratuita

Frontend React + TypeScript + Vite; UI Tailwind CSS + shadcn/ui (componentes
no repo); backend Supabase (Postgres + Auth + RLS + Storage); hospedagem
Vercel ou Netlify com deploy automático do GitHub; PWA via vite-plugin-pwa;
cache de dados via Dexie (IndexedDB); formato de cifra ChordPro
(`[Am]` inline) com parser ChordSheetJS (ou parser próprio, se mais simples).
Novas dependências DEVEM se justificar contra esta lista e manter o custo de
infraestrutura em zero.

### VI. PT-BR na interface, inglês no código

Interface e textos visíveis ao usuário em português do Brasil (PT-BR);
identificadores de código, nomes de tabela/coluna, commits e documentação
técnica em inglês. Rotas e rótulos seguem o mapa de telas do documento de
arquitetura. Racional: experiência nativa para a equipe, código
internacionalizável.

### VII. Simplicidade e entrega incremental

Escopo do MVP primeiro: login (e-mail/Google), equipe + convite por link,
biblioteca com busca/temas, editor com preview ao vivo, visualizador com
transposição e fonte ajustável, setlists (reordenar, duplicar), modo tocar,
PWA offline, modo claro/escuro. Recursos pós-MVP (rolagem automática,
importação por link, PDF, gravador, anotações, telão, pedal Bluetooth) ficam
FORA do escopo até que o MVP esteja completo. Catálogo público de cifras
está explicitamente fora de escopo por decisão de produto. Racional: YAGNI;
entregar valor usável cedo.

## Requisitos de Segurança e Privacidade

- Cifras e setlists são conteúdo privado da equipe: nada é exposto
  publicamente (sem catálogo público, sem compartilhamento anônimo).
- Convites são revogáveis e têm expiração (`expires_at`, `revoked`).
- Um usuário PODE pertencer a várias equipes; o app exige seletor de equipe
  e nunca mistura dados de equipes diferentes em uma mesma sessão.
- Direitos autorais: cifras permanecem em área privada da equipe (uso
  interno), sem distribuição pública.
- Credenciais Supabase ficam apenas em variáveis de ambiente
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); a anon key é pública por
  design, mas as políticas RLS são o que protege os dados.

## Fluxo de Desenvolvimento e Qualidade

- Commits pequenos e descritivos; uma tarefa por vez quando o trabalho for
  feito com agentes de IA.
- Antes de cada PR: rodar lint e build/preview local sem erros.
- Toda mudança de acesso (novas políticas RLS, papéis, convites) passa por
  revisão dedicada das políticas antes do merge.
- Cada fase do roteiro (Alicerce, Núcleo, Repertório, PWA) tem critério de
  "pronto quando" definido no documento de arquitetura e deve ser validado
  contra ele antes de avançar.
- Migrações de banco vivem no repositório (SQL versionado, incluindo as
  políticas RLS) para que o schema seja reprodutível.

## Governance

- Esta constituição se sobrepõe a outras práticas e documentos do projeto;
  conflitos são resolvidos em favor dela.
- Emendas exigem: registro da mudança, incremento de versão semântico
  (MAJOR: remoção/redefinição incompatível de princípio; MINOR: novo
  princípio ou seção; PATCH: esclarecimento), e atualização de
  `Last Amended`.
- Revisões de compliance (RLS, privacidade, escopo) são feitas a cada PR que
  tocar acesso a dados ou a stack fixa.
- Documentos vivos (ex.: arquitetura) podem evoluir, mas DEVEM permanecer
  coerentes com esta constituição.

**Version**: 1.0.0 | **Ratified**: 2026-11-11 | **Last Amended**: 2026-11-11
