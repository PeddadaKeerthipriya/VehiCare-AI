-- 1. Extend notifications table
alter table notifications
  add column if not exists sent_at timestamptz,
  add column if not exists delivery_status text default 'pending',
  add column if not exists notification_type text,
  add column if not exists reference_id uuid;

alter table notifications
  add constraint chk_notifications_delivery_status
  check (delivery_status in ('pending', 'sent', 'failed'));

alter table notifications
  add constraint chk_notifications_type
  check (notification_type in ('maintenance', 'diagnosis', 'insurance', 'puc', 'fastag') or notification_type is null);

-- 2. Index for notification-feed/history queries (Week 6 requirement)
create index if not exists idx_notifications_user_sent
  on notifications (user_id, sent_at);

-- Supports dedup lookups by source record (reference_id + type)
create index if not exists idx_notifications_reference
  on notifications (reference_id, notification_type);

-- 3. notification_preferences table — one record per user
create table if not exists notification_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table notification_preferences enable row level security;

drop policy if exists "users can view own notification preferences" on notification_preferences;
create policy "users can view own notification preferences"
  on notification_preferences for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can insert own notification preferences" on notification_preferences;
create policy "users can insert own notification preferences"
  on notification_preferences for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can update own notification preferences" on notification_preferences;
create policy "users can update own notification preferences"
  on notification_preferences for update
  to authenticated
  using (auth.uid() = user_id);

-- 4. notifications: add UPDATE + DELETE policies (SELECT/INSERT already exist, left untouched)
drop policy if exists "users can update own notifications" on notifications;
create policy "users can update own notifications"
  on notifications for update
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can delete own notifications" on notifications;
create policy "users can delete own notifications"
  on notifications for delete
  to authenticated
  using (auth.uid() = user_id);