-- ============================================================
-- Louve Fácil — seed_sample_songs.sql (OPCIONAL)
-- 4 cifras de exemplo em ChordPro com temas, para testar o app
-- rapidamente após configurar o Supabase.
--
-- Pré-requisito: sua equipe já criada pelo app (/equipes) e a
-- migração 0003_bpm_meter.sql executada (colunas bpm/time_signature).
-- O seed usa a PRIMEIRA equipe criada no projeto (created_at mais antigo).
-- Para usar outra equipe, ajuste a cláusula `order by t.created_at limit 1`.
--
-- Sem efeito colateral: só INSERTs; pode ser executado mais de uma vez
-- (cria novas linhas a cada execução).
-- ============================================================

insert into public.songs (team_id, title, artist, original_key, bpm, time_signature, themes, content, created_by)
select t.id, v.title, v.artist, v.original_key, v.bpm, v.time_signature, v.themes, v.content,
       (select m.user_id from public.team_members m
         where m.team_id = t.id and m.role = 'owner' limit 1)
from (select id from public.teams order by created_at asc limit 1) t
cross join (
  values
    (
      'Água Viva', 'Ministério Adoração', 'G', 72, '4/4',
      array['Adoração']::text[],
      '{key: G}

{section: Verso 1}
[G]Como um rio que [C]jamais seca
[Em]Minha alma clama [D]por Tua presença
[G]Água viva, [C]fonte que não [D]cessa
[G]Tua graça, [C]o meu refúgio [D]é

{section: Refrão}
[C]Vem, Senhor, [G]como águas em [D]mim jorrar
[C]Vem, Senhor, [G]quero Te ad[D]orar
[Em]Porque só [C]em Ti, [D]eu encontro [G]vida'
    ),
    (
      'Santo', 'Hillsong', 'A', 78, '4/4',
      array['Adoração', 'Ceia']::text[],
      '{key: A}

{section: Verso 1}
[A]Santo, Santo, [D]Santo
[E]Santo é o Senhor dos [A]exércitos
[A]Santo, Santo, [D]Santo
[E]Toda terra está cheia da [A]Tua glória

{section: Refrão}
[D]Hosana nas alturas, [A]Hosana ao Rei
[E]Hosana nas alturas, [D]Hosana [A]a Ti'
    ),
    (
      'Noite Feliz', 'Liturgia Comunitária', 'D', 96, '6/8',
      array['Natal']::text[],
      '{key: D}

{section: Verso 1}
[D]Noite feliz, [A]noite de paz
[Bm]Noite de amor [Em]tão ser[A]ena
[D]Tudo está bem, [A]tudo é paz
[D]Cristo nasceu [A]em Bel[D]ém

{section: Refrão}
[G]Glória a Deus nas altura, [D]paz na terra, boa [A]vontade
[G]Glória a Deus nas altura, [D]porque Cristo é [A]nas[D]cido'
    ),
    (
      'Tua Palavra', 'Renascer Praise', 'E', 84, '4/4',
      array['Jovens']::text[],
      '{key: E}

{section: Verso 1}
[E]Tua palavra é a [B]lâmpada
[C#m]Para os meus passos [A]e luz
[E]Que ilumina o meu [B]caminho
[C#m]É a verdade [A]que me conduz

{section: Refrão}
[A]Tua palavra, Senhor, [E]é viva e eficaz
[B]Nada se iguala, [E]a Tua verdade'
    )
) as v(title, artist, original_key, bpm, time_signature, themes, content);
