-- ============================================================================
-- 0003_admin_audit.sql
-- Admin accounts (RBAC) and an append-only audit log for compliance (DPDP).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- admin_users: linked to Supabase auth.users. Role-based access.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  id          uuid primary key,             -- == auth.users.id
  email       text not null unique,
  full_name   text,
  role        text not null default 'counsellor' check (role in ('admin','counsellor')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audit_log: append-only record of sensitive actions / PII access.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigserial primary key,
  actor_id    uuid,                          -- admin_users.id or null (system)
  actor_type  text not null default 'system' check (actor_type in ('system','admin','counsellor','student')),
  action      text not null,                 -- e.g. 'lead.view','lead.export','recommendation.generate'
  entity      text,                          -- table / resource name
  entity_id   text,
  meta        jsonb not null default '{}'::jsonb,
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_actor  on public.audit_log(actor_id, created_at);
create index if not exists idx_audit_entity on public.audit_log(entity, entity_id);
