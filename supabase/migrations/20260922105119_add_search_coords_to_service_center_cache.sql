alter table service_center_cache
  add column if not exists search_lat double precision,
  add column if not exists search_lng double precision;

create index if not exists idx_service_center_cache_search_lookup
  on service_center_cache (search_lat, search_lng, radius);

truncate service_center_cache;