-- 1. custom_intervals table (Tue) — user-defined override intervals per vehicle
create table if not exists custom_intervals (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  task_name text not null,
  interval_km integer,
  interval_days integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_custom_intervals_vehicle_id
  on custom_intervals (vehicle_id);

alter table custom_intervals enable row level security;

drop policy if exists "users can view their vehicle custom intervals" on custom_intervals;
create policy "users can view their vehicle custom intervals"
  on custom_intervals for select
  to authenticated
  using (exists (select 1 from vehicles v where v.id = custom_intervals.vehicle_id and v.user_id = auth.uid()));

drop policy if exists "users can insert their vehicle custom intervals" on custom_intervals;
create policy "users can insert their vehicle custom intervals"
  on custom_intervals for insert
  to authenticated
  with check (exists (select 1 from vehicles v where v.id = custom_intervals.vehicle_id and v.user_id = auth.uid()));

drop policy if exists "users can update their vehicle custom intervals" on custom_intervals;
create policy "users can update their vehicle custom intervals"
  on custom_intervals for update
  to authenticated
  using (exists (select 1 from vehicles v where v.id = custom_intervals.vehicle_id and v.user_id = auth.uid()));

drop policy if exists "users can delete their vehicle custom intervals" on custom_intervals;
create policy "users can delete their vehicle custom intervals"
  on custom_intervals for delete
  to authenticated
  using (exists (select 1 from vehicles v where v.id = custom_intervals.vehicle_id and v.user_id = auth.uid()));

-- 2. notified_at tracking (Wed) — prevents duplicate reminders per schedule item
alter table maintenance_schedules
  add column if not exists notified_at timestamptz;

-- 3. missing insurance_policies index (Mon)
create index if not exists idx_insurance_vehicle_id
  on insurance_policies (vehicle_id);

-- 4. supports the "all vehicles due soon" aggregate query (Thu)
create index if not exists idx_maintenance_schedules_due_status
  on maintenance_schedules (due_date, status);