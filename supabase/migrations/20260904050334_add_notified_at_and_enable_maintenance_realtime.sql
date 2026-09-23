-- 1. notified_at tracking for insurance/PUC/FASTag reminders
alter table insurance_policies add column if not exists notified_at timestamptz;
alter table puc_certificates add column if not exists notified_at timestamptz;
alter table fastag_accounts add column if not exists notified_at timestamptz;

-- 2. Clean up duplicate SELECT policy on maintenance_schedules
drop policy if exists "Users can view own maintenance schedules" on maintenance_schedules;
-- keeps "Users can view their own maintenance schedules" as the single SELECT policy

-- 3. Enable Realtime on maintenance_schedules
-- RLS is already correct (SELECT/INSERT/UPDATE/DELETE all scoped to auth.uid()),
-- so Realtime broadcasts remain isolated per user/vehicle automatically.
alter publication supabase_realtime add table maintenance_schedules;
