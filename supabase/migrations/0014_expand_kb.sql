-- ============================================================================
-- Migration 0014: Knowledge Base Expansion (KB v4)
--
-- Adds 90 new careers across all 15 domains, growing the catalog from 51 to
-- ~141. Covers major gaps: web/cloud engineering, law specialisations, media
-- roles, allied health, sciences, and hospitality roles relevant to Kerala
-- Plus Two students.
--
-- New courses added (13): btech_chemical, btech_aerospace, btech_biomedical,
--   btech_marine, bhms, bsc_audiology, bsc_optometry, bsc_radiology, bot,
--   bsc_geology, bsc_forensic, bsc_horticulture, bfsc
--
-- All inserts use ON CONFLICT DO NOTHING — fully idempotent.
-- KB VERSION: bump to "4" after applying.
-- ============================================================================

-- ── 1. NEW COURSES ───────────────────────────────────────────────────────────
insert into public.courses
  (id, name, category, level, duration_years, stream_required, core_subjects_required,
   typical_fee_band, availability_kerala, leads_to_higher_study, notes, status, kb_version) values

  ('btech_chemical',
   'B.Tech Chemical Engineering',
   'UG-Engineering', 'UG', 4,
   array['science_maths','science_cs'],
   array['physics','chemistry','mathematics'],
   'high', 'limited', array[]::text[],
   'KEAM / JEE entry; petrochemical, food, pharma industries; CUSAT has a strong dept.',
   'published', '4'),

  ('btech_aerospace',
   'B.Tech Aerospace / Aeronautical Engineering',
   'UG-Engineering', 'UG', 4,
   array['science_maths','science_cs'],
   array['physics','mathematics'],
   'high', 'rare', array[]::text[],
   'Limited seats in Kerala; CUSAT/IITs; strong national demand. KEAM/JEE entry.',
   'published', '4'),

  ('btech_biomedical',
   'B.Tech Biomedical Engineering',
   'UG-Engineering', 'UG', 4,
   array['science_bio','science_maths','science_cs'],
   array['physics','chemistry'],
   'high', 'limited', array[]::text[],
   'Bridges engineering and medicine; medical device industry; KEAM/JEE entry.',
   'published', '4'),

  ('btech_marine',
   'B.Tech / B.E. Marine Engineering',
   'UG-Engineering', 'UG', 4,
   array['science_maths','science_cs'],
   array['physics','mathematics'],
   'very-high', 'rare', array[]::text[],
   'IMU CET entry; Merchant Navy pathway; high starting salary; sea service required.',
   'published', '4'),

  ('bhms',
   'BHMS (Bachelor of Homeopathic Medicine & Surgery)',
   'UG-Medical', 'UG', 5.5,
   array['science_bio'],
   array['physics','chemistry','biology'],
   'medium', 'limited', array[]::text[],
   'NEET mandatory (per recent NMC guidelines — verify). Kerala has several BHMS colleges; growing wellness demand.',
   'published', '4'),

  ('bsc_audiology',
   'B.Sc Audiology & Speech-Language Pathology',
   'UG-Medical', 'UG', 4,
   array['science_bio'],
   array['biology'],
   'medium', 'limited', array[]::text[],
   'RCI-regulated; AIISH Mysore, Manipal; growing clinical demand in Kerala hospitals.',
   'published', '4'),

  ('bsc_optometry',
   'B.Sc Optometry',
   'UG-Medical', 'UG', 4,
   array['science_bio','science_maths','science_cs'],
   array['biology','physics'],
   'medium', 'limited', array[]::text[],
   'Optical clinics, hospitals, optical retail; growing demand in Kerala urban centres.',
   'published', '4'),

  ('bsc_radiology',
   'B.Sc Medical Imaging Technology / Radiology',
   'UG-Medical', 'UG', 3,
   array['science_bio'],
   array['biology','physics'],
   'medium', 'limited', array[]::text[],
   'Diagnostic centres, hospitals; X-ray, CT, MRI operation; state counselling entry.',
   'published', '4'),

  ('bot',
   'BOT (Bachelor of Occupational Therapy)',
   'UG-Medical', 'UG', 4.5,
   array['science_bio'],
   array['biology'],
   'medium', 'limited', array[]::text[],
   'Rehabilitation, disability, mental health; growing field; Manipal / RGUHS institutes.',
   'published', '4'),

  ('bsc_geology',
   'B.Sc Geology / Applied Geology',
   'UG-Science', 'UG', 3,
   array['science_bio','science_maths','science_cs'],
   array[]::text[],
   'low', 'limited', array[]::text[],
   'Government survey depts, mining, oil; Kerala Univ / Calicut Univ offer the programme.',
   'published', '4'),

  ('bsc_forensic',
   'B.Sc Forensic Science',
   'UG-Science', 'UG', 3,
   array['science_bio','science_maths','science_cs'],
   array['chemistry','biology'],
   'medium', 'limited', array[]::text[],
   'Police forensic labs, courts; M.Sc usually needed for senior roles. Growing field.',
   'published', '4'),

  ('bsc_horticulture',
   'B.Sc Horticulture (Hons)',
   'UG-Science', 'UG', 4,
   array['science_bio','science_maths','science_cs'],
   array['biology','chemistry'],
   'low', 'limited', array[]::text[],
   'KAU / state agri universities; good govt job prospects; floriculture booming in Kerala.',
   'published', '4'),

  ('bfsc',
   'B.F.Sc (Bachelor of Fisheries Science)',
   'UG-Science', 'UG', 4,
   array['science_bio','science_maths','science_cs'],
   array['biology','chemistry'],
   'low', 'limited', array[]::text[],
   'Kerala University of Fisheries & Ocean Studies (KUFOS); strong demand in coastal Kerala; fisheries dept jobs.',
   'published', '4')

on conflict (id) do nothing;

-- ── 2. ELIGIBILITY RULES FOR NEW COURSES ─────────────────────────────────────
insert into public.eligibility_rules
  (course_id, required_stream, required_subjects, min_aggregate_pct, min_subject_pct, other_constraints) values

  ('btech_chemical',  array['science_maths','science_cs'], array['physics','chemistry','mathematics'], 50, '{}'::jsonb, array[]::text[]),
  ('btech_aerospace', array['science_maths','science_cs'], array['physics','mathematics'], 50, '{}'::jsonb, array[]::text[]),
  ('btech_biomedical',array['science_bio','science_maths','science_cs'], array['physics','chemistry'], 50, '{}'::jsonb, array[]::text[]),
  ('btech_marine',    array['science_maths','science_cs'], array['physics','mathematics'], 60, '{}'::jsonb, array['Medical fitness required (Class I/II)']),
  ('bhms',            array['science_bio'], array['physics','chemistry','biology'], 50, '{}'::jsonb, array[]::text[]),
  ('bsc_audiology',   array['science_bio'], array['biology'], 50, '{}'::jsonb, array[]::text[]),
  ('bsc_optometry',   array['science_bio','science_maths','science_cs'], array['biology','physics'], 45, '{}'::jsonb, array[]::text[]),
  ('bsc_radiology',   array['science_bio'], array['biology','physics'], 45, '{}'::jsonb, array[]::text[]),
  ('bot',             array['science_bio'], array['biology'], 45, '{}'::jsonb, array[]::text[]),
  ('bsc_geology',     array['science_bio','science_maths','science_cs'], array[]::text[], 45, '{}'::jsonb, array[]::text[]),
  ('bsc_forensic',    array['science_bio','science_maths','science_cs'], array['chemistry','biology'], 45, '{}'::jsonb, array[]::text[]),
  ('bsc_horticulture',array['science_bio','science_maths','science_cs'], array['biology','chemistry'], 50, '{}'::jsonb, array[]::text[]),
  ('bfsc',            array['science_bio','science_maths','science_cs'], array['biology','chemistry'], 50, '{}'::jsonb, array[]::text[])

on conflict do nothing;

-- ── 3. COURSE-EXAM LINKS FOR NEW COURSES ─────────────────────────────────────
insert into public.course_exam (course_id, exam_id, requirement, region) values
  ('btech_chemical',  'keam',     'one-of',    'Kerala'),
  ('btech_chemical',  'jee_main', 'one-of',    'National'),
  ('btech_aerospace', 'keam',     'one-of',    'Kerala'),
  ('btech_aerospace', 'jee_main', 'one-of',    'National'),
  ('btech_biomedical','keam',     'one-of',    'Kerala'),
  ('btech_biomedical','jee_main', 'one-of',    'National'),
  ('bhms',            'neet',     'mandatory', 'National'),
  ('bsc_horticulture','keam',     'one-of',    'Kerala'),
  ('bfsc',            'keam',     'one-of',    'Kerala')
on conflict do nothing;

-- ── 4. NEW CAREERS (90 careers) ───────────────────────────────────────────────
insert into public.careers
  (id, name, domain_id, short_description, riasec_codes, personality_fit,
   earning_band, job_market_kerala, job_market_india, higher_study_required,
   risk_level, min_years_to_earn, status, kb_version) values

  -- ── Computing ──────────────────────────────────────────────────────────────
  ('web_developer',
   'Web Developer (Frontend / Backend / Full-Stack)',
   'computing',
   'Build websites and web apps using HTML, CSS, JavaScript, and server-side technologies.',
   array['investigative','conventional'], array['analytical','practical'],
   'high', 'strong', 'strong', 'none', 'moderate', 3,
   'published', '4'),

  ('cloud_engineer',
   'Cloud Engineer / Solutions Architect',
   'computing',
   'Design and maintain cloud infrastructure on AWS, GCP, or Azure for businesses.',
   array['investigative','conventional'], array['analytical','structured'],
   'high', 'moderate', 'strong', 'preferred', 'moderate', 5,
   'published', '4'),

  ('data_engineer',
   'Data Engineer / Data Platform Engineer',
   'computing',
   'Build data pipelines and infrastructure to collect, store, and process large datasets.',
   array['investigative','conventional'], array['analytical','structured'],
   'high', 'moderate', 'strong', 'none', 'moderate', 4,
   'published', '4'),

  ('network_engineer',
   'Network Engineer / Network Administrator',
   'computing',
   'Design, configure, and maintain computer networks and telecommunications infrastructure.',
   array['investigative','realistic'], array['analytical','structured'],
   'medium', 'moderate', 'strong', 'none', 'stable', 3,
   'published', '4'),

  ('embedded_systems_engineer',
   'Embedded Systems Engineer / IoT Developer',
   'computing',
   'Program microcontrollers and IoT devices for consumer electronics and industrial systems.',
   array['investigative','realistic'], array['analytical','practical'],
   'high', 'moderate', 'strong', 'preferred', 'moderate', 4,
   'published', '4'),

  ('software_qa_engineer',
   'Software QA Engineer / Test Engineer',
   'computing',
   'Design and run automated and manual tests to ensure software quality before release.',
   array['investigative','conventional'], array['analytical','structured'],
   'medium', 'moderate', 'strong', 'none', 'stable', 3,
   'published', '4'),

  ('blockchain_developer',
   'Blockchain Developer / Web3 Developer',
   'computing',
   'Build decentralised apps, smart contracts, and blockchain-based systems.',
   array['investigative','conventional'], array['analytical','risk_taking'],
   'high', 'weak', 'strong', 'none', 'entrepreneurial', 4,
   'published', '4'),

  -- ── Engineering ────────────────────────────────────────────────────────────
  ('chemical_engineer',
   'Chemical Engineer',
   'engineering',
   'Design industrial processes to transform raw materials into chemicals, fuels, and materials.',
   array['realistic','investigative'], array['analytical','practical'],
   'medium', 'moderate', 'strong', 'preferred', 'stable', 4,
   'published', '4'),

  ('aerospace_engineer',
   'Aerospace / Aeronautical Engineer',
   'engineering',
   'Design and test aircraft, spacecraft, and aviation defence systems.',
   array['realistic','investigative'], array['analytical','practical'],
   'high', 'weak', 'strong', 'preferred', 'stable', 5,
   'published', '4'),

  ('biomedical_engineer',
   'Biomedical Engineer',
   'engineering',
   'Develop medical devices, prosthetics, and diagnostic equipment using engineering principles.',
   array['realistic','investigative'], array['analytical','practical'],
   'medium', 'moderate', 'strong', 'preferred', 'moderate', 5,
   'published', '4'),

  ('industrial_engineer',
   'Industrial / Manufacturing Engineer',
   'engineering',
   'Optimise production processes, reduce waste, and improve efficiency in manufacturing.',
   array['realistic','investigative'], array['analytical','structured'],
   'medium', 'moderate', 'strong', 'none', 'stable', 4,
   'published', '4'),

  ('marine_engineer',
   'Marine Engineer (Merchant Navy)',
   'engineering',
   'Operate and maintain ship propulsion and mechanical systems on commercial vessels.',
   array['realistic','investigative'], array['practical','analytical'],
   'high', 'moderate', 'strong', 'none', 'stable', 4,
   'published', '4'),

  ('robotics_engineer',
   'Robotics Engineer / Automation Engineer',
   'engineering',
   'Design robots and automated systems for industry, medicine, and research.',
   array['realistic','investigative'], array['analytical','practical'],
   'high', 'weak', 'strong', 'preferred', 'moderate', 5,
   'published', '4'),

  ('renewable_energy_engineer',
   'Renewable Energy Engineer',
   'engineering',
   'Design solar, wind, and other clean-energy systems and smart power infrastructure.',
   array['realistic','investigative'], array['analytical','practical'],
   'medium', 'moderate', 'strong', 'preferred', 'stable', 4,
   'published', '4'),

  ('environmental_engineer',
   'Environmental Engineer',
   'engineering',
   'Design systems to manage pollution, treat waste water, and protect natural resources.',
   array['realistic','investigative'], array['analytical','practical'],
   'medium', 'moderate', 'strong', 'preferred', 'stable', 4,
   'published', '4'),

  ('telecom_engineer',
   'Telecommunications Engineer',
   'engineering',
   'Design and maintain mobile networks, satellite systems, and internet infrastructure.',
   array['realistic','investigative'], array['analytical','structured'],
   'medium', 'moderate', 'strong', 'preferred', 'stable', 4,
   'published', '4'),

  -- ── Medical ────────────────────────────────────────────────────────────────
  ('homeopathy_doctor',
   'Homeopathy Doctor (BHMS)',
   'medical',
   'Treat patients using classical homeopathic medicine; strong wellness demand in Kerala.',
   array['investigative','social'], array['analytical','social'],
   'medium', 'strong', 'moderate', 'none', 'stable', 6,
   'published', '4'),

  ('speech_language_pathologist',
   'Speech-Language Pathologist / Therapist',
   'medical',
   'Diagnose and treat communication and swallowing disorders in children and adults.',
   array['social','investigative'], array['social','analytical'],
   'medium', 'moderate', 'moderate', 'preferred', 'stable', 4,
   'published', '4'),

  ('optometrist',
   'Optometrist',
   'medical',
   'Examine eyes, prescribe glasses and contact lenses, and detect vision disorders.',
   array['investigative','realistic'], array['analytical','practical'],
   'medium', 'strong', 'strong', 'none', 'stable', 4,
   'published', '4'),

  ('radiographer',
   'Radiographer / Medical Imaging Technologist',
   'medical',
   'Operate X-ray, MRI, and CT scanners to produce diagnostic images for doctors.',
   array['investigative','realistic'], array['analytical','structured'],
   'medium', 'strong', 'strong', 'none', 'stable', 3,
   'published', '4'),

  -- ── Allied Health ──────────────────────────────────────────────────────────
  ('audiologist',
   'Audiologist',
   'allied_health',
   'Assess and treat hearing and balance disorders; fit hearing aids and cochlear devices.',
   array['social','investigative'], array['social','analytical'],
   'medium', 'moderate', 'moderate', 'preferred', 'stable', 4,
   'published', '4'),

  ('occupational_therapist',
   'Occupational Therapist',
   'allied_health',
   'Help patients regain daily living skills after illness, injury, or disability.',
   array['social','realistic'], array['social','practical'],
   'medium', 'moderate', 'moderate', 'none', 'stable', 4,
   'published', '4'),

  ('emergency_paramedic',
   'Emergency Medical Technician / Paramedic',
   'allied_health',
   'Provide urgent pre-hospital care in ambulances and emergency settings.',
   array['realistic','social'], array['practical','risk_taking'],
   'medium', 'strong', 'strong', 'none', 'stable', 2,
   'published', '4'),

  ('sports_scientist',
   'Sports Scientist / Exercise Physiologist',
   'allied_health',
   'Apply science to improve athletic performance, fitness, and injury prevention.',
   array['realistic','investigative'], array['practical','analytical'],
   'medium', 'moderate', 'moderate', 'preferred', 'moderate', 4,
   'published', '4'),

  -- ── Pure & Applied Sciences ────────────────────────────────────────────────
  ('geologist',
   'Geologist / Earth Scientist',
   'sciences',
   'Study the Earth''s structure, minerals, and geological processes for mining and disaster management.',
   array['investigative','realistic'], array['analytical','practical'],
   'medium', 'moderate', 'moderate', 'preferred', 'stable', 5,
   'published', '4'),

  ('forensic_scientist',
   'Forensic Scientist / Crime Scene Analyst',
   'sciences',
   'Analyse physical evidence to support criminal investigations and court proceedings.',
   array['investigative','conventional'], array['analytical','structured'],
   'medium', 'moderate', 'moderate', 'preferred', 'stable', 4,
   'published', '4'),

  ('materials_scientist',
   'Materials Scientist / Metallurgist',
   'sciences',
   'Develop new materials — metals, polymers, composites — for engineering and technology industries.',
   array['investigative','realistic'], array['analytical','structured'],
   'medium', 'weak', 'moderate', 'mandatory', 'stable', 6,
   'published', '4'),

  ('biochemist',
   'Biochemist / Molecular Biologist',
   'sciences',
   'Study chemical processes in living organisms; applications in medicine and pharmaceuticals.',
   array['investigative','realistic'], array['analytical','structured'],
   'medium', 'moderate', 'moderate', 'mandatory', 'stable', 6,
   'published', '4'),

  ('oceanographer',
   'Oceanographer / Marine Scientist',
   'sciences',
   'Study ocean currents, marine ecosystems, and climate interactions for conservation and policy.',
   array['investigative','realistic'], array['analytical','practical'],
   'medium', 'moderate', 'moderate', 'preferred', 'stable', 5,
   'published', '4'),

  -- ── Commerce / Finance ─────────────────────────────────────────────────────
  ('insurance_professional',
   'Insurance Professional / Underwriter',
   'commerce_finance',
   'Assess risk and manage insurance products in life, health, and general insurance sectors.',
   array['conventional','enterprising'], array['analytical','structured'],
   'medium', 'strong', 'strong', 'none', 'stable', 3,
   'published', '4'),

  ('tax_consultant',
   'Tax Consultant / GST Practitioner',
   'commerce_finance',
   'Advise businesses and individuals on tax planning, compliance, and filing.',
   array['conventional','enterprising'], array['analytical','structured'],
   'medium', 'strong', 'strong', 'none', 'moderate', 3,
   'published', '4'),

  ('actuary',
   'Actuary',
   'commerce_finance',
   'Use mathematics and statistics to assess financial risk for insurance and pension funds.',
   array['conventional','investigative'], array['analytical','structured'],
   'high', 'moderate', 'strong', 'preferred', 'stable', 5,
   'published', '4'),

  ('stock_broker',
   'Stock Broker / Securities Analyst',
   'commerce_finance',
   'Trade stocks and analyse investment opportunities for clients in capital markets.',
   array['enterprising','conventional'], array['risk_taking','analytical'],
   'variable', 'moderate', 'strong', 'none', 'entrepreneurial', 3,
   'published', '4'),

  ('credit_analyst',
   'Credit Analyst / Risk Analyst',
   'commerce_finance',
   'Evaluate creditworthiness of borrowers for banks and financial institutions.',
   array['conventional','investigative'], array['analytical','structured'],
   'medium', 'moderate', 'strong', 'none', 'stable', 3,
   'published', '4'),

  -- ── Management ─────────────────────────────────────────────────────────────
  ('hr_manager',
   'Human Resources (HR) Manager',
   'management',
   'Recruit, train, and manage employee relations, talent development, and organisational culture.',
   array['social','enterprising'], array['social','structured'],
   'medium', 'strong', 'strong', 'preferred', 'stable', 4,
   'published', '4'),

  ('supply_chain_manager',
   'Supply Chain / Logistics Manager',
   'management',
   'Oversee procurement, inventory, warehousing, and distribution of goods efficiently.',
   array['enterprising','conventional'], array['structured','analytical'],
   'medium', 'moderate', 'strong', 'none', 'stable', 4,
   'published', '4'),

  ('marketing_manager',
   'Marketing Manager / Brand Manager',
   'management',
   'Plan and execute marketing campaigns to grow brand awareness and drive sales.',
   array['enterprising','artistic'], array['social','risk_taking'],
   'medium', 'moderate', 'strong', 'preferred', 'moderate', 4,
   'published', '4'),

  ('operations_manager',
   'Operations Manager',
   'management',
   'Streamline daily business operations, improve processes, and ensure performance targets are met.',
   array['enterprising','conventional'], array['structured','analytical'],
   'medium', 'moderate', 'strong', 'preferred', 'stable', 5,
   'published', '4'),

  ('real_estate_manager',
   'Real Estate Developer / Property Manager',
   'management',
   'Manage property development, sales, leasing, and real estate investment in Kerala''s growing market.',
   array['enterprising','realistic'], array['risk_taking','social'],
   'variable', 'strong', 'strong', 'none', 'entrepreneurial', 4,
   'published', '4'),

  ('healthcare_administrator',
   'Hospital / Healthcare Administrator',
   'management',
   'Manage operations, finance, staffing, and quality in hospitals and healthcare facilities.',
   array['enterprising','conventional'], array['structured','social'],
   'medium', 'strong', 'strong', 'preferred', 'stable', 4,
   'published', '4'),

  -- ── Law ────────────────────────────────────────────────────────────────────
  ('corporate_lawyer',
   'Corporate Lawyer',
   'law',
   'Handle mergers, acquisitions, contracts, and corporate compliance for companies and investors.',
   array['enterprising','conventional'], array['analytical','structured'],
   'high', 'moderate', 'strong', 'none', 'moderate', 6,
   'published', '4'),

  ('criminal_lawyer',
   'Criminal Defence / Prosecution Lawyer',
   'law',
   'Represent clients in criminal cases as defence counsel or public prosecutor in courts.',
   array['enterprising','social'], array['analytical','social'],
   'variable', 'strong', 'strong', 'none', 'moderate', 5,
   'published', '4'),

  ('ip_attorney',
   'Intellectual Property (IP) Lawyer',
   'law',
   'Protect patents, trademarks, and copyrights for creators, startups, and corporations.',
   array['investigative','conventional'], array['analytical','structured'],
   'high', 'moderate', 'strong', 'none', 'stable', 6,
   'published', '4'),

  ('human_rights_advocate',
   'Human Rights / Public Interest Lawyer',
   'law',
   'Fight for civil liberties, constitutional rights, and justice for marginalised communities.',
   array['social','enterprising'], array['social','analytical'],
   'low', 'moderate', 'moderate', 'none', 'stable', 5,
   'published', '4'),

  ('cyber_law_expert',
   'Cyber Law Expert / Digital Rights Lawyer',
   'law',
   'Handle cybercrime, data privacy, and digital intellectual property cases.',
   array['investigative','conventional'], array['analytical','structured'],
   'high', 'moderate', 'strong', 'none', 'moderate', 6,
   'published', '4'),

  -- ── Design ─────────────────────────────────────────────────────────────────
  ('product_industrial_designer',
   'Product / Industrial Designer',
   'design',
   'Design everyday products — from furniture to electronics — balancing form, function, and user needs.',
   array['artistic','realistic'], array['practical','analytical'],
   'medium', 'moderate', 'strong', 'none', 'moderate', 4,
   'published', '4'),

  ('ui_ux_designer',
   'UI / UX Designer',
   'design',
   'Design intuitive digital interfaces and user experiences for apps and websites.',
   array['artistic','investigative'], array['practical','analytical'],
   'high', 'moderate', 'strong', 'none', 'moderate', 3,
   'published', '4'),

  ('jewellery_designer',
   'Jewellery Designer / Goldsmith',
   'design',
   'Design and craft jewellery for retail, custom orders, and export markets — thriving in Kerala.',
   array['artistic','realistic'], array['practical'],
   'variable', 'strong', 'strong', 'none', 'entrepreneurial', 3,
   'published', '4'),

  ('textile_designer',
   'Textile Designer / Surface Pattern Designer',
   'design',
   'Create patterns, fabrics, and surface designs for fashion, home furnishings, and industry.',
   array['artistic','realistic'], array['practical'],
   'medium', 'moderate', 'moderate', 'none', 'moderate', 3,
   'published', '4'),

  ('concept_artist',
   'Concept Artist / Digital Illustrator',
   'design',
   'Create visual concepts for games, films, animation, and advertising campaigns.',
   array['artistic','investigative'], array['practical'],
   'variable', 'weak', 'moderate', 'none', 'entrepreneurial', 3,
   'published', '4'),

  -- ── Architecture ───────────────────────────────────────────────────────────
  ('urban_planner',
   'Urban Planner / Town Planner',
   'architecture',
   'Design sustainable cities, manage land use, and plan public infrastructure and transport.',
   array['realistic','investigative'], array['analytical','practical'],
   'medium', 'moderate', 'strong', 'preferred', 'stable', 5,
   'published', '4'),

  ('landscape_architect',
   'Landscape Architect',
   'architecture',
   'Design parks, gardens, public spaces, and ecological environments for cities and institutions.',
   array['artistic','realistic'], array['practical','analytical'],
   'medium', 'moderate', 'moderate', 'none', 'moderate', 4,
   'published', '4'),

  ('quantity_surveyor',
   'Quantity Surveyor / Cost Estimator',
   'architecture',
   'Estimate construction costs, manage budgets, and ensure value for money in building projects.',
   array['conventional','realistic'], array['analytical','structured'],
   'medium', 'strong', 'strong', 'none', 'stable', 3,
   'published', '4'),

  -- ── Media / Communication ──────────────────────────────────────────────────
  ('radio_jockey',
   'Radio Jockey (RJ) / Broadcast Presenter',
   'media',
   'Host radio programmes, engage mass audiences, and present music and news shows.',
   array['artistic','social'], array['social','risk_taking'],
   'variable', 'moderate', 'moderate', 'none', 'entrepreneurial', 2,
   'published', '4'),

  ('documentary_filmmaker',
   'Documentary Filmmaker / Video Journalist',
   'media',
   'Research and produce factual films for broadcast, film festivals, and OTT platforms.',
   array['artistic','investigative'], array['practical','risk_taking'],
   'variable', 'moderate', 'moderate', 'none', 'entrepreneurial', 4,
   'published', '4'),

  ('public_relations_specialist',
   'Public Relations (PR) Specialist',
   'media',
   'Manage an organisation''s image, media relations, and crisis communications strategy.',
   array['enterprising','social'], array['social','structured'],
   'medium', 'moderate', 'strong', 'none', 'moderate', 3,
   'published', '4'),

  ('advertising_copywriter',
   'Advertising Copywriter / Creative Director',
   'media',
   'Write compelling ad copy, campaign scripts, and brand narratives across all media.',
   array['artistic','enterprising'], array['practical','risk_taking'],
   'variable', 'moderate', 'strong', 'none', 'moderate', 3,
   'published', '4'),

  ('social_media_strategist',
   'Social Media Strategist / Digital Marketer',
   'media',
   'Grow brand presence through targeted social media campaigns, content, and analytics.',
   array['enterprising','artistic'], array['social','analytical'],
   'medium', 'strong', 'strong', 'none', 'moderate', 2,
   'published', '4'),

  ('sound_engineer',
   'Sound Engineer / Audio Producer',
   'media',
   'Record, mix, and master audio for music, film, TV, radio, and live events.',
   array['artistic','realistic'], array['practical','analytical'],
   'variable', 'moderate', 'moderate', 'none', 'entrepreneurial', 3,
   'published', '4'),

  -- ── Agriculture, Food & Environment ───────────────────────────────────────
  ('horticulturist',
   'Horticulturist / Floriculturist',
   'agriculture',
   'Cultivate fruits, vegetables, flowers, and landscape plants; floriculture is booming in Kerala.',
   array['realistic','investigative'], array['practical','analytical'],
   'medium', 'strong', 'moderate', 'none', 'stable', 3,
   'published', '4'),

  ('fisheries_scientist',
   'Fisheries Scientist / Aquaculture Specialist',
   'agriculture',
   'Manage fisheries, fish farming, and marine resource conservation — high demand in coastal Kerala.',
   array['investigative','realistic'], array['analytical','practical'],
   'medium', 'strong', 'moderate', 'preferred', 'stable', 4,
   'published', '4'),

  ('agricultural_engineer',
   'Agricultural Engineer',
   'agriculture',
   'Design farm machinery, irrigation systems, and post-harvest technology for modern agriculture.',
   array['realistic','investigative'], array['analytical','practical'],
   'medium', 'moderate', 'strong', 'none', 'stable', 4,
   'published', '4'),

  ('dairy_technologist',
   'Dairy Technologist / Milk Product Specialist',
   'agriculture',
   'Process, test, and develop dairy products for cooperatives and food companies like Milma.',
   array['investigative','realistic'], array['analytical','structured'],
   'medium', 'strong', 'moderate', 'none', 'stable', 3,
   'published', '4'),

  -- ── Humanities, Education & Social Sciences ────────────────────────────────
  ('economist',
   'Economist / Economic Analyst',
   'humanities',
   'Analyse economic trends, advise on policy, and research market and development behaviour.',
   array['investigative','conventional'], array['analytical','structured'],
   'medium', 'moderate', 'moderate', 'mandatory', 'stable', 7,
   'published', '4'),

  ('political_scientist',
   'Political Scientist / Policy Analyst',
   'humanities',
   'Study governance, public policy, and political systems for research or government advisory.',
   array['investigative','social'], array['analytical','social'],
   'medium', 'moderate', 'moderate', 'mandatory', 'stable', 7,
   'published', '4'),

  ('historian',
   'Historian / Archivist',
   'humanities',
   'Research historical events, curate records, and publish or teach historical scholarship.',
   array['investigative','artistic'], array['analytical','structured'],
   'low', 'moderate', 'moderate', 'mandatory', 'stable', 7,
   'published', '4'),

  ('sociologist',
   'Sociologist / Social Researcher',
   'humanities',
   'Study society, culture, and human behaviour through research, surveys, and fieldwork.',
   array['investigative','social'], array['analytical','social'],
   'medium', 'moderate', 'moderate', 'mandatory', 'stable', 6,
   'published', '4'),

  ('librarian',
   'Librarian / Information Scientist',
   'humanities',
   'Manage library collections, digital information systems, and knowledge resources in institutions.',
   array['conventional','investigative'], array['structured','analytical'],
   'low', 'strong', 'strong', 'preferred', 'stable', 3,
   'published', '4'),

  ('museum_curator',
   'Museum Curator / Heritage Professional',
   'humanities',
   'Preserve and present cultural artefacts, artworks, and heritage for public education.',
   array['investigative','artistic'], array['analytical','structured'],
   'low', 'moderate', 'moderate', 'preferred', 'stable', 5,
   'published', '4'),

  ('education_counsellor',
   'Education Counsellor / Career Counsellor',
   'humanities',
   'Guide students on course choices, career paths, and academic and personal development.',
   array['social','investigative'], array['social','analytical'],
   'medium', 'strong', 'strong', 'preferred', 'stable', 3,
   'published', '4'),

  -- ── Government, Defence & Civil Services ──────────────────────────────────
  ('police_officer',
   'Police Officer (State Police / IPS)',
   'government',
   'Maintain law and order, investigate crimes, and protect communities via Kerala PSC or UPSC IPS.',
   array['realistic','social'], array['practical','social'],
   'medium', 'strong', 'strong', 'none', 'stable', 3,
   'published', '4'),

  ('forest_officer',
   'Forest Officer / Wildlife Conservation Officer',
   'government',
   'Protect forests, manage wildlife sanctuaries, and implement conservation policy in Kerala.',
   array['realistic','investigative'], array['practical','analytical'],
   'medium', 'strong', 'strong', 'none', 'stable', 4,
   'published', '4'),

  ('customs_excise_officer',
   'Customs & Excise / Revenue Officer',
   'government',
   'Enforce customs and excise laws, prevent smuggling, and collect indirect taxes for the government.',
   array['conventional','realistic'], array['analytical','structured'],
   'medium', 'strong', 'strong', 'none', 'stable', 3,
   'published', '4'),

  ('revenue_officer',
   'Revenue Officer / Panchayat Development Officer',
   'government',
   'Administer land records, local governance, and rural development programmes via Kerala PSC.',
   array['conventional','social'], array['structured','social'],
   'medium', 'strong', 'strong', 'none', 'stable', 3,
   'published', '4'),

  -- ── Hospitality & Tourism ──────────────────────────────────────────────────
  ('travel_consultant',
   'Travel Consultant / Tourism Professional',
   'hospitality',
   'Plan tours, sell travel packages, and provide travel advisory services to clients.',
   array['enterprising','social'], array['social','structured'],
   'variable', 'strong', 'strong', 'none', 'entrepreneurial', 2,
   'published', '4'),

  ('tour_guide',
   'Tour Guide / Heritage Interpreter',
   'hospitality',
   'Lead tourists through heritage sites, backwaters, and wildlife parks with cultural insights.',
   array['social','artistic'], array['social','practical'],
   'variable', 'strong', 'moderate', 'none', 'entrepreneurial', 1,
   'published', '4'),

  ('airline_cabin_crew',
   'Airline Cabin Crew / Flight Attendant',
   'hospitality',
   'Ensure passenger safety and comfort on commercial flights; strong Gulf and international demand.',
   array['social','realistic'], array['social','practical'],
   'medium', 'weak', 'strong', 'none', 'moderate', 1,
   'published', '4'),

  ('food_beverage_manager',
   'Food & Beverage Manager',
   'hospitality',
   'Oversee restaurant operations, menu planning, and F&B staff in hotels and resorts.',
   array['enterprising','realistic'], array['social','structured'],
   'medium', 'strong', 'strong', 'none', 'stable', 4,
   'published', '4'),

  ('cruise_hospitality_professional',
   'Cruise Ship Hospitality Professional',
   'hospitality',
   'Work on cruise ships in guest services, entertainment, or F&B — highly popular path in Kerala.',
   array['social','realistic'], array['social','practical'],
   'medium', 'weak', 'strong', 'none', 'moderate', 2,
   'published', '4'),

  ('spa_wellness_manager',
   'Spa & Wellness Manager / Ayurvedic Resort Manager',
   'hospitality',
   'Manage wellness centres, spa operations, and Ayurvedic resorts — a thriving niche in Kerala.',
   array['enterprising','social'], array['social','structured'],
   'medium', 'strong', 'strong', 'none', 'stable', 4,
   'published', '4')

on conflict (id) do nothing;

-- ── 5. CAREER → COURSE LINKS ─────────────────────────────────────────────────
insert into public.career_course (career_id, course_id, route_type, strength, pathway_note) values

  -- web_developer
  ('web_developer','btech_cse','primary',0.9,'B.Tech CSE → full-stack web development'),
  ('web_developer','bsc_cs','alternative',0.9,'B.Sc CS → web development; strong portfolio matters'),
  ('web_developer','bca','alternative',0.8,'BCA → web developer; frontend or backend'),
  ('web_developer','diploma_cs','fallback',0.6,'Diploma + self-learning → junior web dev'),

  -- cloud_engineer
  ('cloud_engineer','btech_cse','primary',1.0,'B.Tech CSE → cloud/infrastructure engineering'),
  ('cloud_engineer','bsc_cs','alternative',0.7,'B.Sc CS → cloud with certifications (AWS/GCP)'),

  -- data_engineer
  ('data_engineer','btech_cse','primary',1.0,'B.Tech CSE → data engineering and pipelines'),
  ('data_engineer','bsc_cs','alternative',0.8,'B.Sc CS → data engineering; M.Sc or certs help'),

  -- network_engineer
  ('network_engineer','btech_cse','primary',0.9,'B.Tech CSE → networking and infrastructure'),
  ('network_engineer','btech_ece','alternative',0.8,'B.Tech ECE → telecom and networking'),
  ('network_engineer','bsc_cs','fallback',0.6,'B.Sc CS + CCNA/CCNP certifications'),

  -- embedded_systems_engineer
  ('embedded_systems_engineer','btech_ece','primary',1.0,'B.Tech ECE → embedded/IoT engineering'),
  ('embedded_systems_engineer','btech_eee','alternative',0.7,'B.Tech EEE → embedded systems and hardware'),

  -- software_qa_engineer
  ('software_qa_engineer','btech_cse','primary',0.9,'B.Tech CSE → QA and test engineering'),
  ('software_qa_engineer','bsc_cs','alternative',0.8,'B.Sc CS → QA/testing roles'),
  ('software_qa_engineer','bca','fallback',0.6,'BCA → junior QA roles'),

  -- blockchain_developer
  ('blockchain_developer','btech_cse','primary',1.0,'B.Tech CSE → blockchain/Web3 development'),
  ('blockchain_developer','bsc_cs','alternative',0.7,'B.Sc CS → blockchain with strong self-learning'),

  -- chemical_engineer
  ('chemical_engineer','btech_chemical','primary',1.0,'B.Tech Chemical Engineering → process/plant roles'),
  ('chemical_engineer','btech_cse','fallback',0.4,'B.Tech CSE → process simulation roles only'),

  -- aerospace_engineer
  ('aerospace_engineer','btech_aerospace','primary',1.0,'B.Tech Aerospace → DRDO/ISRO/private aviation'),
  ('aerospace_engineer','btech_mech','alternative',0.6,'B.Tech Mechanical → aerospace manufacturing'),

  -- biomedical_engineer
  ('biomedical_engineer','btech_biomedical','primary',1.0,'B.Tech Biomedical → medical device industry'),
  ('biomedical_engineer','btech_ece','alternative',0.6,'B.Tech ECE → medical electronics specialisation'),
  ('biomedical_engineer','btech_mech','alternative',0.5,'B.Tech Mech → prosthetics and implant engineering'),

  -- industrial_engineer
  ('industrial_engineer','btech_mech','primary',0.9,'B.Tech Mechanical → industrial/manufacturing engineering'),
  ('industrial_engineer','btech_chemical','alternative',0.5,'B.Tech Chemical → process plant management'),

  -- marine_engineer
  ('marine_engineer','btech_marine','primary',1.0,'B.Tech Marine Engineering → Merchant Navy sea service'),

  -- robotics_engineer
  ('robotics_engineer','btech_mech','primary',0.8,'B.Tech Mech → robotics and automation'),
  ('robotics_engineer','btech_ece','alternative',0.8,'B.Tech ECE → robotics and embedded control'),
  ('robotics_engineer','btech_cse','alternative',0.7,'B.Tech CSE → robot programming and AI'),

  -- renewable_energy_engineer
  ('renewable_energy_engineer','btech_eee','primary',1.0,'B.Tech EEE → solar/wind power engineering'),
  ('renewable_energy_engineer','btech_civil','alternative',0.5,'B.Tech Civil → energy infrastructure'),

  -- environmental_engineer
  ('environmental_engineer','btech_civil','primary',0.9,'B.Tech Civil → environmental and water treatment'),
  ('environmental_engineer','btech_chemical','alternative',0.7,'B.Tech Chemical → pollution control systems'),
  ('environmental_engineer','bsc_envscience','fallback',0.5,'B.Sc Env. Science → M.Tech for engineering roles'),

  -- telecom_engineer
  ('telecom_engineer','btech_ece','primary',1.0,'B.Tech ECE → telecom and network engineering'),
  ('telecom_engineer','btech_eee','alternative',0.5,'B.Tech EEE → power-communication systems'),

  -- homeopathy_doctor
  ('homeopathy_doctor','bhms','primary',1.0,'BHMS → homeopathy practice and clinics'),

  -- speech_language_pathologist
  ('speech_language_pathologist','bsc_audiology','primary',1.0,'B.Sc Audiology & SLP → clinical practice; M.Sc for senior roles'),
  ('speech_language_pathologist','bsc_lifescience','fallback',0.4,'B.Sc + M.Sc SLP pathway'),

  -- optometrist
  ('optometrist','bsc_optometry','primary',1.0,'B.Sc Optometry → optical clinics and hospitals'),

  -- radiographer
  ('radiographer','bsc_radiology','primary',1.0,'B.Sc Medical Imaging → hospital radiology dept'),
  ('radiographer','bmlt','fallback',0.5,'BMLT → radiology technician with additional training'),

  -- audiologist
  ('audiologist','bsc_audiology','primary',1.0,'B.Sc Audiology → hearing clinics and ENT depts'),

  -- occupational_therapist
  ('occupational_therapist','bot','primary',1.0,'BOT → rehab centres, hospitals, special needs schools'),

  -- emergency_paramedic
  ('emergency_paramedic','bsc_lifescience','fallback',0.6,'B.Sc + paramedic certificate course'),
  ('emergency_paramedic','bmlt','fallback',0.5,'BMLT pathway → emergency services'),

  -- sports_scientist
  ('sports_scientist','bsc_lifescience','primary',0.8,'B.Sc Life Science → M.Sc Exercise Physiology'),
  ('sports_scientist','bpt','alternative',0.7,'BPT → sports physiotherapy and conditioning'),

  -- geologist
  ('geologist','bsc_geology','primary',1.0,'B.Sc Geology → GSI / mining / oil sector; M.Sc preferred'),
  ('geologist','bsc_envscience','fallback',0.4,'B.Sc Env. Sc → environmental geology'),

  -- forensic_scientist
  ('forensic_scientist','bsc_forensic','primary',1.0,'B.Sc Forensic Science → police labs, courts; M.Sc recommended'),
  ('forensic_scientist','bsc_lifescience','alternative',0.6,'B.Sc Life Science → forensic biology specialisation'),

  -- materials_scientist
  ('materials_scientist','btech_mech','primary',0.7,'B.Tech Mech → materials and metallurgy; M.Tech needed'),
  ('materials_scientist','btech_chemical','alternative',0.6,'B.Tech Chemical → polymer and materials science'),

  -- biochemist
  ('biochemist','bsc_lifescience','primary',1.0,'B.Sc Biochemistry → M.Sc → pharma/research'),
  ('biochemist','btech_biomedical','alternative',0.5,'B.Tech Biomedical → biomedical science research'),

  -- oceanographer
  ('oceanographer','bsc_lifescience','primary',0.8,'B.Sc Marine / Life Science → M.Sc Oceanography'),
  ('oceanographer','bsc_envscience','alternative',0.7,'B.Sc Env. Science → marine environment research'),
  ('oceanographer','bfsc','alternative',0.6,'B.F.Sc → marine resource management'),

  -- insurance_professional
  ('insurance_professional','bcom','primary',0.8,'B.Com → insurance industry; IRDA exams'),
  ('insurance_professional','bba','alternative',0.8,'BBA → insurance management'),
  ('insurance_professional','ca_track','alternative',0.6,'CA → risk and actuarial insurance roles'),

  -- tax_consultant
  ('tax_consultant','ca_track','primary',1.0,'CA → taxation and GST consultancy'),
  ('tax_consultant','bcom','alternative',0.7,'B.Com → tax practitioner with additional certifications'),
  ('tax_consultant','bba','fallback',0.5,'BBA + tax certifications'),

  -- actuary
  ('actuary','bcom','primary',0.7,'B.Com + IAI (Institute of Actuaries India) exams'),
  ('actuary','ca_track','alternative',0.6,'CA + actuarial exams — dual qualification path'),
  ('actuary','bsc_cs','alternative',0.7,'B.Sc CS + IAI exams — data-heavy actuarial role'),

  -- stock_broker
  ('stock_broker','bcom','primary',0.9,'B.Com → SEBI/NSE certifications → stock broking'),
  ('stock_broker','bba','alternative',0.8,'BBA → capital markets and equity research'),
  ('stock_broker','ca_track','alternative',0.6,'CA → investment advisory roles'),

  -- credit_analyst
  ('credit_analyst','bcom','primary',0.9,'B.Com → bank credit analysis; JAIIB helps'),
  ('credit_analyst','bba','alternative',0.8,'BBA → credit and risk departments'),

  -- hr_manager
  ('hr_manager','bba','primary',0.9,'BBA → HR roles; MBA-HR for senior positions'),
  ('hr_manager','mba','higher-study-route',0.8,'MBA HR specialisation → HR management'),
  ('hr_manager','ba_general','fallback',0.5,'BA + MBA → HR entry path'),

  -- supply_chain_manager
  ('supply_chain_manager','bba','primary',0.9,'BBA → logistics and supply chain management'),
  ('supply_chain_manager','mba','higher-study-route',0.8,'MBA Operations → supply chain leadership'),
  ('supply_chain_manager','btech_mech','alternative',0.6,'B.Tech Mech → manufacturing supply chain'),

  -- marketing_manager
  ('marketing_manager','bba','primary',0.9,'BBA → marketing roles; MBA-Marketing for senior'),
  ('marketing_manager','mba','higher-study-route',0.8,'MBA Marketing → brand management'),
  ('marketing_manager','bjmc','alternative',0.6,'BJMC → marketing communications and PR'),

  -- operations_manager
  ('operations_manager','bba','primary',0.9,'BBA → operations management; MBA for leadership'),
  ('operations_manager','mba','higher-study-route',0.8,'MBA Operations → senior management'),
  ('operations_manager','btech_mech','alternative',0.6,'B.Tech Mech → industrial operations'),

  -- real_estate_manager
  ('real_estate_manager','bba','primary',0.8,'BBA → real estate management'),
  ('real_estate_manager','barch','alternative',0.6,'B.Arch → development and project management'),
  ('real_estate_manager','ba_general','fallback',0.5,'BA + real estate certifications'),

  -- healthcare_administrator
  ('healthcare_administrator','bba','primary',0.8,'BBA → hospital administration; MBA-HA preferred'),
  ('healthcare_administrator','mba','higher-study-route',0.9,'MBA Hospital Administration → senior roles'),
  ('healthcare_administrator','bsc_lifescience','alternative',0.5,'B.Sc + MBA-HA for clinical admin'),

  -- corporate_lawyer
  ('corporate_lawyer','ballb','primary',1.0,'BA LLB → corporate law practice; LLM helps'),

  -- criminal_lawyer
  ('criminal_lawyer','ballb','primary',1.0,'BA LLB → criminal courts; Kerala Bar Council enrolment'),

  -- ip_attorney
  ('ip_attorney','ballb','primary',1.0,'BA LLB → IP law; engineering background is an advantage'),

  -- human_rights_advocate
  ('human_rights_advocate','ballb','primary',1.0,'BA LLB → human rights organisations and courts'),
  ('human_rights_advocate','ba_general','fallback',0.5,'BA → LLB → public interest law'),

  -- cyber_law_expert
  ('cyber_law_expert','ballb','primary',1.0,'BA LLB → cyber law; tech background very useful'),

  -- product_industrial_designer
  ('product_industrial_designer','bdes_comm','primary',0.8,'B.Des → product / industrial design'),
  ('product_industrial_designer','bdes_interior','alternative',0.6,'B.Des Interior → product design overlap'),
  ('product_industrial_designer','btech_mech','alternative',0.5,'B.Tech Mech → engineering design'),

  -- ui_ux_designer
  ('ui_ux_designer','bdes_comm','primary',0.9,'B.Des Communication → UI/UX design'),
  ('ui_ux_designer','bsc_cs','alternative',0.7,'B.Sc CS → front-end and UX design'),
  ('ui_ux_designer','bca','fallback',0.6,'BCA → UI/UX with portfolio'),

  -- jewellery_designer
  ('jewellery_designer','bdes_fashion','primary',0.7,'B.Des → jewellery specialisation'),
  ('jewellery_designer','bdes_comm','alternative',0.5,'B.Des Comm → visual design for jewellery'),

  -- textile_designer
  ('textile_designer','bdes_fashion','primary',1.0,'B.Des Fashion → textile and surface design'),
  ('textile_designer','bdes_comm','alternative',0.5,'B.Des Communication → textile pattern design'),

  -- concept_artist
  ('concept_artist','bsc_animation','primary',1.0,'B.Sc Animation → concept art and illustration'),
  ('concept_artist','bdes_comm','alternative',0.8,'B.Des → concept art for media and gaming'),

  -- urban_planner
  ('urban_planner','barch','primary',0.8,'B.Arch → M.Plan in urban planning; Town Planning depts'),
  ('urban_planner','ba_general','fallback',0.5,'BA (Geog/Soc) + M.Plan → urban planning'),

  -- landscape_architect
  ('landscape_architect','barch','primary',0.7,'B.Arch → M.Landscape Architecture specialisation'),
  ('landscape_architect','bsc_agriculture','alternative',0.6,'B.Sc Agriculture → horticulture/landscape route'),

  -- quantity_surveyor
  ('quantity_surveyor','btech_civil','primary',1.0,'B.Tech Civil → quantity surveying and cost estimation'),
  ('quantity_surveyor','barch','alternative',0.6,'B.Arch → project cost management'),

  -- radio_jockey
  ('radio_jockey','bjmc','primary',0.9,'BJMC → radio presenting and broadcast journalism'),
  ('radio_jockey','ba_general','fallback',0.5,'BA + shortlisting / audition for RJ roles'),

  -- documentary_filmmaker
  ('documentary_filmmaker','bjmc','primary',1.0,'BJMC → documentary journalism and film'),
  ('documentary_filmmaker','ba_general','fallback',0.5,'BA + film-making workshops and portfolio'),

  -- public_relations_specialist
  ('public_relations_specialist','bjmc','primary',0.9,'BJMC → PR and communications'),
  ('public_relations_specialist','bba','alternative',0.7,'BBA → corporate communications'),
  ('public_relations_specialist','ba_general','fallback',0.5,'BA → PR entry with experience'),

  -- advertising_copywriter
  ('advertising_copywriter','bjmc','primary',1.0,'BJMC → advertising and copywriting'),
  ('advertising_copywriter','ba_general','fallback',0.6,'BA English/Humanities → creative writing path'),

  -- social_media_strategist
  ('social_media_strategist','bjmc','primary',0.8,'BJMC → digital media and social marketing'),
  ('social_media_strategist','bba','alternative',0.8,'BBA → marketing and social media management'),
  ('social_media_strategist','bsc_cs','fallback',0.5,'B.Sc CS → data-driven social media analytics'),

  -- sound_engineer
  ('sound_engineer','bjmc','primary',0.7,'BJMC → audio production and broadcasting'),
  ('sound_engineer','ba_general','fallback',0.5,'BA + audio engineering courses and studio training'),

  -- horticulturist
  ('horticulturist','bsc_horticulture','primary',1.0,'B.Sc Horticulture → KAU / state agri departments'),
  ('horticulturist','bsc_agriculture','alternative',0.7,'B.Sc Agriculture → horticulture specialisation'),

  -- fisheries_scientist
  ('fisheries_scientist','bfsc','primary',1.0,'B.F.Sc → KUFOS / Fisheries Dept / aquaculture industry'),
  ('fisheries_scientist','bsc_lifescience','alternative',0.6,'B.Sc Marine / Life Science → fisheries research'),

  -- agricultural_engineer
  ('agricultural_engineer','btech_food','primary',0.8,'B.Tech Food Tech / Agri Engineering → farm machinery'),
  ('agricultural_engineer','bsc_agriculture','alternative',0.7,'B.Sc Agriculture → agri engineering roles'),

  -- dairy_technologist
  ('dairy_technologist','btech_food','primary',1.0,'B.Tech Food Tech → dairy processing (MILMA, KMF)'),
  ('dairy_technologist','bsc_agriculture','alternative',0.6,'B.Sc Agriculture + dairy technology training'),

  -- economist
  ('economist','ba_general','primary',0.7,'BA Economics → M.A. Economics → research / policy'),
  ('economist','bcom','alternative',0.5,'B.Com → economics and econometrics route'),

  -- political_scientist
  ('political_scientist','ba_general','primary',1.0,'BA Political Science → M.A. → research / academia / UPSC'),

  -- historian
  ('historian','ba_general','primary',1.0,'BA History → M.A. History → archives, academia, heritage'),

  -- sociologist
  ('sociologist','ba_general','primary',1.0,'BA Sociology → M.A. → research, NGO, academia'),
  ('sociologist','bsw','alternative',0.7,'BSW → community and social research roles'),

  -- librarian
  ('librarian','ba_general','primary',0.7,'BA → B.LISc / M.LISc → library service'),
  ('librarian','bsc_cs','alternative',0.5,'B.Sc CS → digital library and information management'),

  -- museum_curator
  ('museum_curator','ba_general','primary',1.0,'BA History/Arts → M.A. Museology → curator roles'),

  -- education_counsellor
  ('education_counsellor','bsc_psychology','primary',0.9,'B.Sc Psychology → M.Sc → career/school counselling'),
  ('education_counsellor','bed','alternative',0.7,'B.Ed → student guidance and counselling role'),
  ('education_counsellor','ba_general','fallback',0.5,'BA → counselling certifications and experience'),

  -- police_officer
  ('police_officer','ba_general','primary',0.7,'BA → Kerala PSC (Sub Inspector) or UPSC IPS'),
  ('police_officer','bsc_cs','alternative',0.5,'B.Sc CS → cyber crime cell / technical roles'),

  -- forest_officer
  ('forest_officer','bsc_agriculture','primary',0.8,'B.Sc Agriculture/Forestry → Kerala PSC Forest Officer'),
  ('forest_officer','bsc_lifescience','alternative',0.7,'B.Sc Life Science → forest ecology roles'),
  ('forest_officer','bsc_envscience','alternative',0.6,'B.Sc Env. Science → conservation roles'),

  -- customs_excise_officer
  ('customs_excise_officer','bcom','primary',0.7,'B.Com → SSC CGL / CBEC recruitment'),
  ('customs_excise_officer','ba_general','alternative',0.7,'BA → SSC CGL / Customs officer path'),
  ('customs_excise_officer','bba','alternative',0.6,'BBA → customs and trade compliance'),

  -- revenue_officer
  ('revenue_officer','ba_general','primary',0.9,'BA → Kerala PSC Village Officer / Revenue Officer'),
  ('revenue_officer','bcom','alternative',0.6,'B.Com → revenue administration'),

  -- travel_consultant
  ('travel_consultant','bhm','primary',0.8,'BHM → travel agency and tour operations'),
  ('travel_consultant','ba_general','alternative',0.7,'BA Geography/History → tour operations'),
  ('travel_consultant','bba','alternative',0.6,'BBA → travel business management'),

  -- tour_guide
  ('tour_guide','ba_general','primary',0.8,'BA History/Tourism → guide certification + language skills'),
  ('tour_guide','bhm','alternative',0.7,'BHM → guided tourism and heritage interpretation'),

  -- airline_cabin_crew
  ('airline_cabin_crew','bhm','primary',0.8,'BHM → airline cabin crew training programmes'),
  ('airline_cabin_crew','ba_general','alternative',0.7,'BA + airline training academy → cabin crew'),
  ('airline_cabin_crew','bsc_nursing','fallback',0.4,'B.Sc Nursing → air ambulance / medical crew'),

  -- food_beverage_manager
  ('food_beverage_manager','bhm','primary',1.0,'BHM → F&B management in hotels and resorts'),
  ('food_beverage_manager','bsc_culinary','alternative',0.8,'B.Sc Culinary → F&B team leadership'),

  -- cruise_hospitality_professional
  ('cruise_hospitality_professional','bhm','primary',1.0,'BHM → cruise line hospitality departments'),
  ('cruise_hospitality_professional','bsc_culinary','alternative',0.7,'Culinary Arts → cruise ship kitchen/F&B'),

  -- spa_wellness_manager
  ('spa_wellness_manager','bhm','primary',0.9,'BHM → spa and wellness resort management'),
  ('spa_wellness_manager','bams','alternative',0.8,'BAMS → Ayurvedic wellness resort management')

on conflict do nothing;

-- ── 6. CAREER SIGNALS ─────────────────────────────────────────────────────────
insert into public.career_signal (career_id, signal_type, signal_key, weight) values

  -- web_developer
  ('web_developer','interest','technology_coding',1.0),
  ('web_developer','interest','design_visual',0.5),
  ('web_developer','aptitude','logical',0.9),
  ('web_developer','aptitude','numerical',0.5),
  ('web_developer','personality','practical',0.7),
  ('web_developer','personality','analytical',0.6),

  -- cloud_engineer
  ('cloud_engineer','interest','technology_coding',0.9),
  ('cloud_engineer','interest','numbers_analysis',0.5),
  ('cloud_engineer','aptitude','logical',1.0),
  ('cloud_engineer','aptitude','numerical',0.6),
  ('cloud_engineer','personality','analytical',0.9),
  ('cloud_engineer','personality','structured',0.7),

  -- data_engineer
  ('data_engineer','interest','technology_coding',0.9),
  ('data_engineer','interest','numbers_analysis',0.7),
  ('data_engineer','aptitude','logical',1.0),
  ('data_engineer','aptitude','numerical',0.8),
  ('data_engineer','personality','analytical',0.9),
  ('data_engineer','personality','structured',0.7),

  -- network_engineer
  ('network_engineer','interest','technology_coding',0.7),
  ('network_engineer','interest','building_engineering',0.5),
  ('network_engineer','aptitude','logical',0.9),
  ('network_engineer','aptitude','numerical',0.5),
  ('network_engineer','personality','analytical',0.7),
  ('network_engineer','personality','structured',0.8),

  -- embedded_systems_engineer
  ('embedded_systems_engineer','interest','technology_coding',0.9),
  ('embedded_systems_engineer','interest','building_engineering',0.7),
  ('embedded_systems_engineer','aptitude','logical',1.0),
  ('embedded_systems_engineer','aptitude','numerical',0.7),
  ('embedded_systems_engineer','aptitude','spatial',0.5),
  ('embedded_systems_engineer','personality','analytical',0.8),
  ('embedded_systems_engineer','personality','practical',0.7),

  -- software_qa_engineer
  ('software_qa_engineer','interest','technology_coding',0.8),
  ('software_qa_engineer','interest','numbers_analysis',0.4),
  ('software_qa_engineer','aptitude','logical',1.0),
  ('software_qa_engineer','aptitude','verbal',0.5),
  ('software_qa_engineer','personality','analytical',0.9),
  ('software_qa_engineer','personality','structured',0.8),

  -- blockchain_developer
  ('blockchain_developer','interest','technology_coding',1.0),
  ('blockchain_developer','interest','business_money',0.4),
  ('blockchain_developer','aptitude','logical',1.0),
  ('blockchain_developer','aptitude','numerical',0.6),
  ('blockchain_developer','personality','analytical',0.9),
  ('blockchain_developer','personality','risk_taking',0.5),

  -- chemical_engineer
  ('chemical_engineer','interest','building_engineering',0.7),
  ('chemical_engineer','interest','science_research',0.6),
  ('chemical_engineer','aptitude','numerical',0.9),
  ('chemical_engineer','aptitude','scientific',0.8),
  ('chemical_engineer','aptitude','logical',0.7),
  ('chemical_engineer','personality','analytical',0.8),
  ('chemical_engineer','personality','practical',0.7),

  -- aerospace_engineer
  ('aerospace_engineer','interest','building_engineering',0.9),
  ('aerospace_engineer','interest','defence_adventure',0.5),
  ('aerospace_engineer','interest','science_research',0.5),
  ('aerospace_engineer','aptitude','logical',1.0),
  ('aerospace_engineer','aptitude','numerical',0.9),
  ('aerospace_engineer','aptitude','spatial',0.7),
  ('aerospace_engineer','personality','analytical',0.9),
  ('aerospace_engineer','personality','practical',0.7),

  -- biomedical_engineer
  ('biomedical_engineer','interest','building_engineering',0.7),
  ('biomedical_engineer','interest','health_medicine',0.7),
  ('biomedical_engineer','aptitude','logical',0.9),
  ('biomedical_engineer','aptitude','scientific',0.7),
  ('biomedical_engineer','aptitude','numerical',0.7),
  ('biomedical_engineer','personality','analytical',0.9),
  ('biomedical_engineer','personality','practical',0.6),

  -- industrial_engineer
  ('industrial_engineer','interest','building_engineering',0.8),
  ('industrial_engineer','interest','numbers_analysis',0.6),
  ('industrial_engineer','aptitude','logical',0.9),
  ('industrial_engineer','aptitude','numerical',0.8),
  ('industrial_engineer','aptitude','spatial',0.5),
  ('industrial_engineer','personality','analytical',0.8),
  ('industrial_engineer','personality','structured',0.7),

  -- marine_engineer
  ('marine_engineer','interest','building_engineering',0.8),
  ('marine_engineer','interest','defence_adventure',0.7),
  ('marine_engineer','aptitude','logical',0.8),
  ('marine_engineer','aptitude','numerical',0.7),
  ('marine_engineer','aptitude','spatial',0.5),
  ('marine_engineer','personality','practical',0.8),
  ('marine_engineer','personality','risk_taking',0.6),

  -- robotics_engineer
  ('robotics_engineer','interest','technology_coding',0.8),
  ('robotics_engineer','interest','building_engineering',0.9),
  ('robotics_engineer','aptitude','logical',1.0),
  ('robotics_engineer','aptitude','spatial',0.8),
  ('robotics_engineer','aptitude','numerical',0.7),
  ('robotics_engineer','personality','analytical',0.9),
  ('robotics_engineer','personality','practical',0.8),

  -- renewable_energy_engineer
  ('renewable_energy_engineer','interest','building_engineering',0.9),
  ('renewable_energy_engineer','interest','nature_agriculture',0.5),
  ('renewable_energy_engineer','aptitude','logical',0.9),
  ('renewable_energy_engineer','aptitude','numerical',0.8),
  ('renewable_energy_engineer','personality','analytical',0.8),
  ('renewable_energy_engineer','personality','practical',0.7),

  -- environmental_engineer
  ('environmental_engineer','interest','nature_agriculture',0.7),
  ('environmental_engineer','interest','building_engineering',0.8),
  ('environmental_engineer','aptitude','logical',0.9),
  ('environmental_engineer','aptitude','scientific',0.7),
  ('environmental_engineer','aptitude','numerical',0.7),
  ('environmental_engineer','personality','analytical',0.8),
  ('environmental_engineer','personality','practical',0.7),

  -- telecom_engineer
  ('telecom_engineer','interest','technology_coding',0.6),
  ('telecom_engineer','interest','building_engineering',0.8),
  ('telecom_engineer','aptitude','logical',0.9),
  ('telecom_engineer','aptitude','numerical',0.8),
  ('telecom_engineer','aptitude','spatial',0.4),
  ('telecom_engineer','personality','analytical',0.8),
  ('telecom_engineer','personality','structured',0.7),

  -- homeopathy_doctor
  ('homeopathy_doctor','interest','health_medicine',0.9),
  ('homeopathy_doctor','interest','helping_teaching',0.6),
  ('homeopathy_doctor','aptitude','scientific',0.8),
  ('homeopathy_doctor','aptitude','verbal',0.6),
  ('homeopathy_doctor','personality','social',0.7),
  ('homeopathy_doctor','personality','analytical',0.7),

  -- speech_language_pathologist
  ('speech_language_pathologist','interest','health_medicine',0.7),
  ('speech_language_pathologist','interest','helping_teaching',0.9),
  ('speech_language_pathologist','aptitude','verbal',1.0),
  ('speech_language_pathologist','aptitude','scientific',0.6),
  ('speech_language_pathologist','personality','social',0.9),
  ('speech_language_pathologist','personality','analytical',0.7),

  -- optometrist
  ('optometrist','interest','health_medicine',0.8),
  ('optometrist','interest','science_research',0.5),
  ('optometrist','aptitude','scientific',0.9),
  ('optometrist','aptitude','logical',0.7),
  ('optometrist','personality','analytical',0.8),
  ('optometrist','personality','practical',0.7),

  -- radiographer
  ('radiographer','interest','health_medicine',0.7),
  ('radiographer','interest','technology_coding',0.4),
  ('radiographer','aptitude','scientific',0.8),
  ('radiographer','aptitude','logical',0.6),
  ('radiographer','personality','analytical',0.7),
  ('radiographer','personality','structured',0.7),

  -- audiologist
  ('audiologist','interest','health_medicine',0.7),
  ('audiologist','interest','helping_teaching',0.7),
  ('audiologist','aptitude','scientific',0.8),
  ('audiologist','aptitude','verbal',0.6),
  ('audiologist','personality','social',0.8),
  ('audiologist','personality','analytical',0.7),

  -- occupational_therapist
  ('occupational_therapist','interest','health_medicine',0.6),
  ('occupational_therapist','interest','helping_teaching',1.0),
  ('occupational_therapist','aptitude','scientific',0.6),
  ('occupational_therapist','aptitude','verbal',0.5),
  ('occupational_therapist','personality','social',0.9),
  ('occupational_therapist','personality','practical',0.8),

  -- emergency_paramedic
  ('emergency_paramedic','interest','health_medicine',0.8),
  ('emergency_paramedic','interest','defence_adventure',0.7),
  ('emergency_paramedic','aptitude','scientific',0.7),
  ('emergency_paramedic','aptitude','logical',0.6),
  ('emergency_paramedic','personality','practical',0.9),
  ('emergency_paramedic','personality','risk_taking',0.7),

  -- sports_scientist
  ('sports_scientist','interest','health_medicine',0.5),
  ('sports_scientist','interest','science_research',0.7),
  ('sports_scientist','interest','nature_agriculture',0.3),
  ('sports_scientist','aptitude','scientific',0.8),
  ('sports_scientist','aptitude','numerical',0.5),
  ('sports_scientist','personality','analytical',0.7),
  ('sports_scientist','personality','practical',0.8),

  -- geologist
  ('geologist','interest','science_research',0.9),
  ('geologist','interest','nature_agriculture',0.7),
  ('geologist','aptitude','scientific',0.9),
  ('geologist','aptitude','logical',0.7),
  ('geologist','aptitude','spatial',0.6),
  ('geologist','personality','analytical',0.8),
  ('geologist','personality','practical',0.6),

  -- forensic_scientist
  ('forensic_scientist','interest','science_research',0.8),
  ('forensic_scientist','interest','law_justice',0.7),
  ('forensic_scientist','aptitude','scientific',1.0),
  ('forensic_scientist','aptitude','logical',0.8),
  ('forensic_scientist','personality','analytical',0.9),
  ('forensic_scientist','personality','structured',0.7),

  -- materials_scientist
  ('materials_scientist','interest','science_research',0.9),
  ('materials_scientist','interest','building_engineering',0.5),
  ('materials_scientist','aptitude','scientific',1.0),
  ('materials_scientist','aptitude','logical',0.7),
  ('materials_scientist','aptitude','numerical',0.6),
  ('materials_scientist','personality','analytical',0.9),
  ('materials_scientist','personality','structured',0.6),

  -- biochemist
  ('biochemist','interest','science_research',1.0),
  ('biochemist','interest','health_medicine',0.5),
  ('biochemist','aptitude','scientific',1.0),
  ('biochemist','aptitude','logical',0.7),
  ('biochemist','aptitude','numerical',0.5),
  ('biochemist','personality','analytical',0.9),
  ('biochemist','personality','structured',0.6),

  -- oceanographer
  ('oceanographer','interest','science_research',0.9),
  ('oceanographer','interest','nature_agriculture',1.0),
  ('oceanographer','aptitude','scientific',0.9),
  ('oceanographer','aptitude','logical',0.6),
  ('oceanographer','personality','analytical',0.7),
  ('oceanographer','personality','practical',0.6),

  -- insurance_professional
  ('insurance_professional','interest','business_money',0.8),
  ('insurance_professional','interest','numbers_analysis',0.6),
  ('insurance_professional','aptitude','numerical',0.8),
  ('insurance_professional','aptitude','verbal',0.6),
  ('insurance_professional','personality','analytical',0.7),
  ('insurance_professional','personality','structured',0.7),

  -- tax_consultant
  ('tax_consultant','interest','business_money',0.8),
  ('tax_consultant','interest','law_justice',0.5),
  ('tax_consultant','aptitude','numerical',0.9),
  ('tax_consultant','aptitude','logical',0.7),
  ('tax_consultant','personality','analytical',0.9),
  ('tax_consultant','personality','structured',0.8),

  -- actuary
  ('actuary','interest','numbers_analysis',1.0),
  ('actuary','interest','business_money',0.6),
  ('actuary','aptitude','numerical',1.0),
  ('actuary','aptitude','logical',0.9),
  ('actuary','personality','analytical',1.0),
  ('actuary','personality','structured',0.7),

  -- stock_broker
  ('stock_broker','interest','business_money',1.0),
  ('stock_broker','interest','numbers_analysis',0.8),
  ('stock_broker','aptitude','numerical',0.8),
  ('stock_broker','aptitude','verbal',0.6),
  ('stock_broker','personality','risk_taking',0.9),
  ('stock_broker','personality','analytical',0.7),

  -- credit_analyst
  ('credit_analyst','interest','numbers_analysis',0.8),
  ('credit_analyst','interest','business_money',0.6),
  ('credit_analyst','aptitude','numerical',0.9),
  ('credit_analyst','aptitude','logical',0.8),
  ('credit_analyst','personality','analytical',0.9),
  ('credit_analyst','personality','structured',0.8),

  -- hr_manager
  ('hr_manager','interest','helping_teaching',0.8),
  ('hr_manager','interest','business_money',0.5),
  ('hr_manager','aptitude','verbal',0.9),
  ('hr_manager','aptitude','logical',0.5),
  ('hr_manager','personality','social',0.9),
  ('hr_manager','personality','structured',0.6),

  -- supply_chain_manager
  ('supply_chain_manager','interest','business_money',0.7),
  ('supply_chain_manager','interest','numbers_analysis',0.5),
  ('supply_chain_manager','aptitude','numerical',0.7),
  ('supply_chain_manager','aptitude','logical',0.8),
  ('supply_chain_manager','personality','analytical',0.7),
  ('supply_chain_manager','personality','structured',0.8),

  -- marketing_manager
  ('marketing_manager','interest','business_money',0.8),
  ('marketing_manager','interest','media_communication',0.7),
  ('marketing_manager','aptitude','verbal',0.8),
  ('marketing_manager','aptitude','numerical',0.5),
  ('marketing_manager','personality','social',0.7),
  ('marketing_manager','personality','risk_taking',0.6),

  -- operations_manager
  ('operations_manager','interest','business_money',0.7),
  ('operations_manager','interest','numbers_analysis',0.5),
  ('operations_manager','aptitude','logical',0.8),
  ('operations_manager','aptitude','numerical',0.7),
  ('operations_manager','personality','structured',0.9),
  ('operations_manager','personality','analytical',0.7),

  -- real_estate_manager
  ('real_estate_manager','interest','business_money',0.9),
  ('real_estate_manager','interest','building_engineering',0.5),
  ('real_estate_manager','aptitude','verbal',0.7),
  ('real_estate_manager','aptitude','numerical',0.6),
  ('real_estate_manager','personality','risk_taking',0.8),
  ('real_estate_manager','personality','social',0.7),

  -- healthcare_administrator
  ('healthcare_administrator','interest','health_medicine',0.5),
  ('healthcare_administrator','interest','business_money',0.7),
  ('healthcare_administrator','aptitude','verbal',0.7),
  ('healthcare_administrator','aptitude','numerical',0.6),
  ('healthcare_administrator','personality','structured',0.8),
  ('healthcare_administrator','personality','social',0.6),

  -- corporate_lawyer
  ('corporate_lawyer','interest','law_justice',0.9),
  ('corporate_lawyer','interest','business_money',0.7),
  ('corporate_lawyer','aptitude','verbal',1.0),
  ('corporate_lawyer','aptitude','logical',0.9),
  ('corporate_lawyer','personality','analytical',0.9),
  ('corporate_lawyer','personality','structured',0.7),

  -- criminal_lawyer
  ('criminal_lawyer','interest','law_justice',1.0),
  ('criminal_lawyer','interest','helping_teaching',0.5),
  ('criminal_lawyer','aptitude','verbal',1.0),
  ('criminal_lawyer','aptitude','logical',0.9),
  ('criminal_lawyer','personality','social',0.8),
  ('criminal_lawyer','personality','analytical',0.8),

  -- ip_attorney
  ('ip_attorney','interest','law_justice',0.9),
  ('ip_attorney','interest','technology_coding',0.4),
  ('ip_attorney','aptitude','verbal',0.9),
  ('ip_attorney','aptitude','logical',1.0),
  ('ip_attorney','personality','analytical',0.9),
  ('ip_attorney','personality','structured',0.7),

  -- human_rights_advocate
  ('human_rights_advocate','interest','law_justice',0.9),
  ('human_rights_advocate','interest','helping_teaching',0.8),
  ('human_rights_advocate','aptitude','verbal',0.9),
  ('human_rights_advocate','aptitude','logical',0.7),
  ('human_rights_advocate','personality','social',0.9),
  ('human_rights_advocate','personality','risk_taking',0.5),

  -- cyber_law_expert
  ('cyber_law_expert','interest','law_justice',0.8),
  ('cyber_law_expert','interest','technology_coding',0.6),
  ('cyber_law_expert','aptitude','logical',1.0),
  ('cyber_law_expert','aptitude','verbal',0.8),
  ('cyber_law_expert','personality','analytical',0.9),
  ('cyber_law_expert','personality','structured',0.7),

  -- product_industrial_designer
  ('product_industrial_designer','interest','design_visual',0.9),
  ('product_industrial_designer','interest','building_engineering',0.5),
  ('product_industrial_designer','aptitude','spatial',1.0),
  ('product_industrial_designer','aptitude','logical',0.5),
  ('product_industrial_designer','personality','practical',0.9),
  ('product_industrial_designer','personality','analytical',0.6),

  -- ui_ux_designer
  ('ui_ux_designer','interest','design_visual',1.0),
  ('ui_ux_designer','interest','technology_coding',0.5),
  ('ui_ux_designer','aptitude','spatial',0.9),
  ('ui_ux_designer','aptitude','logical',0.5),
  ('ui_ux_designer','personality','practical',0.8),
  ('ui_ux_designer','personality','analytical',0.6),

  -- jewellery_designer
  ('jewellery_designer','interest','design_visual',1.0),
  ('jewellery_designer','interest','business_money',0.4),
  ('jewellery_designer','aptitude','spatial',0.9),
  ('jewellery_designer','personality','practical',1.0),
  ('jewellery_designer','personality','analytical',0.4),

  -- textile_designer
  ('textile_designer','interest','design_visual',1.0),
  ('textile_designer','interest','nature_agriculture',0.3),
  ('textile_designer','aptitude','spatial',0.8),
  ('textile_designer','personality','practical',0.9),

  -- concept_artist
  ('concept_artist','interest','design_visual',1.0),
  ('concept_artist','interest','media_communication',0.4),
  ('concept_artist','aptitude','spatial',1.0),
  ('concept_artist','aptitude','verbal',0.3),
  ('concept_artist','personality','practical',0.9),
  ('concept_artist','personality','risk_taking',0.4),

  -- urban_planner
  ('urban_planner','interest','building_engineering',0.7),
  ('urban_planner','interest','helping_teaching',0.5),
  ('urban_planner','aptitude','logical',0.8),
  ('urban_planner','aptitude','spatial',0.8),
  ('urban_planner','aptitude','numerical',0.6),
  ('urban_planner','personality','analytical',0.9),
  ('urban_planner','personality','structured',0.7),

  -- landscape_architect
  ('landscape_architect','interest','design_visual',0.8),
  ('landscape_architect','interest','nature_agriculture',0.8),
  ('landscape_architect','aptitude','spatial',0.9),
  ('landscape_architect','aptitude','logical',0.5),
  ('landscape_architect','personality','practical',0.8),
  ('landscape_architect','personality','analytical',0.5),

  -- quantity_surveyor
  ('quantity_surveyor','interest','building_engineering',0.7),
  ('quantity_surveyor','interest','numbers_analysis',0.7),
  ('quantity_surveyor','aptitude','numerical',0.9),
  ('quantity_surveyor','aptitude','logical',0.7),
  ('quantity_surveyor','personality','analytical',0.8),
  ('quantity_surveyor','personality','structured',0.9),

  -- radio_jockey
  ('radio_jockey','interest','media_communication',1.0),
  ('radio_jockey','interest','helping_teaching',0.4),
  ('radio_jockey','aptitude','verbal',1.0),
  ('radio_jockey','personality','social',0.9),
  ('radio_jockey','personality','risk_taking',0.5),

  -- documentary_filmmaker
  ('documentary_filmmaker','interest','media_communication',0.9),
  ('documentary_filmmaker','interest','science_research',0.5),
  ('documentary_filmmaker','aptitude','verbal',0.8),
  ('documentary_filmmaker','aptitude','spatial',0.5),
  ('documentary_filmmaker','personality','practical',0.7),
  ('documentary_filmmaker','personality','risk_taking',0.6),

  -- public_relations_specialist
  ('public_relations_specialist','interest','media_communication',0.9),
  ('public_relations_specialist','interest','business_money',0.5),
  ('public_relations_specialist','aptitude','verbal',1.0),
  ('public_relations_specialist','aptitude','logical',0.5),
  ('public_relations_specialist','personality','social',0.9),
  ('public_relations_specialist','personality','structured',0.5),

  -- advertising_copywriter
  ('advertising_copywriter','interest','media_communication',0.9),
  ('advertising_copywriter','interest','design_visual',0.5),
  ('advertising_copywriter','aptitude','verbal',1.0),
  ('advertising_copywriter','aptitude','logical',0.4),
  ('advertising_copywriter','personality','practical',0.6),
  ('advertising_copywriter','personality','risk_taking',0.5),

  -- social_media_strategist
  ('social_media_strategist','interest','media_communication',0.9),
  ('social_media_strategist','interest','business_money',0.6),
  ('social_media_strategist','aptitude','verbal',0.8),
  ('social_media_strategist','aptitude','numerical',0.5),
  ('social_media_strategist','personality','social',0.8),
  ('social_media_strategist','personality','analytical',0.5),

  -- sound_engineer
  ('sound_engineer','interest','media_communication',0.8),
  ('sound_engineer','interest','technology_coding',0.4),
  ('sound_engineer','aptitude','spatial',0.6),
  ('sound_engineer','aptitude','logical',0.6),
  ('sound_engineer','personality','practical',0.9),
  ('sound_engineer','personality','analytical',0.5),

  -- horticulturist
  ('horticulturist','interest','nature_agriculture',1.0),
  ('horticulturist','interest','science_research',0.5),
  ('horticulturist','aptitude','scientific',0.7),
  ('horticulturist','aptitude','logical',0.5),
  ('horticulturist','personality','practical',0.9),
  ('horticulturist','personality','analytical',0.5),

  -- fisheries_scientist
  ('fisheries_scientist','interest','nature_agriculture',0.9),
  ('fisheries_scientist','interest','science_research',0.8),
  ('fisheries_scientist','aptitude','scientific',0.9),
  ('fisheries_scientist','aptitude','logical',0.6),
  ('fisheries_scientist','personality','analytical',0.7),
  ('fisheries_scientist','personality','practical',0.7),

  -- agricultural_engineer
  ('agricultural_engineer','interest','nature_agriculture',0.8),
  ('agricultural_engineer','interest','building_engineering',0.7),
  ('agricultural_engineer','aptitude','logical',0.8),
  ('agricultural_engineer','aptitude','numerical',0.6),
  ('agricultural_engineer','personality','practical',0.8),
  ('agricultural_engineer','personality','analytical',0.7),

  -- dairy_technologist
  ('dairy_technologist','interest','nature_agriculture',0.6),
  ('dairy_technologist','interest','science_research',0.6),
  ('dairy_technologist','aptitude','scientific',0.8),
  ('dairy_technologist','aptitude','numerical',0.5),
  ('dairy_technologist','personality','analytical',0.7),
  ('dairy_technologist','personality','structured',0.7),

  -- economist
  ('economist','interest','numbers_analysis',0.9),
  ('economist','interest','business_money',0.6),
  ('economist','aptitude','numerical',0.9),
  ('economist','aptitude','logical',0.8),
  ('economist','aptitude','verbal',0.6),
  ('economist','personality','analytical',1.0),
  ('economist','personality','structured',0.6),

  -- political_scientist
  ('political_scientist','interest','law_justice',0.6),
  ('political_scientist','interest','helping_teaching',0.5),
  ('political_scientist','interest','media_communication',0.4),
  ('political_scientist','aptitude','verbal',0.9),
  ('political_scientist','aptitude','logical',0.7),
  ('political_scientist','personality','analytical',0.8),
  ('political_scientist','personality','social',0.7),

  -- historian
  ('historian','interest','science_research',0.8),
  ('historian','interest','law_justice',0.4),
  ('historian','aptitude','verbal',1.0),
  ('historian','aptitude','logical',0.6),
  ('historian','personality','analytical',0.8),
  ('historian','personality','structured',0.5),

  -- sociologist
  ('sociologist','interest','helping_teaching',0.7),
  ('sociologist','interest','science_research',0.7),
  ('sociologist','aptitude','verbal',0.8),
  ('sociologist','aptitude','logical',0.6),
  ('sociologist','personality','analytical',0.7),
  ('sociologist','personality','social',0.8),

  -- librarian
  ('librarian','interest','science_research',0.5),
  ('librarian','interest','helping_teaching',0.7),
  ('librarian','aptitude','verbal',0.8),
  ('librarian','aptitude','logical',0.5),
  ('librarian','personality','structured',0.9),
  ('librarian','personality','analytical',0.6),

  -- museum_curator
  ('museum_curator','interest','science_research',0.7),
  ('museum_curator','interest','design_visual',0.5),
  ('museum_curator','aptitude','verbal',0.9),
  ('museum_curator','aptitude','logical',0.5),
  ('museum_curator','personality','analytical',0.8),
  ('museum_curator','personality','structured',0.6),

  -- education_counsellor
  ('education_counsellor','interest','helping_teaching',1.0),
  ('education_counsellor','interest','science_research',0.4),
  ('education_counsellor','aptitude','verbal',0.9),
  ('education_counsellor','aptitude','logical',0.5),
  ('education_counsellor','personality','social',1.0),
  ('education_counsellor','personality','analytical',0.6),

  -- police_officer
  ('police_officer','interest','law_justice',0.9),
  ('police_officer','interest','defence_adventure',0.8),
  ('police_officer','aptitude','verbal',0.7),
  ('police_officer','aptitude','logical',0.6),
  ('police_officer','personality','practical',0.8),
  ('police_officer','personality','social',0.7),

  -- forest_officer
  ('forest_officer','interest','nature_agriculture',1.0),
  ('forest_officer','interest','law_justice',0.5),
  ('forest_officer','aptitude','scientific',0.7),
  ('forest_officer','aptitude','logical',0.6),
  ('forest_officer','personality','practical',0.8),
  ('forest_officer','personality','analytical',0.6),

  -- customs_excise_officer
  ('customs_excise_officer','interest','law_justice',0.7),
  ('customs_excise_officer','interest','numbers_analysis',0.5),
  ('customs_excise_officer','aptitude','numerical',0.7),
  ('customs_excise_officer','aptitude','logical',0.7),
  ('customs_excise_officer','personality','structured',0.8),
  ('customs_excise_officer','personality','analytical',0.7),

  -- revenue_officer
  ('revenue_officer','interest','law_justice',0.6),
  ('revenue_officer','interest','helping_teaching',0.5),
  ('revenue_officer','aptitude','verbal',0.7),
  ('revenue_officer','aptitude','logical',0.6),
  ('revenue_officer','personality','structured',0.8),
  ('revenue_officer','personality','social',0.7),

  -- travel_consultant
  ('travel_consultant','interest','media_communication',0.5),
  ('travel_consultant','interest','business_money',0.7),
  ('travel_consultant','interest','nature_agriculture',0.4),
  ('travel_consultant','aptitude','verbal',0.8),
  ('travel_consultant','aptitude','numerical',0.4),
  ('travel_consultant','personality','social',0.9),
  ('travel_consultant','personality','risk_taking',0.5),

  -- tour_guide
  ('tour_guide','interest','media_communication',0.6),
  ('tour_guide','interest','helping_teaching',0.7),
  ('tour_guide','aptitude','verbal',1.0),
  ('tour_guide','personality','social',1.0),
  ('tour_guide','personality','practical',0.5),

  -- airline_cabin_crew
  ('airline_cabin_crew','interest','helping_teaching',0.6),
  ('airline_cabin_crew','interest','defence_adventure',0.6),
  ('airline_cabin_crew','aptitude','verbal',0.8),
  ('airline_cabin_crew','personality','social',0.9),
  ('airline_cabin_crew','personality','practical',0.6),
  ('airline_cabin_crew','personality','risk_taking',0.5),

  -- food_beverage_manager
  ('food_beverage_manager','interest','business_money',0.6),
  ('food_beverage_manager','interest','helping_teaching',0.5),
  ('food_beverage_manager','aptitude','verbal',0.7),
  ('food_beverage_manager','aptitude','numerical',0.5),
  ('food_beverage_manager','personality','social',0.8),
  ('food_beverage_manager','personality','structured',0.7),

  -- cruise_hospitality_professional
  ('cruise_hospitality_professional','interest','helping_teaching',0.6),
  ('cruise_hospitality_professional','interest','defence_adventure',0.7),
  ('cruise_hospitality_professional','aptitude','verbal',0.8),
  ('cruise_hospitality_professional','personality','social',0.9),
  ('cruise_hospitality_professional','personality','risk_taking',0.6),

  -- spa_wellness_manager
  ('spa_wellness_manager','interest','health_medicine',0.5),
  ('spa_wellness_manager','interest','helping_teaching',0.6),
  ('spa_wellness_manager','interest','business_money',0.5),
  ('spa_wellness_manager','aptitude','verbal',0.7),
  ('spa_wellness_manager','personality','social',0.8),
  ('spa_wellness_manager','personality','structured',0.7)

on conflict do nothing;

-- ── 7. CAREER SKILLS (3 stages each) ─────────────────────────────────────────
insert into public.career_skills (career_id, skill_name, stage, resource_type, sort_order) values

  ('web_developer','HTML, CSS & JavaScript fundamentals','foundation','self-study',1),
  ('web_developer','Frontend framework (React/Vue) or backend (Node/Python)','intermediate','course',2),
  ('web_developer','Build and deploy a full-stack web project','advanced','project',3),

  ('cloud_engineer','Computer networking and OS fundamentals','foundation','self-study',1),
  ('cloud_engineer','Cloud platforms (AWS/GCP/Azure) + IaC (Terraform)','intermediate','certification',2),
  ('cloud_engineer','Architect and deploy a production cloud system','advanced','project',3),

  ('data_engineer','SQL and Python programming basics','foundation','self-study',1),
  ('data_engineer','Data pipeline tools (Spark, Airflow, dbt, Kafka)','intermediate','course',2),
  ('data_engineer','Build an end-to-end data pipeline and dashboard','advanced','project',3),

  ('network_engineer','Networking fundamentals (OSI model, TCP/IP)','foundation','self-study',1),
  ('network_engineer','CCNA certification and hands-on lab practice','intermediate','certification',2),
  ('network_engineer','Design and manage a live enterprise network','advanced','project',3),

  ('embedded_systems_engineer','Electronics fundamentals + C programming','foundation','self-study',1),
  ('embedded_systems_engineer','Microcontrollers (Arduino/STM32) and RTOS','intermediate','course',2),
  ('embedded_systems_engineer','Build an IoT device from scratch','advanced','project',3),

  ('software_qa_engineer','Software testing fundamentals and bug lifecycle','foundation','self-study',1),
  ('software_qa_engineer','Selenium / Cypress / pytest automation framework','intermediate','course',2),
  ('software_qa_engineer','Lead QA for a production software release','advanced','project',3),

  ('blockchain_developer','Programming (Solidity / Rust) + cryptography basics','foundation','self-study',1),
  ('blockchain_developer','Smart contracts and Ethereum/Solana development','intermediate','course',2),
  ('blockchain_developer','Deploy a working decentralised app (dApp)','advanced','project',3),

  ('chemical_engineer','Chemistry, physics & mathematics foundations','foundation','self-study',1),
  ('chemical_engineer','Process engineering and simulation tools (ASPEN)','intermediate','course',2),
  ('chemical_engineer','Industry internship in a chemical or pharma plant','advanced','project',3),

  ('aerospace_engineer','Physics and mathematics (PCM) foundations','foundation','self-study',1),
  ('aerospace_engineer','Aerodynamics, propulsion, and structural mechanics','intermediate','course',2),
  ('aerospace_engineer','Internship at DRDO / ISRO / aviation company','advanced','project',3),

  ('biomedical_engineer','Biology and physics foundations','foundation','self-study',1),
  ('biomedical_engineer','Medical device design and bioelectronics','intermediate','course',2),
  ('biomedical_engineer','Design a medical device prototype or sensor','advanced','project',3),

  ('industrial_engineer','Mathematics and basic manufacturing knowledge','foundation','self-study',1),
  ('industrial_engineer','Lean manufacturing, Six Sigma, and CAD tools','intermediate','certification',2),
  ('industrial_engineer','Internship in a manufacturing facility','advanced','project',3),

  ('marine_engineer','Physics and mathematics (PCM) — especially thermodynamics','foundation','self-study',1),
  ('marine_engineer','Marine propulsion, ship systems, and IMO regulations','intermediate','course',2),
  ('marine_engineer','Sea service cadetship on a commercial vessel','advanced','project',3),

  ('robotics_engineer','Programming (C++ / Python) + electronics basics','foundation','self-study',1),
  ('robotics_engineer','ROS (Robot Operating System) and control systems','intermediate','course',2),
  ('robotics_engineer','Build and programme a functional robot','advanced','project',3),

  ('renewable_energy_engineer','Electrical and physics foundations','foundation','self-study',1),
  ('renewable_energy_engineer','Solar/wind system design and energy storage tech','intermediate','course',2),
  ('renewable_energy_engineer','Design and install a rooftop solar project','advanced','project',3),

  ('environmental_engineer','Chemistry and environmental science basics','foundation','self-study',1),
  ('environmental_engineer','Wastewater treatment, EIA, and GIS tools','intermediate','course',2),
  ('environmental_engineer','Internship with a pollution control board or plant','advanced','project',3),

  ('telecom_engineer','Electronics and communication fundamentals','foundation','self-study',1),
  ('telecom_engineer','4G/5G networks, RF design, and optical fibre systems','intermediate','course',2),
  ('telecom_engineer','Internship with BSNL, Jio, or a network vendor','advanced','project',3),

  ('homeopathy_doctor','Biology and chemistry foundation','foundation','self-study',1),
  ('homeopathy_doctor','BHMS degree — Organon of Medicine and Materia Medica','intermediate','course',2),
  ('homeopathy_doctor','Clinical internship and set up own practice','advanced','project',3),

  ('speech_language_pathologist','Biology and communication science basics','foundation','self-study',1),
  ('speech_language_pathologist','B.Sc Audiology & SLP — phonetics, disorders, therapy','intermediate','course',2),
  ('speech_language_pathologist','Clinical practicum in hospitals or rehab centres','advanced','project',3),

  ('optometrist','Biology and physics foundation','foundation','self-study',1),
  ('optometrist','B.Sc Optometry — optics, vision science, contact lenses','intermediate','course',2),
  ('optometrist','Clinical internship in an eye hospital or optical clinic','advanced','project',3),

  ('radiographer','Physics and biology foundation','foundation','self-study',1),
  ('radiographer','B.Sc Medical Imaging — X-ray, CT, MRI equipment training','intermediate','course',2),
  ('radiographer','Hospital radiology department internship','advanced','project',3),

  ('audiologist','Biology and speech science basics','foundation','self-study',1),
  ('audiologist','B.Sc Audiology — hearing assessment and hearing aid fitting','intermediate','course',2),
  ('audiologist','Clinical practicum in ENT/audiology clinic','advanced','project',3),

  ('occupational_therapist','Biology and psychology basics','foundation','self-study',1),
  ('occupational_therapist','BOT degree — rehabilitation techniques and ADL training','intermediate','course',2),
  ('occupational_therapist','Fieldwork with disability rehab or paediatric OT','advanced','project',3),

  ('emergency_paramedic','First aid certification and anatomy basics','foundation','self-study',1),
  ('emergency_paramedic','Paramedic training — trauma, cardiac, airway management','intermediate','certification',2),
  ('emergency_paramedic','Field internship with ambulance service or ER','advanced','project',3),

  ('sports_scientist','Biology, physiology, and fitness basics','foundation','self-study',1),
  ('sports_scientist','Exercise physiology and sports nutrition','intermediate','course',2),
  ('sports_scientist','Work with a sports academy or athletic team','advanced','project',3),

  ('geologist','Physics, chemistry, and earth science basics','foundation','self-study',1),
  ('geologist','Geological mapping, mineralogy, and GIS tools','intermediate','course',2),
  ('geologist','Field survey project or GSI internship','advanced','project',3),

  ('forensic_scientist','Chemistry and biology foundation','foundation','self-study',1),
  ('forensic_scientist','Criminalistics, toxicology, and forensic analysis techniques','intermediate','course',2),
  ('forensic_scientist','Internship in a police forensic lab or court expert role','advanced','project',3),

  ('materials_scientist','Chemistry and physics foundation','foundation','self-study',1),
  ('materials_scientist','Materials characterisation and processing techniques','intermediate','course',2),
  ('materials_scientist','Research project on a novel material or coating','advanced','project',3),

  ('biochemist','Chemistry and biology foundation','foundation','self-study',1),
  ('biochemist','B.Sc Biochemistry — enzymes, metabolism, molecular biology','intermediate','course',2),
  ('biochemist','Lab research project or pharma internship','advanced','project',3),

  ('oceanographer','Biology, chemistry, or physics foundation (any)','foundation','self-study',1),
  ('oceanographer','Marine science — oceanography, remote sensing, modelling','intermediate','course',2),
  ('oceanographer','Field research cruise or marine institute internship','advanced','project',3),

  ('insurance_professional','Mathematics and basic economics','foundation','self-study',1),
  ('insurance_professional','IRDA licensing and insurance product knowledge','intermediate','certification',2),
  ('insurance_professional','Work as an insurance trainee or agent and build client base','advanced','project',3),

  ('tax_consultant','Accountancy and taxation basics','foundation','self-study',1),
  ('tax_consultant','GST, income tax law, and ITR filing practice','intermediate','course',2),
  ('tax_consultant','Handle real client tax returns and advisory cases','advanced','project',3),

  ('actuary','Mathematics and statistics foundation','foundation','self-study',1),
  ('actuary','IAI (Institute of Actuaries India) CT-series papers','intermediate','exam',2),
  ('actuary','Pass actuarial exams and complete work-based learning','advanced','certification',3),

  ('stock_broker','Financial markets and basic economics','foundation','self-study',1),
  ('stock_broker','NCFM / NISM certifications and trading platforms','intermediate','certification',2),
  ('stock_broker','Trade live with a SEBI-registered broker / build a track record','advanced','project',3),

  ('credit_analyst','Accountancy and financial statements basics','foundation','self-study',1),
  ('credit_analyst','Credit appraisal, risk modelling, and banking regulations','intermediate','course',2),
  ('credit_analyst','Internship in a bank or NBFC credit department','advanced','project',3),

  ('hr_manager','Communication and organisational behaviour basics','foundation','self-study',1),
  ('hr_manager','BBA — HR management, labour law, payroll systems','intermediate','course',2),
  ('hr_manager','HR internship + MBA-HR for senior roles','advanced','project',3),

  ('supply_chain_manager','Logistics and operations basics','foundation','self-study',1),
  ('supply_chain_manager','Supply chain tools (ERP, SAP) and procurement processes','intermediate','course',2),
  ('supply_chain_manager','Internship with a logistics firm or manufacturing company','advanced','project',3),

  ('marketing_manager','Consumer psychology and branding basics','foundation','self-study',1),
  ('marketing_manager','Digital marketing, SEO, and campaign management tools','intermediate','course',2),
  ('marketing_manager','Run a real brand campaign or digital marketing project','advanced','project',3),

  ('operations_manager','Process management and business basics','foundation','self-study',1),
  ('operations_manager','Operations research, ERP systems, and Six Sigma','intermediate','certification',2),
  ('operations_manager','Lead an operations improvement project at work','advanced','project',3),

  ('real_estate_manager','Real estate markets and property law basics','foundation','self-study',1),
  ('real_estate_manager','RERA regulations, site valuation, and project finance','intermediate','course',2),
  ('real_estate_manager','Manage a real estate project or property portfolio','advanced','project',3),

  ('healthcare_administrator','Health systems and management basics','foundation','self-study',1),
  ('healthcare_administrator','Hospital administration — finance, HR, quality management','intermediate','course',2),
  ('healthcare_administrator','Internship in hospital administration or health department','advanced','project',3),

  ('corporate_lawyer','Legal reasoning and English language strength','foundation','self-study',1),
  ('corporate_lawyer','BA LLB — company law, contracts, M&A','intermediate','course',2),
  ('corporate_lawyer','Intern at a law firm; get enrolled with the Bar Council','advanced','project',3),

  ('criminal_lawyer','Legal reasoning and ethics','foundation','self-study',1),
  ('criminal_lawyer','BA LLB — criminal procedure code, evidence law','intermediate','course',2),
  ('criminal_lawyer','Practice under a senior criminal advocate','advanced','project',3),

  ('ip_attorney','Analytical thinking and technical awareness','foundation','self-study',1),
  ('ip_attorney','BA LLB — IPR law, patents, trademark registration','intermediate','course',2),
  ('ip_attorney','Intern with an IP law firm and file a patent application','advanced','project',3),

  ('human_rights_advocate','Social awareness and strong communication','foundation','self-study',1),
  ('human_rights_advocate','BA LLB — constitutional law, international human rights law','intermediate','course',2),
  ('human_rights_advocate','Volunteer with an NGO or legal aid organisation','advanced','project',3),

  ('cyber_law_expert','Technology basics and legal reasoning','foundation','self-study',1),
  ('cyber_law_expert','BA LLB — IT Act, cybercrime law, data protection law','intermediate','course',2),
  ('cyber_law_expert','Handle a cybercrime case or privacy compliance project','advanced','project',3),

  ('product_industrial_designer','Sketching, drawing, and design observation skills','foundation','self-study',1),
  ('product_industrial_designer','B.Des — product design, CAD modelling (SolidWorks/Rhino)','intermediate','course',2),
  ('product_industrial_designer','Build a physical product prototype for real users','advanced','project',3),

  ('ui_ux_designer','Visual design basics and user empathy','foundation','self-study',1),
  ('ui_ux_designer','Figma / Adobe XD, interaction design, usability testing','intermediate','course',2),
  ('ui_ux_designer','Design and test a complete app UI with real users','advanced','project',3),

  ('jewellery_designer','Drawing, sketching, and an eye for aesthetics','foundation','self-study',1),
  ('jewellery_designer','Jewellery design techniques — gemology, metalwork, CAD jewellery','intermediate','course',2),
  ('jewellery_designer','Create and sell original jewellery collection','advanced','project',3),

  ('textile_designer','Drawing and colour theory basics','foundation','self-study',1),
  ('textile_designer','Textile techniques — weaving, printing, surface design','intermediate','course',2),
  ('textile_designer','Design a fabric collection and pitch to a brand','advanced','project',3),

  ('concept_artist','Drawing and digital illustration skills','foundation','self-study',1),
  ('concept_artist','Digital painting (Photoshop / Procreate) and art direction','intermediate','self-study',2),
  ('concept_artist','Build a professional concept art portfolio for studios','advanced','project',3),

  ('urban_planner','Geography, civics, and analytical thinking','foundation','self-study',1),
  ('urban_planner','B.Arch / M.Plan — land use, transport, urban economics','intermediate','course',2),
  ('urban_planner','Work on a real town planning or urban renewal project','advanced','project',3),

  ('landscape_architect','Botany, drawing, and environmental awareness','foundation','self-study',1),
  ('landscape_architect','B.Arch + M.Sc Landscape Architecture — site design, ecology','intermediate','course',2),
  ('landscape_architect','Design a public green space or garden project','advanced','project',3),

  ('quantity_surveyor','Mathematics and construction basics','foundation','self-study',1),
  ('quantity_surveyor','Cost estimation, BOQ preparation, and contract law','intermediate','course',2),
  ('quantity_surveyor','Handle quantity surveying for a real construction project','advanced','project',3),

  ('radio_jockey','Voice training and communication skills','foundation','self-study',1),
  ('radio_jockey','BJMC — broadcast journalism and radio production','intermediate','course',2),
  ('radio_jockey','Intern at a radio station and produce live segments','advanced','project',3),

  ('documentary_filmmaker','Research, scripting, and storytelling skills','foundation','self-study',1),
  ('documentary_filmmaker','Video production — cinematography, editing, documentary narrative','intermediate','course',2),
  ('documentary_filmmaker','Produce and enter a documentary in a festival','advanced','project',3),

  ('public_relations_specialist','Communication and writing skills','foundation','self-study',1),
  ('public_relations_specialist','Media relations, crisis communication, and PR strategy','intermediate','course',2),
  ('public_relations_specialist','Manage a PR campaign for an organisation or event','advanced','project',3),

  ('advertising_copywriter','Creative writing and consumer psychology','foundation','self-study',1),
  ('advertising_copywriter','Ad copywriting — headlines, scripts, brand tone of voice','intermediate','self-study',2),
  ('advertising_copywriter','Build a copywriting portfolio with real brand briefs','advanced','project',3),

  ('social_media_strategist','Social media platforms and basic analytics','foundation','self-study',1),
  ('social_media_strategist','Digital marketing — Meta Ads, Google Ads, content calendar','intermediate','certification',2),
  ('social_media_strategist','Grow a brand or personal page from 0 to audience','advanced','project',3),

  ('sound_engineer','Music theory and basic acoustics','foundation','self-study',1),
  ('sound_engineer','Recording software (DAW) — Pro Tools, Logic Pro, Ableton','intermediate','self-study',2),
  ('sound_engineer','Record and mix a full song or short film audio track','advanced','project',3),

  ('horticulturist','Plant biology and agriculture basics','foundation','self-study',1),
  ('horticulturist','B.Sc Horticulture — plant propagation, floriculture, pest management','intermediate','course',2),
  ('horticulturist','Manage a nursery, farm, or horticulture project','advanced','project',3),

  ('fisheries_scientist','Biology and chemistry foundation','foundation','self-study',1),
  ('fisheries_scientist','B.F.Sc — aquaculture, fisheries management, marine resources','intermediate','course',2),
  ('fisheries_scientist','Field project with CMFRI or KUFOS; visit fish farms','advanced','project',3),

  ('agricultural_engineer','Physics, biology, and maths foundation','foundation','self-study',1),
  ('agricultural_engineer','Agricultural machinery, irrigation design, and post-harvest tech','intermediate','course',2),
  ('agricultural_engineer','Internship at KAU or an agri-machinery company','advanced','project',3),

  ('dairy_technologist','Biology and chemistry foundation','foundation','self-study',1),
  ('dairy_technologist','Dairy processing, quality testing, and FSSAI standards','intermediate','course',2),
  ('dairy_technologist','Internship at Milma, KMF, or a private dairy company','advanced','project',3),

  ('economist','Mathematics and current affairs awareness','foundation','self-study',1),
  ('economist','BA Economics → M.A. / M.Sc Economics, econometrics','intermediate','course',2),
  ('economist','Research publication or policy brief for a think tank/NGO','advanced','project',3),

  ('political_scientist','Civics, history, and strong reading habits','foundation','self-study',1),
  ('political_scientist','BA Political Science → M.A. → UPSC / academia / think tank','intermediate','course',2),
  ('political_scientist','Publish research or work in policy / electoral analysis','advanced','project',3),

  ('historian','Reading, research, and writing skills','foundation','self-study',1),
  ('historian','BA History → M.A. → archival research, heritage management','intermediate','course',2),
  ('historian','Write and publish original historical research or heritage guide','advanced','project',3),

  ('sociologist','Social awareness and analytical thinking','foundation','self-study',1),
  ('sociologist','BA Sociology → M.A. → NGO, research, or academic roles','intermediate','course',2),
  ('sociologist','Conduct a community fieldwork study and publish findings','advanced','project',3),

  ('librarian','Reading habits and information organisation skills','foundation','self-study',1),
  ('librarian','B.LISc / M.LISc — cataloguing, digital library systems','intermediate','course',2),
  ('librarian','Manage a library collection or build a digital archive','advanced','project',3),

  ('museum_curator','Art history, archaeology, or heritage awareness','foundation','self-study',1),
  ('museum_curator','BA + M.A. Museology — conservation, curation, exhibition design','intermediate','course',2),
  ('museum_curator','Curate an exhibition or manage a heritage collection','advanced','project',3),

  ('education_counsellor','Empathy and communication skills','foundation','self-study',1),
  ('education_counsellor','B.Sc Psychology → M.Sc / Counselling certification','intermediate','course',2),
  ('education_counsellor','Intern in a school counselling department or NGO','advanced','project',3),

  ('police_officer','Physical fitness, discipline, and current affairs awareness','foundation','self-study',1),
  ('police_officer','Kerala PSC exams (Sub Inspector) or UPSC IPS — systematic preparation','intermediate','exam',2),
  ('police_officer','Complete training academy and begin active service','advanced','project',3),

  ('forest_officer','Biology, environment, and physical fitness basics','foundation','self-study',1),
  ('forest_officer','Kerala PSC Forest Officer exam + wildlife management study','intermediate','exam',2),
  ('forest_officer','Complete training and field postings in Kerala forests','advanced','project',3),

  ('customs_excise_officer','General awareness and mathematics foundation','foundation','self-study',1),
  ('customs_excise_officer','SSC CGL / CBEC examination preparation','intermediate','exam',2),
  ('customs_excise_officer','Complete customs training academy and field posting','advanced','project',3),

  ('revenue_officer','General awareness and Malayalam language skills','foundation','self-study',1),
  ('revenue_officer','Kerala PSC Village Officer / Revenue Inspector exam prep','intermediate','exam',2),
  ('revenue_officer','Complete department training and field revenue assignment','advanced','project',3),

  ('travel_consultant','Geography, history, and communication skills','foundation','self-study',1),
  ('travel_consultant','BHM / travel management course + IATA certification','intermediate','certification',2),
  ('travel_consultant','Work at a travel agency and plan tours independently','advanced','project',3),

  ('tour_guide','Local history, culture, and language skills','foundation','self-study',1),
  ('tour_guide','Ministry of Tourism guide certification (MoT India)','intermediate','certification',2),
  ('tour_guide','Lead international tourist groups independently','advanced','project',3),

  ('airline_cabin_crew','English communication and grooming basics','foundation','self-study',1),
  ('airline_cabin_crew','Aviation cabin crew training (safety, first aid, service)','intermediate','certification',2),
  ('airline_cabin_crew','Complete initial operating experience with an airline','advanced','project',3),

  ('food_beverage_manager','Cooking, hospitality, and customer service basics','foundation','self-study',1),
  ('food_beverage_manager','BHM — food production, F&B operations, beverage management','intermediate','course',2),
  ('food_beverage_manager','Manage F&B operations at a hotel or restaurant','advanced','project',3),

  ('cruise_hospitality_professional','English communication and hospitality basics','foundation','self-study',1),
  ('cruise_hospitality_professional','BHM + specialised cruise line training programme','intermediate','course',2),
  ('cruise_hospitality_professional','Complete a cruise ship contract and gain sea experience','advanced','project',3),

  ('spa_wellness_manager','Ayurveda / wellness basics and hospitality awareness','foundation','self-study',1),
  ('spa_wellness_manager','BHM or BAMS + spa management training','intermediate','course',2),
  ('spa_wellness_manager','Manage operations at an Ayurvedic resort or wellness centre','advanced','project',3)

on conflict do nothing;
