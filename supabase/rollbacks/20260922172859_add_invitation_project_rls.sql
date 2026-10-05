drop policy if exists invitation_documents_insert on public.invitation_documents;
drop policy if exists invitation_documents_select on public.invitation_documents;
drop policy if exists invitation_project_members_delete on public.invitation_project_members;
drop policy if exists invitation_project_members_update on public.invitation_project_members;
drop policy if exists invitation_project_members_insert on public.invitation_project_members;
drop policy if exists invitation_project_members_select on public.invitation_project_members;
drop policy if exists invitation_projects_delete on public.invitation_projects;
drop policy if exists invitation_projects_update on public.invitation_projects;
drop policy if exists invitation_projects_insert on public.invitation_projects;
drop policy if exists invitation_projects_select on public.invitation_projects;

revoke all on table public.invitation_documents from authenticated;
revoke all on table public.invitation_project_members from authenticated;
revoke all on table public.invitation_projects from authenticated;
revoke execute on function private.has_project_role(uuid, text[]) from authenticated;
drop function if exists private.has_project_role(uuid, text[]);
