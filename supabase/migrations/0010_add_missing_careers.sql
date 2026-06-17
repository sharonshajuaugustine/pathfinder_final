-- ============================================================================
-- Migration 0010: Add 10 high-demand careers missing from the KB (KB v3).
--
-- The original 40-career catalog covered ~51% of common Kerala student
-- aspirations. Students wanting Game Developer, Veterinarian, Marine Biologist,
-- AI/ML Engineer, Chef, etc. were silently given the nearest match. This adds
-- the 10 highest-demand gaps with full course routes, signals, and skills.
--
-- New careers: ai_ml_engineer, game_developer, mobile_app_developer,
--   veterinarian, biotechnologist, marine_biologist, microbiologist,
--   chef_culinary, event_manager, social_worker.
--
-- New courses: bvsc, bsw, bsc_culinary (others reuse existing courses).
-- All inserts are idempotent (ON CONFLICT DO NOTHING / explicit upserts).
-- ============================================================================

-- ── 1. NEW COURSES ──────────────────────────────────────────────────────────
insert into public.courses
  (id, name, category, level, duration_years, stream_required, core_subjects_required,
   typical_fee_band, availability_kerala, leads_to_higher_study, notes, status, kb_version) values

  ('bvsc', 'BVSc & AH (Veterinary Science & Animal Husbandry)', 'UG-Medical', 'UG', 5,
   array['science_bio'], array['biology','chemistry'],
   'low', 'limited', array[]::text[],
   'Admission via NEET-UG; 5.5 years including internship. Leads to government/private veterinary practice.',
   'published', '3'),

  ('bsw', 'BSW (Bachelor of Social Work)', 'UG-Arts', 'UG', 3,
   array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[],
   'low', 'abundant', array[]::text[],
   'Entry to NGO/community/welfare work; MSW recommended for senior roles.',
   'published', '3'),

  ('bsc_culinary', 'B.Sc Culinary Arts / Catering Technology', 'UG-Arts', 'UG', 3,
   array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[],
   'medium', 'limited', array[]::text[],
   'Professional cooking and kitchen management; pathway to chef roles in hotels and restaurants.',
   'published', '3')

on conflict (id) do nothing;

-- ── 2. ELIGIBILITY RULES for new courses ────────────────────────────────────
insert into public.eligibility_rules
  (course_id, required_stream, required_subjects, min_aggregate_pct, min_subject_pct, other_constraints) values
  ('bvsc',        array['science_bio'], array['biology','chemistry'], 50, '{}'::jsonb, array[]::text[]),
  ('bsw',         array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 45, '{}'::jsonb, array[]::text[]),
  ('bsc_culinary',array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 45, '{}'::jsonb, array[]::text[])
on conflict do nothing;

-- ── 3. COURSE-EXAM links ────────────────────────────────────────────────────
insert into public.course_exam (course_id, exam_id, requirement, region) values
  ('bvsc', 'neet', 'mandatory', 'National')
on conflict do nothing;

-- ── 4. CAREERS ──────────────────────────────────────────────────────────────
insert into public.careers
  (id, name, domain_id, short_description, riasec_codes, personality_fit,
   earning_band, job_market_kerala, job_market_india, higher_study_required,
   risk_level, min_years_to_earn, status, kb_version) values

  ('ai_ml_engineer', 'AI / Machine Learning Engineer', 'computing',
   'Build intelligent systems and machine-learning models that learn from data.',
   array['investigative','conventional'], array['analytical','structured'],
   'high','moderate','strong','preferred','moderate',5,'published','3'),

  ('game_developer', 'Game Developer / Game Designer', 'computing',
   'Design and build video games — programming, graphics, and interactive systems.',
   array['investigative','artistic'], array['practical','structured'],
   'variable','weak','moderate','none','moderate',4,'published','3'),

  ('mobile_app_developer', 'Mobile App Developer', 'computing',
   'Build mobile apps for Android and iOS used by millions of people.',
   array['investigative','conventional'], array['practical','structured'],
   'high','moderate','strong','none','moderate',3,'published','3'),

  ('veterinarian', 'Veterinarian (BVSc)', 'medical',
   'Diagnose and treat animals — pets, livestock, and wildlife health.',
   array['investigative','realistic'], array['practical','analytical'],
   'medium','moderate','moderate','none','stable',5,'published','3'),

  ('biotechnologist', 'Biotechnologist', 'sciences',
   'Apply biology and technology to develop medicines, foods, and bio-products.',
   array['investigative','realistic'], array['analytical','structured'],
   'medium','moderate','moderate','preferred','moderate',5,'published','3'),

  ('marine_biologist', 'Marine Biologist', 'sciences',
   'Study ocean life and ecosystems — research, conservation, and fisheries science.',
   array['investigative','realistic'], array['analytical','practical'],
   'medium','moderate','moderate','preferred','moderate',5,'published','3'),

  ('microbiologist', 'Microbiologist', 'sciences',
   'Study microorganisms to fight disease, improve food safety, and aid research.',
   array['investigative','conventional'], array['analytical','structured'],
   'medium','moderate','moderate','preferred','stable',5,'published','3'),

  ('chef_culinary', 'Chef / Culinary Artist', 'hospitality',
   'Create dishes and lead kitchens in restaurants, hotels, and food businesses.',
   array['realistic','artistic'], array['practical','social'],
   'variable','moderate','strong','none','entrepreneurial',3,'published','3'),

  ('event_manager', 'Event Manager', 'management',
   'Plan and run events — weddings, corporate functions, concerts, and festivals.',
   array['enterprising','social'], array['social','risk_taking'],
   'variable','moderate','strong','none','entrepreneurial',3,'published','3'),

  ('social_worker', 'Social Worker / NGO Professional', 'humanities',
   'Support communities and vulnerable people through welfare, NGOs, and development work.',
   array['social','investigative'], array['social'],
   'low','strong','moderate','preferred','stable',3,'published','3')

on conflict (id) do nothing;

-- ── 5. CAREER → COURSE routes ───────────────────────────────────────────────
insert into public.career_course (career_id, course_id, route_type, strength, pathway_note) values
  ('ai_ml_engineer','btech_cse','primary',1.0,'B.Tech CSE/AI → ML engineering roles'),
  ('ai_ml_engineer','bsc_cs','alternative',0.8,'B.Sc CS + ML specialisation; M.Sc/MTech recommended'),
  ('ai_ml_engineer','bca','fallback',0.6,'BCA + strong self-study and projects'),

  ('game_developer','btech_cse','primary',0.9,'B.Tech CSE → game programming'),
  ('game_developer','bsc_cs','alternative',0.8,'B.Sc CS + game-dev portfolio'),
  ('game_developer','bca','fallback',0.7,'BCA + Unity/Unreal projects'),

  ('mobile_app_developer','btech_cse','primary',1.0,'B.Tech CSE → mobile development'),
  ('mobile_app_developer','bsc_cs','alternative',0.8,'B.Sc CS → app developer'),
  ('mobile_app_developer','bca','alternative',0.7,'BCA → app developer'),
  ('mobile_app_developer','diploma_cs','fallback',0.6,'Diploma → junior app developer'),

  ('veterinarian','bvsc','primary',1.0,'BVSc & AH via NEET → veterinary practice'),

  ('biotechnologist','bsc_lifescience','primary',1.0,'B.Sc Biotechnology → M.Sc → industry/research'),
  ('biotechnologist','btech_food','alternative',0.5,'B.Tech-route food/bioprocess specialisation'),

  ('marine_biologist','bsc_lifescience','primary',0.8,'B.Sc Life Science → M.Sc Marine Biology'),
  ('marine_biologist','bsc_envscience','alternative',0.8,'B.Sc Environmental Science → marine specialisation'),

  ('microbiologist','bsc_lifescience','primary',1.0,'B.Sc Microbiology → M.Sc → labs/research'),

  ('chef_culinary','bsc_culinary','primary',1.0,'Culinary Arts programme → professional chef'),
  ('chef_culinary','bhm','alternative',0.7,'Hotel Management → kitchen/F&B route'),

  ('event_manager','bba','primary',0.9,'BBA / event management → event roles'),
  ('event_manager','bhm','alternative',0.6,'Hospitality route into events'),
  ('event_manager','ba_general','fallback',0.5,'BA + internships and portfolio'),

  ('social_worker','bsw','primary',1.0,'BSW → MSW → NGO/welfare/development work'),
  ('social_worker','bsc_psychology','alternative',0.6,'Psychology route into counselling/welfare'),
  ('social_worker','ba_general','fallback',0.5,'BA Sociology/Social Science + fieldwork')
on conflict do nothing;

-- ── 6. CAREER SIGNALS (interest / aptitude / personality) ───────────────────
insert into public.career_signal (career_id, signal_type, signal_key, weight) values
  -- ai_ml_engineer
  ('ai_ml_engineer','interest','technology_coding',1.0),
  ('ai_ml_engineer','interest','numbers_analysis',0.7),
  ('ai_ml_engineer','interest','science_research',0.4),
  ('ai_ml_engineer','aptitude','logical',1.0),
  ('ai_ml_engineer','aptitude','numerical',0.9),
  ('ai_ml_engineer','personality','analytical',0.9),
  ('ai_ml_engineer','personality','structured',0.6),

  -- game_developer
  ('game_developer','interest','technology_coding',1.0),
  ('game_developer','interest','design_visual',0.7),
  ('game_developer','aptitude','logical',0.9),
  ('game_developer','aptitude','spatial',0.6),
  ('game_developer','personality','practical',0.7),
  ('game_developer','personality','structured',0.5),

  -- mobile_app_developer
  ('mobile_app_developer','interest','technology_coding',1.0),
  ('mobile_app_developer','interest','design_visual',0.5),
  ('mobile_app_developer','aptitude','logical',0.9),
  ('mobile_app_developer','aptitude','numerical',0.6),
  ('mobile_app_developer','personality','practical',0.7),
  ('mobile_app_developer','personality','structured',0.6),

  -- veterinarian
  ('veterinarian','interest','health_medicine',0.8),
  ('veterinarian','interest','nature_agriculture',0.8),
  ('veterinarian','interest','science_research',0.4),
  ('veterinarian','aptitude','scientific',0.8),
  ('veterinarian','aptitude','logical',0.6),
  ('veterinarian','personality','practical',0.6),
  ('veterinarian','personality','analytical',0.6),

  -- biotechnologist
  ('biotechnologist','interest','science_research',1.0),
  ('biotechnologist','interest','health_medicine',0.5),
  ('biotechnologist','interest','technology_coding',0.3),
  ('biotechnologist','aptitude','scientific',1.0),
  ('biotechnologist','aptitude','logical',0.7),
  ('biotechnologist','aptitude','numerical',0.5),
  ('biotechnologist','personality','analytical',0.8),
  ('biotechnologist','personality','structured',0.5),

  -- marine_biologist
  ('marine_biologist','interest','science_research',1.0),
  ('marine_biologist','interest','nature_agriculture',0.9),
  ('marine_biologist','aptitude','scientific',1.0),
  ('marine_biologist','aptitude','logical',0.6),
  ('marine_biologist','personality','analytical',0.7),
  ('marine_biologist','personality','practical',0.5),

  -- microbiologist
  ('microbiologist','interest','science_research',1.0),
  ('microbiologist','interest','health_medicine',0.5),
  ('microbiologist','aptitude','scientific',1.0),
  ('microbiologist','aptitude','logical',0.6),
  ('microbiologist','personality','analytical',0.8),
  ('microbiologist','personality','structured',0.6),

  -- chef_culinary
  ('chef_culinary','interest','design_visual',0.6),
  ('chef_culinary','interest','business_money',0.4),
  ('chef_culinary','interest','helping_teaching',0.3),
  ('chef_culinary','aptitude','spatial',0.4),
  ('chef_culinary','aptitude','verbal',0.3),
  ('chef_culinary','personality','practical',0.8),
  ('chef_culinary','personality','social',0.5),

  -- event_manager
  ('event_manager','interest','business_money',0.7),
  ('event_manager','interest','media_communication',0.6),
  ('event_manager','interest','helping_teaching',0.4),
  ('event_manager','aptitude','verbal',0.6),
  ('event_manager','aptitude','numerical',0.4),
  ('event_manager','personality','social',0.8),
  ('event_manager','personality','risk_taking',0.6),

  -- social_worker
  ('social_worker','interest','helping_teaching',1.0),
  ('social_worker','interest','law_justice',0.4),
  ('social_worker','interest','science_research',0.2),
  ('social_worker','aptitude','verbal',0.7),
  ('social_worker','aptitude','logical',0.3),
  ('social_worker','personality','social',0.9)
on conflict do nothing;

-- ── 7. CAREER SKILLS (3 stages each) ────────────────────────────────────────
insert into public.career_skills (career_id, skill_name, stage, resource_type, sort_order) values
  ('ai_ml_engineer','Programming + mathematics & statistics foundations','foundation','self-study',1),
  ('ai_ml_engineer','Machine learning (Python, scikit-learn, deep learning)','intermediate','course',2),
  ('ai_ml_engineer','Build & deploy a real ML/AI project','advanced','project',3),

  ('game_developer','Programming basics (C#, C++)','foundation','self-study',1),
  ('game_developer','Game engine + design (Unity / Unreal)','intermediate','course',2),
  ('game_developer','Build & publish a playable game','advanced','project',3),

  ('mobile_app_developer','Programming fundamentals','foundation','self-study',1),
  ('mobile_app_developer','Mobile frameworks (Flutter / Kotlin / React Native)','intermediate','course',2),
  ('mobile_app_developer','Build & publish your own app','advanced','project',3),

  ('veterinarian','Strong Biology foundation','foundation','self-study',1),
  ('veterinarian','BVSc & AH degree (via NEET)','intermediate','course',2),
  ('veterinarian','Clinical internship with animals','advanced','project',3),

  ('biotechnologist','Biology & chemistry foundation','foundation','self-study',1),
  ('biotechnologist','B.Sc / M.Sc Biotechnology','intermediate','course',2),
  ('biotechnologist','Lab research project or industry internship','advanced','project',3),

  ('marine_biologist','Biology & ecology foundation','foundation','self-study',1),
  ('marine_biologist','B.Sc Life/Marine Science → M.Sc','intermediate','course',2),
  ('marine_biologist','Field research / marine internship','advanced','project',3),

  ('microbiologist','Biology & chemistry foundation','foundation','self-study',1),
  ('microbiologist','B.Sc Microbiology → M.Sc','intermediate','course',2),
  ('microbiologist','Laboratory research project','advanced','project',3),

  ('chef_culinary','Cooking fundamentals & kitchen hygiene','foundation','self-study',1),
  ('chef_culinary','Culinary arts / catering programme','intermediate','course',2),
  ('chef_culinary','Restaurant / hotel kitchen internship','advanced','project',3),

  ('event_manager','Communication & organising skills','foundation','self-study',1),
  ('event_manager','BBA / event management programme','intermediate','course',2),
  ('event_manager','Plan & run a real event (internship)','advanced','project',3),

  ('social_worker','Empathy & communication skills','foundation','self-study',1),
  ('social_worker','BSW / MSW programme','intermediate','course',2),
  ('social_worker','Fieldwork with an NGO or community','advanced','project',3)
on conflict do nothing;
