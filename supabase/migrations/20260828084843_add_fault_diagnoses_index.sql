create index if not exists idx_fault_diagnoses_vehicle_created
  on fault_diagnoses (vehicle_id, created_at);