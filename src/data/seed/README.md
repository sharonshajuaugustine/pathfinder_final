# Knowledge Base — Seed Structure & Completion Guide

The KB is the **source of truth**. The AI never invents careers, courses, fees,
or exams — it only reads what is seeded here. Accuracy of this data == accuracy
of recommendations. **Every row must be human-verified before launch.**

## Where the data lives

The KB is stored in Supabase (tables in `supabase/migrations/0002_knowledge_base.sql`)
and loaded at runtime by `src/lib/kb-loader.ts`. Seed it with SQL in
`supabase/seed/`. The starter seed (`0001_seed_kb.sql`) contains **15 domains +
6 representative careers** so the engine runs end-to-end.

## Tables to populate (in order)

1. `domains` — 15 fixed domains (already complete in starter seed).
2. `exams` — ~15 entrance exams (closed list — see below).
3. `courses` + `eligibility_rules` — ~30 course categories. Verify fees,
   stream/subject requirements, and marks thresholds against official sources.
4. `careers` — ~40 careers (list below).
5. `career_course` — link each career to primary / alternative / fallback courses.
6. `course_exam` — link each course to its exams (`mandatory` / `one-of` / `optional`).
7. `career_signal` — **the matching intelligence.** Each career weighted 0..1
   against interest clusters, aptitudes, and personality traits. Do this last
   and tune against test profiles.
8. `career_skills` — 2–4 roadmap steps per career.

## Controlled vocabularies (must match `src/types/profile.ts`)

- **Streams:** `science_bio`, `science_maths`, `science_cs`, `commerce`, `humanities`
- **Interest clusters (12):** technology_coding, health_medicine, business_money,
  science_research, design_visual, helping_teaching, law_justice,
  building_engineering, media_communication, nature_agriculture,
  defence_adventure, numbers_analysis
- **Aptitudes (5):** numerical, logical, verbal, spatial, scientific
- **Personality traits (5):** analytical, structured, social, practical, risk_taking

## Full MVP career list (~40) — to complete

**Science – Biology:** doctor*, dentist, ayurveda_physician, homeopathy_physician,
nurse*, pharmacist, physiotherapist, medical_lab_technologist, radiology_technologist,
veterinary_doctor, biotechnologist, agricultural_scientist, nutritionist

**Science – Maths/CS:** software_engineer*, data_scientist, cybersecurity_analyst,
mechanical_engineer*, civil_engineer, electrical_engineer, ece_engineer, architect,
pilot, merchant_navy_officer, research_scientist, statistician_actuary

**Commerce:** chartered_accountant*, company_secretary, cost_accountant,
banking_finance, business_manager, digital_marketer, entrepreneur, financial_analyst

**Humanities / cross-stream:** lawyer*, civil_servant, defence_officer, teacher,
psychologist, graphic_ux_designer, journalist

(* already in starter seed.)

## Full MVP exam list (~15)

keam*, neet*, jee_main*, jee_advanced, cuet, clat*/klee, nata, nift_nid,
ca_foundation*/cma/cs, cusat_cat, nda, icar_aieea, nchmct_jee, imu_cet,
kerala_nursing_paramedical

(* already in starter seed.)

## Versioning

Bump `KB_VERSION` (env) whenever content changes. Every recommendation snapshots
the version so past reports stay reproducible.
