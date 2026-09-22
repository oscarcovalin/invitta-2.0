insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invitation-assets',
  'invitation-assets',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.invitation_asset_project_id(object_name text)
returns uuid
language sql
immutable
security invoker
set search_path = ''
as $$
  select substring(
    (storage.foldername(object_name))[1]
    from '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  )::uuid;
$$;

revoke all on function private.invitation_asset_project_id(text) from public;
grant execute on function private.invitation_asset_project_id(text) to authenticated;

create policy invitation_assets_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'invitation-assets'
  and private.has_project_role(
    private.invitation_asset_project_id(name),
    array['project_owner', 'planner', 'designer', 'hostess', 'catering', 'viewer']
  )
);

create policy invitation_assets_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'invitation-assets'
  and private.has_project_role(
    private.invitation_asset_project_id(name),
    array['project_owner', 'planner', 'designer']
  )
);

create policy invitation_assets_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'invitation-assets'
  and private.has_project_role(
    private.invitation_asset_project_id(name),
    array['project_owner', 'planner', 'designer']
  )
)
with check (
  bucket_id = 'invitation-assets'
  and private.has_project_role(
    private.invitation_asset_project_id(name),
    array['project_owner', 'planner', 'designer']
  )
);

create policy invitation_assets_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'invitation-assets'
  and private.has_project_role(
    private.invitation_asset_project_id(name),
    array['project_owner', 'planner', 'designer']
  )
);
