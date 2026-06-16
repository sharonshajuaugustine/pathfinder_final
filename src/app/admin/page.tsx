import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Admin dashboard — PLACEHOLDER. Real version is gated behind Supabase Auth
// (admin_users + RLS is_staff()/is_admin()). Build the secure login + data
// views in the admin phase. This stub documents the intended sections.
export default function AdminPlaceholder() {
  const sections = [
    { t: "Leads & funnel", d: "New students, status, source, assign to counsellor." },
    { t: "Session viewer", d: "Profile + transcript + assessment + recommendation reasoning." },
    { t: "Knowledge base CMS", d: "Edit careers / courses / exams / eligibility, with versioning." },
    { t: "Recommendation tuning", d: "Adjust scoring weights, view outcome distribution." },
    { t: "LLM ops", d: "Sample transcripts, cost per session, model routing." },
    { t: "Analytics", d: "Funnel, drop-off, popular careers, conversion." },
    { t: "Audit & compliance", d: "Access logs, consent records, deletion requests." },
  ];
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Admin dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Placeholder. Secure login (Supabase Auth + RBAC) and data views are built in the admin phase.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.t}>
            <CardHeader>
              <CardTitle className="text-base">{s.t}</CardTitle>
              <CardDescription>{s.d}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Coming soon</CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
