do $$
begin
  if not exists (
    select 1 from storage.objects where bucket_id = 'invitation-music'
  ) then
    drop policy if exists invitation_music_delete on storage.objects;
    drop policy if exists invitation_music_update on storage.objects;
    drop policy if exists invitation_music_insert on storage.objects;
    drop policy if exists invitation_music_select on storage.objects;
    delete from storage.buckets where id = 'invitation-music';
  end if;
end;
$$;
