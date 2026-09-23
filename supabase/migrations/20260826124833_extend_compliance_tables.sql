-- ============================================================
-- Migration: extend_compliance_tables
-- Week 4: reconcile roadmap fields onto the existing
-- insurance / puc / fastag tables. Drops the unused,
-- never-wired-up duplicate insurance_policies table.
-- ============================================================

-- Drop the redundant duplicate (confirmed unused by frontend/backend)
DROP TABLE IF EXISTS "public"."insurance_policies";

-- Extend "insurance" with roadmap fields not yet present
ALTER TABLE "public"."insurance"
    ADD COLUMN IF NOT EXISTS "premium_due_date" date,
    ADD COLUMN IF NOT EXISTS "document_url" text;

-- Extend "puc" with document upload support
ALTER TABLE "public"."puc"
    ADD COLUMN IF NOT EXISTS "document_url" text;

-- Extend "fastag" with linked-account tracking + low-balance flag
ALTER TABLE "public"."fastag"
    ADD COLUMN IF NOT EXISTS "linked_account" text,
    ADD COLUMN IF NOT EXISTS "low_balance_flag" boolean NOT NULL DEFAULT false;

-- Helpful index for the reminder-notifier cron (Week 6 pattern)
CREATE INDEX IF NOT EXISTS "idx_insurance_end_date" ON "public"."insurance" ("end_date");