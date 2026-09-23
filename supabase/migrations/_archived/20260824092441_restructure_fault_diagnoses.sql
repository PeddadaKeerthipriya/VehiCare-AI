alter table fault_diagnoses
  add column if not exists user_id uuid references users(id) on delete cascade,
  add column if not exists severity text,
  add column if not exists possible_cause text,
  add column if not exists recommended_action text,
  add column if not exists mechanic_required boolean default false;

-- Migrate existing data into the new column before renaming/dropping the old one
update fault_diagnoses
set possible_cause = ai_diagnosis
where possible_cause is null and ai_diagnosis is not null;

alter table fault_diagnoses rename column symptom_input to symptom;

alter table fault_diagnoses drop column if exists ai_diagnosis;

alter table fault_diagnoses
  add constraint chk_fault_diagnoses_severity
  check (severity in ('low', 'medium', 'high', 'critical') or severity is null);