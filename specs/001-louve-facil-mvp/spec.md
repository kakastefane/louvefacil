# Feature Specification: MVP do Louve Fácil

**Feature Branch**: `001-louve-facil-mvp`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "PWA multiplataforma para equipes de louvor compartilharem cifras e letras padronizadas. Cada membro da equipe se cadastra (e-mail ou Google), cria ou entra em uma equipe via link de convite, e donos/editores cadastram as cifras padronizadas (título, tom, temas, letra com acordes). Todos os membros acessam a biblioteca e os setlists da equipe no navegador ou pelo app instalado (PWA), com leitura offline dos dados já abertos. Inclui editor de cifra com preview ao vivo, visualizador com transposição e fonte ajustável, setlists com reordenação e duplicação, modo 'tocar' para navegar entre músicas do repertório, modo claro/escuro. Membros de outras equipes não têm acesso aos dados — nem por busca, nem por link direto. Escopo definido em `.docs/louve-facil-arquitetura.md`."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acesso à equipe e isolamento de dados (Priority: P1)

Um músico se cadastra no aplicativo (e-mail e senha ou conta Google), cria uma equipe — tornando-se o **dono** — e convida colegas compartilhando um link de convite (com expiração) por WhatsApp. O convidado abre o link, se cadastra e entra na equipe. Cada pessoa tem um papel: dono (gerencia membros e convites), editor (cria/edita cifras e setlists) ou membro (apenas visualiza). Um usuário pode participar de várias equipes e alternar entre elas. Nenhuma equipe consegue ver os dados de outra — nem buscando, nem abrindo links diretos de conteúdo alheio.

**Why this priority**: É a fundação de todo o produto: sem cadastro, equipe e isolamento, nenhuma outra função tem valor — as cifras são conteúdo privado e colaborativo por equipe. É também o diferencial competitivo declarado (colaborativo por equipe).

**Independent Test**: Pode ser testado criando duas contas e duas equipes separadas: um usuário da equipe A tenta acessar (via busca ou link direto) o conteúdo da equipe B e deve receber acesso negado; já o convidado por link da equipe A vê a biblioteca dela. Entrega o valor "meu conteúdo é só da minha equipe".

**Acceptance Scenarios**:

1. **Given** um visitante na tela de login, **When** ele se cadastra com e-mail e senha válidos, **Then** uma conta é criada e ele entra no aplicativo, vendo a opção de criar equipe ou entrar em uma existente.
2. **Given** um usuário autenticado sem equipe, **When** ele cria uma equipe com um nome, **Then** ele se torna dono dessa equipe e o app passa a exibi-la como equipe ativa.
3. **Given** um dono de equipe, **When** ele gera um link de convite com validade e o compartilha, **Then** qualquer pessoa que abrir o link, se cadastrar/entrar e aceitar, passa a fazer parte da equipe como membro.
4. **Given** um usuário que já pertence a duas equipes, **When** ele usa o seletor de equipes, **Then** ele alterna a equipe ativa e vê apenas o conteúdo (biblioteca, setlists) da equipe selecionada.
5. **Given** um membro da equipe A, **When** ele tenta acessar uma cifra da equipe B por link direto ou busca, **Then** o acesso é negado e a cifra não aparece em nenhum resultado.
6. **Given** um dono de equipe, **When** ele revoga um convite ou remove um membro, **Then** o link revogado deixa de funcionar e o membro removido perde o acesso ao conteúdo da equipe.
7. **Given** um convite com prazo expirado, **When** alguém abre o link, **Then** o sistema informa que o convite é inválido/expirado e oferece contactar o dono da equipe.

---

### User Story 2 - Cifra padronizada com preview ao vivo (Priority: P2)

Um dono ou editor cadastra a cifra oficial de uma música da equipe: título, artista (opcional), tom original (opcional), temas (opcional, ex. "adoração", "natal") e a letra com acordes escritos em formato padronizado (acordes entre colchetes, posicionados antes da sílaba, com metatags no topo). Enquanto digita, ele vê ao lado a pré-visualização renderizada, com os acordes exibidos acima da letra — exatamente como o músico lerá depois. O texto-fonte digitado permanece intacto como fonte única da verdade.

**Why this priority**: O conteúdo da biblioteca é o coração do produto; sem cifras cadastradas não há nada para ler, buscar ou tocar. Vem logo após o acesso à equipe porque depende dela.

**Independent Test**: Pode ser testado por um editor digitando uma cifra de exemplo com acordes no formato colchete e conferindo se a pré-visualização exibe acordes sobre a letra em tempo real; ao salvar, a cifra aparece na biblioteca da equipe. Entrega o valor "cifra única e padronizada da equipe".

**Acceptance Scenarios**:

1. **Given** um editor na tela de nova cifra, **When** ele digita a letra com acordes entre colchetes e metatags de título e tom, **Then** a pré-visualização ao vivo renderiza os acordes acima das sílabas correspondentes, atualizando a cada digitação.
2. **Given** um editor preenchendo o formulário de cifra, **When** ele salva com título e conteúdo preenchidos, **Then** a cifra é gravada e aparece na biblioteca da equipe com título, artista, tom e temas informados.
3. **Given** um editor tentando salvar uma cifra sem título ou sem conteúdo, **When** ele confirma, **Then** o sistema impede o salvamento e indica os campos obrigatórios.
4. **Given** uma cifra existente, **When** um editor a edita (ajusta acordes, corrige letra), **Then** a versão atualizada substitui a anterior para toda a equipe e a fonte da cifra permanece o texto editado.
5. **Given** uma cifra existente, **When** um editor a exclui, **Then** ela sai da biblioteca e de qualquer setlist que a contenha, com confirmação prévia.
6. **Given** um membro (papel somente leitura), **When** ele abre a biblioteca ou uma cifra, **Then** ele não vê opções de criar, editar ou excluir.

---

### User Story 3 - Leitura confortável: biblioteca, busca e visualizador (Priority: P3)

Um membro abre a biblioteca da equipe, vê todas as cifras com título, artista, tom e temas, busca por título/artista e filtra por tema. Ao abrir uma cifra, ele lê no visualizador: acordes renderizados acima da letra, transposição de tom em tempo real (sem alterar o texto original), ajuste de tamanho de fonte e modo claro/escuro — tudo pensado para leitura no ensaio e no palco.

**Why this priority**: É o uso diário do músico (encontrar e ler a cifra). Depende de haver cifras cadastradas (US2), mas independe de setlists.

**Independent Test**: Pode ser testado cadastrando algumas cifras com temas variados, buscando por termo parcial do título, filtrando por tema, transpondo ±N semitons e variando a fonte; o texto-fonte não muda. Entrega o valor "qualquer um encontra e lê a cifra no tom certo".

**Acceptance Scenarios**:

1. **Given** uma biblioteca com cifras, **When** um membro busca por parte do título ou do artista, **Then** a lista mostra apenas as cifras correspondentes, dentro da própria equipe.
2. **Given** cifras com temas atribuídos, **When** um membro seleciona um tema, **Then** a lista mostra apenas as cifras daquele tema.
3. **Given** uma cifra aberta no visualizador, **When** o membro aumenta ou diminui a transposição, **Then** os acordes exibidos mudam de tom imediatamente e o texto original da cifra permanece inalterado para a equipe.
4. **Given** uma cifra aberta no visualizador, **When** o membro ajusta o tamanho da fonte, **Then** a letra e os acordes ficam maiores/menores mantendo o alinhamento acorde–sílaba.
5. **Given** o aplicativo em uso, **When** o membro alterna o tema visual (ou o sistema operacional está em modo escuro), **Then** todas as telas respeitam o modo claro/escuro escolhido.
6. **Given** uma cifra transposta em um semitom que reutiliza o mesmo nome (ex. B# / C), **When** a transposição é aplicada, **Then** o sistema escolhe nomes de acordes válidos e legíveis (sustenidos ou bemóis conforme o tom de referência).

---

### User Story 4 - Setlists e modo tocar (Priority: P4)

Um dono/editor monta o repertório de um culto: cria um setlist com nome e data do evento, adiciona músicas da biblioteca da equipe e as reordena por arrastar. Ele duplica um setlist para reutilizar num próximo evento. Cada música no setlist guarda um desvio de transposição próprio (ex. `+2`), ajustado no momento, sem alterar a cifra original. No modo "tocar", o músico navega de música em música do setlist (próxima/anterior), cada uma já renderizada no tom salvo.

**Why this priority**: É o fluxo do evento (ensaio/culto) e consolida o valor do produto: "um culto inteiro cabe num setlist navegável com os tons ajustados". Depende de cifras (US2), mas independe dos demais fluxos.

**Independent Test**: Pode ser testado criando um setlist com 3 músicas, reordenando por arrastar, transpondo uma delas, duplicando o setlist e navegando no modo tocar conferindo os tons. Entrega o valor "repertório organizado e navegável no palco".

**Acceptance Scenarios**:

1. **Given** um editor na tela de setlists, **When** ele cria um setlist com nome e data do evento, **Then** o setlist aparece na lista da equipe, vazio, pronto para receber músicas.
2. **Given** um setlist aberto por um editor, **When** ele adiciona músicas da biblioteca e reordena arrastando, **Then** a ordem exibida é persistida e mantida para todos os membros.
3. **Given** um item de setlist, **When** o editor ajusta a transposição daquele item, **Then** o desvio é salvo no item (não na cifra) e é reaplicado sempre que o setlist for aberto.
4. **Given** um setlist existente, **When** o editor o duplica, **Then** uma cópia independente é criada com os mesmos itens, ordem e transposições, e alterações na cópia não afetam o original.
5. **Given** um setlist com pelo menos uma música, **When** um membro entra no modo tocar, **Then** ele vê a primeira música renderizada no tom salvo do item e navega para a próxima/anterior sem voltar à lista.
6. **Given** um setlist sem músicas, **When** alguém entra no modo tocar, **Then** o sistema orienta adicionar músicas antes de usar o modo.
7. **Given** um membro (papel somente leitura), **When** ele abre um setlist, **Then** ele pode visualizar, usar o modo tocar e ajustar a fonte, mas não pode criar, reordenar, duplicar nem alterar transposições.

---

### User Story 5 - App instalável e leitura offline (Priority: P5)

O músico instala o aplicativo no celular/tablet/desktop (PWA: "Adicionar à Tela de Início" no iPhone, instalação no Android/Chrome). Depois de abrir uma cifra ou setlist com conexão, ele consegue reler esse conteúdo sem internet — no ensaio com sinal ruim ou no palco. A escrita (criar/editar) exige conexão, e o app comunica isso claramente quando offline.

**Why this priority**: É o diferencial de uso real no palco, mas o app já entrega valor completo com conexão; offline aperfeiçoa a experiência de leitura.

**Independent Test**: Pode ser testado instalando o app num dispositivo, abrindo algumas cifras, desligando a internet e conferindo que o app abre (app shell) e as cifras/setlists já abertos são lidos, enquanto criar/editar mostra aviso de que exige conexão. Entrega o valor "leitura garantida sem sinal".

**Acceptance Scenarios**:

1. **Given** o app acessado por navegador compatível, **When** o usuário opta por instalar, **Then** o app é instalado com ícone próprio e abre em janela/aba própria, sem barra de navegador.
2. **Given** cifras e setlists já abertos anteriormente com conexão, **When** o usuário abre o app sem internet, **Then** o app carrega e o conteúdo já aberto continua legível.
3. **Given** o usuário offline, **When** ele tenta criar ou editar uma cifra/setlist, **Then** o sistema informa claramente que a escrita exige conexão e não perde o que foi digitado na tela atual.
4. **Given** um conteúdo nunca aberto antes, **When** o usuário está offline, **Then** o sistema informa que aquele conteúdo não está disponível offline e sugerirá abri-lo com conexão.

---

### Edge Cases

- O que acontece quando o dono da equipe é removido como membro ou quer sair? No MVP, o dono não pode remover a si mesmo nem sair da equipe sem antes excluir a equipe (transferência de dono fica fora do escopo).
- O que acontece quando a última cifra de um setlist é excluída da biblioteca? O item correspondente é removido do setlist, mantendo a ordem dos demais.
- Como o sistema lida com cifras sem acordes (só letra)? Deve renderizar apenas a letra, sem quebrar a visualização.
- Como o sistema lida com acordes desconhecidos ou malformados no formato? Deve exibi-los como texto (acima da letra) sem interromper a renderização do restante.
- O que acontece quando dois editores editam a mesma cifra simultaneamente? A última gravação prevalece; o MVP não exige edição colaborativa em tempo real.
- O que acontece quando a conexão cai no meio de um salvamento? O sistema informa o erro e preserva o texto digitado na tela para nova tentativa.
- O que acontece quando um convite é aberto por quem já é membro da equipe? O sistema informa que ele já participa daquela equipe.
- O que acontece quando um membro com papel alterado (ex. editor → membro) está com o app aberto? Na próxima interação de escrita, o sistema nega e informa a falta de permissão.
- Busca sem resultados ou filtros que zeram a lista? Exibir estado vazio amigável com sugestão de limpar filtros.
- Nomes de tema duplicados ou com maiúsculas/minúsculas diferentes? O sistema agrupa temas equivalentes ignorando maiúsculas/minúsculas e espaços extras.

## Requirements *(mandatory)*

### Functional Requirements

**Acesso e perfil**

- **FR-001**: O sistema MUST permitir que um visitante crie uma conta informando e-mail e senha.
- **FR-002**: O sistema MUST permitir entrada com conta Google (login social), além do e-mail/senha.
- **FR-003**: O sistema MUST permitir que o usuário encerre a sessão, e MUST mantê-la válida entre visitas até o logout.
- **FR-004**: O sistema MUST oferecer recuperação de senha por e-mail para contas de e-mail/senha.

**Equipes, papéis e convites**

- **FR-005**: O sistema MUST permitir que um usuário autenticado crie uma equipe informando um nome; quem cria torna-se dono.
- **FR-006**: O sistema MUST suportar três papéis com permissões distintas — dono (tudo + gerenciar membros e convites), editor (criar/editar cifras e setlists) e membro (apenas visualizar).
- **FR-007**: O dono MUST poder gerar um link de convite com código e prazo de expiração, compartilhável por qualquer aplicativo de mensagem.
- **FR-008**: O sistema MUST permitir que quem abrir um convite válido, já autenticado ou ao se cadastrar, entre na equipe como membro.
- **FR-009**: O dono MUST poder revogar convites pendentes e remover membros da equipe; convites expirados ou revogados MUST deixar de funcionar.
- **FR-010**: O sistema MUST garantir que membros de uma equipe NUNCA acessem dados (cifras, setlists, membros) de outra equipe — nem por busca, nem por link direto; o acesso MUST ser negado na camada de dados, não apenas na interface.
- **FR-011**: O sistema MUST permitir que um usuário participe de várias equipes e MUST exibir claramente a equipe ativa, com seletor para alternar.
- **FR-012**: O sistema MUST exibir, para usuário autenticado sem equipe, um fluxo claro de "criar equipe" ou "entrar via convite".
- **FR-013**: O dono MUST poder alterar o papel de um membro entre editor e membro; o número de donos por equipe é um (sem transferência no MVP).

**Cifras**

- **FR-014**: Editores MUST poder cadastrar cifras com título (obrigatório), artista (opcional), tom original (opcional), temas (opcional, lista de etiquetas) e letra com acordes (obrigatório) no formato padronizado com acordes entre colchetes antes da sílaba e metatags no topo.
- **FR-015**: O sistema MUST tratar o texto-fonte da cifra como fonte única da verdade: nenhuma operação de visualização ou transposição pode alterá-lo.
- **FR-016**: O editor MUST exibir pré-visualização ao vivo da cifra renderizada (acordes acima da letra) durante a digitação.
- **FR-017**: O sistema MUST renderizar a cifra em grade de duas linhas (acorde sobre a sílaba) preservando o posicionamento dos acordes.
- **FR-018**: O sistema MUST permitir busca de cifras por título e artista, e filtro por tema, restritas à equipe ativa.
- **FR-019**: Editores MUST poder editar e excluir cifras da equipe; exclusão exige confirmação e remove a cifra de setlists existentes.
- **FR-020**: Membros MUST poder visualizar toda a biblioteca da equipe ativa, com estado vazio amigável quando não houver cifras.

**Visualizador**

- **FR-021**: O visualizador MUST aplicar transposição em tempo real aos acordes exibidos, escolhendo sustenidos ou bemóis conforme o tom de referência, sem alterar o texto original.
- **FR-022**: O visualizador MUST permitir ajuste do tamanho da fonte, mantendo o alinhamento acorde–sílaba.
- **FR-023**: O sistema MUST suportar modo claro e escuro, respeitando a preferência do sistema operacional e permitindo alternância manual.

**Setlists e modo tocar**

- **FR-024**: Editores MUST poder criar setlists com nome (obrigatório) e data do evento (opcional).
- **FR-025**: Editores MUST poder adicionar músicas da equipe a um setlist e reordenar os itens por arrastar e soltar, com a ordem persistida.
- **FR-026**: O sistema MUST permitir salvar um desvio de transposição (ex. `+2`, `-1`, `0`) por item do setlist, sem alterar a cifra original, e reaplicá-lo ao abrir o setlist.
- **FR-027**: Editores MUST poder duplicar um setlist, criando cópia independente (itens, ordem e transposições).
- **FR-028**: O sistema MUST oferecer o modo "tocar" para membros navegarem de música em música do setlist (próxima/anterior), cada uma renderizada com a transposição salva do item, sem voltar à lista entre músicas.
- **FR-029**: Membros MUST poder visualizar os setlists da equipe e usar o modo tocar; apenas donos/editores podem criar, reordenar, duplicar ou alterar transposições.

**Uso offline (PWA)**

- **FR-030**: O sistema MUST ser instalável como aplicativo (PWA) em celulares, tablets e desktops, com ícone e nome próprios.
- **FR-031**: O sistema MUST manter legível offline todo conteúdo (cifras e setlists) previamente aberto pelo usuário naquele dispositivo, incluindo o app shell para abertura sem rede.
- **FR-032**: O sistema MUST indicar claramente quando uma ação de escrita não pode ser concluída por falta de conexão, preservando o conteúdo digitado na tela atual para nova tentativa.
- **FR-033**: O sistema MUST comunicar, para conteúdo nunca aberto, que ele não está disponível offline, incentivando abri-lo com conexão.

### Key Entities *(include if feature involves data)*

- **Usuário (User)**: pessoa autenticada; identifica-se por e-mail (e/ou conta Google); pode pertencer a várias equipes com papéis distintos em cada uma.
- **Equipe (Team)**: grupo colaborativo com nome; criada por um usuário que se torna seu dono; unidade de isolamento de todo o conteúdo.
- **Membro de Equipe (TeamMember)**: vínculo entre usuário e equipe com papel (`dono`, `editor`, `membro`); único por par equipe–usuário.
- **Convite (Invite)**: código único por equipe, com prazo de expiração e possibilidade de revogação; usado para ingressar na equipe.
- **Cifra (Song)**: música da equipe com título, artista opcional, tom original opcional, lista de temas e o texto-fonte letra+acordes (formato com acordes entre colchetes); pertence a exatamente uma equipe; é a fonte única da verdade do conteúdo.
- **Setlist**: repertório da equipe com nome e data opcional; contém itens ordenados.
- **Item de Setlist (SetlistItem)**: referência a uma cifra dentro de um setlist, com posição (ordem) e desvio de transposição próprio; a transposição exibida = cifra renderizada + desvio do item.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um novo usuário conclui cadastro, criação de equipe e entrada nela em menos de 3 minutos, sem ajuda externa.
- **SC-002**: Um convidado abre o link de convite, se cadastra e visualiza a biblioteca da equipe em menos de 2 minutos.
- **SC-003**: Em teste com duas equipes distintas, 100% das tentativas de acesso cruzado (busca e link direto) são negadas na camada de dados.
- **SC-004**: Um editor cadastra uma cifra típica (2–3 estrofes com acordes) com preview ao vivo em menos de 10 minutos.
- **SC-005**: Um músico encontra qualquer cifra da equipe por busca ou filtro de tema em menos de 10 segundos.
- **SC-006**: Um músico transpõe uma cifra e ajusta a fonte em menos de 5 segundos usando no máximo 5 toques.
- **SC-007**: Um repertório de até 15 músicas é navegável no modo tocar com tons salvos, com troca de música percebida como instantânea (menos de 1 segundo).
- **SC-008**: Com o app instalado e o conteúdo previamente aberto, a leitura offline de uma cifra inicia em menos de 3 segundos sem rede.
- **SC-009**: 100% das telas do MVP são utilizáveis em celular (a partir de ~360 px de largura) e desktop, com a mesma funcionalidade.
- **SC-010**: Membros de equipes relatam a experiência como "achar e ler a cifra do culto em um lugar só" em testes com pelo menos uma equipe real.

## Assumptions

- Login com Google depende de credenciais OAuth configuradas no ambiente de implantação; o cadastro por e-mail/senha funciona independentemente e é o caminho garantido.
- A escrita (criar/editar) exige conexão; apenas a leitura funciona offline (decisão de escopo do MVP).
- Prazo padrão de expiração de convites: 7 dias, alterável pelo dono ao gerar o convite.
- Por padrão, a transposição exibe acordes com sustenidos ou bemóis conforme o tom de referência da música (bemóis preferidos em tons de bemol); não há preferência global por usuário no MVP.
- Temas são etiquetas livres digitadas pelo editor (sem catálogo fixo); o sistema agrupa variantes equivalentes ignorando maiúsculas/minúsculas.
- Edição colaborativa simultânea não é exigida: se dois editores salvam a mesma cifra, a última gravação prevalece.
- Não há transferência de dono nem exclusão de equipe no MVP (ficam para pós-MVP); o dono é o único dono da equipe.
- Interface e textos em PT-BR; os dados digitados (títulos, letras, temas) ficam exatamente como o usuário escreve.
- O uso de uma equipe cabe nos níveis gratuitos dos serviços de infraestrutura (sem custos para o MVP).
- Cifras permanecem privadas à equipe (uso interno), sem qualquer catálogo ou distribuição pública.
