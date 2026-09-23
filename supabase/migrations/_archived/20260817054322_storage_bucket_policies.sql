-- RLS policies for the existing vehicare-1storage bucket
-- Convention: files are uploaded as {user_id}/filename.ext
-- Backend must construct upload paths using the authenticated user's UUID as the first folder segment

create policy "Users can upload own slips"
  on storage.objects for insert
  with check (
    bucket_id = 'vehicare-1storage'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view own slips"
  on storage.objects for select
  using (
    bucket_id = 'vehicare-1storage'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own slips"
  on storage.objects for update
  using (
    bucket_id = 'vehicare-1storage'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own slips"
  on storage.objects for delete
  using (
    bucket_id = 'vehicare-1storage'
    and (storage.foldername(name))[1] = auth.uid()::text
  );