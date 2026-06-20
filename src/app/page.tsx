import Link from "next/link";

const STEPS = [
  {
    num: "01",
    title: "Tell us about yourself",
    desc: "A guided AI conversation explores your interests, strengths, and goals — asking follow-up questions based on what you say until it really understands you.",
  },
  {
    num: "02",
    title: "Quick aptitude check",
    desc: "15 questions measure your numerical, logical, and spatial strengths — making guidance specific, not generic.",
  },
  {
    num: "03",
    title: "Get your personalised report",
    desc: "A ranked list of careers with courses, entrance exams, and a skill roadmap — fully explained.",
  },
];

const WHY = [
  {
    title: "We listen, then dig deeper",
    desc: "When your answer is vague, we ask from a different angle — not the same question again. You stay in control and can move on whenever you're ready.",
  },
  {
    title: "We measure, not guess",
    desc: "A quick aptitude check combines with your interests and goals for accurate, personalised guidance.",
  },
  {
    title: "You and your family decide",
    desc: "We explain every recommendation. Nothing is decided for you — this tool supports your own choice.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary" />
            <span className="text-sm font-semibold tracking-tight">PathFinder</span>
          </Link>
          <Link
            href="/admin"
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Counsellor login
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="hero-gradient px-6 pb-20 pt-20 text-white sm:pb-28 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
            Free career guidance for Plus Two students in Kerala
          </span>
          <h1 className="mt-5 text-balance text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Find the career path
            <br className="hidden sm:block" /> that actually fits you.
          </h1>
          <p className="mt-5 text-balance text-base leading-relaxed text-white/80 sm:text-lg">
            A guided AI conversation maps your interests, strengths, and goals to honest, explained
            recommendations — built for Kerala&apos;s Plus Two students.
          </p>
          <div className="mt-8">
            <Link
              href="/start"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-8 text-sm font-semibold text-primary shadow-lg transition-all hover:bg-white/95 hover:shadow-xl"
            >
              Start now — it&apos;s free
            </Link>
          </div>
          <p className="mt-4 text-xs text-white/55">
            No account needed · Takes about 20 minutes · Free forever
          </p>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-10 px-6 py-6 text-center sm:gap-16">
          {[
            { val: "40+", label: "Career paths" },
            { val: "5", label: "Streams covered" },
            { val: "~20 min", label: "To complete" },
            { val: "100%", label: "Free to use" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-bold text-primary">{s.val}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">How it works</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Three steps from where you are to where you&apos;re going.
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.num}>
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                  {s.num}
                </div>
                <h3 className="text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why PathFinder ── */}
      <section className="border-t bg-secondary/50 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Why students trust PathFinder</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {WHY.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="px-6 py-16 text-center sm:py-20">
        <div className="mx-auto max-w-xl">
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to find your path?</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Free, in about 20 minutes. No account needed.
          </p>
          <Link
            href="/start"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-sm font-semibold text-primary-foreground shadow transition-all hover:bg-primary/90"
          >
            Get started for free
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t bg-white px-6 py-8">
        <div className="mx-auto max-w-5xl space-y-1 text-center">
          <p className="text-xs text-muted-foreground">
            PathFinder is a career guidance tool. It supports your decision — it does not make it for
            you. All advice should be discussed with family, teachers, and counsellors.
          </p>
          <p className="text-xs text-muted-foreground/50">
            © {new Date().getFullYear()} PathFinder · Made for Kerala students
          </p>
        </div>
      </footer>
    </div>
  );
}
