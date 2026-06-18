"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
      email: String(fd.get("email")),
      age: Number(fd.get("age")),
      district: String(fd.get("district") ?? ""),
      stream: String(fd.get("stream") ?? ""),
      percentage: Number(percentageRaw),
      preferredLanguage: "en",
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
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary" />
            <span className="text-sm font-semibold">PathFinder</span>
          </Link>
          <span className="text-xs text-muted-foreground">Step 1 of 3</span>
        </div>
      </header>

      {/* Journey progress */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-2xl px-6 py-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-primary">Your details</span>
            <div className="h-px flex-1 bg-primary/30" />
            <span className="text-muted-foreground">Conversation</span>
            <div className="h-px flex-1 bg-border" />
            <span className="text-muted-foreground">Your report</span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Let&apos;s get started</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            A few quick details so we can save your report and personalise the conversation.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <Field label="Full name">
            <Input name="name" required minLength={2} placeholder="Your name" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone number">
              <Input
                name="phone"
                required
                inputMode="numeric"
                pattern="[6-9][0-9]{9}"
                placeholder="9XXXXXXXXX"
              />
            </Field>
            <Field label="Age">
              <Input name="age" type="number" required min={14} max={30} placeholder="17" />
            </Field>
          </div>

          <Field label="Email">
            <Input name="email" type="email" required placeholder="you@example.com" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="District">
              <Select name="district" required defaultValue="">
                <option value="" disabled>
                  Select district
                </option>
                {KERALA_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Plus Two stream">
              <Select name="stream" required defaultValue="">
                <option value="" disabled>
                  Select stream
                </option>
                {STREAMS.map((s) => (
                  <option key={s} value={s}>
                    {STREAM_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Percentage">
            <Input
              name="percentage"
              type="number"
              required
              min={0}
              max={100}
              step="0.01"
              placeholder="e.g. 85"
            />
          </Field>

          <label className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
            <Checkbox name="consentGiven" required className="mt-0.5 shrink-0" />
            <span className="leading-relaxed text-muted-foreground">
              I agree to the processing of my information to generate career guidance, and understand
              it may be shared with a counsellor. Data is handled per the privacy policy.
            </span>
          </label>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            className="h-12 w-full text-sm font-semibold"
            disabled={!sessionId || submitting}
          >
            {submitting ? "Saving..." : "Continue to the conversation →"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            This is completely free. No payment required.
          </p>
        </form>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
