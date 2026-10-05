-- Operational records are project-scoped, not part of the public invitation.
create table public.invitation_tables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.invitation_projects(id) on delete cascade,
  name text not null check (name = btrim(name, E' \t\n\r') and char_length(name) between 1 and 160),
  type text not null check (type in ('circular', 'imperial', 'rectangular')),
  capacity integer not null check (capacity between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (project_id, id)
);

create table public.invitation_guests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.invitation_projects(id) on delete cascade,
  name text not null check (name = btrim(name, E' \t\n\r') and char_length(name) between 1 and 160),
  passes integer not null check (passes between 1 and 100),
  table_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  foreign key (project_id, table_id) references public.invitation_tables(project_id, id)
    on delete no action
);

-- This index also covers the guest's project FK; the table unique index covers its FK.
create index invitation_guests_project_table_idx on public.invitation_guests(project_id, table_id);
alter table public.invitation_tables enable row level security;
alter table public.invitation_guests enable row level security;
revoke all on public.invitation_tables, public.invitation_guests from public, anon, authenticated;

grant select on public.invitation_tables, public.invitation_guests to authenticated;
grant insert (id, project_id, name, type, capacity) on public.invitation_tables to authenticated;
grant update (name, type, capacity) on public.invitation_tables to authenticated;
grant insert (id, project_id, name, passes, table_id) on public.invitation_guests to authenticated;
grant update (name, passes, table_id) on public.invitation_guests to authenticated;

create policy invitation_tables_select on public.invitation_tables for select to authenticated
  using (private.has_project_role(project_id, array['project_owner', 'planner']));
create policy invitation_tables_insert on public.invitation_tables for insert to authenticated
  with check (private.has_project_role(project_id, array['project_owner', 'planner']));
create policy invitation_tables_update on public.invitation_tables for update to authenticated
  using (private.has_project_role(project_id, array['project_owner', 'planner']))
  with check (private.has_project_role(project_id, array['project_owner', 'planner']));
create policy invitation_guests_select on public.invitation_guests for select to authenticated
  using (private.has_project_role(project_id, array['project_owner', 'planner']));
create policy invitation_guests_insert on public.invitation_guests for insert to authenticated
  with check (private.has_project_role(project_id, array['project_owner', 'planner']));
create policy invitation_guests_update on public.invitation_guests for update to authenticated
  using (private.has_project_role(project_id, array['project_owner', 'planner']))
  with check (private.has_project_role(project_id, array['project_owner', 'planner']));

-- Column grants restrict clients; this also guards identity during maintenance.
create function private.guard_invitation_operation_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.project_id is distinct from old.project_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Operation identity and creation timestamp are immutable' using errcode = '23514';
  end if;
  new.version := old.version + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.guard_invitation_operation_update() from public, anon, authenticated;
create trigger invitation_tables_guard_update before update on public.invitation_tables
  for each row execute function private.guard_invitation_operation_update();
create trigger invitation_guests_guard_update before update on public.invitation_guests
  for each row execute function private.guard_invitation_operation_update();
