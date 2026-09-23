create or replace view vehicle_diagnosis_context as
select
  v.id as vehicle_id,
  v.user_id,
  v.make,
  v.model,
  v.year,
  v.odometer_km,
  coalesce(
    json_agg(
      json_build_object(
        'service_type', sr.service_type,
        'service_date', sr.service_date,
        'notes', sr.notes
      ) order by sr.service_date desc
    ) filter (where sr.id is not null),
    '[]'
  ) as recent_service_history
from vehicles v
left join service_records sr on sr.vehicle_id = v.id
group by v.id;

alter view vehicle_diagnosis_context set (security_invoker = true);