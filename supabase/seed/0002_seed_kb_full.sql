-- ============================================================================
-- 0002_seed_kb_full.sql  (KB VERSION 2 — FULL MVP SEED)
--
-- Expands the starter seed (0001) from 6 careers to the full ~40-career MVP set.
-- Adds 11 exams, 29 courses, 34 careers, and the complete signal weight matrix.
--
-- DATA ACCURACY NOTES:
--   * Fee bands, cutoff percentages, and exam windows are approximate.
--     Mark them UNVERIFIED and review against official sources before launch.
--   * All exams named are real, nationally/state recognised exams.
--   * Stream eligibility reflects typical Kerala/national norms (not every
--     institution—there are exceptions).
--   * Salary/earning bands reflect broad Indian market ranges, not Kerala-specific.
--
-- SAFE TO RUN:  All inserts use ON CONFLICT DO NOTHING — idempotent.
-- RUN AFTER:   0001_seed_kb.sql (domains + 6 starter careers must already exist).
-- KB VERSION:  Bump KB_VERSION env var to "2" after applying this file.
-- ============================================================================

-- ============================================================================
-- 1. EXAMS (11 new)
-- ============================================================================
insert into public.exams (id, name, scope, conducting_body, eligible_streams, required_subjects, typical_window, difficulty) values

  ('nata',        'NATA (National Aptitude Test in Architecture)',
   'National', 'Council of Architecture',
   array['science_maths','science_cs'],
   array['mathematics','physics'], 'Feb–Jun', 'moderate'),

  ('nift_entrance','NIFT Entrance Test',
   'National', 'National Institute of Fashion Technology',
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[], 'Jan–Feb', 'moderate'),

  ('uceed',       'UCEED (Undergraduate Common Entrance Exam for Design)',
   'National', 'IIT Bombay',
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[], 'January', 'hard'),

  ('nda',         'NDA (National Defence Academy)',
   'National', 'UPSC',
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[], 'April & September', 'hard'),

  ('cds',         'CDS (Combined Defence Services)',
   'National', 'UPSC',
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[], 'February & November', 'hard'),

  ('upsc_cse',    'UPSC Civil Services Examination (IAS/IPS/IFS)',
   'National', 'UPSC',
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[], 'May (Prelims)', 'very-hard'),

  ('kerala_psc',  'Kerala Public Service Commission Examinations',
   'Kerala-state', 'Kerala PSC',
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[], 'Varies by post', 'moderate'),

  ('bank_ibps',   'IBPS PO / SBI PO Examination',
   'National', 'IBPS / SBI',
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[], 'August–November', 'moderate'),

  ('cseet',       'CSEET (Company Secretaries Executive Entrance Test)',
   'National', 'ICSI',
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[], 'May & November', 'moderate'),

  ('ugc_net',     'UGC-NET / JRF (eligibility for lectureship & research)',
   'National', 'NTA',
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[], 'June & December', 'hard'),

  ('nchmct_jee',  'NCHMCT JEE (Hotel Management Joint Entrance)',
   'National', 'NTA / NCHMCT',
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[], 'April', 'moderate')

on conflict (id) do nothing;

-- ============================================================================
-- 2. COURSES (29 new)
-- ============================================================================
-- Streams key:
--   science_bio  = PCB (Biology stream)
--   science_maths= PCM (Maths stream)
--   science_cs   = Computer Science stream
--   commerce     = Commerce stream
--   humanities   = Arts / Humanities stream
-- Fee bands: low=<1L/yr, medium=1-3L/yr, high=3-8L/yr, very-high=>8L/yr
-- ============================================================================

insert into public.courses
  (id, name, category, level, duration_years, stream_required,
   core_subjects_required, typical_fee_band, availability_kerala, notes) values

  -- ── Computing ──────────────────────────────────────────────────────────────
  ('bsc_cs',
   'B.Sc Computer Science',
   'UG-Science','UG', 3,
   array['science_maths','science_cs'],
   array['mathematics'],'medium','abundant',
   'Widely available; good entry for software roles without B.Tech fees'),

  ('bca',
   'BCA (Bachelor of Computer Applications)',
   'UG-Science','UG', 3,
   array['science_maths','science_cs','commerce'],
   array['mathematics'],'low','abundant',
   'Open to Maths-stream students across streams; entry route to software careers'),

  -- ── Engineering ────────────────────────────────────────────────────────────
  ('btech_civil',
   'B.Tech Civil Engineering',
   'UG-Engineering','UG', 4,
   array['science_maths','science_cs'],
   array['physics','chemistry','mathematics'],'high','abundant',
   'KEAM / JEE entry; strong demand in Kerala infrastructure sector'),

  ('btech_eee',
   'B.Tech Electrical & Electronics Engineering',
   'UG-Engineering','UG', 4,
   array['science_maths','science_cs'],
   array['physics','chemistry','mathematics'],'high','abundant',
   'KEAM entry; PSU, KSEB, power sector employment'),

  ('btech_ece',
   'B.Tech Electronics & Communication Engineering',
   'UG-Engineering','UG', 4,
   array['science_maths','science_cs'],
   array['physics','chemistry','mathematics'],'high','abundant',
   'KEAM entry; electronics, telecom, embedded systems'),

  -- ── Medical ────────────────────────────────────────────────────────────────
  ('bds',
   'BDS (Bachelor of Dental Surgery)',
   'UG-Medical','UG', 5,
   array['science_bio'],
   array['physics','chemistry','biology'],'very-high','limited',
   'NEET mandatory; ~5-year course; good private practice potential in Kerala'),

  ('bpharm',
   'B.Pharm (Bachelor of Pharmacy)',
   'UG-Medical','UG', 4,
   array['science_bio','science_maths','science_cs'],
   array['chemistry'],'medium','abundant',
   'Open to PCB and PCM; pharma industry + hospital pharmacy + drug inspector'),

  ('bams',
   'BAMS (Bachelor of Ayurvedic Medicine & Surgery)',
   'UG-Medical','UG', 5.5,
   array['science_bio'],
   array['physics','chemistry','biology'],'medium','limited',
   'Kerala Ayurveda tradition; growing demand; KEAM/state counselling entry. NOTE: NEET required for Ayurveda admissions per recent NMC guidelines — verify current rules.'),

  -- ── Allied Health ──────────────────────────────────────────────────────────
  ('bpt',
   'BPT (Bachelor of Physiotherapy)',
   'UG-Medical','UG', 4.5,
   array['science_bio'],
   array['biology'],'medium','abundant',
   'Strong employment in hospitals, sports rehab, elder care; Kerala + abroad demand'),

  ('bmlt',
   'BMLT (Bachelor of Medical Lab Technology)',
   'UG-Medical','UG', 3,
   array['science_bio'],
   array['biology','chemistry'],'low','limited',
   'Diagnostic labs, hospitals; useful with B.Sc path too'),

  -- ── Pure Sciences ──────────────────────────────────────────────────────────
  ('bsc_lifescience',
   'B.Sc Life Science (Biology / Biotechnology / Biochemistry)',
   'UG-Science','UG', 3,
   array['science_bio'],
   array['biology','chemistry'],'low','abundant',
   'Foundation for research, M.Sc, PhD; also entry to teaching'),

  ('bsc_envscience',
   'B.Sc Environmental Science',
   'UG-Science','UG', 3,
   array['science_bio','science_maths','science_cs'],
   array[]::text[],'low','limited',
   'Environment sector, NGOs, govt agencies; career outlook improving'),

  -- ── Commerce / Finance ─────────────────────────────────────────────────────
  ('bba',
   'BBA (Bachelor of Business Administration)',
   'UG-Commerce','UG', 3,
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[],'medium','abundant',
   'Open to all streams; strong foundation for MBA; management roles'),

  ('cs_track',
   'CS (Company Secretary — ICSI Foundation to Final)',
   'Professional-Cert','Professional', 3,
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[],'low','abundant',
   'ICSI-regulated; can pursue alongside B.Com; strong corporate governance roles'),

  ('mba',
   'MBA (Master of Business Administration)',
   'Professional-Cert','Professional', 2,
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[],'high','abundant',
   'UNVERIFIED fee band — varies widely by institution. Requires any UG degree (planned after Plus Two). Entrance: CAT/MAT/CMAT.'),

  -- ── Arts / Humanities ──────────────────────────────────────────────────────
  ('ba_general',
   'BA (General Arts / Humanities / Social Science)',
   'UG-Arts','UG', 3,
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[],'low','abundant',
   'Open to all streams; foundation for UPSC, teaching, law, media careers'),

  ('bed',
   'B.Ed (Bachelor of Education)',
   'Professional-Cert','Professional', 2,
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[],'low','abundant',
   'Requires any UG degree; mandatory for government school teaching; KEU/university-run'),

  -- ── Design ─────────────────────────────────────────────────────────────────
  ('bdes_comm',
   'B.Des Communication / Graphic Design (or BFA)',
   'UG-Design','UG', 4,
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[],'medium','limited',
   'Includes BFA (Fine Arts) at CUSAT, KU; portfolio + entrance required at most colleges'),

  ('bdes_fashion',
   'B.Des Fashion Design (or NIFT Programme)',
   'UG-Design','UG', 4,
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[],'high','limited',
   'NIFT Bhopal/Kannur for South India applicants; also private fashion institutes'),

  ('bdes_interior',
   'B.Des Interior Design / B.Sc Interior Design',
   'UG-Design','UG', 4,
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[],'medium','limited',
   'Private institutes mostly; NID / CEPT for top ranks'),

  ('bsc_animation',
   'B.Sc Animation / B.Des Animation & VFX',
   'UG-Design','UG', 3,
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[],'medium','limited',
   'Growing sector; private institutes dominant; Toonz Academy Kerala is notable'),

  -- ── Architecture ───────────────────────────────────────────────────────────
  ('barch',
   'B.Arch (Bachelor of Architecture)',
   'UG-Design','UG', 5,
   array['science_maths','science_cs'],
   array['mathematics','physics'],'high','limited',
   'NATA mandatory; 5-year professional degree; Council of Architecture regulated'),

  -- ── Media / Journalism ─────────────────────────────────────────────────────
  ('bjmc',
   'BJMC / BA Journalism & Mass Communication',
   'UG-Arts','UG', 3,
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[],'low','abundant',
   'Open to all streams; Kerala has strong media industry; IIMC/ACJ for top roles'),

  -- ── Agriculture ────────────────────────────────────────────────────────────
  ('bsc_agriculture',
   'B.Sc Agriculture (Hons)',
   'UG-Science','UG', 4,
   array['science_bio','science_maths','science_cs'],
   array['biology','chemistry'],'low','abundant',
   'KAU (Kerala Agricultural University) is the main institution; good govt job prospects'),

  ('btech_food',
   'B.Tech Food Technology / B.Sc Food Science',
   'UG-Engineering','UG', 4,
   array['science_bio','science_maths','science_cs'],
   array['chemistry'],'medium','limited',
   'Food processing, FSSAI, export firms; KEAM for KAU entry'),

  ('bsc_nutrition',
   'B.Sc Nutrition & Dietetics / Foods & Nutrition',
   'UG-Science','UG', 3,
   array['science_bio'],
   array['biology','chemistry'],'low','abundant',
   'Hospitals, public health, private practice; diaspora demand for dietitians'),

  -- ── Psychology ─────────────────────────────────────────────────────────────
  ('bsc_psychology',
   'B.Sc / BA Psychology',
   'UG-Science','UG', 3,
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[],'low','abundant',
   'Growing field in Kerala; clinical roles need M.Sc + RCI licence'),

  -- ── Hospitality ────────────────────────────────────────────────────────────
  ('bhm',
   'BHM / B.Sc Hospitality & Hotel Administration',
   'UG-Arts','UG', 3,
   array['science_bio','science_maths','science_cs','commerce','humanities'],
   array[]::text[],'medium','limited',
   'NCHMCT JEE for IHM seats (most prestigious); private institutes also available'),

  -- ── Aviation ───────────────────────────────────────────────────────────────
  ('cpl_training',
   'CPL (Commercial Pilot Licence) Training',
   'Professional-Cert','Professional', 2.5,
   array['science_maths','science_cs'],
   array['physics','mathematics'],'very-high','rare',
   'DGCA-regulated; requires Class 2 medical; 200+ flying hours; cost ₹40-70L at Indian flying clubs. NOT a university degree — a DGCA licence. Verify current DGCA requirements.')

on conflict (id) do nothing;

-- ============================================================================
-- 3. CAREERS (34 new, to reach 40 total)
-- ============================================================================
insert into public.careers
  (id, name, domain_id, short_description,
   riasec_codes, personality_fit,
   earning_band, job_market_kerala, job_market_india,
   higher_study_required, risk_level, min_years_to_earn) values

  -- ── Computing ──────────────────────────────────────────────────────────────
  ('data_scientist',
   'Data Scientist',
   'computing',
   'Extract insights from large datasets using statistics and machine learning.',
   array['investigative','conventional'], array['analytical','structured'],
   'high','moderate','strong','preferred','moderate',5),

  ('cybersecurity_analyst',
   'Cybersecurity Analyst',
   'computing',
   'Protect systems and networks from digital threats and breaches.',
   array['investigative','realistic'], array['analytical','structured'],
   'high','moderate','strong','preferred','stable',4),

  -- ── Engineering ────────────────────────────────────────────────────────────
  ('civil_engineer',
   'Civil Engineer',
   'engineering',
   'Plan and build infrastructure: roads, bridges, buildings, water systems.',
   array['realistic','investigative'], array['analytical','practical'],
   'medium','strong','strong','preferred','stable',4),

  ('electrical_engineer',
   'Electrical Engineer',
   'engineering',
   'Design electrical systems: power grids, motors, transformers.',
   array['realistic','investigative'], array['analytical','practical'],
   'medium','strong','strong','preferred','stable',4),

  ('electronics_engineer',
   'Electronics & Communication Engineer',
   'engineering',
   'Design circuits, communication systems, and embedded devices.',
   array['realistic','investigative'], array['analytical','practical'],
   'medium','moderate','strong','preferred','stable',4),

  -- ── Medical ────────────────────────────────────────────────────────────────
  ('dentist',
   'Dentist (BDS)',
   'medical',
   'Diagnose and treat oral health conditions; surgical and preventive care.',
   array['investigative','realistic'], array['practical','social'],
   'high','strong','strong','none','stable',5),

  ('pharmacist',
   'Pharmacist',
   'medical',
   'Dispense medicines, advise patients, and manage pharmaceutical supply.',
   array['investigative','conventional'], array['analytical','structured'],
   'medium','strong','strong','none','stable',4),

  ('ayurveda_practitioner',
   'Ayurveda Doctor (BAMS)',
   'medical',
   'Treat patients using classical Ayurvedic medicine; growing wellness demand.',
   array['investigative','social'], array['analytical','social'],
   'medium','strong','strong','none','stable',6),

  -- ── Allied Health ──────────────────────────────────────────────────────────
  ('physiotherapist',
   'Physiotherapist',
   'allied_health',
   'Rehabilitate patients through exercise, manual therapy, and movement.',
   array['social','realistic'], array['social','practical'],
   'medium','strong','strong','none','stable',4),

  ('medical_lab_technician',
   'Medical Laboratory Technician',
   'allied_health',
   'Conduct diagnostic tests (blood, urine, microbiology) in labs.',
   array['investigative','realistic'], array['analytical','structured'],
   'low','strong','strong','none','stable',3),

  -- ── Sciences ───────────────────────────────────────────────────────────────
  ('research_scientist',
   'Research Scientist',
   'sciences',
   'Conduct original research in biology, chemistry, physics, or allied fields.',
   array['investigative','realistic'], array['analytical'],
   'medium','weak','moderate','mandatory','stable',8),

  ('environmental_scientist',
   'Environmental Scientist',
   'sciences',
   'Study ecosystems, pollution, and climate; advise on sustainable practices.',
   array['investigative','realistic'], array['analytical','practical'],
   'medium','moderate','moderate','preferred','stable',5),

  -- ── Commerce / Finance ─────────────────────────────────────────────────────
  ('bank_officer',
   'Bank Officer (PO / Manager)',
   'commerce_finance',
   'Manage loans, deposits, and banking operations in public/private sector banks.',
   array['conventional','enterprising'], array['structured','analytical'],
   'medium','strong','strong','none','stable',3),

  ('company_secretary',
   'Company Secretary (CS)',
   'commerce_finance',
   'Ensure corporate legal compliance, governance, and regulatory filing.',
   array['conventional','enterprising'], array['structured','analytical'],
   'high','moderate','strong','none','stable',4),

  ('financial_analyst',
   'Financial Analyst',
   'commerce_finance',
   'Analyse investments, financial statements, and market trends for decisions.',
   array['conventional','investigative'], array['analytical','structured'],
   'high','moderate','strong','preferred','moderate',4),

  -- ── Management ─────────────────────────────────────────────────────────────
  ('business_manager',
   'Business Manager / MBA Graduate',
   'management',
   'Oversee operations, strategy, and teams in corporate or entrepreneurial roles.',
   array['enterprising','social'], array['social','risk_taking'],
   'high','moderate','strong','mandatory','moderate',6),

  -- ── Government / Defence ───────────────────────────────────────────────────
  ('civil_services_officer',
   'Civil Services Officer (IAS / IPS / IFS)',
   'government',
   'Serve in Indian Administrative, Police, or Foreign Services via UPSC.',
   array['social','enterprising'], array['analytical','social'],
   'medium','strong','strong','none','stable',5),

  ('defence_officer',
   'Defence Officer (Army / Navy / Air Force)',
   'government',
   'Lead troops or technical units in the armed forces via NDA or CDS.',
   array['realistic','enterprising'], array['practical','risk_taking'],
   'medium','moderate','strong','none','stable',4),

  -- ── Design ─────────────────────────────────────────────────────────────────
  ('graphic_designer',
   'Graphic / UX Designer',
   'design',
   'Create visual communication: brand identity, UI, print, and digital media.',
   array['artistic','investigative'], array['practical'],
   'medium','moderate','strong','none','moderate',3),

  ('fashion_designer',
   'Fashion Designer',
   'design',
   'Design clothing and accessories for retail, export, or fashion labels.',
   array['artistic','enterprising'], array['practical','risk_taking'],
   'variable','weak','moderate','none','entrepreneurial',3),

  ('interior_designer',
   'Interior Designer',
   'design',
   'Plan and design interior spaces for homes, offices, and commercial buildings.',
   array['artistic','realistic'], array['practical'],
   'variable','moderate','strong','none','moderate',3),

  ('animator_3d',
   'Animator / 3D VFX Artist',
   'design',
   'Create animated content and visual effects for films, games, and advertising.',
   array['artistic','investigative'], array['practical'],
   'medium','weak','strong','none','moderate',3),

  -- ── Architecture ───────────────────────────────────────────────────────────
  ('architect',
   'Architect',
   'architecture',
   'Design buildings and spaces; coordinate construction from concept to build.',
   array['realistic','artistic'], array['analytical','practical'],
   'variable','moderate','strong','none','moderate',5),

  -- ── Media / Communication ──────────────────────────────────────────────────
  ('journalist',
   'Journalist / Reporter',
   'media',
   'Research and report news for print, TV, digital, and social media channels.',
   array['artistic','social'], array['social','risk_taking'],
   'low','strong','moderate','none','moderate',3),

  ('content_creator_digital',
   'Digital Content Creator / Social Media Manager',
   'media',
   'Produce engaging content for brands and audiences across digital platforms.',
   array['artistic','enterprising'], array['risk_taking'],
   'variable','moderate','strong','none','entrepreneurial',2),

  ('film_tv_professional',
   'Film / TV Professional (Director / Cinematographer / Editor)',
   'media',
   'Create visual storytelling content for cinema, television, and OTT platforms.',
   array['artistic','realistic'], array['practical','risk_taking'],
   'variable','strong','strong','none','entrepreneurial',4),

  -- ── Agriculture ────────────────────────────────────────────────────────────
  ('agricultural_scientist',
   'Agricultural Officer / Scientist',
   'agriculture',
   'Advise farmers, conduct agri research, or manage crop/soil programs.',
   array['investigative','realistic'], array['analytical','practical'],
   'medium','strong','strong','preferred','stable',5),

  ('food_technologist',
   'Food Technologist',
   'agriculture',
   'Develop food products, ensure safety standards, and manage food processing.',
   array['investigative','realistic'], array['analytical','practical'],
   'medium','moderate','strong','none','stable',4),

  ('nutritionist_dietitian',
   'Nutritionist / Dietitian',
   'agriculture',
   'Advise individuals and communities on diet, nutrition, and health.',
   array['investigative','social'], array['social','analytical'],
   'medium','strong','strong','preferred','stable',4),

  -- ── Humanities / Education ─────────────────────────────────────────────────
  ('school_teacher',
   'School Teacher',
   'humanities',
   'Teach subjects in government or private schools (secondary/higher secondary).',
   array['social','artistic'], array['social'],
   'medium','strong','strong','none','stable',3),

  ('university_professor',
   'Lecturer / University Professor',
   'humanities',
   'Teach and conduct research at degree colleges and universities.',
   array['investigative','social'], array['analytical','social'],
   'medium','strong','strong','mandatory','stable',8),

  ('psychologist',
   'Psychologist / Counsellor',
   'humanities',
   'Assess and support mental health, behaviour, and wellbeing.',
   array['social','investigative'], array['social','analytical'],
   'medium','moderate','moderate','preferred','stable',5),

  -- ── Hospitality ────────────────────────────────────────────────────────────
  ('hotel_manager',
   'Hotel / Resort Manager',
   'hospitality',
   'Oversee operations, guest experience, and staff in hotels and resorts.',
   array['enterprising','social'], array['social','structured'],
   'medium','strong','strong','none','stable',3),

  ('commercial_pilot',
   'Commercial Pilot (CPL)',
   'hospitality',
   'Fly commercial aircraft for passenger or cargo airlines.',
   array['realistic','enterprising'], array['practical','risk_taking'],
   'high','weak','strong','none','stable',5)

on conflict (id) do nothing;

-- ============================================================================
-- 4. CAREER → COURSE LINKS
-- ============================================================================
insert into public.career_course (career_id, course_id, route_type, strength, pathway_note) values

  -- data_scientist
  ('data_scientist','btech_cse','primary',1.0,'B.Tech CSE → data roles; most common path'),
  ('data_scientist','bsc_cs','alternative',0.8,'B.Sc CS → data analyst entry; M.Sc recommended'),
  ('data_scientist','mba','higher-study-route',0.5,'MBA Business Analytics for senior roles'),

  -- cybersecurity_analyst
  ('cybersecurity_analyst','btech_cse','primary',1.0,'B.Tech CSE with security specialisation'),
  ('cybersecurity_analyst','bsc_cs','alternative',0.8,'B.Sc CS + certifications (CEH, CISSP)'),
  ('cybersecurity_analyst','bca','fallback',0.6,'BCA + industry certs; longer path to senior roles'),

  -- civil_engineer
  ('civil_engineer','btech_civil','primary',1.0,'B.Tech Civil Engineering'),

  -- electrical_engineer
  ('electrical_engineer','btech_eee','primary',1.0,'B.Tech EEE; KSEB and PSU recruitment'),

  -- electronics_engineer
  ('electronics_engineer','btech_ece','primary',1.0,'B.Tech ECE; telecom, embedded, consumer electronics'),

  -- dentist
  ('dentist','bds','primary',1.0,'NEET → BDS; private practice or hospital'),

  -- pharmacist
  ('pharmacist','bpharm','primary',1.0,'B.Pharm → pharma industry or hospital pharmacy'),
  ('pharmacist','bsc_lifescience','fallback',0.6,'B.Sc BioChem/Biotech → pharma sales/QC'),

  -- ayurveda_practitioner
  ('ayurveda_practitioner','bams','primary',1.0,'BAMS; Kerala Ayurveda sector is strong'),

  -- physiotherapist
  ('physiotherapist','bpt','primary',1.0,'BPT; hospital or independent clinic'),

  -- medical_lab_technician
  ('medical_lab_technician','bmlt','primary',1.0,'BMLT; diagnostic labs and hospitals'),
  ('medical_lab_technician','bsc_lifescience','alternative',0.7,'B.Sc Bio → lab roles with additional cert'),

  -- research_scientist
  ('research_scientist','bsc_lifescience','primary',1.0,'B.Sc → M.Sc → PhD research path'),
  ('research_scientist','bsc_envscience','alternative',0.7,'Environmental research route'),

  -- environmental_scientist
  ('environmental_scientist','bsc_envscience','primary',1.0,'B.Sc Environmental Science'),
  ('environmental_scientist','bsc_agriculture','alternative',0.7,'Agri-environment overlap'),

  -- bank_officer
  ('bank_officer','bcom','primary',1.0,'B.Com → IBPS PO; most common banking route'),
  ('bank_officer','bba','alternative',0.8,'BBA → banking management trainee'),
  ('bank_officer','ba_general','fallback',0.6,'Any degree eligible for IBPS; BA accepted'),

  -- company_secretary
  ('company_secretary','cs_track','primary',1.0,'CS Foundation → Executive → Professional (ICSI)'),
  ('company_secretary','bcom','alternative',0.8,'B.Com alongside CS qualification'),

  -- financial_analyst
  ('financial_analyst','bba','primary',1.0,'BBA → CFA / MBA Finance track'),
  ('financial_analyst','bcom','alternative',0.9,'B.Com → financial analysis roles'),

  -- business_manager
  ('business_manager','bba','primary',1.0,'BBA → MBA; structured management path'),
  ('business_manager','bcom','alternative',0.7,'B.Com → MBA'),
  ('business_manager','mba','higher-study-route',1.0,'MBA is the professional qualification'),

  -- civil_services_officer
  ('civil_services_officer','ba_general','primary',1.0,'Any degree → UPSC CSE; humanities background helps'),
  ('civil_services_officer','bcom','alternative',0.7,'B.Com → UPSC or Kerala PSC'),
  ('civil_services_officer','bsc_lifescience','alternative',0.7,'Science graduates also successful in UPSC'),

  -- defence_officer
  ('defence_officer','ba_general','primary',1.0,'CDS route: any UG degree → Army/Navy/Air Force via CDS'),
  ('defence_officer','bsc_cs','alternative',0.7,'Technical branch via CDS; engineering preferred'),

  -- graphic_designer
  ('graphic_designer','bdes_comm','primary',1.0,'B.Des Communication Design / BFA → design industry'),
  ('graphic_designer','bsc_animation','alternative',0.7,'Animation degree applicable to graphic/digital roles'),

  -- fashion_designer
  ('fashion_designer','bdes_fashion','primary',1.0,'NIFT or private design institute → fashion industry'),

  -- interior_designer
  ('interior_designer','bdes_interior','primary',1.0,'B.Des Interior or B.Sc Interior Design'),

  -- animator_3d
  ('animator_3d','bsc_animation','primary',1.0,'B.Sc Animation / B.Des Animation & VFX'),
  ('animator_3d','bdes_comm','alternative',0.6,'Graphic design degree with 3D skills'),

  -- architect
  ('architect','barch','primary',1.0,'NATA → B.Arch; Council of Architecture registration'),

  -- journalist
  ('journalist','bjmc','primary',1.0,'BJMC → print, TV, digital media'),
  ('journalist','ba_general','alternative',0.7,'BA + journalism portfolio + experience'),

  -- content_creator_digital
  ('content_creator_digital','bjmc','primary',0.9,'BJMC covers media skills; self-driven platform-building'),
  ('content_creator_digital','ba_general','fallback',0.6,'Any degree; skills-driven field'),

  -- film_tv_professional
  ('film_tv_professional','bjmc','primary',1.0,'BJMC with film production focus; FTII/SFT for advanced'),
  ('film_tv_professional','bdes_comm','alternative',0.7,'BFA / visual communication background'),

  -- agricultural_scientist
  ('agricultural_scientist','bsc_agriculture','primary',1.0,'B.Sc Agri → KAU/ICAR research or govt officer'),

  -- food_technologist
  ('food_technologist','btech_food','primary',1.0,'B.Tech Food Technology → food processing industry'),
  ('food_technologist','bsc_agriculture','alternative',0.8,'B.Sc Agri with food science specialisation'),

  -- nutritionist_dietitian
  ('nutritionist_dietitian','bsc_nutrition','primary',1.0,'B.Sc Nutrition & Dietetics → hospital or private practice'),
  ('nutritionist_dietitian','bsc_lifescience','fallback',0.6,'B.Sc Bio → PG nutrition studies'),

  -- school_teacher
  ('school_teacher','ba_general','primary',1.0,'BA/B.Sc → B.Ed → Kerala PSC teacher'),
  ('school_teacher','bed','higher-study-route',1.0,'B.Ed is mandatory for govt school teaching'),

  -- university_professor
  ('university_professor','bsc_lifescience','primary',1.0,'B.Sc → M.Sc → NET/PhD → lectureship'),
  ('university_professor','ba_general','alternative',0.8,'BA → MA → NET → college teaching'),

  -- psychologist
  ('psychologist','bsc_psychology','primary',1.0,'B.Sc Psychology → M.Sc → RCI registration'),
  ('psychologist','ba_general','fallback',0.6,'BA Psychology + M.A route'),

  -- hotel_manager
  ('hotel_manager','bhm','primary',1.0,'BHM / IHM via NCHMCT JEE → hotel operations'),

  -- commercial_pilot
  ('commercial_pilot','cpl_training','primary',1.0,'CPL training at DGCA-approved flying clubs; 200 hr minimum')

on conflict do nothing;

-- ============================================================================
-- 5. COURSE → EXAM LINKS
-- ============================================================================
insert into public.course_exam (course_id, exam_id, requirement, region) values

  -- Engineering (new B.Tech variants use same exams as existing btech_cse)
  ('btech_civil','keam','one-of','Kerala'),
  ('btech_civil','jee_main','one-of','National'),
  ('btech_eee','keam','one-of','Kerala'),
  ('btech_eee','jee_main','one-of','National'),
  ('btech_ece','keam','one-of','Kerala'),
  ('btech_ece','jee_main','one-of','National'),

  -- Medical
  ('bds','neet','mandatory','National'),
  ('bams','neet','mandatory','National'),
  ('bpharm','neet','optional','National'),

  -- Architecture
  ('barch','nata','mandatory','National'),

  -- Design
  ('bdes_comm','uceed','one-of','National'),
  ('bdes_fashion','nift_entrance','one-of','National'),

  -- Hotel Management
  ('bhm','nchmct_jee','one-of','National'),

  -- Commerce / Finance
  ('cs_track','cseet','mandatory','National'),
  ('bcom','bank_ibps','not-required','National'),  -- IBPS PO is after graduation, noted
  ('ba_general','bank_ibps','not-required','National'),
  ('ba_general','upsc_cse','not-required','National'),
  ('ba_general','kerala_psc','not-required','Kerala'),
  ('ba_general','cds','not-required','National'),
  ('ba_general','ugc_net','not-required','National'),

  -- Teaching / Research
  ('bsc_lifescience','ugc_net','not-required','National'),
  ('bed','kerala_psc','not-required','Kerala')

on conflict do nothing;

-- ============================================================================
-- 6. ELIGIBILITY RULES
-- ============================================================================
insert into public.eligibility_rules
  (course_id, required_stream, required_subjects, min_aggregate_pct) values

  -- Computing
  ('bsc_cs',         array['science_maths','science_cs'],                        array['mathematics'], 45),
  ('bca',            array['science_maths','science_cs','commerce'],              array['mathematics'], 40),

  -- Engineering
  ('btech_civil',    array['science_maths','science_cs'],                        array['physics','chemistry','mathematics'], 50),
  ('btech_eee',      array['science_maths','science_cs'],                        array['physics','chemistry','mathematics'], 50),
  ('btech_ece',      array['science_maths','science_cs'],                        array['physics','chemistry','mathematics'], 50),

  -- Medical
  ('bds',            array['science_bio'],                                       array['physics','chemistry','biology'], 50),
  ('bpharm',         array['science_bio','science_maths','science_cs'],          array['chemistry'], 45),
  ('bams',           array['science_bio'],                                       array['physics','chemistry','biology'], 50),

  -- Allied Health
  ('bpt',            array['science_bio'],                                       array['biology'], 45),
  ('bmlt',           array['science_bio'],                                       array['biology','chemistry'], 45),

  -- Sciences
  ('bsc_lifescience',array['science_bio'],                                       array['biology','chemistry'], 45),
  ('bsc_envscience', array['science_bio','science_maths','science_cs'],          array[]::text[], 45),

  -- Commerce
  ('bba',            array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 45),
  ('cs_track',       array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 45),
  ('mba',            array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 45),

  -- Arts
  ('ba_general',     array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 40),
  ('bed',            array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 45),

  -- Design
  ('bdes_comm',      array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 45),
  ('bdes_fashion',   array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 45),
  ('bdes_interior',  array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 45),
  ('bsc_animation',  array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 45),

  -- Architecture
  ('barch',          array['science_maths','science_cs'],                        array['mathematics','physics'], 50),

  -- Media
  ('bjmc',           array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 45),

  -- Agriculture
  ('bsc_agriculture',array['science_bio','science_maths','science_cs'],          array['biology','chemistry'], 50),
  ('btech_food',     array['science_bio','science_maths','science_cs'],          array['chemistry'], 50),
  ('bsc_nutrition',  array['science_bio'],                                       array['biology','chemistry'], 45),

  -- Social / Psychology
  ('bsc_psychology', array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 45),

  -- Hospitality / Aviation
  ('bhm',            array['science_bio','science_maths','science_cs','commerce','humanities'], array[]::text[], 45),
  ('cpl_training',   array['science_maths','science_cs'],                        array['physics','mathematics'], 50)

on conflict do nothing;

-- ============================================================================
-- 7. CAREER SIGNAL WEIGHTS — the matching intelligence
-- ============================================================================
-- Weights are editorial judgements (0.0–1.0); not statistically derived.
-- Primary signal = 1.0; secondary = 0.6–0.8; supporting = 0.4–0.5.
-- signal_type: 'interest' | 'aptitude' | 'personality'
-- signal_key:  interest cluster | aptitude dim | personality trait (see profile.ts)
-- ============================================================================
insert into public.career_signal (career_id, signal_type, signal_key, weight) values

  -- ── data_scientist ─────────────────────────────────────────────────────────
  ('data_scientist','interest','technology_coding',1.0),
  ('data_scientist','interest','numbers_analysis',0.9),
  ('data_scientist','interest','science_research',0.5),
  ('data_scientist','aptitude','numerical',1.0),
  ('data_scientist','aptitude','logical',0.9),
  ('data_scientist','aptitude','scientific',0.6),
  ('data_scientist','personality','analytical',0.9),
  ('data_scientist','personality','structured',0.6),

  -- ── cybersecurity_analyst ──────────────────────────────────────────────────
  ('cybersecurity_analyst','interest','technology_coding',1.0),
  ('cybersecurity_analyst','interest','numbers_analysis',0.6),
  ('cybersecurity_analyst','aptitude','logical',1.0),
  ('cybersecurity_analyst','aptitude','numerical',0.7),
  ('cybersecurity_analyst','personality','analytical',0.8),

  -- ── civil_engineer ─────────────────────────────────────────────────────────
  ('civil_engineer','interest','building_engineering',1.0),
  ('civil_engineer','interest','numbers_analysis',0.6),
  ('civil_engineer','aptitude','spatial',0.9),
  ('civil_engineer','aptitude','numerical',0.8),
  ('civil_engineer','aptitude','logical',0.6),
  ('civil_engineer','personality','practical',0.7),
  ('civil_engineer','personality','analytical',0.5),

  -- ── electrical_engineer ────────────────────────────────────────────────────
  ('electrical_engineer','interest','building_engineering',0.8),
  ('electrical_engineer','interest','technology_coding',0.5),
  ('electrical_engineer','interest','numbers_analysis',0.7),
  ('electrical_engineer','aptitude','numerical',1.0),
  ('electrical_engineer','aptitude','logical',0.8),
  ('electrical_engineer','aptitude','spatial',0.6),
  ('electrical_engineer','personality','analytical',0.7),
  ('electrical_engineer','personality','practical',0.6),

  -- ── electronics_engineer ───────────────────────────────────────────────────
  ('electronics_engineer','interest','technology_coding',0.8),
  ('electronics_engineer','interest','building_engineering',0.7),
  ('electronics_engineer','interest','numbers_analysis',0.6),
  ('electronics_engineer','aptitude','logical',0.9),
  ('electronics_engineer','aptitude','numerical',0.8),
  ('electronics_engineer','aptitude','spatial',0.7),
  ('electronics_engineer','personality','analytical',0.8),

  -- ── dentist ────────────────────────────────────────────────────────────────
  ('dentist','interest','health_medicine',1.0),
  ('dentist','interest','science_research',0.4),
  ('dentist','aptitude','scientific',0.9),
  ('dentist','aptitude','spatial',0.7),
  ('dentist','personality','practical',0.7),
  ('dentist','personality','social',0.6),

  -- ── pharmacist ─────────────────────────────────────────────────────────────
  ('pharmacist','interest','health_medicine',0.8),
  ('pharmacist','interest','science_research',0.7),
  ('pharmacist','interest','business_money',0.3),
  ('pharmacist','aptitude','scientific',1.0),
  ('pharmacist','aptitude','numerical',0.6),
  ('pharmacist','personality','analytical',0.7),
  ('pharmacist','personality','structured',0.6),

  -- ── ayurveda_practitioner ──────────────────────────────────────────────────
  ('ayurveda_practitioner','interest','health_medicine',0.9),
  ('ayurveda_practitioner','interest','science_research',0.6),
  ('ayurveda_practitioner','interest','nature_agriculture',0.5),
  ('ayurveda_practitioner','aptitude','scientific',0.8),
  ('ayurveda_practitioner','aptitude','verbal',0.5),
  ('ayurveda_practitioner','personality','social',0.8),
  ('ayurveda_practitioner','personality','analytical',0.5),

  -- ── physiotherapist ────────────────────────────────────────────────────────
  ('physiotherapist','interest','health_medicine',0.9),
  ('physiotherapist','interest','helping_teaching',0.7),
  ('physiotherapist','aptitude','scientific',0.7),
  ('physiotherapist','aptitude','spatial',0.6),
  ('physiotherapist','personality','social',0.8),
  ('physiotherapist','personality','practical',0.7),

  -- ── medical_lab_technician ─────────────────────────────────────────────────
  ('medical_lab_technician','interest','health_medicine',0.7),
  ('medical_lab_technician','interest','science_research',0.8),
  ('medical_lab_technician','aptitude','scientific',1.0),
  ('medical_lab_technician','aptitude','numerical',0.5),
  ('medical_lab_technician','personality','analytical',0.7),
  ('medical_lab_technician','personality','structured',0.7),

  -- ── research_scientist ─────────────────────────────────────────────────────
  ('research_scientist','interest','science_research',1.0),
  ('research_scientist','interest','numbers_analysis',0.6),
  ('research_scientist','interest','technology_coding',0.4),
  ('research_scientist','aptitude','scientific',1.0),
  ('research_scientist','aptitude','logical',0.8),
  ('research_scientist','aptitude','numerical',0.6),
  ('research_scientist','personality','analytical',0.9),

  -- ── environmental_scientist ────────────────────────────────────────────────
  ('environmental_scientist','interest','nature_agriculture',1.0),
  ('environmental_scientist','interest','science_research',0.8),
  ('environmental_scientist','aptitude','scientific',0.8),
  ('environmental_scientist','aptitude','logical',0.6),
  ('environmental_scientist','personality','analytical',0.7),

  -- ── bank_officer ───────────────────────────────────────────────────────────
  ('bank_officer','interest','business_money',1.0),
  ('bank_officer','interest','numbers_analysis',0.8),
  ('bank_officer','aptitude','numerical',1.0),
  ('bank_officer','aptitude','logical',0.7),
  ('bank_officer','aptitude','verbal',0.5),
  ('bank_officer','personality','structured',0.8),
  ('bank_officer','personality','analytical',0.5),

  -- ── company_secretary ──────────────────────────────────────────────────────
  ('company_secretary','interest','business_money',0.8),
  ('company_secretary','interest','law_justice',0.8),
  ('company_secretary','interest','numbers_analysis',0.5),
  ('company_secretary','aptitude','logical',0.8),
  ('company_secretary','aptitude','verbal',0.7),
  ('company_secretary','aptitude','numerical',0.5),
  ('company_secretary','personality','structured',0.9),
  ('company_secretary','personality','analytical',0.6),

  -- ── financial_analyst ──────────────────────────────────────────────────────
  ('financial_analyst','interest','numbers_analysis',1.0),
  ('financial_analyst','interest','business_money',0.9),
  ('financial_analyst','aptitude','numerical',1.0),
  ('financial_analyst','aptitude','logical',0.8),
  ('financial_analyst','personality','analytical',0.9),
  ('financial_analyst','personality','structured',0.6),

  -- ── business_manager ───────────────────────────────────────────────────────
  ('business_manager','interest','business_money',0.9),
  ('business_manager','interest','helping_teaching',0.5),
  ('business_manager','interest','media_communication',0.4),
  ('business_manager','aptitude','numerical',0.7),
  ('business_manager','aptitude','verbal',0.7),
  ('business_manager','aptitude','logical',0.6),
  ('business_manager','personality','social',0.7),
  ('business_manager','personality','risk_taking',0.6),

  -- ── civil_services_officer ─────────────────────────────────────────────────
  ('civil_services_officer','interest','law_justice',0.8),
  ('civil_services_officer','interest','helping_teaching',0.7),
  ('civil_services_officer','interest','media_communication',0.4),
  ('civil_services_officer','aptitude','verbal',0.9),
  ('civil_services_officer','aptitude','logical',0.8),
  ('civil_services_officer','aptitude','numerical',0.5),
  ('civil_services_officer','personality','social',0.7),
  ('civil_services_officer','personality','analytical',0.6),

  -- ── defence_officer ────────────────────────────────────────────────────────
  ('defence_officer','interest','defence_adventure',1.0),
  ('defence_officer','interest','helping_teaching',0.4),
  ('defence_officer','aptitude','logical',0.7),
  ('defence_officer','aptitude','spatial',0.6),
  ('defence_officer','aptitude','numerical',0.5),
  ('defence_officer','personality','practical',0.7),
  ('defence_officer','personality','risk_taking',0.8),

  -- ── graphic_designer ───────────────────────────────────────────────────────
  ('graphic_designer','interest','design_visual',1.0),
  ('graphic_designer','interest','technology_coding',0.4),
  ('graphic_designer','interest','media_communication',0.5),
  ('graphic_designer','aptitude','spatial',0.9),
  ('graphic_designer','personality','practical',0.6),

  -- ── fashion_designer ───────────────────────────────────────────────────────
  ('fashion_designer','interest','design_visual',1.0),
  ('fashion_designer','interest','business_money',0.4),
  ('fashion_designer','aptitude','spatial',0.8),
  ('fashion_designer','personality','practical',0.5),
  ('fashion_designer','personality','risk_taking',0.4),

  -- ── interior_designer ──────────────────────────────────────────────────────
  ('interior_designer','interest','design_visual',0.9),
  ('interior_designer','interest','building_engineering',0.5),
  ('interior_designer','aptitude','spatial',1.0),
  ('interior_designer','personality','practical',0.7),

  -- ── animator_3d ────────────────────────────────────────────────────────────
  ('animator_3d','interest','design_visual',0.9),
  ('animator_3d','interest','technology_coding',0.6),
  ('animator_3d','interest','media_communication',0.4),
  ('animator_3d','aptitude','spatial',1.0),
  ('animator_3d','aptitude','logical',0.5),
  ('animator_3d','personality','practical',0.6),

  -- ── architect ──────────────────────────────────────────────────────────────
  ('architect','interest','design_visual',0.7),
  ('architect','interest','building_engineering',0.8),
  ('architect','interest','numbers_analysis',0.4),
  ('architect','aptitude','spatial',1.0),
  ('architect','aptitude','numerical',0.6),
  ('architect','aptitude','logical',0.5),
  ('architect','personality','practical',0.7),
  ('architect','personality','analytical',0.5),

  -- ── journalist ─────────────────────────────────────────────────────────────
  ('journalist','interest','media_communication',1.0),
  ('journalist','interest','law_justice',0.4),
  ('journalist','interest','helping_teaching',0.4),
  ('journalist','aptitude','verbal',1.0),
  ('journalist','aptitude','logical',0.5),
  ('journalist','personality','social',0.7),
  ('journalist','personality','risk_taking',0.5),

  -- ── content_creator_digital ────────────────────────────────────────────────
  ('content_creator_digital','interest','media_communication',0.9),
  ('content_creator_digital','interest','design_visual',0.6),
  ('content_creator_digital','interest','business_money',0.4),
  ('content_creator_digital','aptitude','verbal',0.8),
  ('content_creator_digital','aptitude','spatial',0.5),
  ('content_creator_digital','personality','risk_taking',0.6),

  -- ── film_tv_professional ───────────────────────────────────────────────────
  ('film_tv_professional','interest','media_communication',0.9),
  ('film_tv_professional','interest','design_visual',0.7),
  ('film_tv_professional','aptitude','spatial',0.7),
  ('film_tv_professional','aptitude','verbal',0.6),
  ('film_tv_professional','personality','risk_taking',0.7),
  ('film_tv_professional','personality','practical',0.4),

  -- ── agricultural_scientist ─────────────────────────────────────────────────
  ('agricultural_scientist','interest','nature_agriculture',1.0),
  ('agricultural_scientist','interest','science_research',0.6),
  ('agricultural_scientist','aptitude','scientific',0.8),
  ('agricultural_scientist','aptitude','numerical',0.5),
  ('agricultural_scientist','personality','practical',0.7),
  ('agricultural_scientist','personality','analytical',0.5),

  -- ── food_technologist ──────────────────────────────────────────────────────
  ('food_technologist','interest','science_research',0.8),
  ('food_technologist','interest','nature_agriculture',0.6),
  ('food_technologist','interest','business_money',0.4),
  ('food_technologist','aptitude','scientific',0.9),
  ('food_technologist','aptitude','numerical',0.6),
  ('food_technologist','personality','analytical',0.6),
  ('food_technologist','personality','practical',0.6),

  -- ── nutritionist_dietitian ─────────────────────────────────────────────────
  ('nutritionist_dietitian','interest','health_medicine',0.8),
  ('nutritionist_dietitian','interest','science_research',0.6),
  ('nutritionist_dietitian','interest','helping_teaching',0.6),
  ('nutritionist_dietitian','aptitude','scientific',0.8),
  ('nutritionist_dietitian','aptitude','verbal',0.5),
  ('nutritionist_dietitian','personality','social',0.7),
  ('nutritionist_dietitian','personality','analytical',0.5),

  -- ── school_teacher ─────────────────────────────────────────────────────────
  ('school_teacher','interest','helping_teaching',1.0),
  ('school_teacher','interest','media_communication',0.4),
  ('school_teacher','aptitude','verbal',0.8),
  ('school_teacher','aptitude','logical',0.5),
  ('school_teacher','personality','social',0.9),

  -- ── university_professor ───────────────────────────────────────────────────
  ('university_professor','interest','helping_teaching',0.8),
  ('university_professor','interest','science_research',0.8),
  ('university_professor','aptitude','verbal',0.9),
  ('university_professor','aptitude','logical',0.7),
  ('university_professor','aptitude','scientific',0.5),
  ('university_professor','personality','analytical',0.7),
  ('university_professor','personality','social',0.6),

  -- ── psychologist ───────────────────────────────────────────────────────────
  ('psychologist','interest','helping_teaching',0.8),
  ('psychologist','interest','science_research',0.6),
  ('psychologist','interest','health_medicine',0.5),
  ('psychologist','aptitude','verbal',0.8),
  ('psychologist','aptitude','logical',0.6),
  ('psychologist','personality','social',0.9),
  ('psychologist','personality','analytical',0.6),

  -- ── hotel_manager ──────────────────────────────────────────────────────────
  ('hotel_manager','interest','business_money',0.7),
  ('hotel_manager','interest','helping_teaching',0.5),
  ('hotel_manager','interest','media_communication',0.4),
  ('hotel_manager','aptitude','verbal',0.7),
  ('hotel_manager','aptitude','numerical',0.5),
  ('hotel_manager','personality','social',0.8),
  ('hotel_manager','personality','structured',0.5),

  -- ── commercial_pilot ───────────────────────────────────────────────────────
  ('commercial_pilot','interest','defence_adventure',0.8),
  ('commercial_pilot','interest','numbers_analysis',0.5),
  ('commercial_pilot','aptitude','spatial',1.0),
  ('commercial_pilot','aptitude','numerical',0.8),
  ('commercial_pilot','aptitude','logical',0.7),
  ('commercial_pilot','personality','practical',0.7),
  ('commercial_pilot','personality','risk_taking',0.6)

on conflict do nothing;

-- ============================================================================
-- 8. CAREER SKILLS — roadmap per career (2–3 steps each)
-- ============================================================================
insert into public.career_skills (career_id, skill_name, stage, resource_type, sort_order) values

  ('data_scientist','Mathematics & statistics fundamentals','foundation','self-study',1),
  ('data_scientist','Python + data analysis libraries (Pandas, NumPy)','intermediate','course',2),
  ('data_scientist','Build an ML project with real data','advanced','project',3),

  ('cybersecurity_analyst','Networking & operating systems basics','foundation','self-study',1),
  ('cybersecurity_analyst','Ethical hacking fundamentals (CEH / CompTIA Security+)','intermediate','certification',2),
  ('cybersecurity_analyst','Capture-the-Flag (CTF) competitions & labs','advanced','project',3),

  ('civil_engineer','Engineering drawing & AutoCAD','foundation','course',1),
  ('civil_engineer','Structural analysis & material science','intermediate','course',2),
  ('civil_engineer','Site internship / project management','advanced','project',3),

  ('electrical_engineer','Circuit theory & electrical machines','foundation','self-study',1),
  ('electrical_engineer','PLC / SCADA systems training','intermediate','course',2),
  ('electrical_engineer','Industrial internship (KSEB / PSU)','advanced','project',3),

  ('electronics_engineer','Digital electronics & microcontrollers','foundation','self-study',1),
  ('electronics_engineer','Embedded C & FPGA programming','intermediate','course',2),
  ('electronics_engineer','Build embedded project / IoT prototype','advanced','project',3),

  ('dentist','Biology & chemistry mastery (NEET prep)','foundation','exam',1),
  ('dentist','Clinical practice & patient management','intermediate','course',2),

  ('pharmacist','Chemistry & biochemistry fundamentals','foundation','self-study',1),
  ('pharmacist','Pharmacology & drug interactions','intermediate','course',2),

  ('ayurveda_practitioner','Biology & Sanskrit basics','foundation','self-study',1),
  ('ayurveda_practitioner','Classical Ayurvedic texts & clinical training','intermediate','course',2),

  ('physiotherapist','Anatomy, physiology & kinesiology','foundation','self-study',1),
  ('physiotherapist','Clinical placement & manual therapy practice','intermediate','course',2),
  ('physiotherapist','Specialize: sports / neuro / orthopedic rehab','advanced','certification',3),

  ('medical_lab_technician','Biology & biochemistry basics','foundation','self-study',1),
  ('medical_lab_technician','Lab techniques: haematology, microbiology, histology','intermediate','course',2),

  ('research_scientist','Strong foundation in chosen science (bio/chem/physics)','foundation','self-study',1),
  ('research_scientist','M.Sc in specialised field + UGC-NET / JRF','intermediate','exam',2),
  ('research_scientist','PhD research & publication','advanced','project',3),

  ('environmental_scientist','Ecology & environmental science basics','foundation','self-study',1),
  ('environmental_scientist','Environmental Impact Assessment (EIA) skills','intermediate','course',2),
  ('environmental_scientist','GIS & remote sensing tools','advanced','course',3),

  ('bank_officer','Quantitative aptitude & reasoning practice','foundation','self-study',1),
  ('bank_officer','IBPS / SBI PO exam preparation','intermediate','exam',2),
  ('bank_officer','Banking operations & finance knowledge','advanced','course',3),

  ('company_secretary','CS Foundation exam preparation','foundation','exam',1),
  ('company_secretary','CS Executive: company law & governance','intermediate','exam',2),
  ('company_secretary','CS Professional + practical training','advanced','exam',3),

  ('financial_analyst','Accounting & financial statement analysis','foundation','self-study',1),
  ('financial_analyst','CFA Level 1 preparation','intermediate','certification',2),
  ('financial_analyst','Financial modelling & valuation projects','advanced','project',3),

  ('business_manager','Communication, leadership & team skills','foundation','self-study',1),
  ('business_manager','BBA / any UG degree','intermediate','course',2),
  ('business_manager','MBA from reputed institution (CAT / MAT prep)','advanced','exam',3),

  ('civil_services_officer','NCERT foundation + current affairs habit','foundation','self-study',1),
  ('civil_services_officer','UPSC / Kerala PSC systematic preparation','intermediate','exam',2),
  ('civil_services_officer','Mains answer writing & interview prep','advanced','self-study',3),

  ('defence_officer','Physical fitness training & NDA syllabus prep','foundation','self-study',1),
  ('defence_officer','NDA (after 12th) or CDS (after graduation) exam','intermediate','exam',2),

  ('graphic_designer','Colour theory, typography & design principles','foundation','self-study',1),
  ('graphic_designer','Adobe Illustrator, Photoshop, Figma','intermediate','course',2),
  ('graphic_designer','Portfolio with 10+ real-world projects','advanced','project',3),

  ('fashion_designer','Sketching, fabric knowledge & design basics','foundation','self-study',1),
  ('fashion_designer','NIFT entrance preparation & pattern making','intermediate','exam',2),
  ('fashion_designer','Collection development & textile sourcing','advanced','project',3),

  ('interior_designer','Spatial awareness & architectural basics','foundation','self-study',1),
  ('interior_designer','AutoCAD, SketchUp & 3D visualization','intermediate','course',2),
  ('interior_designer','Client project portfolio','advanced','project',3),

  ('animator_3d','Drawing fundamentals & visual storytelling','foundation','self-study',1),
  ('animator_3d','Maya / Blender / After Effects','intermediate','course',2),
  ('animator_3d','3D animation showreel','advanced','project',3),

  ('architect','NATA preparation (drawing & spatial ability)','foundation','exam',1),
  ('architect','Architectural design studio practice','intermediate','course',2),
  ('architect','Council of Architecture registration (COA)','advanced','certification',3),

  ('journalist','Reading across topics + writing practice','foundation','self-study',1),
  ('journalist','BJMC / journalism programme','intermediate','course',2),
  ('journalist','Internship at newspaper / TV channel / digital outlet','advanced','project',3),

  ('content_creator_digital','Video editing, copywriting & social media basics','foundation','self-study',1),
  ('content_creator_digital','Build and grow a niche channel or profile','intermediate','project',2),
  ('content_creator_digital','Brand partnerships & monetisation strategy','advanced','project',3),

  ('film_tv_professional','Screenplay writing & visual storytelling','foundation','self-study',1),
  ('film_tv_professional','Film production internship / short film project','intermediate','project',2),
  ('film_tv_professional','FTII / SFT / film school advanced diploma (optional)','advanced','course',3),

  ('agricultural_scientist','Biology, botany & soil science basics','foundation','self-study',1),
  ('agricultural_scientist','B.Sc Agriculture at KAU / ICAR','intermediate','course',2),
  ('agricultural_scientist','M.Sc + ICAR JRF for research roles','advanced','exam',3),

  ('food_technologist','Chemistry & food science basics','foundation','self-study',1),
  ('food_technologist','B.Tech Food Technology / B.Sc Food Science','intermediate','course',2),
  ('food_technologist','FSSAI, HACCP, ISO food safety certifications','advanced','certification',3),

  ('nutritionist_dietitian','Biology & nutrition science basics','foundation','self-study',1),
  ('nutritionist_dietitian','B.Sc Nutrition & Dietetics','intermediate','course',2),
  ('nutritionist_dietitian','Hospital internship & RD (Registered Dietitian) path','advanced','project',3),

  ('school_teacher','Strong subject matter expertise','foundation','self-study',1),
  ('school_teacher','B.Ed after any UG degree','intermediate','course',2),
  ('school_teacher','Kerala PSC teacher eligibility test','advanced','exam',3),

  ('university_professor','M.Sc / MA in specialised subject','foundation','course',1),
  ('university_professor','UGC-NET / JRF qualification','intermediate','exam',2),
  ('university_professor','PhD research & publications','advanced','project',3),

  ('psychologist','B.Sc Psychology or BA Psychology','foundation','course',1),
  ('psychologist','M.Sc Clinical Psychology + RCI registration','intermediate','certification',2),
  ('psychologist','Supervised clinical hours & internship','advanced','project',3),

  ('hotel_manager','Communication skills & hospitality basics','foundation','self-study',1),
  ('hotel_manager','BHM / IHM (via NCHMCT JEE)','intermediate','course',2),
  ('hotel_manager','International hotel chain internship','advanced','project',3),

  ('commercial_pilot','Strong Physics & Maths + DGCA Class 2 medical','foundation','self-study',1),
  ('commercial_pilot','CPL training at DGCA-approved flying club (200+ hrs)','intermediate','course',2),
  ('commercial_pilot','DGCA written exams + type rating at airline','advanced','exam',3)

on conflict do nothing;
