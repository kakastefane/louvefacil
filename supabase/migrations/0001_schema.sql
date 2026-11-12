-- ============================================================
-- Louve Fácil — 0001_schema.sql
-- Schema completo (idempotente). Executar ANTES de 0002.
-- Docs: specs/001-louve-facil-mvp/data-model.md
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- teams
-- ------------------------------------------------------------
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- team_members  (um vínculo por par equipe-usuário; um único owner)
-- ------------------------------------------------------------
create table if not exists public.team_members (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('owner','editor','member')),
  display_name text not null default ''
               check (char_length(btrim(display_name)) between 1 and 80),
  joined_at    timestamptz not null default now(),
  unique (team_id, user_id)
);

create unique index if not exists team_members_single_owner
  on public.team_members (team_id) where (role = 'owner');

create index if not exists team_members_user_id_idx
  on public.team_members (user_id);

-- ------------------------------------------------------------
-- invites  (código = segredo; consumo apenas via RPC em 0002)
-- ------------------------------------------------------------
create table if not exists public.invites (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  code       text not null unique check (char_length(code) >= 8),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked    boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists invites_team_id_idx on public.invites (team_id);

-- ------------------------------------------------------------
-- songs  (content = fonte única da verdade da cifra, ChordPro)
-- ------------------------------------------------------------
create table if not exists public.songs (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  artist       text check (artist is null or char_length(btrim(artist)) <= 200),
  original_key text check (original_key is null or original_key ~ '^[A-G][#b]?$'),
  themes       text[] not null default '{}',
  content      text not null check (char_length(content) between 1 and 20000),
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists songs_team_id_idx on public.songs (team_id);
create index if not exists songs_team_lower_title_idx
  on public.songs (team_id, lower(title));

-- ------------------------------------------------------------
-- setlists
-- ------------------------------------------------------------
create table if not exists public.setlists (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 160),
  event_date date,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists setlists_team_id_idx on public.setlists (team_id);

-- ------------------------------------------------------------
-- setlist_items  (ordem única por setlist; desvio de transposição)
-- ------------------------------------------------------------
create table if not exists public.setlist_items (
  id         uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references public.setlists(id) on delete cascade,
  song_id    uuid not null references public.songs(id) on delete cascade,
  position   int not null check (position >= 1),
  transpose  int not null default 0 check (transpose between -11 and 11),
  unique (setlist_id, song_id)
);

-- ordem única, adiada para permitir reordenação atômica em transação
create unique index if not exists setlist_items_position_uniq
  on public.setlist_items (setlist_id, position) deferrable initially deferred;

create index if not exists setlist_items_setlist_pos_idx
  on public.setlist_items (setlist_id, position);

-- ------------------------------------------------------------
-- trigger updated_at (songs, setlists)
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists songs_set_updated_at on public.songs;
create trigger songs_set_updated_at
  before update on public.songs
  for each row execute function public.set_updated_at();

drop trigger if exists setlists_set_updated_at on public.setlists;
create trigger setlists_set_updated_at
  before update on public.setlists
  for each row execute function public.set_updated_at();
