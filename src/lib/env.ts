// Centralized, validated environment access.
// Server-only secrets are read lazily and NEVER imported into client components.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Public (safe for browser). Prefixed NEXT_PUBLIC_.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

// Server-only. Accessing these from a client bundle will throw at build/runtime.
export const serverEnv = {
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get groqApiKey() {
    return required("GROQ_API_KEY", process.env.GROQ_API_KEY);
  },
  get groqModel() {
    return process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  },
  get kbVersion() {
    return process.env.KB_VERSION ?? "1";
  },
};
