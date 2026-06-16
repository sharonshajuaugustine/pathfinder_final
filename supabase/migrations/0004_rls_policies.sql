-- ============================================================================
-- 0004_rls_policies.sql
-- Row Level Security. Default-deny everything to the anon/public client.
--
-- Security model:
--   * The browser NEVER reads/writes student PII directly.
--   * All student writes go through Next.js server routes/actions using the
--     SERVICE ROLE key, which BYPASSES RLS. So RLS here is a hard backstop:
--     if the anon key ever leaks or is used client-side, it can do nothing.
--   * Knowledge base catalog tables are world-readable (public reference data).
--   * Admin/counsellor access is granted to authenticated admin_users only.
-- ============================================================================

-- Enable RLS on every table.
alter table public.sessions             enable row level security;
alter table public.leads                enable row level security;
alter table public.conversations        enable row level security;
alter table public.student_profiles     enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.recommendations      enable row level security;
alter table public.domains              enable row level security;
alter table public.careers              enable row level security;
alter table public.courses              enable row level security;
alter table public.exams                enable row level security;
alter table public.career_course        enable row level security;
alter table public.course_exam          enable row level security;
alter table public.eligibility_rules    enable row level security;
alter table public.career_signal        enable row level security;
alter table public.career_skills        enable row level security;
alter table public.admin_users          enable row level security;
alter table public.audit_log            enable row level security;

-- ---------------------------------------------------------------------------
-- Knowledge base catalog: public READ-ONLY. (No insert/update/delete policy =>
-- writes denied for anon; service role bypasses RLS for seeding.)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'domains','careers','courses','exams','career_course',
    'course_exam','eligibility_rules','career_signal','career_skills'
  ]
  loop
    execute format(
      'create policy %I_public_read on public.%I for select using (true);',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helper: is the current authenticated user an active admin?
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where id = auth.uid() and is_active = true and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where id = auth.uid() and is_active = true
  );
$$;

-- ---------------------------------------------------------------------------
-- Student PII + session data: NO anon policies (default deny).
-- Staff (admin/counsellor) may READ for the dashboard.
-- All WRITES happen via service-role server routes (bypass RLS).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'sessions','leads','conversations','student_profiles',
    'assessment_responses','recommendations'
  ]
  loop
    execute format(
      'create policy %I_staff_read on public.%I for select using (public.is_staff());',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- admin_users: a user can read their own row; admins manage all.
-- ---------------------------------------------------------------------------
create policy admin_users_self_read on public.admin_users
  for select using (id = auth.uid() or public.is_admin());
create policy admin_users_admin_write on public.admin_users
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- audit_log: staff may read; inserts happen via service role only.
-- ---------------------------------------------------------------------------
create policy audit_staff_read on public.audit_log
  for select using (public.is_staff());
