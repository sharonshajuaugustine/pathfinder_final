-- ============================================================================
-- 0001_core_student_tables.sql
-- Core student-facing tables: sessions, conversations, profiles, assessment,
-- leads, recommendations.
--
-- Design notes:
--  * All PII lives in `leads`. Other tables reference it by id.
--  * `sessions` are created anonymously; a session is linked to a lead after
--    onboarding completes.
--  * Conversation + profile state are persisted (Vercel functions are
--    stateless — never hold session state in memory).
--  * Every recommendation snapshots `kb_version` for reproducibility.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- sessions: one per browser visit. Anonymous until onboarding links a lead.
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid,                       -- set after onboarding (FK added below)
  status        text not null default 'started'
                  check (status in ('started','onboarded','in_chat','assessment','completed','abandoned')),
  language      text not null default 'en'  check (language in ('en','ml')),
  source        text,                       -- utm / referral
  user_agent    text,
  ip_hash       text,                       -- hashed, never raw IP (privacy)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- leads: the lead / student record. Holds ALL PII. Created at onboarding.
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references public.sessions(id) on delete cascade,
  name                  text not null,
  phone                 text not null,
  phone_verified        boolean not null default false,
  email                 text,
  age                   int  not null check (age between 14 and 30),
  is_minor              boolean not null default false,     -- derived: age < 18
  district              text not null,
  stream                text not null
                          check (stream in ('science_bio','science_maths','science_cs','commerce','humanities')),
  percentage            numeric(5,2) check (percentage between 0 and 100),
  grade                 text,                                -- alternative to percentage
  preferred_language    text not null default 'en' check (preferred_language in ('en','ml')),
  -- consent (DPDP). For minors, guardian consent is required.
  consent_given         boolean not null default false,
  guardian_name         text,
  guardian_phone        text,
  guardian_consent      boolean not null default false,
  consent_version       text not null default '1',
  consent_at            timestamptz,
  -- lead funnel
  funnel_status         text not null default 'new'
                          check (funnel_status in ('new','contacted','counselling_booked','converted','closed')),
  assigned_counsellor   uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- link sessions.lead_id -> leads.id (deferred FK to avoid circular create order)
alter table public.sessions
  add constraint sessions_lead_fk
  foreign key (lead_id) references public.leads(id) on delete set null;

create index if not exists idx_leads_session on public.leads(session_id);
create index if not exists idx_leads_funnel  on public.leads(funnel_status);

-- ---------------------------------------------------------------------------
-- conversations: turn-by-turn chat log (interview + extraction + explanation).
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions(id) on delete cascade,
  role          text not null check (role in ('assistant','user','system')),
  stage         text,                       -- interview stage slot (e.g. 'interests')
  content       text not null,
  -- AI bookkeeping (model, tokens, cost) for observability & cost caps
  model         text,
  prompt_tokens int,
  output_tokens int,
  cost_usd      numeric(10,6),
  created_at    timestamptz not null default now()
);
create index if not exists idx_conversations_session on public.conversations(session_id, created_at);

-- ---------------------------------------------------------------------------
-- student_profiles: structured profile, built incrementally during the chat.
-- One row per session. JSONB holds the flexible profile object; key academic
-- fields are mirrored to typed columns for fast filtering.
-- ---------------------------------------------------------------------------
create table if not exists public.student_profiles (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null unique references public.sessions(id) on delete cascade,
  -- mirrored hard-filter fields (also in profile jsonb)
  stream              text,
  percentage          numeric(5,2),
  -- the full structured profile (interests, aptitude, personality, constraints…)
  profile             jsonb not null default '{}'::jsonb,
  -- per-dimension confidence + meta
  completeness_pct    int not null default 0 check (completeness_pct between 0 and 100),
  confidence          jsonb not null default '{}'::jsonb,   -- { dimension: 0..1 }
  conflict_flags      jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_profiles_session on public.student_profiles(session_id);

-- ---------------------------------------------------------------------------
-- assessment_responses: item-level aptitude / personality answers.
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_responses (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions(id) on delete cascade,
  item_id       text not null,              -- references seed item bank
  dimension     text not null,              -- numerical|logical|verbal|spatial|scientific|personality
  answer        text not null,
  score         numeric(5,2),               -- normalized contribution
  created_at    timestamptz not null default now()
);
create index if not exists idx_assessment_session on public.assessment_responses(session_id);

-- ---------------------------------------------------------------------------
-- recommendations: final engine output. AI explains; engine decides.
-- ---------------------------------------------------------------------------
create table if not exists public.recommendations (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.sessions(id) on delete cascade,
  kb_version        text not null,           -- snapshot of KB used (reproducibility)
  -- ranked engine output: array of { career_id, fit_score, confidence, factors,
  -- courses[], exams[], skills[], alternatives[] }
  results           jsonb not null,
  overall_confidence numeric(4,3),
  explanation       text,                    -- AI-generated prose over engine facts
  created_at        timestamptz not null default now()
);
create index if not exists idx_recommendations_session on public.recommendations(session_id, created_at);
