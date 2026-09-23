-- Extend indexing to support filtering by vehicle + severity, sorted by recency
create index if not exists idx_fault_diagnoses_vehicle_severity_created
  on fault_diagnoses (vehicle_id, severity, created_at desc);
