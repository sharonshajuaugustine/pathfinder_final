-- ============================================================================
-- 0005_remove_guardian_fields.sql
-- Remove guardian consent columns from the leads table. Guardian consent logic
-- has been removed from the MVP. The `is_minor` flag is retained (derived from
-- age) as it is still a useful analytic and may be needed for compliance later.
-- ============================================================================

alter table public.leads
  drop column if exists guardian_name,
  drop column if exists guardian_phone,
  drop column if exists guardian_consent;
