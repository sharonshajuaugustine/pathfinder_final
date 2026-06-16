-- ============================================================================
-- 0002_knowledge_base.sql
-- Verified knowledge base. Facts in catalog tables; matching signals in
-- weighted join tables. This is the source of truth — the AI never invents
-- a career, course, fee, exam, or cutoff.
--
-- Tables:
--   domains, careers, courses, exams                (catalog)
--   career_course, course_exam                      (relationships)
--   eligibility_rules                               (hard filters)
--   career_signal                                   (matching weights)
--   career_skills                                   (roadmap)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- domains: 15 controlled top-level career domains.
-- ---------------------------------------------------------------------------
create table if not exists public.domains (
  id          text primary key,             -- slug, e.g. 'computing'
  name        text not null,
  description text,
  sort_order  int not null default 0
);

-- ---------------------------------------------------------------------------
-- careers: the recommendable career path.
-- ---------------------------------------------------------------------------
create table if not exists public.careers (
  id                    text primary key,    -- slug, e.g. 'software_engineer'
  name                  text not null,
  domain_id             text not null references public.domains(id),
  field                 text,
  short_description     text,
  typical_roles         text[] default '{}',
  riasec_codes          text[] default '{}', -- subset of R,I,A,S,E,C
  personality_fit       text[] default '{}',
  earning_band          text check (earning_band in ('low','medium','high','variable')),
  job_market_kerala     text check (job_market_kerala in ('weak','moderate','strong')),
  job_market_india      text check (job_market_india in ('weak','moderate','strong')),
  higher_study_required text check (higher_study_required in ('none','preferred','mandatory')),
  risk_level            text check (risk_level in ('stable','moderate','entrepreneurial')),
  min_years_to_earn     int,
  status                text not null default 'published' check (status in ('draft','published')),
  kb_version            text not null default '1'
);
create index if not exists idx_careers_domain on public.careers(domain_id);

-- ---------------------------------------------------------------------------
-- courses: recommendable academic path (UG / diploma / integrated / pro).
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id                    text primary key,    -- slug, e.g. 'btech_cse'
  name                  text not null,
  category              text not null
                          check (category in ('UG-Engineering','UG-Medical','UG-Science',
                                              'UG-Commerce','UG-Arts','UG-Design','UG-Law',
                                              'Diploma','Integrated','Professional-Cert')),
  level                 text not null check (level in ('Diploma','UG','Integrated-PG','Professional')),
  duration_years        numeric(3,1),
  stream_required       text[] default '{}', -- science_bio|science_maths|science_cs|commerce|humanities|any
  core_subjects_required text[] default '{}',
  typical_fee_band      text check (typical_fee_band in ('low','medium','high','very-high')),
  availability_kerala   text check (availability_kerala in ('abundant','limited','rare')),
  leads_to_higher_study text[] default '{}', -- course ids
  notes                 text,
  status                text not null default 'published' check (status in ('draft','published')),
  kb_version            text not null default '1'
);

-- ---------------------------------------------------------------------------
-- exams: entrance exams (closed list for MVP).
-- ---------------------------------------------------------------------------
create table if not exists public.exams (
  id                text primary key,        -- slug, e.g. 'keam'
  name              text not null,
  scope             text not null check (scope in ('Kerala-state','National','Institute-specific')),
  conducting_body   text,
  eligible_streams  text[] default '{}',
  required_subjects text[] default '{}',
  typical_window    text,                    -- month(s), not exact dates
  difficulty        text check (difficulty in ('moderate','hard','very-hard')),
  kb_version        text not null default '1'
);

-- ---------------------------------------------------------------------------
-- career_course: many-to-many. primary / alternative / fallback / higher-study.
-- ---------------------------------------------------------------------------
create table if not exists public.career_course (
  career_id     text not null references public.careers(id) on delete cascade,
  course_id     text not null references public.courses(id) on delete cascade,
  route_type    text not null check (route_type in ('primary','alternative','fallback','higher-study-route')),
  strength      numeric(3,2) not null default 1.0 check (strength between 0 and 1),
  pathway_note  text,
  primary key (career_id, course_id, route_type)
);

-- ---------------------------------------------------------------------------
-- course_exam: which exams gate a course, and how.
-- ---------------------------------------------------------------------------
create table if not exists public.course_exam (
  course_id   text not null references public.courses(id) on delete cascade,
  exam_id     text not null references public.exams(id) on delete cascade,
  requirement text not null check (requirement in ('mandatory','one-of','optional','not-required')),
  region      text check (region in ('Kerala','National')),
  primary key (course_id, exam_id)
);

-- ---------------------------------------------------------------------------
-- eligibility_rules: machine-evaluable HARD FILTERS for a course.
-- ---------------------------------------------------------------------------
create table if not exists public.eligibility_rules (
  id                uuid primary key default gen_random_uuid(),
  course_id         text not null references public.courses(id) on delete cascade,
  required_stream   text[] default '{}',     -- OR semantics
  required_subjects text[] default '{}',     -- AND semantics
  min_aggregate_pct numeric(5,2),
  min_subject_pct   jsonb default '{}'::jsonb,
  age_min           int,
  age_max           int,
  other_constraints text[] default '{}'      -- e.g. physical-fitness, no-color-blindness
);
create index if not exists idx_eligibility_course on public.eligibility_rules(course_id);

-- ---------------------------------------------------------------------------
-- career_signal: the matching intelligence. Each career weighted 0..1 against
-- interest clusters, aptitudes, and personality traits. Drives scoring.
-- signal_type: 'interest' | 'aptitude' | 'personality'
-- ---------------------------------------------------------------------------
create table if not exists public.career_signal (
  career_id   text not null references public.careers(id) on delete cascade,
  signal_type text not null check (signal_type in ('interest','aptitude','personality')),
  signal_key  text not null,                 -- e.g. 'technology_coding', 'logical', 'analytical'
  weight      numeric(3,2) not null check (weight between 0 and 1),
  primary key (career_id, signal_type, signal_key)
);

-- ---------------------------------------------------------------------------
-- career_skills: skill roadmap per career (foundation -> advanced).
-- ---------------------------------------------------------------------------
create table if not exists public.career_skills (
  id            uuid primary key default gen_random_uuid(),
  career_id     text not null references public.careers(id) on delete cascade,
  skill_name    text not null,
  stage         text not null check (stage in ('foundation','intermediate','advanced')),
  resource_type text check (resource_type in ('course','certification','project','exam','self-study')),
  sort_order    int not null default 0
);
create index if not exists idx_skills_career on public.career_skills(career_id);
