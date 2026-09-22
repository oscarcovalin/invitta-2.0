create table public.invitation_projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  slug text not null check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 160),
  event_type text not null check (event_type in ('wedding', 'quinceanera', 'other')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug)
);

create table public.invitation_project_members (
  project_id uuid not null references public.invitation_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('project_owner', 'planner', 'designer', 'hostess', 'catering', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index invitation_project_members_user_id_idx
  on public.invitation_project_members (user_id);

create table public.invitation_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.invitation_projects(id) on delete cascade,
  revision integer not null check (revision > 0),
  schema_version integer not null check (schema_version > 0),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, revision),
  unique (project_id, id)
);

alter table public.invitation_projects
  add constraint invitation_projects_published_document_fk
  foreign key (id, published_document_id)
  references public.invitation_documents(project_id, id)
  deferrable initially deferred;

create index invitation_documents_project_id_idx
  on public.invitation_documents (project_id);

alter table public.invitation_projects enable row level security;
alter table public.invitation_project_members enable row level security;
alter table public.invitation_documents enable row level security;

revoke all on table public.invitation_projects from anon, authenticated;
revoke all on table public.invitation_project_members from anon, authenticated;
revoke all on table public.invitation_documents from anon, authenticated;
