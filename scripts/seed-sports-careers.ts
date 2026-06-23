import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Manually parse .env.local file to avoid external dependency
const envPath = path.resolve(process.cwd(), ".env.local");
let supabaseUrl = "";
let supabaseServiceRoleKey = "";
let kbVersion = "3";

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const parts = line.trim().split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
      if (key === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = val;
      if (key === "SUPABASE_SERVICE_ROLE_KEY") supabaseServiceRoleKey = val;
      if (key === "KB_VERSION") kbVersion = val;
    }
  }
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase URL or Service Role Key in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  console.log(`Seeding sports & custom niche careers for KB version: ${kbVersion}`);

  // 1. Insert Courses
  const courses = [
    {
      id: "bped",
      name: "B.P.Ed (Bachelor of Physical Education)",
      category: "UG-Arts",
      level: "UG",
      duration_years: 4,
      stream_required: ["science_bio", "science_maths", "science_cs", "commerce", "humanities"],
      core_subjects_required: [],
      typical_fee_band: "low",
      availability_kerala: "limited",
      leads_to_higher_study: [],
      notes: "Bachelor of Physical Education. Critical for physical education teachers and sports coaches.",
      status: "published",
      kb_version: kbVersion,
    },
    {
      id: "bsc_sports",
      name: "B.Sc in Sports Coaching & Science",
      category: "UG-Science",
      level: "UG",
      duration_years: 3,
      stream_required: ["science_bio", "science_maths", "science_cs", "commerce", "humanities"],
      core_subjects_required: [],
      typical_fee_band: "medium",
      availability_kerala: "limited",
      leads_to_higher_study: [],
      notes: "Focuses on sports training methods, exercise physiology, and athletic conditioning.",
      status: "published",
      kb_version: kbVersion,
    },
    {
      id: "fitness_cert",
      name: "Certified Personal Trainer (CPT)",
      category: "Professional-Cert",
      level: "Professional",
      duration_years: 1,
      stream_required: ["science_bio", "science_maths", "science_cs", "commerce", "humanities"],
      core_subjects_required: [],
      typical_fee_band: "medium",
      availability_kerala: "abundant",
      leads_to_higher_study: [],
      notes: "Fitness instructor and gym trainer certification (e.g., ACE or NASM).",
      status: "published",
      kb_version: kbVersion,
    },
  ];

  for (const course of courses) {
    const { error } = await supabase.from("courses").upsert(course, { onConflict: "id" });
    if (error) console.error(`Error inserting course ${course.id}:`, error);
    else console.log(`Upserted course: ${course.id}`);
  }

  // 2. Clean and Insert Eligibility Rules (Since eligibility_rules has no unique constraint on course_id, we delete first)
  const eligibilityRules = [
    {
      course_id: "bped",
      required_stream: ["science_bio", "science_maths", "science_cs", "commerce", "humanities"],
      required_subjects: [],
      min_aggregate_pct: 45,
    },
    {
      course_id: "bsc_sports",
      required_stream: ["science_bio", "science_maths", "science_cs", "commerce", "humanities"],
      required_subjects: [],
      min_aggregate_pct: 45,
    },
    {
      course_id: "fitness_cert",
      required_stream: ["science_bio", "science_maths", "science_cs", "commerce", "humanities"],
      required_subjects: [],
      min_aggregate_pct: 40,
    },
  ];

  for (const rule of eligibilityRules) {
    await supabase.from("eligibility_rules").delete().eq("course_id", rule.course_id);
    const { error } = await supabase.from("eligibility_rules").insert(rule);
    if (error) console.error(`Error inserting eligibility rule for ${rule.course_id}:`, error);
    else console.log(`Inserted eligibility rule: ${rule.course_id}`);
  }

  // 3. Insert Careers (sports_coach, fitness_trainer, photographer_videographer, makeup_artist)
  const careers = [
    {
      id: "sports_coach",
      name: "Sports Coach / PE Instructor",
      domain_id: "allied_health",
      field: "Sports & Physical Education",
      short_description: "Train athletes, manage school/academy sports teams, and teach physical education.",
      riasec_codes: ["social", "realistic"],
      personality_fit: ["social", "practical"],
      earning_band: "medium",
      job_market_kerala: "strong",
      job_market_india: "strong",
      higher_study_required: "none",
      risk_level: "stable",
      min_years_to_earn: 4,
      status: "published",
      kb_version: kbVersion,
    },
    {
      id: "fitness_trainer",
      name: "Gym / Fitness Trainer",
      domain_id: "allied_health",
      field: "Fitness & Wellness",
      short_description: "Help clients achieve fitness goals, manage personal training programs, and run gym operations.",
      riasec_codes: ["realistic", "social"],
      personality_fit: ["practical", "social"],
      earning_band: "medium",
      job_market_kerala: "strong",
      job_market_india: "strong",
      higher_study_required: "none",
      risk_level: "moderate",
      min_years_to_earn: 2,
      status: "published",
      kb_version: kbVersion,
    },
    {
      id: "photographer_videographer",
      name: "Photographer / Videographer",
      domain_id: "media",
      field: "Creative Media",
      short_description: "Capture visual stories, commercial photos, and videos for brands, weddings, and events.",
      riasec_codes: ["artistic", "realistic"],
      personality_fit: ["practical", "social"],
      earning_band: "variable",
      job_market_kerala: "strong",
      job_market_india: "strong",
      higher_study_required: "none",
      risk_level: "entrepreneurial",
      min_years_to_earn: 3,
      status: "published",
      kb_version: kbVersion,
    },
    {
      id: "makeup_artist",
      name: "Makeup Artist / Beautician",
      domain_id: "design",
      field: "Beauty & Grooming",
      short_description: "Apply cosmetics and styling for events, weddings, fashion shoots, and film production.",
      riasec_codes: ["artistic", "realistic"],
      personality_fit: ["practical", "social"],
      earning_band: "variable",
      job_market_kerala: "strong",
      job_market_india: "strong",
      higher_study_required: "none",
      risk_level: "entrepreneurial",
      min_years_to_earn: 2,
      status: "published",
      kb_version: kbVersion,
    },
  ];

  for (const career of careers) {
    const { error } = await supabase.from("careers").upsert(career, { onConflict: "id" });
    if (error) console.error(`Error inserting career ${career.id}:`, error);
    else console.log(`Upserted career: ${career.id}`);
  }

  // 4. Insert Career-Course Links
  const careerCourses = [
    { career_id: "sports_coach", course_id: "bped", route_type: "primary", strength: 1.0, pathway_note: "B.P.Ed degree → School/academy sports coach" },
    { career_id: "sports_coach", course_id: "bsc_sports", route_type: "alternative", strength: 0.8, pathway_note: "B.Sc in Sports Coaching → Academy coach" },
    { career_id: "sports_coach", course_id: "ba_general", route_type: "fallback", strength: 0.5, pathway_note: "General BA/B.Sc + National sports certification" },
    { career_id: "fitness_trainer", course_id: "fitness_cert", route_type: "primary", strength: 1.0, pathway_note: "CPT certification → Personal trainer at gyms" },
    { career_id: "fitness_trainer", course_id: "bsc_sports", route_type: "alternative", strength: 0.8, pathway_note: "B.Sc Sports Science → Fitness specialist" },
    { career_id: "fitness_trainer", course_id: "bped", route_type: "alternative", strength: 0.7, pathway_note: "B.P.Ed → Gym trainer" },
    { career_id: "photographer_videographer", course_id: "ba_general", route_type: "fallback", strength: 0.6, pathway_note: "Any degree + professional photography/videography diploma" },
    { career_id: "photographer_videographer", course_id: "bdes_fashion", route_type: "alternative", strength: 0.7, pathway_note: "B.Des route into fashion photography" },
    { career_id: "makeup_artist", course_id: "ba_general", route_type: "fallback", strength: 0.6, pathway_note: "Any degree + professional makeup/cosmetology certification" },
    { career_id: "makeup_artist", course_id: "bdes_fashion", route_type: "alternative", strength: 0.7, pathway_note: "B.Des route into fashion styling and makeup" },
  ];

  for (const cc of careerCourses) {
    const { error } = await supabase.from("career_course").upsert(cc, { onConflict: "career_id,course_id,route_type" });
    if (error) console.error(`Error inserting career-course link ${cc.career_id}-${cc.course_id}:`, error);
    else console.log(`Upserted career-course link: ${cc.career_id} -> ${cc.course_id}`);
  }

  // 5. Insert Signals (Weights)
  const signals = [
    // sports_coach
    { career_id: "sports_coach", signal_type: "interest", signal_key: "defence_adventure", weight: 0.9 },
    { career_id: "sports_coach", signal_type: "interest", signal_key: "helping_teaching", weight: 0.8 },
    { career_id: "sports_coach", signal_type: "aptitude", signal_key: "spatial", weight: 0.5 },
    { career_id: "sports_coach", signal_type: "aptitude", signal_key: "verbal", weight: 0.6 },
    { career_id: "sports_coach", signal_type: "personality", signal_key: "practical", weight: 0.8 },
    { career_id: "sports_coach", signal_type: "personality", signal_key: "social", weight: 0.8 },
    // fitness_trainer
    { career_id: "fitness_trainer", signal_type: "interest", signal_key: "defence_adventure", weight: 0.9 },
    { career_id: "fitness_trainer", signal_type: "interest", signal_key: "helping_teaching", weight: 0.6 },
    { career_id: "fitness_trainer", signal_type: "interest", signal_key: "business_money", weight: 0.5 },
    { career_id: "fitness_trainer", signal_type: "aptitude", signal_key: "spatial", weight: 0.4 },
    { career_id: "fitness_trainer", signal_type: "personality", signal_key: "practical", weight: 0.9 },
    { career_id: "fitness_trainer", signal_type: "personality", signal_key: "social", weight: 0.7 },
    // photographer_videographer
    { career_id: "photographer_videographer", signal_type: "interest", signal_key: "design_visual", weight: 0.8 },
    { career_id: "photographer_videographer", signal_type: "interest", signal_key: "media_communication", weight: 0.7 },
    { career_id: "photographer_videographer", signal_type: "aptitude", signal_key: "spatial", weight: 0.8 },
    { career_id: "photographer_videographer", signal_type: "personality", signal_key: "practical", weight: 0.8 },
    // makeup_artist
    { career_id: "makeup_artist", signal_type: "interest", signal_key: "design_visual", weight: 0.9 },
    { career_id: "makeup_artist", signal_type: "interest", signal_key: "business_money", weight: 0.5 },
    { career_id: "makeup_artist", signal_type: "aptitude", signal_key: "spatial", weight: 0.7 },
    { career_id: "makeup_artist", signal_type: "personality", signal_key: "practical", weight: 0.8 },
  ];

  for (const signal of signals) {
    const { error } = await supabase.from("career_signal").upsert(signal, { onConflict: "career_id,signal_type,signal_key" });
    if (error) console.error(`Error inserting signal ${signal.career_id}-${signal.signal_key}:`, error);
    else console.log(`Upserted signal: ${signal.career_id} -> ${signal.signal_key}`);
  }

  // 6. Insert Skills
  const skills = [
    // sports_coach
    { career_id: "sports_coach", skill_name: "Basic rules and training techniques of major sports", stage: "foundation", resource_type: "self-study", sort_order: 1 },
    { career_id: "sports_coach", skill_name: "Bachelor of Physical Education (B.P.Ed) or sports coaching diploma", stage: "intermediate", resource_type: "course", sort_order: 2 },
    { career_id: "sports_coach", skill_name: "Coaching certification from SAI or national federation + team internship", stage: "advanced", resource_type: "project", sort_order: 3 },
    // fitness_trainer
    { career_id: "fitness_trainer", skill_name: "Human anatomy, exercise physiology, and personal fitness", stage: "foundation", resource_type: "self-study", sort_order: 1 },
    { career_id: "fitness_trainer", skill_name: "Personal Trainer / Fitness Instructor certification", stage: "intermediate", resource_type: "course", sort_order: 2 },
    { career_id: "fitness_trainer", skill_name: "Internship at a gym, fitness centre, or health club", stage: "advanced", resource_type: "project", sort_order: 3 },
    // photographer_videographer
    { career_id: "photographer_videographer", skill_name: "Camera operation, lighting fundamentals, and composition basics", stage: "foundation", resource_type: "self-study", sort_order: 1 },
    { career_id: "photographer_videographer", skill_name: "Photo and video editing software (Photoshop, Premiere Pro, Lightroom)", stage: "intermediate", resource_type: "course", sort_order: 2 },
    { career_id: "photographer_videographer", skill_name: "Build a photography/videography portfolio and do client shoots", stage: "advanced", resource_type: "project", sort_order: 3 },
    // makeup_artist
    { career_id: "makeup_artist", skill_name: "Skin types, color theory, and basic makeup application", stage: "foundation", resource_type: "self-study", sort_order: 1 },
    { career_id: "makeup_artist", skill_name: "Professional cosmetology / makeup artistry certification", stage: "intermediate", resource_type: "course", sort_order: 2 },
    { career_id: "makeup_artist", skill_name: "Work as an assistant to a senior artist or intern at a beauty salon", stage: "advanced", resource_type: "project", sort_order: 3 },
  ];

  for (const skill of skills) {
    // Delete existing matching skill first to avoid primary key/unique check issues on inserts
    await supabase.from("career_skills").delete().eq("career_id", skill.career_id).eq("skill_name", skill.skill_name);
    const { error } = await supabase.from("career_skills").insert(skill);
    if (error) console.error(`Error inserting skill for ${skill.career_id}:`, error);
    else console.log(`Inserted skill: ${skill.career_id} -> ${skill.skill_name}`);
  }

  console.log("All sports & custom niche careers upserted successfully!");
}

run();
