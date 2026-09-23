-- Insurance policies (a vehicle can have multiple over time — renewals)
create table insurance_policies (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete cascade not null,
  provider text,
  policy_number text,
  valid_from date,
  valid_to date,
  premium_due_date date,
  coverage_amount numeric(12,2),
  document_url text,
  extraction_source text check (extraction_source in ('api', 'document')),
  status text check (status in ('Active', 'Expired', 'Pending')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PUC certificates (one current record per vehicle)
create table puc_certificates (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete cascade not null unique,
  certificate_number text,
  status text check (status in ('Valid', 'Invalid', 'Expired')),
  issue_date date,
  expiry_date date,
  center_name text,
  fuel_type text,
  last_verified_at timestamptz default now()
);

-- FASTag accounts (one current record per vehicle)
create table fastag_accounts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete cascade not null unique,
  tag_id text,
  linked_account text,
  balance numeric(10,2),
  card_status text,
  last_recharge_date date,
  last_payment_mode text,
  card_validity date,
  low_balance_flag boolean default false,
  last_checked_at timestamptz default now()
);

-- Nearby-service search cache (not user-owned — shared lookup cache, no RLS)
create table service_center_cache (
  id uuid primary key default gen_random_uuid(),
  lat numeric(9,6),
  lng numeric(9,6),
  radius int,
  place_id text,
  name text,
  rating numeric(2,1),
  place_type text,
  place_data jsonb,
  fetched_at timestamptz default now(),
  expires_at timestamptz
);

-- RLS: owner-only access via vehicle ownership, matching existing pattern
alter table insurance_policies enable row level security;
alter table puc_certificates enable row level security;
alter table fastag_accounts enable row level security;

create policy "Users can view own insurance policies"
  on insurance_policies for select
  using (exists (select 1 from vehicles where vehicles.id = insurance_policies.vehicle_id and vehicles.user_id = auth.uid()));

create policy "Users can insert own insurance policies"
  on insurance_policies for insert
  with check (exists (select 1 from vehicles where vehicles.id = insurance_policies.vehicle_id and vehicles.user_id = auth.uid()));

create policy "Users can update own insurance policies"
  on insurance_policies for update
  using (exists (select 1 from vehicles where vehicles.id = insurance_policies.vehicle_id and vehicles.user_id = auth.uid()));

create policy "Users can view own puc certificates"
  on puc_certificates for select
  using (exists (select 1 from vehicles where vehicles.id = puc_certificates.vehicle_id and vehicles.user_id = auth.uid()));

create policy "Users can upsert own puc certificates"
  on puc_certificates for insert
  with check (exists (select 1 from vehicles where vehicles.id = puc_certificates.vehicle_id and vehicles.user_id = auth.uid()));

create policy "Users can update own puc certificates"
  on puc_certificates for update
  using (exists (select 1 from vehicles where vehicles.id = puc_certificates.vehicle_id and vehicles.user_id = auth.uid()));

create policy "Users can view own fastag accounts"
  on fastag_accounts for select
  using (exists (select 1 from vehicles where vehicles.id = fastag_accounts.vehicle_id and vehicles.user_id = auth.uid()));

create policy "Users can upsert own fastag accounts"
  on fastag_accounts for insert
  with check (exists (select 1 from vehicles where vehicles.id = fastag_accounts.vehicle_id and vehicles.user_id = auth.uid()));

create policy "Users can update own fastag accounts"
  on fastag_accounts for update
  using (exists (select 1 from vehicles where vehicles.id = fastag_accounts.vehicle_id and vehicles.user_id = auth.uid()));

-- Basic FK indexes now; expiry_date-specific indexes are Week 5's task per roadmap
create index idx_insurance_policies_vehicle_id on insurance_policies(vehicle_id);
create index idx_puc_certificates_vehicle_id on puc_certificates(vehicle_id);
create index idx_fastag_accounts_vehicle_id on fastag_accounts(vehicle_id);