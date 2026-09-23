create or replace view service_slip_history as
select
  ss.id as slip_id,
  ss.image_url,
  ss.status,
  ss.updated_at,
  ss.error_message,
  sr.id as service_record_id,
  sr.vehicle_id,
  sr.service_date,
  sr.service_type,
  sr.notes,
  v.user_id
from service_slips ss
left join service_records sr on sr.id = ss.service_record_id
left join vehicles v on v.id = sr.vehicle_id;