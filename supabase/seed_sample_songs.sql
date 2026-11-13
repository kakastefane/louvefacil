-- ============================================================
-- Louve Fácil — seed_sample_songs.sql (OPCIONAL)
-- 4 cifras de exemplo em ChordPro com temas, para testar o app
-- rapidamente após configurar o Supabase.
--
-- Pré-requisito: sua equipe já criada pelo app (/equipes).
-- O seed usa a PRIMEIRA equipe criada no projeto (created_at mais antigo).
-- Para usar outra equipe, ajuste a cláusula `order by t.created_at limit 1`.
--
-- Sem efeito colateral: só INSERTs; pode ser executado mais de uma vez
-- (cria novas linhas a cada execução).
-- ============================================================

insert into public.songs (team_id, title, artist, original_key, themes, content, created_by)
select t.id, v.title, v.artist, v.original_key, v.themes, v.content,
       (select m.user_id from public.team_members m
         where m.team_id = t.id and m.role = 'owner' limit 1)
from (select id from public.teams order by created_at asc limit 1) t
cross join (
  values
    (
      'Água Viva', 'Ministério Adoração', 'G',
      array['Adoração']::text[],
      '{key: G}

[Verso 1]
[G]Como um rio que [C]jamais seca
[Em]Minha alma clama [D]por Tua presença
[G]Água viva, [C]fonte que não [D]cessa
[G]Tua graça, [C]o meu refúgio [D]é

[Refrão]
[C]Vem, Senhor, [G]como águas em [D]mim jorrar
[C]Vem, Senhor, [G]quero Te ad[D]orar
[Em]Porque só [C]em Ti, [D]eu encontro [G]vida'
    ),
    (
      'Santo', 'Hillsong', 'A',
      array['Adoração', 'Ceia']::text[],
      '{key: A}

[Verso 1]
[A]Santo, Santo, [D]Santo
[E]Santo é o Senhor dos [A]exércitos
[A]Santo, Santo, [D]Santo
[E]Toda terra está cheia da [A]Tua glória

[Refrão]
[D]Hosana nas alturas, [A]Hosana ao Rei
[E]Hosana nas alturas, [D]Hosana [A]a Ti'
    ),
    (
      'Noite Feliz', 'Liturgia Comunitária', 'D',
      array['Natal']::text[],
      '{key: D}

[Verso 1]
[D]Noite feliz, [A]noite de paz
[Bm]Noite de amor [Em]tão ser[A]ena
[D]Tudo está bem, [A]tudo é paz
[D]Cristo nasceu [A]em Bel[D]ém

[Refrão]
[G]Glória a Deus nas altura, [D]paz na terra, boa [A]vontade
[G]Glória a Deus nas altura, [D]porque Cristo é [A]nas[D]cido'
    ),
    (
      'Tua Palavra', 'Renascer Praise', 'E',
      array['Jovens']::text[],
      '{key: E}

[Verso 1]
[E]Tua palavra é a [B]lâmpada
[C#m]Para os meus passos [A]e luz
[E]Que ilumina o meu [B]caminho
[C#m]É a verdade [A]que me conduz

[Refrão]
[A]Tua palavra, Senhor, [E]é viva e eficaz
[B]Nada se iguala, [E]a Tua verdade'
    )
) as v(title, artist, original_key, themes, content);
