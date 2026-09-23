create table if not exists service_center_cache (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null,
  lng double precision not null,
  radius integer not null,
  place_id text not null,
  name text,
  rating numeric(2,1),
  fetched_at timestamptz not null default now()
);

create index if not exists idx_service_center_cache_lookup
  on service_center_cache (lat, lng, radius);