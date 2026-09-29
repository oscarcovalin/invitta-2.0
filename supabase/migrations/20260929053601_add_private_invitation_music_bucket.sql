insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invitation-music',
  'invitation-music',
  false,
  5000000,
  array['audio/mpeg']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy invitation_music_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'invitation-music'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/music/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]mp3$'
  and private.has_project_role(
    private.invitation_asset_project_id(name),
    array['project_owner', 'planner', 'designer', 'hostess', 'catering', 'viewer']
  )
);

create policy invitation_music_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'invitation-music'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/music/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]mp3$'
  and private.has_project_role(
    private.invitation_asset_project_id(name),
    array['project_owner', 'planner', 'designer']
  )
);

create policy invitation_music_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'invitation-music'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/music/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]mp3$'
  and private.has_project_role(
    private.invitation_asset_project_id(name),
    array['project_owner', 'planner', 'designer']
  )
)
with check (
  bucket_id = 'invitation-music'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/music/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]mp3$'
  and private.has_project_role(
    private.invitation_asset_project_id(name),
    array['project_owner', 'planner', 'designer']
  )
);

create policy invitation_music_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'invitation-music'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/music/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]mp3$'
  and private.has_project_role(
    private.invitation_asset_project_id(name),
    array['project_owner', 'planner', 'designer']
  )
);
