-- The owner must be able to read the row returned by INSERT ... RETURNING.
-- The role helper queries the projects table and cannot see a newly inserted
-- row from its stable-function snapshot during that same statement.
alter policy invitation_projects_select
on public.invitation_projects
using (
  owner_user_id = (select auth.uid())
  or private.has_project_role(
    id,
    array['project_owner', 'planner', 'designer', 'hostess', 'catering', 'viewer']
  )
);
