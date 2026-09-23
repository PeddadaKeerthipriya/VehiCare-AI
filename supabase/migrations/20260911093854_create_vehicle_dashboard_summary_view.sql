create or replace view vehicle_dashboard_summary
with (security_invoker = true) as
select
  v.id as vehicle_id,
  v.user_id,
  -- latest diagnosis
  (select fd.severity from fault_diagnoses fd where fd.vehicle_id = v.id order by fd.created_at desc limit 1) as latest_diagnosis_severity,
  -- next maintenance due
  (select ms.due_date from maintenance_schedules ms where ms.vehicle_id = v.id and ms.status != 'completed' order by ms.due_date asc limit 1) as next_maintenance_due,
  -- insurance/PUC expiry
  (select ip.expiry_date from insurance_policies ip where ip.vehicle_id = v.id order by ip.expiry_date asc limit 1) as insurance_expiry,
  (select pc.expiry_date from puc_certificates pc where pc.vehicle_id = v.id order by pc.expiry_date asc limit 1) as puc_expiry,
  -- fastag balance flag
  (select fa.low_balance_flag from fastag_accounts fa where fa.vehicle_id = v.id limit 1) as fastag_low_balance
from vehicles v;