-- ============================================================
-- Louve Fácil — 0003_bpm_meter.sql
-- Adiciona BPM e compasso (fórmula de compasso) às cifras.
-- Executar DEPOIS de 0001 e 0002. Idempotente.
-- Constraints nomeadas (songs_bpm_check / songs_time_signature_check)
-- para casamento estável com o mapeamento de erros do service.
-- ============================================================

alter table public.songs
  add column if not exists bpm int;

alter table public.songs
  add column if not exists time_signature text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'songs_bpm_check') then
    alter table public.songs
      add constraint songs_bpm_check check (bpm between 20 and 400);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'songs_time_signature_check') then
    alter table public.songs
      add constraint songs_time_signature_check check (time_signature ~ '^[0-9]{1,2}/[0-9]{1,2}$');
  end if;
end $$;

-- índice de apoio para consultas futuras por andamento/fórmula (opcional)
create index if not exists songs_team_bpm_idx on public.songs (team_id, bpm);
