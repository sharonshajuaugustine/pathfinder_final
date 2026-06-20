# PathFinder — Student End-to-End Flow

Complete walkthrough of every step a student goes through from landing on the site to leaving with their career report. Includes what happens on the screen, what the server does behind the scenes, and what gets written to the database at each point.

---

## Overview

The journey has **3 main phases** shown as a progress bar throughout the app:

```
Your details  →  Conversation  →  Your report
(Onboarding)     (Chat + Quiz)     (Result)
```

There is also a **Phase 0** (session creation) that happens invisibly before the student fills in any details.

---

## Phase 0 — Session Creation (invisible to the student)

**When:** The moment the student opens `/onboarding`

**What the student sees:** The onboarding form loading on screen.

**What happens behind the scenes:**

1. The page's `useEffect` fires immediately on load and calls `POST /api/session` with an empty body.
2. The server:
   - Hashes the student's IP address (`clientIpHash`) — this hash is used for rate limiting, never stored as raw IP.
   - Checks the rate limit (`limiters.write`) to prevent spam.
   - Creates a new row in the `sessions` table with:
     - `status: "started"`
     - `language: "en"`
     - `user_agent` from request headers
     - `ip_hash`
   - Writes an audit log entry: `session.create`
   - Returns a UUID `sessionId`
3. The page stores this `sessionId` in React state. The Continue button is disabled until this UUID arrives.

**Database after Phase 0:**

| Table | What was written |
|---|---|
| `sessions` | 1 new row — `status: "started"` |
| `audit_log` | 1 entry — `session.create` |

---

## Phase 1 — Onboarding Form (Step 1 of 3)

**URL:** `/onboarding`

**What the student sees:**
A form with the following fields:

| Field | Type | Validation |
|---|---|---|
| Full name | Text | min 2 characters, required |
| Phone number | Number | must match `[6-9][0-9]{9}` (Indian mobile format) |
| Age | Number | 14–30, required |
| Email | Email | standard email format, required |
| District | Dropdown | list of all Kerala districts |
| Plus Two stream | Dropdown | Science (Bio), Science (Maths), Science (CS), Commerce, Humanities / Arts |
| Percentage | Number | 0–100 (decimal allowed), required |
| Consent checkbox | Checkbox | must be ticked — consent to process data for career guidance |

**What happens when the student clicks "Continue to the conversation →":**

1. The form reads all fields using `FormData` (autofill-safe).
2. Sends `POST /api/onboarding` with all fields + the `sessionId` from Phase 0.
3. The server:
   - Validates the payload against `onboardingSchema` (Zod). Returns 400 if invalid.
   - Checks rate limit for this IP.
   - Writes PII to the `leads` table:
     - name, phone, email, age, district, stream, percentage
     - `is_minor: age < 18`
     - `consent_given: true`, `consent_at: timestamp`
     - `preferred_language: "en"`
   - Updates `sessions`: sets `lead_id`, advances `status` to `"onboarded"`.
   - Seeds `student_profiles` with the academic baseline:
     ```json
     { "academic": { "stream": "...", "percentage": 85, "strongSubjects": [], "weakSubjects": [] } }
     ```
   - Computes initial `completeness_pct` (will be very low — only stream and percentage are known).
   - Writes audit log: `onboarding.submit`
4. On success, the browser navigates to `/chat?session=<sessionId>`.

**Database after Phase 1:**

| Table | What was written |
|---|---|
| `leads` | 1 new row with full PII + consent |
| `sessions` | Updated — `lead_id` linked, `status: "onboarded"` |
| `student_profiles` | 1 new row — stream + percentage only |
| `audit_log` | 1 entry — `onboarding.submit` |

---

## Phase 2A — AI Conversation (Step 2 of 3, Chat Phase)

**URL:** `/chat?session=<sessionId>`

### First Load — Opening Question

1. The chat page reads `?session=` from the URL.
2. A `useEffect` fires once on mount and calls `POST /api/chat` with `{ sessionId, stage: "interests", message: undefined }` — no student message yet.
3. The server generates the first question without any student input and returns it.
4. The first question appears in the chat bubble from "P" (PathFinder).

### The Stage System (client-side only)

The client tracks 3 stages that rotate as the conversation progresses:

| Stage | Label shown to student | Turns |
|---|---|---|
| `interests` | Your direction | turns 1–4 |
| `aspiration` | Your goals | turns 5–8 |
| `constraints` | Practicalities | turns 9–12 |

The stage rotates every 4 student turns. This is purely a **hint** sent to the AI to shift its topical focus — the server's gap state machine is the true decision-maker about what to ask.

### The Gap State Machine (server-side)

The server tracks 8 profile dimensions ("gaps") in priority order. Each gap has state: `{ asks, fails, permissionAsked, permissionGranted }`.

| Gap | What it captures | Type |
|---|---|---|
| `subjects` | Strongest school subjects | Core |
| `interest` | Domain interest clusters (nature, tech, medicine, etc.) | Core |
| `goal` | Goal after school (study / job / govt / business) | Core |
| `priorities` | What matters most in a career (salary, passion, etc.) | Soft |
| `budget` | Whether study cost is a concern | Soft |
| `location` | Willingness to move to study | Soft |
| `family` | Family expectations / involvement | Soft |
| `workstyle` | Preferred way of working (people / solo / outdoors) | Soft |

**Core gaps** (subjects, interest, goal): The AI keeps asking with different-angle follow-up questions until the student provides a clear answer. After 5 vague answers, the AI asks for permission to move on.

**Soft gaps** (priorities, budget, location, family, workstyle): After 3 vague answers, the server silently skips the gap and moves to the next one.

### A Single Conversation Turn — Detailed Breakdown

Each time the student sends a message, the following happens:

**Step 1 — Student sends a message**

The client sends `POST /api/chat`:
```json
{ "sessionId": "...", "stage": "interests", "message": "I like biology", "isChoice": false }
```

If the student clicked a choice button instead of typing: `"isChoice": true`

**Step 2 — Save the student's message**

The server writes the student's message to `conversations` (role: "user").

**Step 3 — Load the previous AI question**

The server fetches the last assistant message from `conversations` — this becomes the `precedingQuestion` context for extraction.

**Step 4 — Load the previous profile**

The server reads `student_profiles` for this session. The profile also contains hidden bookkeeping fields: `_gapState`, `_lastGap`, `_askingPermission`.

**Step 5 — Decide if this is a permission button**

If `_askingPermission` was true last turn AND the student clicked "Let's move on" or "Keep exploring this" — this is a permission response. Skip LLM extraction entirely. Handle it in the gap state machine directly.

**Step 6 — Extract profile signals**

If the student clicked a **choice button** (`isChoice: true`): look up the answer in `directDeltaFromChoice` — a hard-coded mapping table that converts ~80 known button labels into profile deltas without any AI call. Examples:
- "Biology" → `{ academic: { strongSubjects: ["Biology"] } }`
- "Technology / computers" → `{ interests: { technology_coding: 0.7 } }`
- "Study further (BTech / BSc / degree)" → `{ aspiration: { goalOrientation: "higher_study" } }`

If the label is not in the table (or if the student typed a free-text answer): call the **LLM extractor** (`extractProfileDelta`) — sends the student's reply + the preceding question to Groq Llama 3.3 70B, which returns a structured JSON profile delta. Falls back to Llama 3.1 8B Instant if the primary model is rate-limited.

**Step 7 — Merge profile**

The extracted delta is merged into the existing profile using `mergeProfile`. Arrays are appended, numeric interest/aptitude/personality values are averaged. `filledThisTurn` = true if the total number of captured dimensions increased.

**Step 8 — Update gap state**

For the gap that was being targeted last turn (`_lastGap`):
- Increment `asks` by 1.
- Increment `fails` by 1 only if nothing was filled this turn AND this was not a permission turn.
- If this was a permission turn: set `permissionAsked = true`, and if the student said "Let's move on" set `permissionGranted = true`.

**Step 9 — Check for inferred interest from stated career**

If the student named a specific career (e.g. "I want to be a doctor") but no interest cluster was captured yet, `inferInterestFromCareer` maps the career name to the closest cluster (e.g. "doctor" → `health_medicine: 0.7`) and persists it.

**Step 10 — Compute interest phase**

The interest gap has two phases:
- Phase 1 (first interest question): stream-tailored activity choices (e.g. for Science Bio: "Conducting lab experiments", "Treating patients" etc.)
- Phase 2+ (second interest question onward): cross-domain "drawn to" choices (Technology / computers, Medicine / healthcare, etc.)

Phase is determined by `gapState["interest"].asks` after the current update.

**Step 11 — Determine the next gap to ask about**

Filter `GAP_IDS` to find `askableGaps`:
- Remove any gap already captured.
- For core gaps: only remove if `permissionGranted = true`.
- For soft gaps: remove if `fails >= 3`.

`topGapId` = first remaining gap.

**Step 12 — Check if permission question is needed**

`shouldAskPermission = true` if:
- `topGapId` is a core gap
- Not yet captured
- `fails >= 5`
- Permission not yet asked for this gap

If yes: return a **hardcoded** permission question ("That's completely fine — it's a big decision! Should we keep exploring this, or move on for now?") with choices ["Keep exploring this", "Let's move on"]. No LLM involved.

**Step 13 — Check stop condition**

The conversation ends when any of these is true:
- All 3 core gaps + priorities + family captured AND total captured ≥ 5
- All 3 core gaps + priorities captured AND student has answered ≥ 8 questions
- No askable gaps remain
- Student has answered 14 questions (hard ceiling)

If done: update `sessions` status to `"in_chat"`, return `{ done: true }`. The client moves to the assessment phase.

**Step 14 — Determine if this is a follow-up question**

`isFollowUp = true` if:
- Student answered this turn
- The previous turn was also targeting the same gap (`_lastGap === topGapId`)
- That gap is still uncaptured
- This was not a permission turn

If `isFollowUp = true`, the AI prompt tells it to try a completely different angle — not rephrase the same question.

**Step 15 — Generate the next question (LLM call)**

`nextQuestion` is called with full context:
- Student's stream, percentage, stated career, known goal, known interests, known subjects
- `remainingGaps` — what still needs to be asked
- `followUp` flag — whether to build on what the student just said
- Last 20 messages of conversation history
- Current stage

The AI generates a question + 2–4 choice buttons. Primary model: Groq Llama 3.3 70B. Fallback: Groq Llama 3.1 8B Instant.

**Exception:** If `topGapId === "interest"`, the choice buttons are **overridden** by the curated pinned interest set (stream-tailored activities or cross-domain drawn-to choices) — the AI's generated buttons are discarded to ensure consistency.

**Step 16 — Persist everything**

- Save the AI question to `conversations` (role: "assistant") with model name, prompt tokens, output tokens.
- Update `student_profiles` with new merged profile, updated `_gapState`, `_lastGap`, `_askingPermission`, and new `completeness_pct`.
- Update `sessions` status to `"in_chat"`.
- Return `{ question, choices, gapId, done: false }` to the client.

**Database after each turn:**

| Table | What was written |
|---|---|
| `conversations` | 1 user row + 1 assistant row per turn |
| `student_profiles` | Updated profile JSON + completeness_pct |
| `sessions` | `status: "in_chat"` |

### What the student sees during the conversation

- AI question appears in a white bubble with a "P" avatar.
- Choice buttons (if any) appear as 2-column grid below the input.
- Student can click a button OR type their own answer in the text field.
- A typing indicator (three bouncing dots) appears while the server is processing.
- If the AI is rate-limited (429): "The AI is busy right now. Please wait a moment and try again."
- A 3-segment progress bar (Your direction / Your goals / Practicalities) advances every 4 turns.
- Hard maximum: 14 questions. After that the conversation ends automatically.

---

## Phase 2B — Aptitude Check (Step 2 of 3, Assessment Phase)

**What triggers it:** The server returns `{ done: true }` from the chat phase.

**What happens on the client:**
1. `serverDone` state is set to true.
2. The chat input and choice buttons disappear.
3. A `useEffect` watching `chatDone` fires and calls `GET /api/assessment`.
4. The server returns all 10 questions with their choices but **no signals or answer key** (those are server-only).
5. The assessment panel appears at the bottom of the screen. The progress bar changes to "Aptitude check · 1 of 10".

### The 10 Questions

**5 Aptitude questions** (right/wrong, scored 0 or 100):

| # | Dimension | What it tests |
|---|---|---|
| 1 | Numerical | Percentage calculation (compound discount) |
| 2 | Logical | Deductive reasoning (syllogism with invented words) |
| 3 | Verbal | Vocabulary / antonym |
| 4 | Spatial | Paper-folding / visualisation |
| 5 | Scientific | Physics concept (free fall in vacuum) |

**5 Interest/Personality questions** (no right answer — scenario-based):

| # | Scenario | What it captures |
|---|---|---|
| 6 | "Which activity helps you relax AND feel productive?" | Interest cluster + personality trait |
| 7 | "A friend needs help — where do you feel most useful?" | Interest cluster + personality trait |
| 8 | "You have ₹10,000 to learn something. What do you choose?" | Interest cluster + RIASEC type |
| 9 | "Whose real-life story would you most enjoy reading?" | Interest cluster + RIASEC type |
| 10 | "Which volunteering project feels most meaningful?" | Interest cluster + personality trait |

### What happens when the student answers each question

`POST /api/assessment` is called with `{ sessionId, itemId, choiceId }`.

The server:
1. Checks the rate limit.
2. Looks up the item and choice in the server-side answer bank (`ASSESSMENT_ITEMS`).
3. For aptitude questions: extracts the score (0 or 100) from the choice's signals.
4. For personality questions: score is null — only interest/trait/RIASEC signals matter.
5. Deletes any previous answer for this item (safe to re-answer).
6. Inserts the response into `assessment_responses`.
7. Fetches **all** responses for this session so far.
8. Runs `computeAssessmentDelta` on all responses:
   - Aptitude: averages all scores per dimension → produces a 0–100 value per aptitude type.
   - Personality: averages trait values per trait.
   - Interest: averages interest cluster values.
   - RIASEC: averages RIASEC type values.
9. Merges the computed delta into the existing `student_profiles` record.
10. Updates `completeness_pct`.
11. Advances `sessions` status to `"assessment"` (only if it was `"in_chat"` — can't go backwards).

The client advances to the next question immediately without waiting for the server response (non-blocking). If a server call fails, the question still advances — assessment answers are best-effort.

When all 10 questions are answered: `assessmentDone = true`.

**Database after Phase 2B:**

| Table | What was written |
|---|---|
| `assessment_responses` | Up to 10 rows (one per question, idempotent) |
| `student_profiles` | Profile updated with aptitude, personality, interest signals from assessment |
| `sessions` | `status: "assessment"` |

### What the student sees

- One question at a time at the bottom of the screen.
- 4 choice buttons stacked vertically (full width).
- Progress bar fills as questions are answered.
- Questions advance immediately on click.
- After question 10: "Great — we have everything we need to build your personalised report." + "See my career recommendations →" button.

---

## Phase 3 — Result Page (Step 3 of 3)

**URL:** `/result?session=<sessionId>`

**What triggers it:** Student clicks "See my career recommendations →" button.

### Generation

1. Client calls `POST /api/recommendation` with `{ sessionId }`.
2. Server checks for a **cached recommendation** first. If one exists (e.g. student refreshed the page), return it immediately without re-running the engine.
3. If no cache: check rate limit.
4. Load the student profile from `student_profiles`. Run `normalizeProfile` (fills any missing fields with safe defaults) and `applyDerivedAptitude` (fills aptitude from subjects/stream for older profiles).
5. Check completeness gate: if `completeness_pct < 30`, return error — "Please complete the conversation and quick quiz before viewing your recommendations." This blocks students who somehow bypassed the chat.

### Scoring (deterministic, no AI)

`generateRecommendations` runs against all published careers in the knowledge base:

**For every career:**

1. **Eligibility filter** — Check if the student's stream matches the career's required streams. If not: skip for primary route courses (still show as fallback). Check minimum percentage — if below threshold: mark course as "conditional" (not rejected).

2. **Soft scoring across 6 dimensions:**

| Dimension | Weight | What it uses |
|---|---|---|
| Interest | 30% | Student's interest cluster values vs career's interest signals |
| Aptitude | 25% | Student's aptitude scores (0–100, normalized to 0–1) vs career's aptitude signals |
| Academic | 15% | Student's strong subjects vs career domain's expected subjects |
| Personality | 10% | Student's personality traits vs career's personality_fit tags |
| Aspiration | 10% | Student's goal orientation vs career's study requirements and risk level |
| Constraint | 10% | Student's budget band and time-to-income need vs career's cost/duration profile |

**Important:** If a dimension has no data (e.g. aptitude was not measured), it is **excluded from the weighted average entirely** — not counted as 0. The remaining dimensions are renormalized to 100% so missing data doesn't drag all scores down.

3. **Fit score** = weighted average of measured dimensions (0–1 scale, 4 decimal places).

All careers are sorted by fit score descending. Top 5 are returned.

### Confidence Calculation

A separate confidence score answers "how much should the student trust this ranking?":

```
base = 0.45 × (completeness%) + 0.30 × (top fit score) + 0.25 × (gap between #1 and #2 score)
final = base − conflict penalties
```

Conflict penalties: high severity (−0.15), medium (−0.08), low (−0.03). Conflicts are things like goal and constraint contradicting each other (e.g. wants a fast job but chose a 6-year medical path).

Confidence thresholds:
- ≥ 75% → "High confidence" (green)
- ≥ 50% → "Good confidence" (amber)
- < 50% → "Moderate confidence" (orange)

### Course Resolution

For each top career, the system finds eligible courses from the knowledge base:

1. Filter `career_course` links for this career.
2. Sort by route type: primary → alternative → higher-study-route → fallback.
3. Check each course's eligibility rule against the student's stream and percentage.
4. For each eligible course, fetch linked entrance exams (NEET, JEE, KEAM etc.) with difficulty and requirement type.
5. "Ineligible" courses are only shown if they are the fallback route.

### Skills Roadmap

For each top career, fetch the `career_skills` list, sorted by `sort_order`. Each skill has a stage (foundation / intermediate / advanced) and resource type.

### Alternative Careers

For each top career, find 2 other careers from the **same domain** that also ranked highly — shown as "You might also consider."

### Out-of-KB Check

If the student named a specific career (e.g. "marine biologist") and that career name does not match any career in the knowledge base by distinctive keyword matching, a caveat is added: "You mentioned wanting to become a [career]. We couldn't build a full guided path for that specific career here — the paths below are the closest related options."

### AI Explanation

After the deterministic engine runs, the AI (`explainRecommendation`) writes a short paragraph explaining **why** these careers were recommended, using only the engine's output facts — it cannot change the ranking. This is best-effort: if the AI call fails, the report still displays without the explanation.

### Persistence

- Recommendation saved to `recommendations` table with `kb_version`, `results` JSON, `overall_confidence`, `explanation`.
- `sessions` status updated to `"completed"`.
- Audit log: `recommendation.generate`.

**Database after Phase 3:**

| Table | What was written |
|---|---|
| `recommendations` | 1 row with full results JSON |
| `sessions` | `status: "completed"` |
| `audit_log` | 1 entry — `recommendation.generate` |

### What the student sees on the result page

- "Your career report is ready" heading.
- Confidence badge (High / Good / Moderate) with percentage.
- Knowledge base version number.
- AI-written explanation paragraph (if available).
- Up to 5 career cards in order, each showing:
  - Rank badge (#1 Best fit / #2 Strong fit / #3 Good fit)
  - Career name and domain
  - Fit score percentage + coloured bar
  - Course routes (with eligibility status + entrance exams)
  - "Why this fits you" — the scoring factors that contributed most
  - Skill roadmap (foundation → intermediate → advanced)
  - "You might also consider" — 2 alternative careers in the same domain
- Caveats section (amber box) — completeness warnings, conflict flags, and always: "These are suggestions to discuss with a counsellor and your family — not a final decision."
- "What to do next?" section with advice to share the report with parents/counsellors.
- "← Back to home" link.

---

## Complete Session Status Lifecycle

```
started       ← Phase 0: session created on page load
    ↓
onboarded     ← Phase 1: onboarding form submitted
    ↓
in_chat       ← Phase 2A: first chat turn received
    ↓
assessment    ← Phase 2B: first assessment answer received
    ↓
completed     ← Phase 3: recommendation generated
```

---

## Complete Database Summary

| Table | Purpose | Written when |
|---|---|---|
| `sessions` | Session lifecycle and status | Phase 0 (create), Phases 1/2A/2B/3 (status updates) |
| `leads` | Student PII (name, phone, email, district, stream, percentage, consent) | Phase 1 |
| `student_profiles` | Evolving profile JSON (interests, subjects, aptitude, personality, goals, constraints, gap state) | Phase 1 (seed), Phase 2A (each turn), Phase 2B (each answer) |
| `conversations` | Full chat transcript (user + assistant messages with model metadata) | Phase 2A (each turn) |
| `assessment_responses` | Raw assessment answers (item_id, choiceId, score) | Phase 2B (each answer) |
| `recommendations` | Final results JSON with fit scores, courses, explanation | Phase 3 |
| `audit_log` | Security/compliance audit trail | Phases 0, 1, 3 |

---

## Rate Limits Summary

| Endpoint | Limiter | Who it protects against |
|---|---|---|
| `POST /api/session` | `limiters.write` | Bots creating thousands of sessions |
| `POST /api/onboarding` | `limiters.write` | Duplicate form submissions |
| `POST /api/chat` | `limiters.chat` | Per session + per IP — prevents chat spam |
| `POST /api/assessment` | `limiters.write` | Rapid-fire answer submission |
| `POST /api/recommendation` | `limiters.recommend` | Expensive AI call — rate limited unless cached |

All rate limits use both `sessionId` and hashed IP as keys. Hitting a limit returns HTTP 429.

---

## What the Student Can Do If Something Goes Wrong

| Problem | What happens |
|---|---|
| Slow internet | Chat shows "Something went wrong. Please try again." with a retry available |
| AI rate limit (Groq 429) | Automatically falls back to Llama 3.1 8B Instant on the same key |
| Both AI models unavailable | Error shown in chat: "The AI is busy right now." |
| Refreshes result page | Cached recommendation returned instantly — no re-generation |
| Tries to view result without completing chat | 422 error: "Please complete the conversation and quick quiz first" |
| Session ID missing from URL | Chat page shows "Missing session. Please start from onboarding." |
