import { z } from "zod";

// Controlled vocabularies (kept in sync with SQL CHECK constraints).
export const STREAMS = [
  "science_bio",
  "science_maths",
  "science_cs",
  "commerce",
  "humanities",
] as const;
export type Stream = (typeof STREAMS)[number];

export const LANGUAGES = ["en", "ml"] as const;
export type Language = (typeof LANGUAGES)[number];

// Kerala districts (controlled list).
export const KERALA_DISTRICTS = [
  "Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha", "Kottayam",
  "Idukki", "Ernakulam", "Thrissur", "Palakkad", "Malappuram", "Kozhikode",
  "Wayanad", "Kannur", "Kasaragod",
] as const;

// Onboarding form schema. Validated on the SERVER before any PII write.
// name, age, stream, and percentage are captured earlier in the start quiz and
// fetched from student_profiles at submission time — not re-collected here.
export const onboardingSchema = z.object({
  sessionId: z.string().uuid(),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  email: z.string().email(),
  district: z.enum(KERALA_DISTRICTS),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  preferredLanguage: z.enum(LANGUAGES).default("en"),
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: "Consent is required to continue" }),
  }),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
