-- Reconciliation function: called when a user confirms a parsed slip
-- Creates a service_record from the slip's parsed_data and links them
create or replace function confirm_service_slip(
  p_slip_id uuid,
  p_vehicle_id uuid,
  p_service_date date,
  p_service_type text,
  p_notes text
) returns uuid as $$
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
$$ language plpgsql security definer;