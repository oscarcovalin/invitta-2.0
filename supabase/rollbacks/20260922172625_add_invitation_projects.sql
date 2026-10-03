alter table if exists public.invitation_projects
  drop constraint if exists invitation_projects_published_document_fk;

drop table if exists public.invitation_documents;
drop table if exists public.invitation_project_members;
drop table if exists public.invitation_projects;
