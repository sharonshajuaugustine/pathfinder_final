import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
let supabaseUrl = "";
let supabaseServiceRoleKey = "";

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const parts = line.trim().split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
      if (key === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = val;
      if (key === "SUPABASE_SERVICE_ROLE_KEY") supabaseServiceRoleKey = val;
    }
  }
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function run() {
  const { data, error } = await supabase
    .from("student_profiles")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  console.log("LATEST PROFILE:", JSON.stringify(data?.[0], null, 2));
}

run();
