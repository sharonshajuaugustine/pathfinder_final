import Link from "next/link";

const i8 = (n: string) => `https://img.icons8.com/3d-fluency/96/${n}.png`;

const STEPS = [
  {
    num: "01",
    icon: i8("chat-message"),
    title: "Tell us about yourself",
    desc: "A guided AI conversation explores your interests, strengths, and goals — asking follow-up questions based on what you say until it really understands you.",
  },
  {
    num: "02",
    icon: i8("puzzle"),
    title: "Quick aptitude check",
    desc: "15 questions measure your numerical, logical, and spatial strengths — making guidance specific, not generic.",
  },
  {
    num: "03",
    icon: i8("compass"),
    title: "Get your personalised report",
    desc: "A ranked list of careers with courses, entrance exams, and a skill roadmap — fully explained.",
  },
];

const WHY = [
  {
    icon: i8("communication"),
    title: "We listen, then dig deeper",
    desc: "When your answer is vague, we ask from a different angle — not the same question again. You stay in control and can move on whenever you're ready.",
  },
  {
    icon: i8("combo-chart"),
    title: "We measure, not guess",
    desc: "A quick aptitude check combines with your interests and goals for accurate, personalised guidance.",
  },
  {
    icon: i8("agreement"),
    title: "You and your family decide",
    desc: "We explain every recommendation. Nothing is decided for you — this tool supports your own choice.",
  },
];

const STATS = [
  { val: "40+", label: "Career paths", icon: i8("compass") },
  { val: "5", label: "Streams", icon: i8("books") },
  { val: "~20 min", label: "To complete", icon: i8("clock") },
  { val: "Free", label: "Always", icon: i8("confetti") },
];

const HERO_ITEMS = [
  { icon: i8("goal"), size: 52, delay: "0s" },
  { icon: i8("rocket"), size: 68, delay: "-1.4s" },
  { icon: i8("idea"), size: 52, delay: "-2.8s" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: "#F8F3EC" }}>

      {/* ── Nav ── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(248,243,236,0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(30,111,255,0.08)",
        }}
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              style={{
                width: 34, height: 34, borderRadius: 12,
                background: "linear-gradient(145deg, #3B82FF, #1E6FFF)",
                boxShadow: "0 3px 0 rgba(6,26,138,0.4), 0 6px 16px rgba(30,111,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 14, fontFamily: "var(--font-heading)" }}>P</span>
            </div>
            <span className="text-base font-black tracking-tight" style={{ color: "#111827", fontFamily: "var(--font-heading)" }}>
              PathFinder
            </span>
          </Link>
          <Link
            href="/admin"
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all hover:opacity-75"
            style={{ color: "#1E6FFF", background: "rgba(30,111,255,0.09)" }}
          >
            Counsellor login
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="hero-gradient relative overflow-hidden px-6 pb-28 pt-20 text-white sm:pb-36 sm:pt-28">
        <div className="pointer-events-none absolute" style={{ top: -80, right: -80, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(147,197,253,0.28) 0%, transparent 70%)" }} />
        <div className="pointer-events-none absolute" style={{ bottom: -60, left: -60, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(196,181,253,0.22) 0%, transparent 70%)" }} />

        <div className="relative mx-auto max-w-3xl text-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold"
            style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.9)" }}
          >
            ✨ Free career guidance for Plus Two students in Kerala
          </span>

          {/* Floating icon cluster */}
          <div className="my-10 flex items-end justify-center gap-5">
            {HERO_ITEMS.map((item, idx) => (
              <div
                key={idx}
                className="animate-clay-float"
                style={{
                  width: item.size, height: item.size,
                  borderRadius: item.size * 0.28,
                  background: "rgba(255,255,255,0.18)",
                  backdropFilter: "blur(10px)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.3) inset",
                  animationDelay: item.delay, flexShrink: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.icon} alt="" width={Math.round(item.size * 0.58)} height={Math.round(item.size * 0.58)} />
              </div>
            ))}
          </div>

          <h1 className="text-balance text-4xl font-black leading-[1.1] text-white sm:text-5xl lg:text-6xl">
            Find the career path
            <br />
            <span style={{ background: "linear-gradient(90deg, #93C5FD 0%, #C4B5FD 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              that actually fits you.
            </span>
          </h1>

          <p className="mt-5 text-balance text-base leading-relaxed sm:text-lg" style={{ color: "rgba(255,255,255,0.72)" }}>
            A guided AI conversation maps your interests, strengths, and goals to honest, explained
            recommendations — built for Kerala&apos;s Plus Two students.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/discover"
              className="clay-btn h-14 px-10 text-base"
              style={{ background: "#ffffff", color: "#1E6FFF", boxShadow: "0 5px 0 rgba(0,0,0,0.1), 0 12px 32px rgba(0,0,0,0.12)" }}
            >
              Start now — it&apos;s free →
            </Link>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>No account needed · ~20 minutes · Free forever</p>
          </div>
        </div>
      </section>

      {/* ── Floating stats card ── */}
      <div className="relative z-10 mx-auto -mt-10 max-w-2xl px-6">
        <div className="clay-card p-6">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.icon} alt="" width={36} height={36} className="mx-auto mb-2" />
                <p className="text-2xl font-black" style={{ color: "#1E6FFF" }}>{s.val}</p>
                <p className="mt-0.5 text-xs font-semibold" style={{ color: "#6B7280" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── How it works ── */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <span className="mb-3 inline-block rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em]" style={{ background: "rgba(30,111,255,0.08)", color: "#1E6FFF" }}>
              How it works
            </span>
            <h2 className="text-2xl font-black text-gray-900 sm:text-3xl">Three steps to your perfect path</h2>
            <p className="mt-2 text-sm" style={{ color: "#6B7280" }}>From where you are to where you&apos;re going — fast.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, idx) => (
              <div key={s.num} className="clay-card p-7" style={{ animationDelay: `${idx * 0.08}s` }}>
                <div className="mb-5 flex items-center justify-between">
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: "linear-gradient(145deg, #3B82FF, #1E6FFF)", boxShadow: "0 3px 0 rgba(6,26,138,0.35), 0 6px 16px rgba(30,111,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12, fontFamily: "var(--font-heading)" }}>
                    {s.num}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.icon} alt="" width={44} height={44} />
                </div>
                <h3 className="mb-2 text-base font-bold text-gray-900">{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why PathFinder ── */}
      <section className="px-6 py-20 sm:py-24" style={{ background: "rgba(30,111,255,0.03)", borderTop: "1px solid rgba(30,111,255,0.07)", borderBottom: "1px solid rgba(30,111,255,0.07)" }}>
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-2xl font-black text-gray-900 sm:text-3xl">Why students trust PathFinder</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {WHY.map((f) => (
              <div key={f.title} className="clay-card p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.icon} alt="" width={44} height={44} className="mb-3" />
                <h3 className="mb-2 text-sm font-bold text-gray-900">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="px-6 py-20 text-center sm:py-28">
        <div className="mx-auto max-w-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={i8("graduation-cap")} alt="" width={72} height={72} className="mx-auto mb-5" />
          <h2 className="text-2xl font-black text-gray-900 sm:text-3xl">Ready to find your path?</h2>
          <p className="mt-3 text-sm" style={{ color: "#6B7280" }}>Free, in about 20 minutes. No account needed.</p>
          <div className="mt-8">
            <Link href="/discover" className="clay-btn h-14 px-10 text-sm">Get started for free →</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 py-10" style={{ borderTop: "1px solid rgba(30,111,255,0.08)", background: "rgba(255,255,255,0.45)" }}>
        <div className="mx-auto max-w-5xl space-y-1.5 text-center">
          <p className="text-xs" style={{ color: "#9CA3AF" }}>
            PathFinder is a career guidance tool. It supports your decision — it does not make it for you. All advice should be discussed with family, teachers, and counsellors.
          </p>
          <p className="text-xs" style={{ color: "#D1D5DB" }}>© {new Date().getFullYear()} PathFinder · Made for Kerala students</p>
        </div>
      </footer>
    </div>
  );
}
