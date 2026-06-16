# PathFinder — AI Career Guidance Platform (Kerala / India)

Production MVP for guiding Plus Two students to suitable careers and courses.
A guided AI conversation builds a structured profile; a **deterministic scoring +
recommendation engine** makes the final decision; the AI only interviews,
extracts, reviews, and explains. A **verified knowledge base** is the source of
all facts.

> **Architecture rule:** AI = interviewer + extractor + reviewer + explainer.
> Scoring engine + recommendation engine = final decision-makers.
> Knowledge base = source of facts. The AI never invents a career/course/fee/exam.

## Stack

- **Next.js (App Router) + TypeScript** — full-stack (UI + API routes)
- **Tailwind CSS + shadcn/ui** — styling (lightweight primitives included)
- **Supabase PostgreSQL** — data, accessed via **service role only on the server**
- **Groq Llama 3.3 70B Versatile** — the AI model (server-only)
- **Vercel** — deployment target

## Project structure

```
supabase/
  migrations/        0001 core student tables · 0002 knowledge base · 0003 admin/audit · 0004 RLS
  seed/              0001_seed_kb.sql  (15 domains + 6 starter careers, runnable)
src/
  app/
    page.tsx                 landing
    onboarding/page.tsx      onboarding form (collects PII + consent, minors -> guardian)
    chat/page.tsx            guided conversation (functional placeholder)
    result/page.tsx          recommendation report (functional placeholder)
    admin/page.tsx           admin dashboard (placeholder)
    api/
      session/route.ts         POST create anonymous session
      onboarding/route.ts      POST save onboarding PII (server, validated)
      chat/route.ts            POST save message + extract + next question
      assessment/route.ts      POST save aptitude/personality item
      profile/route.ts         GET/POST read & merge profile
      recommendation/route.ts  POST run engine + AI explanation
  core/
    profile-builder.ts       deterministic profile merge + completeness
    scoring-engine.ts        eligibility hard-filter + weighted scoring
    recommendation-engine.ts orchestrates final recommendations
    confidence.ts            confidence calculator (separate from fit)
    conflict-detection.ts    interest vs aptitude/marks conflict flags
    ai.ts                    AI interviewer / extractor / explainer (Groq)
    kb-version.ts            current KB version
  lib/
    supabase/{client,server,admin}.ts   browser / server / service-role clients
    groq.ts                  server-only Groq wrapper (chat + JSON extraction)
    kb-loader.ts             loads KB snapshot from Supabase (cached)
    rate-limit.ts            in-memory limiter PLACEHOLDER (swap for Redis later)
    request.ts               rate-limit + ip-hash helpers for routes
    audit.ts                 append-only audit logging
    env.ts                   validated env access (public vs server-only)
    utils.ts                 cn(), hashIdentifier(), clamp()
  types/                     onboarding · profile · kb · recommendation
  data/seed/README.md        how to complete the full ~40-career KB
```

## Local setup

### 1. Install
```bash
npm install
```

### 2. Supabase
- Create a project at supabase.com.
- In the SQL editor, run the migrations **in order**:
  `0001 → 0002 → 0003 → 0004`, then the seed `supabase/seed/0001_seed_kb.sql`.
  (Or use the Supabase CLI: `supabase db push`.)
- Use the **Connection Pooling** (transaction mode, port 6543) string for
  `DATABASE_URL`.

### 3. Environment
```bash
cp .env.example .env.local
```
Fill in:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only — never exposed to client)
- `GROQ_API_KEY` (server-only), `GROQ_MODEL=llama-3.3-70b-versatile`
- `KB_VERSION=1`

### 4. Run
```bash
npm run dev          # http://localhost:3000
npm run typecheck    # type safety
npm run lint
```

### Try the flow
Landing → Onboarding (try age < 18 to see guardian consent) → Chat (answer a few
questions) → Result (engine-decided recommendations with confidence + explanation).

## Security & privacy (built in)

- Service-role key + Groq key are **server-only** (`server-only` import guards).
- All PII writes go through server routes; **RLS** is default-deny with a public
  read only on KB catalog tables and staff-read on student data.
- IPs are **hashed**, never stored raw. `audit_log` records sensitive actions.
- Minors (age < 18) require **guardian consent** (DPDP). Consent is timestamped
  and versioned.
- Every AI/PII route is **rate-limited** from day one (placeholder limiter).

## Known MVP placeholders (deliberate)

- **Rate limiter is in-memory** — does not span serverless instances. Swap
  `MemoryLimiter` for a Redis (Upstash) implementation behind the same interface.
- **Phone is not yet OTP-verified** — add OTP + captcha before public launch.
- **Chat orchestration is client-side** with simple stage pacing — move to a
  server-driven state machine when hardening.
- **KB is a starter seed** (6 careers) — complete to ~40 per `src/data/seed/README.md`.
- **Admin dashboard is a stub** — build secure login (Supabase Auth + RBAC) + views.
- **No RAG, no frontier-model fallback yet** — both are post-MVP per the plan.

## Deploy (Vercel)

Push to a Git repo, import into Vercel, set the same env vars in the Vercel
project (mark `SUPABASE_SERVICE_ROLE_KEY` and `GROQ_API_KEY` as sensitive).
Frontend + API routes deploy together.
