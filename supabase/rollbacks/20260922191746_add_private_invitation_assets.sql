drop policy if exists invitation_assets_delete on storage.objects;
drop policy if exists invitation_assets_update on storage.objects;
drop policy if exists invitation_assets_insert on storage.objects;
drop policy if exists invitation_assets_select on storage.objects;

revoke execute on function private.invitation_asset_project_id(text) from authenticated;
drop function if exists private.invitation_asset_project_id(text);

delete from storage.buckets bucket
where bucket.id = 'invitation-assets'
  and not exists (
    select 1 from storage.objects object
    where object.bucket_id = bucket.id
  );
