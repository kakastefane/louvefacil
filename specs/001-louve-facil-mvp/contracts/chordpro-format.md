# Contract: Formato de cifra (ChordPro adaptado)

**Feature**: `001-louve-facil-mvp` | **Date**: 2026-11-11

Contrato do conteúdo (`songs.content`) e do seu render. O parser/transpositor
vive em `src/features/chords/` e é puro (sem rede, sem DOM) para permitir
testes de unidade. **O texto-fonte é imutável sob transposição** (Princípio IV
da constituição).

## Gramática aceita

```text
documento    := (metatag | linha_vazia | linha_de_seção | linha_de_acordes | linha_de_letra)*
metatag      := "{" chave ":" valor "}"          # aceitas: title, key, artist
linha_de_seção := "[" rótulo "]" [ conteúdo ]    # ex.: "[Intro] G  D/F#  Em7  C9"
linha_de_letra := ( "[" acorde "]"? caractere )*
acorde       := nota suffix? ["/" nota]?
nota         := ("A"|"B"|"C"|"D"|"E"|"F"|"G") ("#"|"b")?
```

- **Metatags** no topo: `{title: ...}`, `{key: ...}`, `{artist: ...}`.
  `title`/`artist` oficiais são as colunas; a metatag `{key}` serve de tom de
  referência quando a coluna `original_key` estiver vazia.
- **Linha com só `[Rótulo]`** (e opcionalmente acordes soltos em seguida) =
  cabeçalho de seção, estilizado, não é alvo de transposição, exceto os
  acordes soltos após o rótulo (ex. `[Intro] G  D/F#`), que são transpostos.
- **Acordes inline** `[Am]` posicionados imediatamente antes da sílaba:
  render em grade de duas linhas (acorde acima, alinhado à coluna da sílaba).
- **Linhas só de acordes** (ex. pentagrama de introdução): tokens separados
  por espaços são acordes; renderizados na linha de acordes, preservando o
  espaçamento relativo.
- **Acorde malformado** (ex. `[Xy]`): exibido literalmente acima da letra,
  sem transposição e sem quebrar o render (edge case da spec).

## Transposição

- Entrada: `transpose ∈ [-11, +11]` (do item do setlist ou do controle do
  visualizador) e tom de referência (coluna `original_key`, senão metatag
  `{key}`, senão sharp por omissão).
- Raiz e baixo (`/X`) são transpostos módulo 12; **sufixos nunca mudam**
  (`m7`, `maj7`, `dim`, `sus4`, `add9`, `6/9`, …).
- **Enharmonia**: tons de referência em bemol (`F`, `Bb`, `Eb`, `Ab`, `Db`,
  `Gb` e menores correspondentes) usam escala de bemóis; demais, sustenidos.
  Resultado é sempre um nome de acorde válido e legível (ex. de `B#` para `C`).
- Sinal: `transpose = +2` sobe dois semitons (`G → A`); `−1` desce um.

## Render (visualizador)

- Grade de duas linhas por linha com acordes: linha 1 = acordes posicionados
  na coluna da sílaba-alvo; linha 2 = letra.
- Cabeçalho mostra: título, artista, tom exibido (tom original + desvio) e
  temas.
- Controles: transposição (+/−, com indicador `+2`/`0`/`−1`), tamanho da
  fonte (passos discretos), alternância claro/escuro.
