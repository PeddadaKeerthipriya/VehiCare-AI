-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

ALTER TABLE public.fault_diagnoses
  DROP CONSTRAINT chk_fault_diagnoses_severity;

DROP TABLE public.services;

DROP POLICY "Backend service can access diagnoses" ON public.diagnoses;

DROP POLICY "Users can create diagnoses for their vehicles" ON public.diagnoses;

DROP POLICY "Users can delete their vehicle diagnoses" ON public.diagnoses;

DROP POLICY "Users can update their vehicle diagnoses" ON public.diagnoses;

DROP POLICY "Users can view their vehicle diagnoses" ON public.diagnoses;

DROP TABLE public.diagnoses;

CREATE OR REPLACE FUNCTION public.confirm_service_slip (
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

CREATE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;

GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;

GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_maintenance_status()
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

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

ALTER TABLE public.fault_diagnoses
  ADD CONSTRAINT chk_fault_diagnoses_severity CHECK ((lower(severity) = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])) OR severity IS NULL);

CREATE POLICY "users can unsert fault diagnoses" ON public.fault_diagnoses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

ALTER TABLE public.service_records
  ADD COLUMN user_id uuid;

ALTER TABLE public.service_records
  ADD COLUMN description text;

ALTER TABLE public.service_records
  ADD COLUMN cost numeric(12,2);

ALTER TABLE public.service_records
  ADD COLUMN source text DEFAULT 'manual'::text;

ALTER TABLE public.service_records
  ADD CONSTRAINT service_records_source_check CHECK (source IS NULL OR (source = ANY (ARRAY['manual'::text, 'n8n'::text, 'ocr'::text])));

ALTER TABLE public.service_records
  ADD COLUMN created_at timestamp with time zone DEFAULT now();

ALTER TABLE public.service_records
  ADD COLUMN updated_at timestamp with time zone DEFAULT now();
