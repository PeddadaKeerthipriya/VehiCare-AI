-- Add columns only if they don't already exist (handles drift between local/remote)
alter table service_slips add column if not exists status text not null default 'Uploaded';
alter table service_slips add column if not exists updated_at timestamptz not null default now();
alter table service_slips add column if not exists error_message text;

-- Add the constraint only if it doesn't already exist
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_service_slips_status'
  ) then
    alter table service_slips
      add constraint chk_service_slips_status
      check (status in ('Uploaded', 'OCR running', 'Parsed', 'Confirmed', 'Failed'));
  end if;
end $$;