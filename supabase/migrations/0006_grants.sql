-- ============================================================================
-- 0006_grants.sql
-- Explicit PostgreSQL privilege grants.
--
-- WHY THIS IS NEEDED:
--   Supabase auto-grants privileges on tables created through the Studio UI.
--   Tables created via raw SQL migrations do NOT get auto-grants. The result:
--   the `service_role` PostgreSQL role (used by the server-side admin client)
--   has BYPASSRLS but NO table privileges → error 42501 "permission denied".
--
-- SECURITY NOTE:
--   Granting ALL to service_role is safe because:
--     1. The service_role key is never exposed to the browser (server-only module).
--     2. BYPASSRLS already gives it unrestricted access if it had table grants.
--     3. RLS policies still fully protect anon/authenticated roles.
--
-- Run this file in the Supabase SQL Editor after the previous migrations.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- service_role: full access on all current and future tables + sequences.
-- This is the role the server-side admin client authenticates as.
-- ---------------------------------------------------------------------------
grant usage on schema public to service_role;

grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all routines  in schema public to service_role;

-- Ensures tables created in future migrations also get the grant automatically.
alter default privileges in schema public
  grant all privileges on tables    to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;

-- ---------------------------------------------------------------------------
-- authenticated: the role used by logged-in admin/counsellor users.
-- RLS policies (0004) still control WHICH rows they can see.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select on all tables in schema public to authenticated;

alter default privileges in schema public
  grant select on tables to authenticated;

-- ---------------------------------------------------------------------------
-- anon: the role used by unauthenticated browser requests (anon key).
-- Only the KB catalog tables have an RLS SELECT policy, so only those
-- are readable. All other tables are blocked at the RLS layer.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon;

grant select on public.domains            to anon;
grant select on public.careers            to anon;
grant select on public.courses            to anon;
grant select on public.exams              to anon;
grant select on public.career_course      to anon;
grant select on public.course_exam        to anon;
grant select on public.eligibility_rules  to anon;
grant select on public.career_signal      to anon;
grant select on public.career_skills      to anon;
