create extension if not exists pg_cron;

create table public.invitation_rsvps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.invitation_projects(id) on delete cascade,
  submission_id uuid not null,
  guest_name text not null check (char_length(guest_name) between 2 and 120),
  email text check (email is null or char_length(email) <= 254),
  attendance text not null check (attendance in ('confirmed', 'declined')),
  passes smallint not null check (
    (attendance = 'confirmed' and passes between 1 and 5)
    or (attendance = 'declined' and passes = 0)
  ),
  dietary_option text check (dietary_option is null or dietary_option in ('child_menu', 'allergies', 'vegan')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days'),
  unique (project_id, submission_id)
);

create index invitation_rsvps_project_created_idx
  on public.invitation_rsvps (project_id, created_at desc);

create index invitation_rsvps_expires_idx
  on public.invitation_rsvps (expires_at);

alter table public.invitation_rsvps enable row level security;

revoke all on table public.invitation_rsvps from public, anon, authenticated;
grant insert on table public.invitation_rsvps to service_role;
grant select, delete on table public.invitation_rsvps to authenticated;

create policy invitation_rsvps_owner_select
on public.invitation_rsvps for select
to authenticated
using (
  exists (
    select 1
    from public.invitation_projects project
    where project.id = invitation_rsvps.project_id
      and project.owner_user_id = (select auth.uid())
  )
);

create policy invitation_rsvps_owner_delete
on public.invitation_rsvps for delete
to authenticated
using (
  exists (
    select 1
    from public.invitation_projects project
    where project.id = invitation_rsvps.project_id
      and project.owner_user_id = (select auth.uid())
  )
);

select cron.schedule(
  'invitta-rsvp-retention',
  '17 4 * * *',
  'delete from public.invitation_rsvps where expires_at <= now();'
);
