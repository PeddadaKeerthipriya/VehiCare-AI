-- Seed data for local development
-- Note: user IDs here are fixed UUIDs so relationships stay consistent across resets

-- Auth users must exist first (FK target for vehicles.user_id, notifications.user_id, etc.)
insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_sso_user, is_anonymous
) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'asha.rao@example.com',
   crypt('password123', gen_salt('bf')), now(),
   now(), now(), '{"provider":"email","providers":["email"]}', '{}',
   false, false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ravi.kumar@example.com',
   crypt('password123', gen_salt('bf')), now(),
   now(), now(), '{"provider":"email","providers":["email"]}', '{}',
   false, false);

insert into users (id, email, full_name) values
  ('11111111-1111-1111-1111-111111111111', 'asha.rao@example.com', 'Asha Rao'),
  ('22222222-2222-2222-2222-222222222222', 'ravi.kumar@example.com', 'Ravi Kumar')
on conflict (id) do update set full_name = excluded.full_name;

insert into vehicles (id, user_id, make, model, year, vin, odometer_km) values
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Maruti Suzuki', 'Swift', 2019, 'MA3ERLF1S00123456', 42000),
  ('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Hyundai', 'Creta', 2021, 'MALC381CLMM123789', 18500);
insert into service_records (id, vehicle_id, service_date, service_type, notes) values
  ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '2026-03-15', 'Oil Change', 'Synthetic oil, filter replaced'),
  ('b2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', '2026-05-02', 'Brake Inspection', 'Front pads at 40% remaining');
insert into service_slips (id, service_record_id, ocr_raw_text, parsed_data, image_url) values
  ('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
   'Sample OCR text from service slip', '{"amount": "1200", "shop": "Speedy Auto"}', 'https://example.com/slip1.jpg');
insert into fault_diagnoses (id, vehicle_id, user_id, symptom, severity, possible_cause, recommended_action, confidence_score, mechanic_required) values
  ('d1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Car makes a squealing noise when braking', 'medium', 'Likely worn brake pads', 'Inspect and replace brake pads', 0.87, true);
insert into maintenance_schedules (id, vehicle_id, task_name, due_date, due_odometer_km, status) values
  ('e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Timing Belt Replacement', '2026-09-01', 50000, 'pending'),
  ('e2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'Tire Rotation', '2026-08-20', 20000, 'pending');
insert into notifications (id, user_id, schedule_id, channel, message, is_sent) values
  ('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111',
   'email', 'Your Swift is due for a Timing Belt Replacement soon.', false);