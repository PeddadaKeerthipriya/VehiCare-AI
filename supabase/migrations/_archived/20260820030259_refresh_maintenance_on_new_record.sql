-- Stub predictor: recalculates 'due_soon'/'overdue' status based on odometer
-- AI/Backend can replace the logic inside with something richer later
create or replace function refresh_maintenance_status() returns trigger as $$
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
$$ language plpgsql;

create trigger trg_refresh_maintenance_on_service_record
  after insert on service_records
  for each row
  execute function refresh_maintenance_status();