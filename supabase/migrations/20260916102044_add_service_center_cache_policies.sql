drop policy if exists "authenticated can read service center cache" on service_center_cache;
create policy "authenticated can read service center cache"
  on service_center_cache for select
  to authenticated
  using (true);

drop policy if exists "authenticated can insert service center cache" on service_center_cache;
create policy "authenticated can insert service center cache"
  on service_center_cache for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated can update service center cache" on service_center_cache;
create policy "authenticated can update service center cache"
  on service_center_cache for update
  to authenticated
  using (true);