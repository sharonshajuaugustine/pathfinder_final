import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Landing page (placeholder UI — not the final polished design).
export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
        For Plus Two students in Kerala
      </span>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Find the career path that actually fits you.
      </h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        A guided AI conversation helps you understand your interests, strengths, and options — then
        gives you honest, explained recommendations. Free, in about 20 minutes.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/onboarding">
          <Button size="lg">Start now — it&apos;s free</Button>
        </Link>
        <Link href="/admin">
          <Button size="lg" variant="outline">
            Admin / Counsellor login
          </Button>
        </Link>
      </div>

      <div className="mt-14 grid w-full gap-4 sm:grid-cols-3">
        {[
          { t: "We listen first", d: "A friendly chat — no long forms, no jargon." },
          { t: "We measure, not guess", d: "A short aptitude check makes advice real." },
          { t: "You decide", d: "We explain every suggestion. You and your family choose." },
        ].map((f) => (
          <Card key={f.t} className="text-left">
            <CardContent className="pt-6">
              <h3 className="font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-12 max-w-md text-xs text-muted-foreground">
        This tool gives guidance to support your decision. It does not decide your future for you.
      </p>
    </main>
  );
}
