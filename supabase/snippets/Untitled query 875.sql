select table_name, column_name, data_type
from information_schema.columns
where table_name in ('insurance_policies', 'puc_certificates', 'fastag_accounts')
order by table_name, ordinal_position;