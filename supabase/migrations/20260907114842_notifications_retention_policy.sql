-- Function: deletes notifications older than 180 days
create or replace function cleanup_old_notifications()
returns void
language plpgsql
security definer
as $$
begin
  delete from notifications
  where created_at < now() - interval '180 days';
end;
$$;

-- Schedule it to run daily via pg_cron (Supabase's built-in scheduler)
-- Requires the pg_cron extension — enabled below if not already active
create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-old-notifications',
  '0 3 * * *',  -- daily at 3:00 AM
  $$select cleanup_old_notifications();$$
);