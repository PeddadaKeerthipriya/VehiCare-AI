drop policy if exists "users can unsert fault diagnoses" on public.fault_diagnoses;
drop policy if exists "users can insert diagnoses for their vehicles" on public.fault_diagnoses;

create policy "users can insert diagnoses for their vehicles"
  on public.fault_diagnoses
  for insert
  to authenticated
  with check (
    exists (
      select 1 from vehicles v
      where v.id = fault_diagnoses.vehicle_id
        and v.user_id = auth.uid()
    )
  );