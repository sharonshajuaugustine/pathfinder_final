"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KERALA_DISTRICTS, STREAMS } from "@/types/onboarding";

const STREAM_LABELS: Record<string, string> = {
  science_bio: "Science (Biology)",
  science_maths: "Science (Maths)",
  science_cs: "Science (Computer Science)",
  commerce: "Commerce",
  humanities: "Humanities / Arts",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create an anonymous session on mount.
  useEffect(() => {
    fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then((r) => r.json())
      .then((d) => setSessionId(d.sessionId))
      .catch(() => setError("Could not start session. Please refresh the page."));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sessionId) return;
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const percentageRaw = fd.get("percentage");
    const payload = {
      sessionId,
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      age: Number(fd.get("age")),
      district: String(fd.get("district") ?? ""),
      stream: String(fd.get("stream") ?? ""),
      percentage: percentageRaw ? Number(percentageRaw) : undefined,
      preferredLanguage: String(fd.get("preferredLanguage") ?? "en"),
      consentGiven: fd.get("consentGiven") === "on",
    };

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Please check your details and try again.");
      setSubmitting(false);
      return;
    }

    router.push(`/chat?session=${sessionId}`);
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Let&apos;s get started</CardTitle>
          <CardDescription>
            A few quick details so we can save your report and personalize the conversation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Full name">
              <Input name="name" required minLength={2} placeholder="Your name" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone (10 digits)">
                <Input name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" placeholder="9XXXXXXXXX" />
              </Field>
              <Field label="Age">
                <Input name="age" type="number" required min={14} max={30} placeholder="17" />
              </Field>
            </div>

            <Field label="Email (optional)">
              <Input name="email" type="email" placeholder="you@example.com" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="District">
                <Select name="district" required defaultValue="">
                  <option value="" disabled>Select district</option>
                  {KERALA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </Field>
              <Field label="Plus Two stream">
                <Select name="stream" required defaultValue="">
                  <option value="" disabled>Select stream</option>
                  {STREAMS.map((s) => <option key={s} value={s}>{STREAM_LABELS[s]}</option>)}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Percentage (optional)">
                <Input name="percentage" type="number" min={0} max={100} step="0.01" placeholder="e.g. 85" />
              </Field>
              <Field label="Preferred language">
                <Select name="preferredLanguage" defaultValue="en">
                  <option value="en">English</option>
                  <option value="ml">Malayalam</option>
                </Select>
              </Field>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox name="consentGiven" required className="mt-0.5" />
              <span className="text-muted-foreground">
                I agree to the processing of my information to generate career guidance, and understand it may be
                shared with a counsellor. Data is handled per the privacy policy.
              </span>
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={!sessionId || submitting}>
              {submitting ? "Saving..." : "Continue to the conversation"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
