"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { RecommendationResult } from "@/types/recommendation";

// Result page — functional PLACEHOLDER. Triggers the deterministic engine via
// /api/recommendation and renders the explained, confidence-scored output.
function ResultInner() {
  const sessionId = useSearchParams().get("session");
  const [data, setData] = useState<RecommendationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetch("/api/recommendation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError("Could not load recommendations."));
  }, [sessionId]);

  if (!sessionId) return <Center>Missing session.</Center>;
  if (error) return <Center>{error}</Center>;
  if (!data) return <Center>Building your recommendations…</Center>;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Your career guidance</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Overall confidence: {Math.round(data.overallConfidence * 100)}% · KB v{data.kbVersion}
      </p>
      {data.explanation && (
        <Card className="mt-4 bg-secondary/40">
          <CardContent className="pt-6 text-sm">{data.explanation}</CardContent>
        </Card>
      )}

      <div className="mt-6 space-y-4">
        {data.top.map((c, i) => (
          <Card key={c.careerId}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{i + 1}. {c.name}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Fit {Math.round(c.fitScore * 100)}% · Confidence {Math.round(c.confidence * 100)}%
                </span>
              </CardTitle>
              <CardDescription>{c.domain}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {c.factors.length > 0 && (
                <div>
                  <p className="font-medium">Why this fits you</p>
                  <ul className="ml-4 list-disc text-muted-foreground">
                    {c.factors.map((f, j) => <li key={j}>{f.label}</li>)}
                  </ul>
                </div>
              )}
              {c.courses.length > 0 && (
                <div>
                  <p className="font-medium">Course routes</p>
                  <ul className="ml-4 list-disc text-muted-foreground">
                    {c.courses.map((co) => (
                      <li key={co.courseId}>
                        {co.name} <span className="text-xs">({co.routeType}, {co.eligibility})</span>
                        {co.exams.length > 0 && <> — exams: {co.exams.map((e) => e.name).join(", ")}</>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {c.skills.length > 0 && (
                <div>
                  <p className="font-medium">Skill roadmap</p>
                  <p className="text-muted-foreground">
                    {c.skills.map((s) => `${s.skillName} (${s.stage})`).join(" → ")}
                  </p>
                </div>
              )}
              {c.alternatives.length > 0 && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Alternatives: </span>
                  {c.alternatives.map((a) => a.name).join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {data.caveats.length > 0 && (
        <Card className="mt-6 border-amber-300 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-900">
            <p className="font-medium">Please keep in mind</p>
            <ul className="ml-4 mt-1 list-disc">
              {data.caveats.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="flex h-screen items-center justify-center px-6 text-center text-muted-foreground">{children}</main>;
}

export default function ResultPage() {
  return (
    <Suspense fallback={<Center>Loading…</Center>}>
      <ResultInner />
    </Suspense>
  );
}
