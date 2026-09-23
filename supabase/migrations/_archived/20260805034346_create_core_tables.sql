create extension if not exists vector;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  created_at timestamptz default now()
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  make text,
  model text,
  year int,
  vin text unique,
  odometer_km int
);

create table service_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete cascade,
  service_date date,
  service_type text,
  notes text
);

create table service_slips (
  id uuid primary key default gen_random_uuid(),
  service_record_id uuid references service_records(id) on delete cascade,
  ocr_raw_text text,
  parsed_data jsonb,
  image_url text
);

create table fault_diagnoses (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete cascade,
  symptom_input text,
  ai_diagnosis text,
  confidence_score float,
  created_at timestamptz default now()
);

create table maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete cascade,
  task_name text,
  due_date date,
  due_odometer_km int,
  status text default 'pending'
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  schedule_id uuid references maintenance_schedules(id) on delete set null,
  channel text,
  message text,
  is_sent boolean default false,
  created_at timestamptz default now()
);