-- ============================================================
-- Louve Fácil — 0002_rls_policies.sql
-- RLS + helpers + RPCs (idempotente). Executar DEPOIS de 0001.
-- Constituição Princípio I: o banco nega, não a aplicação.
-- ============================================================

-- ------------------------------------------------------------
-- Helpers de papel (SECURITY DEFINER para evitar recursão de política)
-- ------------------------------------------------------------
create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_team_editor(p_team_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id
      and m.user_id = auth.uid()
      and m.role in ('owner','editor')
  );
$$;

create or replace function public.is_team_owner(p_team_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

-- ------------------------------------------------------------
-- Habilitar RLS em todas as tabelas
-- ------------------------------------------------------------
alter table public.teams         enable row level security;
alter table public.team_members  enable row level security;
alter table public.invites       enable row level security;
alter table public.songs         enable row level security;
alter table public.setlists      enable row level security;
alter table public.setlist_items enable row level security;

-- ------------------------------------------------------------
-- teams: select por membro; update/delete pelo dono.
-- Insert SEM política direta: criação apenas via RPC create_team.
-- ------------------------------------------------------------
drop policy if exists "teams_select_membros" on public.teams;
create policy "teams_select_membros" on public.teams
  for select using (public.is_team_member(id));

drop policy if exists "teams_update_dono" on public.teams;
create policy "teams_update_dono" on public.teams
  for update using (public.is_team_owner(id))
  with check (public.is_team_owner(id));

drop policy if exists "teams_delete_dono" on public.teams;
create policy "teams_delete_dono" on public.teams
  for delete using (public.is_team_owner(id));

-- ------------------------------------------------------------
-- team_members: select por membro da equipe.
-- update/delete SEM política direta: apenas via RPCs de gestão.
-- ------------------------------------------------------------
drop policy if exists "team_members_select_membros" on public.team_members;
create policy "team_members_select_membros" on public.team_members
  for select using (public.is_team_member(team_id));

-- ------------------------------------------------------------
-- invites: dono gerencia (select/insert/update/delete).
-- Ingresso de convidados acontece apenas via RPC join_team_with_code.
-- ------------------------------------------------------------
drop policy if exists "invites_select_dono" on public.invites;
create policy "invites_select_dono" on public.invites
  for select using (public.is_team_owner(team_id));

drop policy if exists "invites_insert_dono" on public.invites;
create policy "invites_insert_dono" on public.invites
  for insert with check (public.is_team_owner(team_id));

drop policy if exists "invites_update_dono" on public.invites;
create policy "invites_update_dono" on public.invites
  for update using (public.is_team_owner(team_id))
  with check (public.is_team_owner(team_id));

drop policy if exists "invites_delete_dono" on public.invites;
create policy "invites_delete_dono" on public.invites
  for delete using (public.is_team_owner(team_id));

-- ------------------------------------------------------------
-- songs: leitura por membro; escrita por editor/dono
-- ------------------------------------------------------------
drop policy if exists "songs_select_membros" on public.songs;
create policy "songs_select_membros" on public.songs
  for select using (public.is_team_member(team_id));

drop policy if exists "songs_insert_editores" on public.songs;
create policy "songs_insert_editores" on public.songs
  for insert with check (
    public.is_team_editor(team_id) and created_by = auth.uid()
  );

drop policy if exists "songs_update_editores" on public.songs;
create policy "songs_update_editores" on public.songs
  for update using (public.is_team_editor(team_id))
  with check (public.is_team_editor(team_id));

drop policy if exists "songs_delete_editores" on public.songs;
create policy "songs_delete_editores" on public.songs
  for delete using (public.is_team_editor(team_id));

-- ------------------------------------------------------------
-- setlists: mesmo padrão de songs
-- ------------------------------------------------------------
drop policy if exists "setlists_select_membros" on public.setlists;
create policy "setlists_select_membros" on public.setlists
  for select using (public.is_team_member(team_id));

drop policy if exists "setlists_insert_editores" on public.setlists;
create policy "setlists_insert_editores" on public.setlists
  for insert with check (
    public.is_team_editor(team_id) and created_by = auth.uid()
  );

drop policy if exists "setlists_update_editores" on public.setlists;
create policy "setlists_update_editores" on public.setlists
  for update using (public.is_team_editor(team_id))
  with check (public.is_team_editor(team_id));

drop policy if exists "setlists_delete_editores" on public.setlists;
create policy "setlists_delete_editores" on public.setlists
  for delete using (public.is_team_editor(team_id));

-- ------------------------------------------------------------
-- setlist_items: acesso via equipe do setlist pai
-- ------------------------------------------------------------
drop policy if exists "setlist_items_select_membros" on public.setlist_items;
create policy "setlist_items_select_membros" on public.setlist_items
  for select using (
    exists (
      select 1 from public.setlists s
      where s.id = setlist_id and public.is_team_member(s.team_id)
    )
  );

drop policy if exists "setlist_items_insert_editores" on public.setlist_items;
create policy "setlist_items_insert_editores" on public.setlist_items
  for insert with check (
    exists (
      select 1 from public.setlists s
      where s.id = setlist_id and public.is_team_editor(s.team_id)
    )
  );

drop policy if exists "setlist_items_update_editores" on public.setlist_items;
create policy "setlist_items_update_editores" on public.setlist_items
  for update using (
    exists (
      select 1 from public.setlists s
      where s.id = setlist_id and public.is_team_editor(s.team_id)
    )
  )
  with check (
    exists (
      select 1 from public.setlists s
      where s.id = setlist_id and public.is_team_editor(s.team_id)
    )
  );

drop policy if exists "setlist_items_delete_editores" on public.setlist_items;
create policy "setlist_items_delete_editores" on public.setlist_items
  for delete using (
    exists (
      select 1 from public.setlists s
      where s.id = setlist_id and public.is_team_editor(s.team_id)
    )
  );

-- ============================================================
-- RPCs (SECURITY DEFINER, search_path fixo, validação interna)
-- ============================================================

-- ------------------------------------------------------------
-- create_team: cria equipe + vínculo owner atômicos (único caminho)
-- ------------------------------------------------------------
create or replace function public.create_team(
  p_name text,
  p_display_name text
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_team_id  uuid;
  v_user_id  uuid := auth.uid();
  v_name     text := btrim(p_name);
  v_display  text := btrim(p_display_name);
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 120 then
    raise exception 'invalid_name';
  end if;
  if v_display is null or char_length(v_display) not between 1 and 80 then
    raise exception 'invalid_display_name';
  end if;

  insert into public.teams (name, created_by)
    values (v_name, v_user_id)
    returning id into v_team_id;

  insert into public.team_members (team_id, user_id, role, display_name)
    values (v_team_id, v_user_id, 'owner', v_display);

  return v_team_id;
end;
$$;

-- ------------------------------------------------------------
-- join_team_with_code: ingresso por convite (idempotente)
-- ------------------------------------------------------------
create or replace function public.join_team_with_code(
  p_code text,
  p_display_name text
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code    text := btrim(p_code);
  v_invite  public.invites%rowtype;
  v_team_id uuid;
  v_display text := btrim(p_display_name);
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if v_display is null or char_length(v_display) not between 1 and 80 then
    raise exception 'invalid_display_name';
  end if;

  select * into v_invite from public.invites i where i.code = v_code;
  if not found then
    raise exception 'invalid_code';
  end if;
  if v_invite.revoked then
    raise exception 'revoked_code';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'expired_code';
  end if;

  select m.team_id into v_team_id
    from public.team_members m
    where m.team_id = v_invite.team_id and m.user_id = v_user_id;
  if v_team_id is not null then
    return v_team_id;  -- já é membro: idempotente
  end if;

  insert into public.team_members (team_id, user_id, role, display_name)
    values (v_invite.team_id, v_user_id, 'member', v_display);

  return v_invite.team_id;
end;
$$;

-- ------------------------------------------------------------
-- update_member_role: dono altera papel (editor <-> member)
-- ------------------------------------------------------------
create or replace function public.update_member_role(
  p_member_id uuid,
  p_role text
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_role    text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select team_id, role into v_team_id, v_role
    from public.team_members where id = p_member_id;
  if not found then
    raise exception 'member_not_found';
  end if;

  if not public.is_team_owner(v_team_id) then
    raise exception 'forbidden';
  end if;
  if v_role = 'owner' then
    raise exception 'cannot_change_owner';
  end if;
  if p_role not in ('editor','member') then
    raise exception 'invalid_role';
  end if;

  update public.team_members set role = p_role where id = p_member_id;
end;
$$;

-- ------------------------------------------------------------
-- remove_member: dono remove editor/membro (nunca o próprio dono)
-- ------------------------------------------------------------
create or replace function public.remove_member(p_member_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_role    text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select team_id, role into v_team_id, v_role
    from public.team_members where id = p_member_id;
  if not found then
    raise exception 'member_not_found';
  end if;

  if not public.is_team_owner(v_team_id) then
    raise exception 'forbidden';
  end if;
  if v_role = 'owner' then
    raise exception 'cannot_remove_owner';
  end if;

  delete from public.team_members where id = p_member_id;
end;
$$;

-- ------------------------------------------------------------
-- leave_team: não-dono sai da equipe
-- ------------------------------------------------------------
create or replace function public.leave_team(p_team_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_team_member(p_team_id) then
    raise exception 'not_a_member';
  end if;
  if public.is_team_owner(p_team_id) then
    raise exception 'owner_cannot_leave';
  end if;

  delete from public.team_members
    where team_id = p_team_id and user_id = auth.uid();
end;
$$;

-- ------------------------------------------------------------
-- reorder_setlist: renumera posições 1..n atomicamente
-- ------------------------------------------------------------
create or replace function public.reorder_setlist(
  p_setlist_id uuid,
  p_ordered_item_ids uuid[]
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_count   int;
  v_i       int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select team_id into v_team_id from public.setlists where id = p_setlist_id;
  if not found then
    raise exception 'setlist_not_found';
  end if;
  if not public.is_team_editor(v_team_id) then
    raise exception 'forbidden';
  end if;

  select count(*) into v_count
    from public.setlist_items where setlist_id = p_setlist_id;
  if coalesce(array_length(p_ordered_item_ids, 1), 0) <> v_count then
    raise exception 'items_mismatch';
  end if;

  for v_i in 1..v_count loop
    update public.setlist_items
      set position = v_i
      where id = p_ordered_item_ids[v_i]
        and setlist_id = p_setlist_id;
    if not found then
      raise exception 'item_not_in_setlist';
    end if;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- duplicate_setlist: cópia independente (itens, ordem, transposições)
-- ------------------------------------------------------------
create or replace function public.duplicate_setlist(
  p_setlist_id uuid,
  p_new_name text
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_team_id    uuid;
  v_event_date date;
  v_new_id     uuid;
  v_name       text := btrim(p_new_name);
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select team_id, event_date into v_team_id, v_event_date
    from public.setlists where id = p_setlist_id;
  if not found then
    raise exception 'setlist_not_found';
  end if;
  if not public.is_team_editor(v_team_id) then
    raise exception 'forbidden';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 160 then
    raise exception 'invalid_name';
  end if;

  insert into public.setlists (team_id, name, event_date, created_by)
    values (v_team_id, v_name, v_event_date, auth.uid())
    returning id into v_new_id;

  insert into public.setlist_items (setlist_id, song_id, position, transpose)
    select v_new_id, song_id, position, transpose
      from public.setlist_items
      where setlist_id = p_setlist_id
      order by position;

  return v_new_id;
end;
$$;

-- ------------------------------------------------------------
-- Execução das RPCs apenas para autenticados
-- ------------------------------------------------------------
revoke execute on function public.create_team(uuid, text) from public, anon;
revoke execute on function public.join_team_with_code(text, text) from public, anon;
revoke execute on function public.update_member_role(uuid, text) from public, anon;
revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.leave_team(uuid) from public, anon;
revoke execute on function public.reorder_setlist(uuid, uuid[]) from public, anon;
revoke execute on function public.duplicate_setlist(uuid, text) from public, anon;

grant execute on function public.create_team(uuid, text) to authenticated;
grant execute on function public.join_team_with_code(text, text) to authenticated;
grant execute on function public.update_member_role(uuid, text) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.leave_team(uuid) to authenticated;
grant execute on function public.reorder_setlist(uuid, uuid[]) to authenticated;
grant execute on function public.duplicate_setlist(uuid, text) to authenticated;
