# PathFinder — Pre-Launch Test Cases

End-to-end test plan for the recommendation engine before handing to real
Plus Two students. Every **expected value** below was produced by running the
actual engine (not estimated), so these double as regression checkpoints — if a
number drifts, something changed silently.

The engine is **deterministic**. Given the same profile + KB, it always returns
the same ranking. That means we can pin exact expected values.

Legend: `fit` = fitScore (0..1), `conf` = overallConfidence (0..1).

---

## 1) Same path, different aptitude scores

**Goal:** prove that aptitude actually moves the recommendation for a *fixed*
interest/path. A student who loves coding but can't reason logically must NOT
get the same Software Engineer fit as one who can.

Setup: identical everything except aptitude. Interest `technology_coding: 0.9`.
No subjects named (so aptitude comes purely from the quiz). Career =
`software_engineer`, whose signals weight `aptitude.logical` at 1.0 and
`aptitude.numerical` at 0.7.

| Case | logical | numerical | Expected SE fit | Why |
|------|---------|-----------|-----------------|-----|
| 1a. High aptitude | 90 | 90 | **0.7159** | Strong on the weighted aptitude dims |
| 1b. Low aptitude  | 20 | 20 | **0.3977** | ~45% drop vs 1a — aptitude is doing real work |

**Pass criteria**
- `0.7159 > 0.3977` (strictly). Aptitude must separate the two.
- Both cases: the `aptitude` factor appears in `factors[]` for SE.
- The gap (0.32) is large enough to flip ranking if another career competes.

### 1c. Aptitude masked by a strong subject (critical edge case)
Same as 1b (quiz says low aptitude) **but** the student named **Mathematics** as
a strong subject.

- Stored aptitude becomes `{ logical:80, numerical:85, spatial:70 }` — the
  subject-derived inference **wins via `Math.max`** and overwrites the low quiz
  score. This is intentional (per `profile-builder.ts`): for a Plus Two student,
  "strong in Maths" is more reliable than 5 MCQs.
- Expected SE fit: **0.6199** (recovers toward the high-aptitude case).

**Pass criteria**
- `0.6199 > 0.3977` (subject inference raises the score above the pure low-quiz
  case).
- `p.aptitude.numerical === 85` (observed 20 is NOT stored; Math.max keeps 85).
- Document/verify this behaviour is what you want before launch — it means a
  student who bombs the quiz but is strong in Maths still gets a fair tech fit.

### 1d. Low-aptitude student's ranking across careers
With `logical:20, numerical:20, interest technology_coding:0.9` and both SE and
Mechanical Engineer in the KB:

- Top order: **`Software Engineer:0.3977`, `Mechanical Engineer:0.0428`**.
- SE still wins (interest dominates), but its absolute fit is weak → confidence
  should be honest about that.

---

## 2) Different paths (stream/interest divergence)

**Goal:** the engine routes students to genuinely different careers based on
their dominant signal, not a one-size-fits-all list.

### 2a. Biology student → Medicine, not Tech
Profile: `interest health_medicine:0.9`, strong subjects `[Biology, Chemistry]`,
`aptitude.scientific:80`. KB has `doctor` + `software_engineer`.

- **Doctor fit: 0.8714**, Software Engineer fit: 0.0857.
- Top order: `Doctor:0.8714, Software Engineer:0.0857`.
- `overallConfidence: 0.619`, caveats: 2.

**Pass criteria**
- Doctor ranks #1 by a wide margin (>10x the runner-up).
- The `interest` + `aptitude.scientific` + `academic` (Biology/Chemistry) factors
  all surface for Doctor.
- `personalityFit` for Doctor (`social`) is *not* measured here → it must be
  floored at 0.5 (neutral), **not** zero out the personality dimension.

### 2b. Commerce student → CA, not Engineering
Profile: `interest business_money:0.9`, strong subjects `[Accountancy, Maths]`,
`aptitude.numerical:85`. Expect `chartered_accountant` top, `software_engineer`
and `mechanical_engineer` far below.

### 2c. Humanities student → Law
Profile: `interest law_justice:0.9`, strong subjects `[English, History]`,
`aptitude.verbal:85`. Expect `lawyer` top; `ballb` course eligible (humanities is
in `required_stream`); `clat` exam surfaced.

### 2d. Cross-pressure case (interest pulls one way, aptitude another)
Profile: `interest building_engineering:0.9` but `aptitude.numerical:30,
logical:30`. Expect:
- Mechanical/SE still rank on interest, but **conflict flag**
  `interest_vs_aptitude` (medium severity) must fire (`conflict-detection.ts`
  rule 2: tech/engineering interest > 0.8 with logical/numerical < 40).
- That flag lowers overall confidence and adds a caveat.

---

## 3) Data present vs not present in DB

The engine is written to be **robust to sparse data** — but sparse data must
produce *honest, low-confidence* output, not a confident wrong answer. These test
the DB ↔ engine boundary that breaks most often in practice.

### 3a. Full profile (everything present)
Stream + % + 3 interests + aptitude + goal + budget + location + subjects.

- `computeCompleteness` → **95**.
- Recommendation generated; `overallConfidence` in a healthy band (≥ 0.6).

### 3b. Minimal profile (stream only)
Just `stream: science_maths`. `computeCompleteness` → **23**.

- `/api/recommendation` must **reject with 422** ("complete the conversation and
  quiz first") because completeness < 30. **This guard must not be bypassed.**

### 3c. Profile with `null` / `{}` / malformed jsonb
Load `normalizeProfile(null)`, `normalizeProfile({})`, `normalizeProfile({
academic: null })`.

- Must return a full `StudentProfile` with every section present and
  arrays initialized — never throw `Cannot read property of undefined`.
- `computeCompleteness` on null → 0, no crash.

### 3d. KB table missing rows
- **No signals** for a career → its `weightedMatch` returns 0; fit is driven by
  academic/personality/aspiration neutrals. Career should still appear but low.
- **No courses linked** to a top career → `courses: []` in the recommendation;
  must not crash `resolveCourses`.
- **Course linked but eligibility rule absent** → `evaluateEligibility`
  returns `eligible` (rule undefined = no constraints). Verify this is intended.
- **Course references an exam not in KB** → exam name falls back to the id
  (`exam?.name ?? ce.examId`). Should render the id, not crash.

### 3e. Cached recommendation present (DB hit, no regeneration)
A row already exists in `recommendations` for the session.

- `/api/recommendation` returns the cached `results`/`explanation` **without**
  calling the engine or AI, and **without** consuming the rate limit. (The cache
  check runs *before* `enforceRateLimit` — verify React's double-render doesn't
  429.)
- `caveats` returns `[]` on cache hit (documented behaviour — they were already
  shown).

### 3f. Session/profile row absent
`/api/recommendation` with a random UUID that has no profile row.

- Should return 422 (completeness < 30) or a clean error — never a 500 from a
  null deref.

---

## 4) Other cases to test before end users

These are the failure modes that slip past "it works on my profile."

### 4a. Eligibility hard-filter (stream + marks)
Using `btech_cse` rule (stream `science_maths`/`science_cs`, 50% aggregate):

| Profile | Expected status | Notes |
|---------|-----------------|-------|
| science_maths, 88% | `eligible` | primary route shown |
| commerce, 88% | `ineligible` | primary route **skipped**; fallback (diploma) still shown |
| science_maths, 45% | `conditional` | note: `Needs ~50% (current 45%)` — NOT rejected |

**Pass criteria**
- `ineligible` primary courses are dropped from `courses[]` unless they are the
  `fallback` route (fallback survives even when ineligible — verify intended).
- `conditional` courses stay in the list with a human-readable note.

### 4b. Age gating
`evaluateEligibility` with `ageMin`/`ageMax`:
- Below `ageMin` → `ineligible`.
- Above `ageMax` → `ineligible`.
- Age undefined → age check skipped (no false reject). Verify the recommendation
  route passes `lead.age` through; if age is null, courses must still resolve.

### 4c. Minors & consent (DPDP compliance)
- Onboarding with age < 18 **must** require guardian consent before PII is saved.
- Age ≥ 18 proceeds without guardian flow.
- Consent is timestamped + versioned in the DB — verify the write.

### 4d. Confidence honesty
Construct profiles that should produce **low** confidence and assert it:
- **Near-tie:** two top careers within 0.02 fit → margin term collapses,
  confidence drops.
- **Thin profile:** completeness ~40 → confidence depressed by the
  `0.45 * completeness` term.
- **Conflict flags:** health interest + weak biology (high severity) subtracts
  0.15; tech interest + low numerical (medium) subtracts 0.08.
- Verify the result page actually *shows* the low confidence and caveats — not
  just computes them.

### 4e. Caveat content
- Completeness < 60 → "Profile is incomplete…" caveat.
- Confidence < 0.5 → "Treat these as options to explore…" caveat.
- Every result ends with the counsellor disclaimer caveat.
- Out-of-KB stated career (e.g. "pilot", "veterinarian") → a gap caveat is
  unshifted to the front naming the stated career + closest match. Verify the
  distinctive-word matcher doesn't false-positive on generic words like
  "engineer".

### 4f. Alternatives (adjacent careers)
`buildAlternatives` returns same-domain careers only.
- Doctor → alternatives from `medical`/`allied_health` (e.g. Nurse).
- If a career is the **only** one in its domain → `alternatives: []` (not a
  crash, not careers from another domain).

### 4g. Assessment scoring (quiz → aptitude)
- Correct aptitude answer (`apt_numerical` choice `a`) → dimension score 100.
- Wrong answer → 0.
- AI-generated aptitude items: generator returns a `correctId` field (any of
  a/b/c/d — not always "a"). Choices are shuffled before sending to client so
  position gives no hint. Scoring: `choiceId === correctId` → 100, else 0.
  Fallback 50 if `correctId` is missing (shouldn't happen).
- `_aiAssessmentItems` cache must survive every POST answer — verify `_name` and
  all `_*` metadata are preserved after each assessment answer (regression from
  the `mergeProfile` wipe bug fixed 21 Jun 2026).
- Retaking the same item: old response is deleted before insert (no duplicate
  accumulation).
- Personality/interest items: the selected choice's `interestCluster` is written
  at strength 0.7; invalid clusters are rejected.

### 4h. Derived aptitude invariants (`applyDerivedAptitude`)
- Strong "Mathematics" → infers `numerical≥80, logical≥80, spatial≥70`.
- An **observed** value is never lowered: pre-set `numerical:95` + Maths subject
  → stays 95.
- No subjects + known stream → falls back to `STREAM_APTITUDE` baselines.
- No subjects + no stream → aptitude stays empty (renormalized out of scoring,
  not scored 0).

### 4i. Profile merge accumulates (regression-prone)
- Two subject deltas → both present (`Biology` then `Chemistry` ⇒ both kept).
- `careerPriorities` accumulate across turns (not overwritten).
- `familyExpectations` accumulate.
- **Regression sentinel:** the historical "profile wipe" bug — merging a partial
  delta must never null out sections not in the delta.

### 4j. Renormalization over measured dimensions (the #1 accuracy invariant)
Profile with **only** `interest technology_coding:1.0` (no aptitude, no
academic, nothing else).

- SE fit must be **> 0.9**. Rationale: with only interest measured, it
  renormalizes to full weight. If this drops, someone scored the empty
  aptitude dimension as 0 and silently capped every career at ~0.75.

### 4k. Security / privacy guards
- Service-role key + Groq key are imported behind `server-only` — confirm no
  client bundle leak (grep the build output).
- Rate limits fire on `/api/assessment`, `/api/chat`, `/api/recommendation`
  after the threshold (in-memory limiter — per-instance, document the caveat).
- IPs are hashed, never stored raw; `audit_log` records recommendation
  generation.
- RLS: KB catalog tables publicly readable; student PII tables default-deny
  except staff-read.

### 4l. Determinism check
Run `generateRecommendations` twice on the same `(sessionId, profile, kb)`.
- Byte-identical `top[]` ordering and fitScores. Any difference = a bug
  (non-deterministic sort, floating point, or a Date/random leaking in).

### 4m. TopN boundary
- `topN: 5` with exactly 5 careers → 5 returned.
- `topN: 5` with 3 careers → 3 returned (no padding, no crash).
- `topN: 5` with 0 careers (empty KB) → `top: []`, confidence 0, graceful.

### 4n. Positional confidence decay
Per-career confidence = `overallConfidence * max(0.5, 1 - idx*0.08)`.
- Rank 0 → ×1.0, rank 1 → ×0.92, … floors at ×0.5. Verify monotonic decrease and
  the floor.

---

## How to run

- **Unit layer (fast, no DB):** `npm test` — covers profile-builder, scoring,
  assessment-scorer. Add cases 1a/1b/1c/2a/4j/4h here as pure-engine assertions
  (the `makeKb` fixture pattern is already in
  `src/core/__tests__/engine.test.ts`).
- **Engine probes (this doc's numbers):** small `tsx` scripts that import
  `scoreCareer` / `generateRecommendations` against a hand-built KB — fastest way
  to re-verify a specific fit score after a code change.
- **Integration layer (needs Supabase + Groq):** hit the live
  `/api/recommendation` with seeded sessions for 3a/3b/3e/3f/4c.
- **Regression gate before launch:** re-run every "Expected" value in this doc;
  any drift is a review item, not an auto-pass.
