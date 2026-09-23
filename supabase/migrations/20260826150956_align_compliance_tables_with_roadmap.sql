-- Align compliance tables with the 8-Week Roadmap spec (Section 2.1)
-- Drops the incomplete duplicate, renames existing tables/columns to match.

-- 1. Drop the duplicate/incomplete insurance_policies table.
--    Nothing depends on it yet — confirmed safe to remove.
DROP TABLE IF EXISTS public.insurance_policies;

-- 2. insurance -> insurance_policies (rename table + mismatched columns)
ALTER TABLE public.insurance RENAME TO insurance_policies;
ALTER TABLE public.insurance_policies RENAME COLUMN provider TO insurer;
ALTER TABLE public.insurance_policies RENAME COLUMN end_date TO expiry_date;
-- start_date and status are extra fields beyond the roadmap spec — kept, they're harmless and useful.

-- 3. puc -> puc_certificates (rename table + mismatched columns)
ALTER TABLE public.puc RENAME TO puc_certificates;
ALTER TABLE public.puc_certificates RENAME COLUMN issue_date TO issued_date;
-- emission_details and status are extra fields — kept.

-- 4. fastag -> fastag_accounts (rename table + mismatched columns)
ALTER TABLE public.fastag RENAME TO fastag_accounts;
ALTER TABLE public.fastag_accounts RENAME COLUMN tag_number TO tag_id;
ALTER TABLE public.fastag_accounts RENAME COLUMN last_recharge TO last_recharge_date;
-- balance and status are extra fields — kept.