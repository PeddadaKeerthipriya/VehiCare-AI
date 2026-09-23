-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_net;

CREATE EXTENSION vector WITH SCHEMA extensions;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

CREATE FUNCTION public.confirm_service_slip (
  p_slip_id      uuid,
  p_vehicle_id   uuid,
  p_service_date date,
  p_service_type text,
  p_notes        text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
declare
  v_record_id uuid;
begin
  -- Create the confirmed service record
  insert into service_records (vehicle_id, service_date, service_type, notes)
  values (p_vehicle_id, p_service_date, p_service_type, p_notes)
  returning id into v_record_id;

  -- Link the slip to the new record and mark it confirmed
  update service_slips
  set service_record_id = v_record_id,
      status = 'Confirmed',
      updated_at = now()
  where id = p_slip_id;

  return v_record_id;
end;
$function$;

GRANT ALL ON FUNCTION public.confirm_service_slip(uuid, uuid, date, text, text) TO anon;

GRANT ALL ON FUNCTION public.confirm_service_slip(uuid, uuid, date, text, text) TO authenticated;

GRANT ALL ON FUNCTION public.confirm_service_slip(uuid, uuid, date, text, text) TO service_role;

CREATE FUNCTION public.refresh_maintenance_status()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  update maintenance_schedules ms
  set status = case
    when v.odometer_km >= ms.due_odometer_km then 'overdue'
    when v.odometer_km >= ms.due_odometer_km - 1000 then 'due_soon'
    else 'pending'
  end
  from vehicles v
  where ms.vehicle_id = v.id
    and ms.vehicle_id = new.vehicle_id
    and ms.status != 'completed';
  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.refresh_maintenance_status() TO anon;

GRANT ALL ON FUNCTION public.refresh_maintenance_status() TO authenticated;

GRANT ALL ON FUNCTION public.refresh_maintenance_status() TO service_role;

CREATE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;

GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;

GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;

CREATE FUNCTION public.update_updated_at_column()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;

GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;

GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;

CREATE TABLE public.challans (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id     uuid                     NOT NULL,
  challan_number text                     NOT NULL,
  challan_date   date                     NOT NULL,
  amount         numeric(12,2)            DEFAULT 0 NOT NULL,
  reason         text                     NOT NULL,
  status         text                     DEFAULT 'Pending'::text NOT NULL,
  payment_date   date,
  created_at     timestamp with time zone DEFAULT now() NOT NULL,
  updated_at     timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.challans
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.challans
  ADD CONSTRAINT challans_amount_valid CHECK (amount >= 0::numeric);

ALTER TABLE public.challans
  ADD CONSTRAINT challans_payment_date_valid CHECK (status <> 'Paid'::text OR payment_date IS NOT NULL);

ALTER TABLE public.challans
  ADD CONSTRAINT challans_pkey PRIMARY KEY (id);

ALTER TABLE public.challans
  ADD CONSTRAINT challans_status_valid CHECK (status = ANY (ARRAY['Pending'::text, 'Paid'::text, 'Cancelled'::text]));

GRANT ALL ON public.challans TO anon;

GRANT ALL ON public.challans TO authenticated;

GRANT ALL ON public.challans TO service_role;

CREATE INDEX idx_challans_number ON public.challans (challan_number);

CREATE INDEX idx_challans_date ON public.challans (challan_date);

CREATE INDEX idx_challans_status ON public.challans (status);

CREATE INDEX idx_challans_vehicle_id ON public.challans (vehicle_id);

CREATE TABLE public.diagnoses (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id      uuid                     NOT NULL,
  diagnosis_type  text                     NOT NULL,
  description     text                     NOT NULL,
  severity        text,
  diagnosed_date  date                     NOT NULL,
  recommendations text,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  updated_at      timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.diagnoses
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.diagnoses
  ADD CONSTRAINT diagnoses_pkey PRIMARY KEY (id);

GRANT ALL ON public.diagnoses TO anon;

GRANT ALL ON public.diagnoses TO authenticated;

GRANT ALL ON public.diagnoses TO service_role;

CREATE POLICY "Backend service can access diagnoses" ON public.diagnoses
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE public.fastag (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id    uuid                     NOT NULL,
  tag_number    text                     NOT NULL,
  balance       numeric(12,2)            DEFAULT 0 NOT NULL,
  last_recharge date,
  status        text                     DEFAULT 'Active'::text NOT NULL,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.fastag
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fastag
  ADD CONSTRAINT fastag_balance_valid CHECK (balance >= 0::numeric);

ALTER TABLE public.fastag
  ADD CONSTRAINT fastag_pkey PRIMARY KEY (id);

ALTER TABLE public.fastag
  ADD CONSTRAINT fastag_status_valid CHECK (status = ANY (ARRAY['Active'::text, 'Inactive'::text, 'Blocked'::text, 'Low Balance'::text]));

GRANT ALL ON public.fastag TO anon;

GRANT ALL ON public.fastag TO authenticated;

GRANT ALL ON public.fastag TO service_role;

CREATE INDEX idx_fastag_tag_number ON public.fastag (tag_number);

CREATE INDEX idx_fastag_vehicle_id ON public.fastag (vehicle_id);

CREATE TABLE public.fault_diagnoses (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id         uuid,
  symptom            text,
  confidence_score   double precision,
  created_at         timestamp with time zone DEFAULT now(),
  user_id            uuid,
  severity           text,
  possible_cause     text,
  recommended_action text,
  mechanic_required  boolean                  DEFAULT false
);

ALTER TABLE public.fault_diagnoses
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fault_diagnoses
  ADD CONSTRAINT chk_confidence_range CHECK (confidence_score >= 0::double precision AND confidence_score <= 1::double precision);

ALTER TABLE public.fault_diagnoses
  ADD CONSTRAINT chk_fault_diagnoses_severity CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])) OR severity IS NULL);

ALTER TABLE public.fault_diagnoses
  ADD CONSTRAINT fault_diagnoses_pkey PRIMARY KEY (id);

GRANT ALL ON public.fault_diagnoses TO anon;

GRANT ALL ON public.fault_diagnoses TO authenticated;

GRANT ALL ON public.fault_diagnoses TO service_role;

CREATE INDEX idx_fault_diagnoses_vehicle_severity_created ON public.fault_diagnoses (vehicle_id, severity, created_at DESC);

CREATE INDEX idx_fault_diagnoses_vehicle_created ON public.fault_diagnoses (vehicle_id, created_at DESC);

CREATE TABLE public.insurance (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id    uuid                     NOT NULL,
  policy_number text                     NOT NULL,
  provider      text                     NOT NULL,
  start_date    date                     NOT NULL,
  end_date      date                     NOT NULL,
  status        text                     DEFAULT 'Active'::text NOT NULL,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.insurance
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.insurance
  ADD CONSTRAINT insurance_dates_valid CHECK (end_date >= start_date);

ALTER TABLE public.insurance
  ADD CONSTRAINT insurance_pkey PRIMARY KEY (id);

GRANT ALL ON public.insurance TO anon;

GRANT ALL ON public.insurance TO authenticated;

GRANT ALL ON public.insurance TO service_role;

CREATE TABLE public.insurance_policies (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id    uuid                     NOT NULL,
  insurer       text                     NOT NULL,
  policy_number text                     NOT NULL,
  expiry_date   date                     NOT NULL,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.insurance_policies
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.insurance_policies
  ADD CONSTRAINT insurance_policies_pkey PRIMARY KEY (id);

GRANT ALL ON public.insurance_policies TO anon;

GRANT ALL ON public.insurance_policies TO authenticated;

GRANT ALL ON public.insurance_policies TO service_role;

CREATE INDEX idx_insurance_policies_vehicle_id ON public.insurance_policies (vehicle_id);

CREATE INDEX idx_insurance_policies_expiry_date ON public.insurance_policies (expiry_date);

CREATE TABLE public.maintenance_schedules (
  id              uuid    DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id      uuid,
  task_name       text,
  due_date        date,
  due_odometer_km integer,
  status          text    DEFAULT 'pending'::text
);

ALTER TABLE public.maintenance_schedules
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.maintenance_schedules
  ADD CONSTRAINT chk_status_enum CHECK (status = ANY (ARRAY['pending'::text, 'due_soon'::text, 'overdue'::text, 'completed'::text]));

ALTER TABLE public.maintenance_schedules
  ADD CONSTRAINT maintenance_schedules_pkey PRIMARY KEY (id);

GRANT ALL ON public.maintenance_schedules TO anon;

GRANT ALL ON public.maintenance_schedules TO authenticated;

GRANT ALL ON public.maintenance_schedules TO service_role;

CREATE TABLE public.notifications (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id     uuid,
  schedule_id uuid,
  channel     text,
  message     text,
  is_sent     boolean                  DEFAULT false,
  created_at  timestamp with time zone DEFAULT now()
);

ALTER TABLE public.notifications
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.maintenance_schedules(id) ON DELETE SET NULL;

GRANT ALL ON public.notifications TO anon;

GRANT ALL ON public.notifications TO authenticated;

GRANT ALL ON public.notifications TO service_role;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT
  USING ((auth.uid() = user_id));

CREATE TABLE public.oem_intervals (
  id              uuid    DEFAULT gen_random_uuid() NOT NULL,
  component       text    NOT NULL,
  interval_km     integer,
  interval_months integer,
  notes           text
);

ALTER TABLE public.oem_intervals
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.oem_intervals
  ADD CONSTRAINT oem_intervals_pkey PRIMARY KEY (id);

GRANT ALL ON public.oem_intervals TO anon;

GRANT ALL ON public.oem_intervals TO authenticated;

GRANT ALL ON public.oem_intervals TO service_role;

CREATE TABLE public.puc (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id         uuid                     NOT NULL,
  certificate_number text                     NOT NULL,
  issue_date         date                     NOT NULL,
  expiry_date        date                     NOT NULL,
  emission_details   text,
  created_at         timestamp with time zone DEFAULT now() NOT NULL,
  updated_at         timestamp with time zone DEFAULT now() NOT NULL,
  status             text                     DEFAULT 'Active'::text NOT NULL
);

ALTER TABLE public.puc
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.puc
  ADD CONSTRAINT puc_dates_valid CHECK (expiry_date >= issue_date);

ALTER TABLE public.puc
  ADD CONSTRAINT puc_pkey PRIMARY KEY (id);

ALTER TABLE public.puc
  ADD CONSTRAINT puc_status_valid CHECK (status = ANY (ARRAY['Active'::text, 'Expired'::text]));

GRANT ALL ON public.puc TO anon;

GRANT ALL ON public.puc TO authenticated;

GRANT ALL ON public.puc TO service_role;

CREATE INDEX idx_puc_certificate_number ON public.puc (certificate_number);

CREATE INDEX idx_puc_vehicle_id ON public.puc (vehicle_id);

CREATE INDEX idx_puc_expiry_date ON public.puc (expiry_date);

CREATE TABLE public.service_records (
  id           uuid DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id   uuid,
  service_date date,
  service_type text,
  notes        text
);

ALTER TABLE public.service_records
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.service_records
  ADD CONSTRAINT service_records_pkey PRIMARY KEY (id);

GRANT ALL ON public.service_records TO anon;

GRANT ALL ON public.service_records TO authenticated;

GRANT ALL ON public.service_records TO service_role;

CREATE INDEX idx_service_records_vehicle_id ON public.service_records (vehicle_id);

CREATE INDEX idx_service_records_service_date ON public.service_records (service_date);

CREATE TRIGGER trg_refresh_maintenance_on_service_record
  AFTER INSERT ON public.service_records
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_maintenance_status();

CREATE TABLE public.service_slips (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  service_record_id uuid,
  ocr_raw_text      text,
  parsed_data       jsonb,
  image_url         text,
  status            text                     DEFAULT 'Uploaded'::text NOT NULL,
  updated_at        timestamp with time zone DEFAULT now() NOT NULL,
  error_message     text,
  user_id           uuid,
  file_name         text,
  storage_path      text,
  bucket_name       text,
  created_at        timestamp with time zone DEFAULT now()
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.service_slips;

ALTER TABLE public.service_slips
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.service_slips
  ADD CONSTRAINT chk_service_slips_status CHECK (status = ANY (ARRAY['Uploaded'::text, 'OCR running'::text, 'Parsed'::text, 'Confirmed'::text, 'OCR failed'::text]));

ALTER TABLE public.service_slips
  ADD CONSTRAINT service_slips_pkey PRIMARY KEY (id);

ALTER TABLE public.service_slips
  ADD CONSTRAINT service_slips_service_record_id_fkey FOREIGN KEY (service_record_id) REFERENCES public.service_records(id) ON DELETE CASCADE;

GRANT ALL ON public.service_slips TO anon;

GRANT ALL ON public.service_slips TO authenticated;

GRANT ALL ON public.service_slips TO service_role;

CREATE UNIQUE INDEX service_slips_id_idx ON public.service_slips (id);

CREATE INDEX idx_service_slips_service_record_id ON public.service_slips (service_record_id);

CREATE TRIGGER service_slips_updated_at
  BEFORE UPDATE ON public.service_slips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Allow authenticated users to insert service slips" ON public.service_slips
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view their service slips" ON public.service_slips
  FOR SELECT
  TO authenticated
  USING ((split_part(image_url, '/'::text, 1) = (auth.uid())::text));

CREATE TABLE public.services (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id   uuid                     NOT NULL,
  user_id      uuid                     NOT NULL,
  service_type text                     NOT NULL,
  service_date date                     NOT NULL,
  description  text,
  cost         numeric(12,2),
  source       text                     DEFAULT 'manual'::text NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.services
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.services
  ADD CONSTRAINT services_cost_check CHECK (cost IS NULL OR cost >= 0::numeric);

ALTER TABLE public.services
  ADD CONSTRAINT services_pkey PRIMARY KEY (id);

ALTER TABLE public.services
  ADD CONSTRAINT services_source_check CHECK (source = ANY (ARRAY['manual'::text, 'n8n'::text, 'ocr'::text]));

GRANT ALL ON public.services TO anon;

GRANT ALL ON public.services TO authenticated;

GRANT ALL ON public.services TO service_role;

CREATE INDEX services_service_date_idx ON public.services (service_date);

CREATE INDEX services_user_id_idx ON public.services (user_id);

CREATE INDEX services_vehicle_id_idx ON public.services (vehicle_id);

CREATE TABLE public.users (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  email      text                     NOT NULL,
  full_name  text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.users
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.users
  ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE public.users
  ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE public.fault_diagnoses
  ADD CONSTRAINT fault_diagnoses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

GRANT ALL ON public.users TO anon;

GRANT ALL ON public.users TO authenticated;

GRANT ALL ON public.users TO service_role;

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING ((auth.uid() = id));

CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT
  USING ((auth.uid() = id));

CREATE TABLE public.vehicles (
  id          uuid    DEFAULT gen_random_uuid() NOT NULL,
  user_id     uuid,
  make        text,
  model       text,
  year        integer,
  vin         text,
  odometer_km integer
);

CREATE POLICY "Users can create challans for their vehicles" ON public.challans
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = challans.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can delete their vehicle challans" ON public.challans
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = challans.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can update their vehicle challans" ON public.challans
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = challans.vehicle_id) AND (v.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = challans.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can view their vehicle challans" ON public.challans
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = challans.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can create diagnoses for their vehicles" ON public.diagnoses
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = diagnoses.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can delete their vehicle diagnoses" ON public.diagnoses
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = diagnoses.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can update their vehicle diagnoses" ON public.diagnoses
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = diagnoses.vehicle_id) AND (v.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = diagnoses.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can view their vehicle diagnoses" ON public.diagnoses
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = diagnoses.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can create FASTag for their vehicles" ON public.fastag
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = fastag.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can delete their vehicle FASTag" ON public.fastag
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = fastag.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can update their vehicle FASTag" ON public.fastag
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = fastag.vehicle_id) AND (v.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = fastag.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can view their vehicle FASTag" ON public.fastag
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = fastag.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can view own fault diagnoses" ON public.fault_diagnoses
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles
  WHERE ((vehicles.id = fault_diagnoses.vehicle_id) AND (vehicles.user_id = auth.uid())))));

CREATE POLICY "Users can create insurance for their vehicles" ON public.insurance
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = insurance.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can delete their vehicle insurance" ON public.insurance
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = insurance.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can update their vehicle insurance" ON public.insurance
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = insurance.vehicle_id) AND (v.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = insurance.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can view their vehicle insurance" ON public.insurance
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = insurance.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can view own maintenance schedules" ON public.maintenance_schedules
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles
  WHERE ((vehicles.id = maintenance_schedules.vehicle_id) AND (vehicles.user_id = auth.uid())))));

CREATE POLICY "Users can create PUC for their vehicles" ON public.puc
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = puc.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can delete their vehicle PUC" ON public.puc
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = puc.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can update their vehicle PUC" ON public.puc
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = puc.vehicle_id) AND (v.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = puc.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can view their vehicle PUC" ON public.puc
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles v
  WHERE ((v.id = puc.vehicle_id) AND (v.user_id = auth.uid())))));

CREATE POLICY "Users can insert own service records" ON public.service_records
  FOR INSERT
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.vehicles
  WHERE ((vehicles.id = service_records.vehicle_id) AND (vehicles.user_id = auth.uid())))));

CREATE POLICY "Users can view own service records" ON public.service_records
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM public.vehicles
  WHERE ((vehicles.id = service_records.vehicle_id) AND (vehicles.user_id = auth.uid())))));

ALTER TABLE public.vehicles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicles
  ADD CONSTRAINT chk_odometer_non_negative CHECK (odometer_km >= 0);

ALTER TABLE public.vehicles
  ADD CONSTRAINT chk_odometer_positive CHECK (odometer_km >= 0);

ALTER TABLE public.vehicles
  ADD CONSTRAINT chk_vehicle_year CHECK (year >= 1886 AND year::numeric <= (EXTRACT(year FROM CURRENT_DATE) + 1::numeric));

ALTER TABLE public.vehicles
  ADD CONSTRAINT chk_vin_format CHECK (vin ~ '^[A-HJ-NPR-Z0-9]{17}$'::text);

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);

ALTER TABLE public.challans
  ADD CONSTRAINT challans_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.diagnoses
  ADD CONSTRAINT diagnoses_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.fastag
  ADD CONSTRAINT fastag_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.fault_diagnoses
  ADD CONSTRAINT fault_diagnoses_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.insurance
  ADD CONSTRAINT insurance_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.insurance_policies
  ADD CONSTRAINT insurance_policies_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.maintenance_schedules
  ADD CONSTRAINT maintenance_schedules_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.puc
  ADD CONSTRAINT puc_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.service_records
  ADD CONSTRAINT service_records_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_vin_key UNIQUE (vin);

GRANT ALL ON public.vehicles TO anon;

GRANT ALL ON public.vehicles TO authenticated;

GRANT ALL ON public.vehicles TO service_role;

CREATE POLICY "Users can delete own vehicles" ON public.vehicles
  FOR DELETE
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can delete their own vehicles" ON public.vehicles
  FOR DELETE
  TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own vehicles" ON public.vehicles
  FOR INSERT
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can insert their own vehicles" ON public.vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update own vehicles" ON public.vehicles
  FOR UPDATE
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update their own vehicles" ON public.vehicles
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view own vehicles" ON public.vehicles
  FOR SELECT
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can view their own vehicles" ON public.vehicles
  FOR SELECT
  TO authenticated
  USING ((auth.uid() = user_id));

CREATE VIEW public.service_slip_history WITH (security_invoker=true) AS SELECT ss.id AS slip_id,
    ss.image_url,
    ss.status,
    ss.updated_at,
    ss.error_message,
    sr.id AS service_record_id,
    sr.vehicle_id,
    sr.service_date,
    sr.service_type,
    sr.notes,
    v.user_id
   FROM ((public.service_slips ss
     LEFT JOIN public.service_records sr ON ((sr.id = ss.service_record_id)))
     LEFT JOIN public.vehicles v ON ((v.id = sr.vehicle_id)));

GRANT ALL ON public.service_slip_history TO anon;

GRANT ALL ON public.service_slip_history TO authenticated;

GRANT ALL ON public.service_slip_history TO service_role;

CREATE VIEW public.vehicle_diagnosis_context WITH (security_invoker=true) AS SELECT v.id AS vehicle_id,
    v.user_id,
    v.make,
    v.model,
    v.year,
    v.odometer_km,
    COALESCE(json_agg(json_build_object('service_type', sr.service_type, 'service_date', sr.service_date, 'notes', sr.notes) ORDER BY sr.service_date DESC) FILTER (WHERE (sr.id IS NOT NULL)), '[]'::json) AS recent_service_history
   FROM (public.vehicles v
     LEFT JOIN public.service_records sr ON ((sr.vehicle_id = v.id)))
  GROUP BY v.id;

GRANT ALL ON public.vehicle_diagnosis_context TO anon;

GRANT ALL ON public.vehicle_diagnosis_context TO authenticated;

GRANT ALL ON public.vehicle_diagnosis_context TO service_role;

CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();
