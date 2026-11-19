---
name: Cifras Louve Fácil (ChordPro)
description: Converte cifras de sites (ex. Cifra Club) para o formato ChordPro adaptado do Louve Fácil — seções em badges, acordes inline alinhados à sílaba e metadados validados — e cadastra na biblioteca da equipe. Use ao criar, importar, converter ou revisar cifras.
---

# Cifras no Louve Fácil

Você converte cifras de sites públicos para o formato do Louve Fácil e as
cadastra na biblioteca da equipe ativa. Todo o texto (rótulos, mensagens e
relatório) deve estar em **português do Brasil**.

## Princípios inegociáveis

1. **O conteúdo salvo é a fonte única da verdade.** Nunca salve uma versão
   transposta: o app transpõe apenas na exibição. Guarde sempre a cifra no tom
   original.
2. **Nunca invente.** Não complete versos, acordes ou seções que não estão na
   fonte. Se a fonte estiver truncada, pare e reporte.
3. **Nunca duplique.** Antes de criar, verifique se a música já existe na
   biblioteca da equipe.
4. **Sem lixo de site.** Remova tablaturas, diagramas, propagandas, avaliações,
   comentários, notas de capotraste e marcas do site.
5. **Só o corpo da cifra vai no conteúdo.** Título, artista e tom ficam nos
   campos do formulário, não em metatags no texto (metatags duplicam o
   cabeçalho do visualizador).

## Contrato de saída

Produza esta estrutura antes de cadastrar:

```json
{
  "title": "Nome da canção",
  "artist": "Artista / ministério",
  "original_key": "G",
  "bpm": null,
  "time_signature": null,
  "themes": ["Adoração"],
  "content": "{section: Intro}\nG  D  Em  C\n\n{section: Verso 1}\n[G]Primeira linha da letra..."
}
```

| Campo            | Regra                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| `title`          | 1–200 caracteres. Só o nome da música (sem “Cifra”, “Simplificada”, “(Oficial)”).         |
| `artist`         | Até 200 caracteres ou `null`. Banda/ministério/compositor; participações especiais cabem aqui. |
| `original_key`   | **Apenas a raiz**: `A`–`G`, com `#` ou `b` opcional. Ex.: `G`, `Bb`, `F#`. Nunca `Am`, `Gmaj`. Se desconhecido, `null`. |
| `bpm`            | Inteiro entre 20 e 400, **somente** se a fonte informar. Não estime. Senão `null`.        |
| `time_signature` | Apenas: `2/4`, `3/4`, `4/4`, `5/4`, `6/4`, `6/8`, `7/8`, `9/8`, `12/8`, `2/2`. Senão `null`. |
| `themes`         | Lista de 0–4 temas. **Reutilize os temas já existentes** da equipe; crie um novo só se nenhum servir. |
| `content`        | 1–20.000 caracteres, só o corpo da cifra (seções, acordes e letra).                     |

### Temas

- Antes de definir, leia os temas existentes (filtro de temas da Biblioteca) e
  use a grafia canônica já cadastrada. O app compara ignorando
  maiúsculas/minúsculas e espaços; mesmo assim, não crie variações.
- Prefira 1–3 temas; nunca mais de 4. Use Title Case em PT-BR, sem plural
  desnecessário (`Natal`, não `Natais`; `Adoração`, não `adoração`).
- Vocabulário de referência: `Adoração`, `Louvor`, `Celebração`, `Consagração`,
  `Santa Ceia`, `Batismo`, `Natal`, `Páscoa`, `Pentecostes`, `Missões`,
  `Infantil`, `Hino`, `Lamentação`, `Instrumental`.

## Formato do conteúdo

O conteúdo é ChordPro **adaptado**. Só existem três tipos de linha:

1. **Seção** — `{section: Rótulo}` (recomendado) ou uma linha com apenas
   `[Rótulo]` (sem letra na mesma linha).
2. **Linha só de acordes** — acordes separados por espaço, **sem colchetes**.
   Ex.: `G  D/F#  Em7  C9`.
3. **Linha de letra** — texto com acordes inline entre colchetes, colados na
   sílaba. Ex.: `[G]Ao raiar da manhã [D/F#]eu quero ouvir`.

Linha em branco separa blocos. Use **uma** linha em branco entre seções.

### Seções (badges)

- Forma recomendada: `{section: Verso 1}` em uma linha isolada, com a letra ou
  os acordes nas linhas seguintes.
- Aliases aceitos: `{sec: …}`, `{secao: …}`, `{seção: …}`. Prefira `{section: …}`.
- Alternativa aceita: `[Intro]` sozinho ou seguido **apenas** de acordes
  (`[Intro] G  D  Em`). Se houver qualquer letra na mesma linha, o rótulo vira
  um acorde literal — **erro**.
- O badge já é exibido em maiúsculas: escreva em caixa normal (`Verso 1`,
  `Refrão`), sem ALL CAPS.
- Vocabulário de rótulos: `Intro`, `Verso 1`, `Verso 2`, `Pré-refrão`, `Refrão`,
  `Refrão final`, `Ponte`, `Solo`, `Instrumental`, `Interlúdio`, `Final`.
- Repetições vão no rótulo: `{section: Refrão (2x)}`. Nunca escreva `[2x]` no
  meio da letra (vira acorde literal).
- Repita a letra do refrão em todas as ocorrências; o formato não tem
  referências (“ver refrão”).

### Acordes inline

- O acorde fica **imediatamente antes** do caractere onde começa a sílaba:
  `[G]Antes`. Não deixe espaço depois de `]` a menos que a sílaba já comece
  com espaço.
- Notação latina obrigatória: raiz `A`–`G` maiúscula, acidente `#` ou `b`,
  sufixo (`m`, `7`, `maj7`, `m7`, `dim`, `aug`, `sus4`, `add9`, `6/9`, `m7(b5)`)
  e baixo opcional (`G/B`, `D/F#`). Use `b`/`#` ASCII, nunca `♭`/`♯`.
- Acordes não reconhecidos são exibidos literalmente e **não transpõem**.
  Evite `N.C.`, `%`, `(2x)`, `|`, `x2` e afins dentro de acordes.
- Vários acordes no mesmo ponto: `[G][D]` na ordem em que soam.

#### Conversão de cifras alinhadas por coluna

Sites costumam trazer a linha de acordes acima da letra, alinhada por coluna
(espaços). Converta assim:

1. Conte os caracteres da linha de letra a partir de 0.
2. Para cada acorde na coluna `c`, insira `[acorde]` imediatamente antes do
   caractere de índice `c` da letra (se `c` passar do fim, anexe ao final).
3. Não “melhore” o alinhamento: o app reproduz exatamente a coluna de inserção.
4. Se a fonte perdeu as colunas (HTML colapsou espaços), ancore o acorde na
   primeira letra da sílaba onde a harmonia muda e registre no relatório que o
   alinhamento foi reconstruído.
5. Converta tabulações em espaços **antes** de calcular as colunas; ao final,
   não pode restar nenhum `\t`.

### Linhas só de acordes

- Use para intro, interlúdios, solo instrumental e final.
- Só acordes válidos separados por espaço. Um token inválido faz a linha
  inteira virar letra.
- Espaçamento extra é irrelevante no render (os acordes são distribuídos
  automaticamente); use um espaço simples entre eles.
- **Nunca** use barras de compasso (`| G | D |`), porcentagens ou parênteses
  nessa linha.

### Letra

- Preserve a ordem, a grafia, os acentos e a pontuação da fonte.
- **Uma linha da fonte = uma linha de letra. Nunca junte versos.** Mesmo que
  caibam na mesma linha, cada verso da fonte continua em sua própria linha:
  `[C]Rei do meu coração [Am]Seja o monte que percorro` é **erro**; o correto é
  `[C]Rei do meu coração` em uma linha e `[Am]Seja o monte que percorro` na
  seguinte.
- Não junte nem quebre versos. Se a fonte estiver sem quebras (letra corrida),
  use as quebras da versão oficial da letra, não as dos períodos.
- Sem indentação no começo da linha (o espaço é renderizado).
- Não use Markdown (`**`, `#`, listas), emojis ou HTML.
- Letra sem acordes é permitida (renderiza só o texto).

## O que remover da fonte

| Na fonte                                          | O que fazer                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| “Capotraste na 2ª casa”                            | Transponha os acordes para o **tom real** (soma do capotraste) e registre no relatório. Não inclua a nota. |
| Tablaturas (`e|---3---|`, diagramas, desenhos)      | Remover. Se o solo tiver harmonia clara, deixe `{section: Solo}` + linha de acordes. |
| “Tom: G”, “Capo: 2”, afinação, batida, ritmo       | Remover (o tom vai no campo `original_key`).                        |
| `{title: …}`, `{artist: …}`, `{key: …}`            | Remover do conteúdo; preencher os campos correspondentes.           |
| `{start_of_chorus}`, `{soc}`, `{comment: …}`       | Converter em `{section: Refrão}` ou remover (diretivas são ignoradas). |
| “Refrão:”, “Intro: G D Em”, “(2x)” como texto      | Converter em seção: `{section: Refrão}`, `{section: Intro}` + acordes, `{section: Refrão (2x)}`. |
| Anúncios, comentários, notas, cifras alternativas  | Remover; escolha **uma** versão.                                    |
| Marcas do site, links, avaliações                  | Remover.                                                            |

### Antes → depois

```text
[G] Antes de me conhecer        →  [G]Antes de me conhecer
{start_of_chorus}               →  {section: Refrão}
Refrão:                         →  {section: Refrão}
[Intro] G D Em C                →  {section: Intro}
                                   G  D  Em  C
[Verso 1] Ao raiar da manhã     →  {section: Verso 1}
                                   Ao raiar da manhã
| G | D | Em |                  →  G  D  Em
G7M  D/F#  A7(4)                →  Gmaj7  D/F#  A7sus4   (preferível)
```

## Procedimento

1. **Fonte**: abra a página da cifra e escolha a versão principal (a mais
   completa e bem avaliada). Ignore versões simplificadas, “playback” e
   transposições do site.
2. **Metadados**: extraia título limpo, artista, tom, BPM e compasso (só quando
   explícitos). Defina 1–4 temas reutilizando os da equipe.
3. **Seções**: identifique intro, versos, pré-refrão, refrão, ponte, solo e
   final na ordem da música.
4. **Acordes**: converta linhas alinhadas para inline por coluna (algoritmo
   acima). Preserve o tom da fonte, salvo capotraste (item anterior).
5. **Fidelidade de linhas** (obrigatório): conte as linhas de letra da fonte e
   da saída — devem ser iguais, descontando apenas tablaturas/anúncios
   removidos. Se a saída tiver menos linhas, você juntou versos: separe cada
   verso na própria linha e reancore os acordes. Confira também cada acorde
   contra a coluna/sílaba original; não redistribua acordes “a olho”.
6. **Limpeza**: aplique a tabela “O que remover”.
7. **Valide** (obrigatório):
   ```bash
   npx vite-node scripts/validate-cifra.ts caminho/para/cifra.json
   ```
   Corrija todos os `ERRO`. Revise cada `AVISO` — em especial linhas longas com
   vários acordes, que costumam indicar versos juntados. Confira a prévia
   impressa: acordes devem cair sobre a sílaba certa e cada seção deve virar um
   badge.
8. **Duplicidade**: procure na biblioteca por título (sem acentos,
   minúsculas) e artista. Se existir, **não crie**; reporte e pare (a menos que
   o pedido seja explicitamente “atualizar”).
9. **Cadastro**: na tela **Nova cifra**, use **Importar JSON** para selecionar o
   arquivo validado — os campos do formulário são preenchidos e você confere
   antes de salvar. Também é possível preencher manualmente. Offline não
   permite escrita.
10. **Conferência no app**: abra a cifra e verifique badges, alinhamento, modo
    cantor (só letra) e transposição ±2. O texto-fonte não pode mudar ao
    transpor.
11. **Relatório final** (fora do conteúdo): título, artista, tom, temas, número
    de seções, fonte usada, capotraste tratado, itens removidos (tabs etc.) e
    dúvidas.

## Checklist final

- [ ] `title` limpo, 1–200; `artist` limpo ou `null`
- [ ] `original_key` só com raiz (`G`, `Bb`, `F#`), coerente com os acordes
- [ ] `bpm`/`time_signature` só quando confiáveis e dentro das listas
- [ ] temas existentes reutilizados, no máximo 4
- [ ] toda seção em `{section: …}` (ou `[Rótulo]` sem letra na linha)
- [ ] nenhuma letra na mesma linha de um rótulo entre colchetes
- [ ] acordes inline colados à sílaba, sem espaço após `]`
- [ ] cada verso da fonte em sua própria linha (nenhuma linha longa com 3+ acordes)
- [ ] linhas só de acordes sem `|`, `%`, `N.C.` ou texto
- [ ] sem metatags de título/artista/tom no conteúdo
- [ ] sem tabs, HTML, entidades HTML, Markdown ou emojis
- [ ] uma linha em branco entre seções
- [ ] `content` ≤ 20.000 caracteres
- [ ] validador sem erros e prévia conferida
- [ ] música não duplicada na biblioteca

## Exemplo completo

`references/cifra-exemplo.json` (letra fictícia, só para demonstração):

```json
{
  "title": "Exemplo — Canção Nova",
  "artist": "Equipe de Louvor",
  "original_key": "G",
  "bpm": null,
  "time_signature": null,
  "themes": ["Adoração", "Celebração"],
  "content": "{section: Intro}\nG  D/F#  Em7  C9\n\n{section: Verso 1}\n[G]Ao raiar da manhã [D/F#]eu quero ouvir\n[Em7]Tua voz me cha[C9]mando a seguir\n\n{section: Refrão}\n[C9]Grande é o Se[G]nhor, [D/F#]digno de lou[Em7]vor\n[C9]Para sempre [D]Te louva[G]rei\n\n{section: Ponte}\n[Am7]Mesmo na tempes[G/B]tade eu vou con[C9]fiar\n[D]Tua promessa não vai fal[G]har\n"
}
```

## Decisões padrão (ajustáveis pelo dono da skill)

- **Capotraste**: converter para o tom real. Se a equipe preferir manter as
  posições com capotraste, use o tom das posições e registre o capotraste no
  relatório.
- **Versões múltiplas**: usar a mais completa; não mesclar versões.
- **BPM/compasso**: nunca estimar; deixar `null`.
- **Tablaturas**: descartar; preservar apenas a harmonia.
- **Duplicidade**: nunca sobrescrever sem pedido explícito.
- **Modo menor**: `original_key` aceita apenas a raiz (`A` para `Am`); o “m”
  aparece nos acordes. Registre o tom completo (ex. `Am`) no relatório.

## Referências no repositório

- `specs/001-louve-facil-mvp/contracts/chordpro-format.md` — contrato do formato.
- `src/features/chords/parser.ts` — gramática realmente aceita.
- `src/features/chords/transpose.ts` — regras de transposição e enarmonia.
- `src/features/songs/service.ts` — limites validados no salvamento.
- `scripts/validate-cifra.ts` — validador usado no passo 6.
