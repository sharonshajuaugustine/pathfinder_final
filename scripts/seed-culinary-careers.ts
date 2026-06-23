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
  console.log(`Seeding culinary careers for KB version: ${kbVersion}`);

  // 1. Insert Courses
  const courses = [
    {
      id: "diploma_culinary",
      name: "Diploma in Culinary Arts",
      category: "Diploma",
      level: "Diploma",
      duration_years: 1.5,
      stream_required: ["science_bio", "science_maths", "science_cs", "commerce", "humanities"],
      core_subjects_required: [],
      typical_fee_band: "medium",
      availability_kerala: "abundant",
      leads_to_higher_study: [],
      notes: "Short-term vocational diploma focused on practical kitchen skills and culinary operations.",
      status: "published",
      kb_version: kbVersion,
    },
    {
      id: "diploma_patisserie",
      name: "Diploma in Patisserie & Baking",
      category: "Diploma",
      level: "Diploma",
      duration_years: 1,
      stream_required: ["science_bio", "science_maths", "science_cs", "commerce", "humanities"],
      core_subjects_required: [],
      typical_fee_band: "medium",
      availability_kerala: "limited",
      leads_to_higher_study: [],
      notes: "Specialized diploma in baking, pastry design, cake decoration, and bakery operations.",
      status: "published",
      kb_version: kbVersion,
    },
    {
      id: "bsc_food_tech",
      name: "B.Sc in Food Technology",
      category: "UG-Science",
      level: "UG",
      duration_years: 3,
      stream_required: ["science_bio", "science_maths", "science_cs"],
      core_subjects_required: ["chemistry"],
      typical_fee_band: "medium",
      availability_kerala: "limited",
      leads_to_higher_study: [],
      notes: "Study of food processing, safety, preservation, and nutrition.",
      status: "published",
      kb_version: kbVersion,
    },
  ];

  for (const course of courses) {
    const { error } = await supabase.from("courses").upsert(course, { onConflict: "id" });
    if (error) console.error(`Error inserting course ${course.id}:`, error);
    else console.log(`Upserted course: ${course.id}`);
  }

  // 2. Clean and Insert Eligibility Rules
  const eligibilityRules = [
    {
      course_id: "diploma_culinary",
      required_stream: ["science_bio", "science_maths", "science_cs", "commerce", "humanities"],
      required_subjects: [],
      min_aggregate_pct: 40,
    },
    {
      course_id: "diploma_patisserie",
      required_stream: ["science_bio", "science_maths", "science_cs", "commerce", "humanities"],
      required_subjects: [],
      min_aggregate_pct: 40,
    },
    {
      course_id: "bsc_food_tech",
      required_stream: ["science_bio", "science_maths", "science_cs"],
      required_subjects: ["chemistry"],
      min_aggregate_pct: 50,
    },
  ];

  for (const rule of eligibilityRules) {
    await supabase.from("eligibility_rules").delete().eq("course_id", rule.course_id);
    const { error } = await supabase.from("eligibility_rules").insert(rule);
    if (error) console.error(`Error inserting eligibility rule for ${rule.course_id}:`, error);
    else console.log(`Inserted eligibility rule: ${rule.course_id}`);
  }

  // 3. Insert Careers (pastry_chef, food_scientist, restaurant_manager, food_stylist)
  const careers = [
    {
      id: "pastry_chef",
      name: "Pastry Chef / Professional Baker",
      domain_id: "hospitality",
      field: "Culinary Arts & Baking",
      short_description: "Create pastries, desserts, breads, and baked goods for hotels, fine dining, and bakeries.",
      riasec_codes: ["realistic", "artistic"],
      personality_fit: ["practical", "structured"],
      earning_band: "medium",
      job_market_kerala: "strong",
      job_market_india: "strong",
      higher_study_required: "none",
      risk_level: "entrepreneurial",
      min_years_to_earn: 2,
      status: "published",
      kb_version: kbVersion,
    },
    {
      id: "food_scientist",
      name: "Food Scientist / Technologist",
      domain_id: "agriculture",
      field: "Food Science & Safety",
      short_description: "Research food safety, develop new food products, and improve manufacturing and preservation processes.",
      riasec_codes: ["investigative", "realistic"],
      personality_fit: ["analytical", "structured"],
      earning_band: "medium",
      job_market_kerala: "moderate",
      job_market_india: "strong",
      higher_study_required: "preferred",
      risk_level: "stable",
      min_years_to_earn: 3,
      status: "published",
      kb_version: kbVersion,
    },
    {
      id: "restaurant_manager",
      name: "Restaurant / F&B Manager",
      domain_id: "hospitality",
      field: "Food & Beverage Management",
      short_description: "Manage restaurant staffing, inventory, customer service, operations, and quality standards.",
      riasec_codes: ["enterprising", "social"],
      personality_fit: ["social", "structured"],
      earning_band: "medium",
      job_market_kerala: "strong",
      job_market_india: "strong",
      higher_study_required: "none",
      risk_level: "moderate",
      min_years_to_earn: 3,
      status: "published",
      kb_version: kbVersion,
    },
    {
      id: "food_stylist",
      name: "Food Stylist / Food Photographer",
      domain_id: "media",
      field: "Creative Media & Styling",
      short_description: "Style and photograph food items for commercial advertisements, menus, magazines, and social media blogs.",
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
  ];

  for (const career of careers) {
    const { error } = await supabase.from("careers").upsert(career, { onConflict: "id" });
    if (error) console.error(`Error inserting career ${career.id}:`, error);
    else console.log(`Upserted career: ${career.id}`);
  }

  // 4. Insert Career-Course Links
  const careerCourses = [
    { career_id: "pastry_chef", course_id: "diploma_patisserie", route_type: "primary", strength: 1.0, pathway_note: "Diploma in Patisserie → Pastry chef roles" },
    { career_id: "pastry_chef", course_id: "bsc_culinary", route_type: "alternative", strength: 0.8, pathway_note: "Culinary Arts Degree with baking specialization" },
    { career_id: "pastry_chef", course_id: "diploma_culinary", route_type: "alternative", strength: 0.7, pathway_note: "General Culinary Diploma → Bakery internship" },
    { career_id: "food_scientist", course_id: "bsc_food_tech", route_type: "primary", strength: 1.0, pathway_note: "B.Sc Food Technology → R&D / Safety jobs" },
    { career_id: "food_scientist", course_id: "bsc_lifescience", route_type: "alternative", strength: 0.7, pathway_note: "B.Sc Life Sciences / Chemistry → Food quality roles" },
    { career_id: "restaurant_manager", course_id: "bhm", route_type: "primary", strength: 1.0, pathway_note: "Hotel Management degree → F&B Manager" },
    { career_id: "restaurant_manager", course_id: "bba", route_type: "alternative", strength: 0.7, pathway_note: "BBA degree → Restaurant supervisor" },
    { career_id: "restaurant_manager", course_id: "ba_general", route_type: "fallback", strength: 0.5, pathway_note: "Any UG degree + hospitality experience" },
    { career_id: "food_stylist", course_id: "ba_general", route_type: "primary", strength: 0.8, pathway_note: "Any degree + food photography portfolio" },
    { career_id: "food_stylist", course_id: "bdes_fashion", route_type: "alternative", strength: 0.7, pathway_note: "B.Des in Styling/Photography → Food styling roles" },
  ];

  for (const cc of careerCourses) {
    const { error } = await supabase.from("career_course").upsert(cc, { onConflict: "career_id,course_id,route_type" });
    if (error) console.error(`Error inserting career-course link ${cc.career_id}-${cc.course_id}:`, error);
    else console.log(`Upserted career-course link: ${cc.career_id} -> ${cc.course_id}`);
  }

  // 5. Insert Signals (Weights)
  const signals = [
    // pastry_chef
    { career_id: "pastry_chef", signal_type: "interest", signal_key: "design_visual", weight: 0.8 },
    { career_id: "pastry_chef", signal_type: "interest", signal_key: "business_money", weight: 0.4 },
    { career_id: "pastry_chef", signal_type: "aptitude", signal_key: "spatial", weight: 0.5 },
    { career_id: "pastry_chef", signal_type: "personality", signal_key: "practical", weight: 0.8 },
    { career_id: "pastry_chef", signal_type: "personality", signal_key: "structured", weight: 0.6 },
    // food_scientist
    { career_id: "food_scientist", signal_type: "interest", signal_key: "science_research", weight: 0.8 },
    { career_id: "food_scientist", signal_type: "interest", signal_key: "nature_agriculture", weight: 0.6 },
    { career_id: "food_scientist", signal_type: "aptitude", signal_key: "scientific", weight: 0.8 },
    { career_id: "food_scientist", signal_type: "personality", signal_key: "analytical", weight: 0.8 },
    // restaurant_manager
    { career_id: "restaurant_manager", signal_type: "interest", signal_key: "business_money", weight: 0.8 },
    { career_id: "restaurant_manager", signal_type: "interest", signal_key: "helping_teaching", weight: 0.4 },
    { career_id: "restaurant_manager", signal_type: "personality", signal_key: "social", weight: 0.8 },
    { career_id: "restaurant_manager", signal_type: "personality", signal_key: "structured", weight: 0.7 },
    // food_stylist
    { career_id: "food_stylist", signal_type: "interest", signal_key: "design_visual", weight: 0.9 },
    { career_id: "food_stylist", signal_type: "interest", signal_key: "media_communication", weight: 0.7 },
    { career_id: "food_stylist", signal_type: "aptitude", signal_key: "spatial", weight: 0.8 },
    { career_id: "food_stylist", signal_type: "personality", signal_key: "practical", weight: 0.7 },
  ];

  for (const signal of signals) {
    const { error } = await supabase.from("career_signal").upsert(signal, { onConflict: "career_id,signal_type,signal_key" });
    if (error) console.error(`Error inserting signal ${signal.career_id}-${signal.signal_key}:`, error);
    else console.log(`Upserted signal: ${signal.career_id} -> ${signal.signal_key}`);
  }

  // 6. Insert Skills
  const skills = [
    // pastry_chef
    { career_id: "pastry_chef", skill_name: "Baking science, recipe measurements, and safety", stage: "foundation", resource_type: "self-study", sort_order: 1 },
    { career_id: "pastry_chef", skill_name: "Diploma in Patisserie / professional baking training", stage: "intermediate", resource_type: "course", sort_order: 2 },
    { career_id: "pastry_chef", skill_name: "Bakery kitchen internship or dessert menu project", stage: "advanced", resource_type: "project", sort_order: 3 },
    // food_scientist
    { career_id: "food_scientist", skill_name: "Basic chemistry, biology, and nutrition science", stage: "foundation", resource_type: "self-study", sort_order: 1 },
    { career_id: "food_scientist", skill_name: "B.Sc in Food Technology / food safety regulations", stage: "intermediate", resource_type: "course", sort_order: 2 },
    { career_id: "food_scientist", skill_name: "Food product testing project or lab quality control internship", stage: "advanced", resource_type: "project", sort_order: 3 },
    // restaurant_manager
    { career_id: "restaurant_manager", skill_name: "Customer relations and basic inventory management", stage: "foundation", resource_type: "self-study", sort_order: 1 },
    { career_id: "restaurant_manager", skill_name: "Hotel Management (BHM) / F&B operations course", stage: "intermediate", resource_type: "course", sort_order: 2 },
    { career_id: "restaurant_manager", skill_name: "Restaurant supervisor internship or outlet project", stage: "advanced", resource_type: "project", sort_order: 3 },
    // food_stylist
    { career_id: "food_stylist", skill_name: "Digital photography basics and styling compositions", stage: "foundation", resource_type: "self-study", sort_order: 1 },
    { career_id: "food_stylist", skill_name: "Food styling workshops and professional DSLR course", stage: "intermediate", resource_type: "course", sort_order: 2 },
    { career_id: "food_stylist", skill_name: "Create a styling portfolio and work with food brands", stage: "advanced", resource_type: "project", sort_order: 3 },
  ];

  for (const skill of skills) {
    // Delete existing matching skill first to avoid primary key/unique check issues on inserts
    await supabase.from("career_skills").delete().eq("career_id", skill.career_id).eq("skill_name", skill.skill_name);
    const { error } = await supabase.from("career_skills").insert(skill);
    if (error) console.error(`Error inserting skill for ${skill.career_id}:`, error);
    else console.log(`Inserted skill: ${skill.career_id} -> ${skill.skill_name}`);
  }

  console.log("All culinary careers upserted successfully!");
}

run();
