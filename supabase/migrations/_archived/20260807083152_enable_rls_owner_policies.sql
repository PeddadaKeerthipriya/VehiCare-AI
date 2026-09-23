-- Enable RLS on core tables
alter table users enable row level security;
alter table vehicles enable row level security;
alter table service_records enable row level security;
alter table service_slips enable row level security;
alter table fault_diagnoses enable row level security;
alter table maintenance_schedules enable row level security;
alter table notifications enable row level security;

-- USERS: a user can only see/edit their own row
create policy "Users can view own profile"
  on users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on users for update
  using (auth.uid() = id);

-- VEHICLES: owner-only access (all CRUD)
create policy "Users can view own vehicles"
  on vehicles for select
  using (auth.uid() = user_id);

create policy "Users can insert own vehicles"
  on vehicles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own vehicles"
  on vehicles for update
  using (auth.uid() = user_id);

create policy "Users can delete own vehicles"
  on vehicles for delete
  using (auth.uid() = user_id);

-- SERVICE_RECORDS: access via vehicle ownership
create policy "Users can view own service records"
  on service_records for select
  using (
    exists (
      select 1 from vehicles
      where vehicles.id = service_records.vehicle_id
      and vehicles.user_id = auth.uid()
    )
  );

create policy "Users can insert own service records"
  on service_records for insert
  with check (
    exists (
      select 1 from vehicles
      where vehicles.id = service_records.vehicle_id
      and vehicles.user_id = auth.uid()
    )
  );

-- FAULT_DIAGNOSES: access via vehicle ownership
create policy "Users can view own fault diagnoses"
  on fault_diagnoses for select
  using (
    exists (
      select 1 from vehicles
      where vehicles.id = fault_diagnoses.vehicle_id
      and vehicles.user_id = auth.uid()
    )
  );

-- MAINTENANCE_SCHEDULES: access via vehicle ownership
create policy "Users can view own maintenance schedules"
  on maintenance_schedules for select
  using (
    exists (
      select 1 from vehicles
      where vehicles.id = maintenance_schedules.vehicle_id
      and vehicles.user_id = auth.uid()
    )
  );

-- NOTIFICATIONS: owner-only
create policy "Users can view own notifications"
  on notifications for select
  using (auth.uid() = user_id);
