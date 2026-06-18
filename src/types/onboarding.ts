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
export const onboardingSchema = z.object({
  sessionId: z.string().uuid(),
  name: z.string().min(2).max(80),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  email: z.string().email(),
  age: z.number().int().min(14).max(30),
  district: z.enum(KERALA_DISTRICTS),
  stream: z.enum(STREAMS),
  percentage: z.number().min(0).max(100),
  preferredLanguage: z.enum(LANGUAGES).default("en"),
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: "Consent is required to continue" }),
  }),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
