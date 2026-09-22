create schema if not exists private;

create or replace function private.has_project_role(
  target_project_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1
      from public.invitation_projects project
      where project.id = target_project_id
        and project.owner_user_id = (select auth.uid())
        and 'project_owner' = any(allowed_roles)
    )
    or exists (
      select 1
      from public.invitation_project_members member
      where member.project_id = target_project_id
        and member.user_id = (select auth.uid())
        and member.role = any(allowed_roles)
    )
  );
$$;

revoke all on function private.has_project_role(uuid, text[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.has_project_role(uuid, text[]) to authenticated;

grant select, insert, delete on table public.invitation_projects to authenticated;
grant update (name, event_type, status, published_document_id)
  on table public.invitation_projects to authenticated;
grant select, insert, delete on table public.invitation_project_members to authenticated;
grant update (role) on table public.invitation_project_members to authenticated;
grant select, insert on table public.invitation_documents to authenticated;

create policy invitation_projects_select
on public.invitation_projects for select
to authenticated
using (private.has_project_role(id, array['project_owner', 'planner', 'designer', 'hostess', 'catering', 'viewer']));

create policy invitation_projects_insert
on public.invitation_projects for insert
to authenticated
with check ((select auth.uid()) = owner_user_id);

create policy invitation_projects_update
on public.invitation_projects for update
to authenticated
using (private.has_project_role(id, array['project_owner']))
with check ((select auth.uid()) = owner_user_id);

create policy invitation_projects_delete
on public.invitation_projects for delete
to authenticated
using (private.has_project_role(id, array['project_owner']));

create policy invitation_project_members_select
on public.invitation_project_members for select
to authenticated
using (private.has_project_role(project_id, array['project_owner', 'planner', 'designer', 'hostess', 'catering', 'viewer']));

create policy invitation_project_members_insert
on public.invitation_project_members for insert
to authenticated
with check (private.has_project_role(project_id, array['project_owner']));

create policy invitation_project_members_update
on public.invitation_project_members for update
to authenticated
using (private.has_project_role(project_id, array['project_owner']))
with check (private.has_project_role(project_id, array['project_owner']));

create policy invitation_project_members_delete
on public.invitation_project_members for delete
to authenticated
using (private.has_project_role(project_id, array['project_owner']));

create policy invitation_documents_select
on public.invitation_documents for select
to authenticated
using (private.has_project_role(project_id, array['project_owner', 'planner', 'designer', 'hostess', 'catering', 'viewer']));

create policy invitation_documents_insert
on public.invitation_documents for insert
to authenticated
with check (
  private.has_project_role(project_id, array['project_owner', 'planner', 'designer'])
  and created_by = (select auth.uid())
  and document ->> 'projectId' = project_id::text
  and (document ->> 'schemaVersion')::integer = schema_version
);
