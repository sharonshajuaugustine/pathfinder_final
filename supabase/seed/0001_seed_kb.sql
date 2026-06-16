-- ============================================================================
-- 0001_seed_kb.sql  (KB VERSION 1 — STARTER SEED)
--
-- Representative, runnable subset so the scoring + recommendation engines work
-- end-to-end. This is NOT the full MVP catalog — it seeds 15 domains and 6
-- careers spanning all streams, with their courses, exams, eligibility, signals,
-- and skills.
--
-- To reach the full MVP (~40 careers / ~30 courses / ~15 exams) follow
-- src/data/seed/README.md. Every fee/eligibility/exam row MUST be human-verified
-- before launch.
--
-- Run AFTER 0001..0004 migrations. Idempotent via ON CONFLICT.
-- ============================================================================

-- ---- domains (15) ----------------------------------------------------------
insert into public.domains (id, name, sort_order) values
  ('engineering','Engineering & Technology',1),
  ('computing','Computing, Data & AI',2),
  ('medical','Medical & Clinical',3),
  ('allied_health','Allied Health & Paramedical',4),
  ('sciences','Pure & Applied Sciences',5),
  ('commerce_finance','Commerce, Accounting & Finance',6),
  ('management','Business & Management',7),
  ('law','Law & Legal Services',8),
  ('design','Design & Creative Arts',9),
  ('media','Media & Communication',10),
  ('architecture','Architecture & Built Environment',11),
  ('agriculture','Agriculture, Food & Environment',12),
  ('humanities','Humanities, Education & Social Sciences',13),
  ('government','Government, Defence & Civil Services',14),
  ('hospitality','Hospitality & Tourism',15)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- ---- exams -----------------------------------------------------------------
insert into public.exams (id, name, scope, conducting_body, eligible_streams, required_subjects, typical_window, difficulty) values
  ('keam','KEAM','Kerala-state','CEE Kerala', array['science_maths','science_cs'], array['physics','chemistry','maths'],'April–May','hard'),
  ('neet','NEET-UG','National','NTA', array['science_bio'], array['physics','chemistry','biology'],'May','very-hard'),
  ('jee_main','JEE Main','National','NTA', array['science_maths','science_cs'], array['physics','chemistry','maths'],'Jan & April','hard'),
  ('clat','CLAT','National','Consortium of NLUs', array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[],'December','hard'),
  ('ca_foundation','CA Foundation','National','ICAI', array['commerce','science_maths','science_cs','humanities'], array[]::text[],'Jun & Dec','hard')
on conflict (id) do nothing;

-- ---- courses ---------------------------------------------------------------
insert into public.courses (id, name, category, level, duration_years, stream_required, core_subjects_required, typical_fee_band, availability_kerala, notes) values
  ('btech_cse','B.Tech Computer Science','UG-Engineering','UG',4, array['science_maths','science_cs'], array['physics','chemistry','maths'],'high','abundant','Govt & self-financing; KEAM or JEE entry'),
  ('btech_mech','B.Tech Mechanical','UG-Engineering','UG',4, array['science_maths','science_cs'], array['physics','chemistry','maths'],'high','abundant',null),
  ('diploma_cs','Diploma in Computer Engineering','Diploma','Diploma',3, array['science_maths','science_cs','commerce','humanities'], array[]::text[],'low','abundant','Polytechnic; low-cost route into tech'),
  ('mbbs','MBBS','UG-Medical','UG',5.5, array['science_bio'], array['physics','chemistry','biology'],'very-high','limited','Govt seats via NEET; high competition'),
  ('bsc_nursing','B.Sc Nursing','UG-Medical','UG',4, array['science_bio'], array['biology'],'medium','abundant','Strong employment + abroad demand'),
  ('bcom','B.Com','UG-Commerce','UG',3, array['commerce','humanities'], array[]::text[],'low','abundant','Foundation for CA/finance careers'),
  ('ca_track','CA (Chartered Accountancy)','Professional-Cert','Professional',4, array['commerce','science_maths','science_cs','humanities'], array[]::text[],'low','abundant','ICAI; can pursue with B.Com'),
  ('ballb','BA LLB (5-year integrated)','UG-Law','Integrated-PG',5, array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[],'high','limited','CLAT / KLEE entry')
on conflict (id) do nothing;

-- ---- careers (6) -----------------------------------------------------------
insert into public.careers (id, name, domain_id, short_description, riasec_codes, personality_fit, earning_band, job_market_kerala, job_market_india, higher_study_required, risk_level, min_years_to_earn) values
  ('software_engineer','Software Engineer','computing','Build software, apps and systems.', array['investigative','conventional'], array['analytical','structured'],'high','strong','strong','none','moderate',4),
  ('mechanical_engineer','Mechanical Engineer','engineering','Design and build machines and systems.', array['realistic','investigative'], array['analytical','practical'],'medium','moderate','strong','preferred','stable',4),
  ('doctor','Doctor (MBBS)','medical','Diagnose and treat patients.', array['investigative','social'], array['analytical','social'],'high','strong','strong','mandatory','stable',6),
  ('nurse','Nurse','allied_health','Patient care in hospitals and clinics.', array['social','realistic'], array['social','structured'],'medium','strong','strong','none','stable',4),
  ('chartered_accountant','Chartered Accountant','commerce_finance','Audit, tax, and financial advisory.', array['conventional','enterprising'], array['analytical','structured'],'high','strong','strong','none','stable',4),
  ('lawyer','Lawyer','law','Advise and represent clients in legal matters.', array['enterprising','social'], array['analytical','social'],'variable','moderate','strong','none','moderate',5)
on conflict (id) do nothing;

-- ---- career_course ---------------------------------------------------------
insert into public.career_course (career_id, course_id, route_type, strength, pathway_note) values
  ('software_engineer','btech_cse','primary',1.0,'B.Tech CSE → Software Engineer'),
  ('software_engineer','diploma_cs','fallback',0.7,'Diploma → lateral entry / junior developer'),
  ('mechanical_engineer','btech_mech','primary',1.0,null),
  ('mechanical_engineer','diploma_cs','fallback',0.5,'Diploma route if marks/budget limited'),
  ('doctor','mbbs','primary',1.0,'NEET → MBBS'),
  ('doctor','bsc_nursing','fallback',0.5,'Allied-health alternative within healthcare'),
  ('nurse','bsc_nursing','primary',1.0,null),
  ('chartered_accountant','ca_track','primary',1.0,null),
  ('chartered_accountant','bcom','alternative',0.8,'B.Com alongside CA'),
  ('lawyer','ballb','primary',1.0,'CLAT → BA LLB')
on conflict do nothing;

-- ---- course_exam -----------------------------------------------------------
insert into public.course_exam (course_id, exam_id, requirement, region) values
  ('btech_cse','keam','one-of','Kerala'),
  ('btech_cse','jee_main','one-of','National'),
  ('btech_mech','keam','one-of','Kerala'),
  ('mbbs','neet','mandatory','National'),
  ('bsc_nursing','neet','optional','National'),
  ('ca_track','ca_foundation','mandatory','National'),
  ('ballb','clat','one-of','National')
on conflict do nothing;

-- ---- eligibility_rules -----------------------------------------------------
insert into public.eligibility_rules (course_id, required_stream, required_subjects, min_aggregate_pct) values
  ('btech_cse', array['science_maths','science_cs'], array['physics','chemistry','maths'], 50),
  ('btech_mech', array['science_maths','science_cs'], array['physics','chemistry','maths'], 50),
  ('diploma_cs', array['science_maths','science_cs','commerce','humanities'], array[]::text[], 35),
  ('mbbs', array['science_bio'], array['physics','chemistry','biology'], 50),
  ('bsc_nursing', array['science_bio'], array['biology'], 45),
  ('bcom', array['commerce','humanities'], array[]::text[], 40),
  ('ca_track', array['commerce','science_maths','science_cs','humanities'], array[]::text[], 50),
  ('ballb', array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 45)
on conflict do nothing;

-- ---- career_signal (matching weights — the accuracy engine) -----------------
-- interests (0..1), aptitudes (0..1 weight), personality (0..1 weight)
insert into public.career_signal (career_id, signal_type, signal_key, weight) values
  -- software_engineer
  ('software_engineer','interest','technology_coding',1.0),
  ('software_engineer','interest','numbers_analysis',0.6),
  ('software_engineer','aptitude','logical',1.0),
  ('software_engineer','aptitude','numerical',0.7),
  ('software_engineer','personality','analytical',0.9),
  -- mechanical_engineer
  ('mechanical_engineer','interest','building_engineering',1.0),
  ('mechanical_engineer','interest','technology_coding',0.4),
  ('mechanical_engineer','aptitude','spatial',0.9),
  ('mechanical_engineer','aptitude','numerical',0.8),
  ('mechanical_engineer','personality','practical',0.8),
  -- doctor
  ('doctor','interest','health_medicine',1.0),
  ('doctor','interest','science_research',0.6),
  ('doctor','aptitude','scientific',1.0),
  ('doctor','aptitude','verbal',0.5),
  ('doctor','personality','social',0.7),
  -- nurse
  ('nurse','interest','health_medicine',0.9),
  ('nurse','interest','helping_teaching',0.8),
  ('nurse','aptitude','scientific',0.6),
  ('nurse','personality','social',0.9),
  -- chartered_accountant
  ('chartered_accountant','interest','business_money',1.0),
  ('chartered_accountant','interest','numbers_analysis',0.9),
  ('chartered_accountant','aptitude','numerical',1.0),
  ('chartered_accountant','aptitude','logical',0.7),
  ('chartered_accountant','personality','structured',0.9),
  -- lawyer
  ('lawyer','interest','law_justice',1.0),
  ('lawyer','interest','media_communication',0.5),
  ('lawyer','aptitude','verbal',1.0),
  ('lawyer','aptitude','logical',0.7),
  ('lawyer','personality','social',0.6)
on conflict do nothing;

-- ---- career_skills (roadmap) -----------------------------------------------
insert into public.career_skills (career_id, skill_name, stage, resource_type, sort_order) values
  ('software_engineer','Programming basics (Python/C)','foundation','self-study',1),
  ('software_engineer','Data structures & algorithms','intermediate','course',2),
  ('software_engineer','Build & deploy a real project','advanced','project',3),
  ('doctor','Strong biology & chemistry fundamentals','foundation','self-study',1),
  ('doctor','NEET preparation','intermediate','exam',2),
  ('chartered_accountant','Accounting fundamentals','foundation','self-study',1),
  ('chartered_accountant','CA Foundation','intermediate','exam',2),
  ('nurse','Biology fundamentals','foundation','self-study',1),
  ('nurse','Clinical training','advanced','course',2),
  ('lawyer','Reading & reasoning practice','foundation','self-study',1),
  ('lawyer','CLAT preparation','intermediate','exam',2)
on conflict do nothing;
