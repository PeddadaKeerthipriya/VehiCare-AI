-- Indexes for common query patterns
create index idx_service_records_vehicle_id on service_records(vehicle_id);
create index idx_service_records_service_date on service_records(service_date);
create index idx_service_slips_service_record_id on service_slips(service_record_id);

-- Static OEM maintenance interval reference table
create table oem_intervals (
  id uuid primary key default gen_random_uuid(),
  component text not null,           -- e.g. 'oil', 'tyre', 'brake', 'battery', 'air_filter'
  interval_km int,                   -- e.g. 10000
  interval_months int,               -- e.g. 12
  notes text
);

insert into oem_intervals (component, interval_km, interval_months, notes) values
  ('oil', 10000, 12, 'Standard synthetic oil change interval'),
  ('tyre', 40000, null, 'Rotate every 10,000 km; replace around 40,000 km depending on wear'),
  ('brake', 30000, null, 'Inspect pads; replace as needed based on wear indicator'),
  ('battery', null, 36, 'Typical service life ~3 years'),
  ('air_filter', 15000, 12, 'Replace or clean depending on driving conditions');


  -- Validation constraints
alter table vehicles add constraint chk_odometer_non_negative check (odometer_km >= 0);
alter table vehicles add constraint chk_vin_format check (vin ~ '^[A-HJ-NPR-Z0-9]{17}$' or vin is null);

alter table maintenance_schedules add constraint chk_status_enum
  check (status in ('pending', 'due_soon', 'overdue', 'completed'));

alter table fault_diagnoses add constraint chk_confidence_range
  check (confidence_score >= 0 and confidence_score <= 1);