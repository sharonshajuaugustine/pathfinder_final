# PathFinder — All Quiz Questions

Questions are asked in the order below. The engine skips or reorders some based on what it already knows (stream from intake, early confidence, etc.). Expect **10–14 questions** for a typical student.

---

## Phase 1 — Goals & Stream

These are always asked first, in this order.

### Q1 — Goal
> **What's your main plan after Plus Two?**

| Option | Value |
|--------|-------|
| Study a degree or diploma | higher_study |
| Get a job as soon as possible | job_soon |
| Start my own business / family business | business |
| Prepare for government / PSC exams | government |
| Not sure yet — show me all options | (neutral) |

---

### Q2 — Stated Career
> **Do you already have a career in mind? Type it below — or pick an option.**

Free text box (e.g. "CA, nurse, software engineer, pilot…")

| Option | Value |
|--------|-------|
| I have a rough idea but nothing specific | (neutral) |
| No idea yet — just exploring | (neutral) |

*Skipped automatically if the student already typed a career name in the free text.*

---

### Q3 — Stream *(skipped if stream was picked during intake)*
> **Which stream are you studying in Plus Two?**

| Option | Stream set |
|--------|------------|
| Science — Biology group (PCB / PCMB) | science_bio |
| Science — Maths group (PCM / PCMC) | science_maths |
| Commerce (Business Studies, Accountancy, Economics) | commerce |
| Humanities / Arts (English, History, Social Science) | humanities |
| Vocational / ITI / Open School | vocational |

---

### Q4 — Favourite Subjects *(multi-select — pick all that apply)*

One of the five variants below is shown, depending on the student's stream.

**Science Bio:**
> **Which subjects do you enjoy or do best in? Pick all that apply.**
> Biology · Chemistry · Physics · Mathematics · Computer Science

**Science Maths:**
> **Which subjects do you enjoy or do best in? Pick all that apply.**
> Mathematics · Physics · Chemistry · Computer Science · Biology

**Commerce:**
> **Which subjects do you enjoy or do best in? Pick all that apply.**
> Business Studies · Accountancy · Economics · Mathematics · Computer Science

**Humanities:**
> **Which subjects do you enjoy or do best in? Pick all that apply.**
> English / Literature · History / Political Science · Geography · Psychology / Sociology · Malayalam / Hindi / Second Language

**Vocational / ITI:**
> **Which area is your vocational / ITI course in? Pick all that apply.**
> Electronics / Electrical · Mechanical / Automobile · Beauty & Wellness / Fashion · Healthcare / Lab Technician · Hospitality / Catering / Tourism

---

## Phase 2 — Interest Questions *(adaptive, up to 8)*

The engine picks whichever of these is most useful next based on the student's current profile. Not all will be asked — only the ones that give the most new information.

### Interest — Technology & Coding
> **How do you feel about building apps, websites, or writing code?**

| Option | Signal |
|--------|--------|
| I love it — building digital things really excites me | technology_coding: high |
| It's okay, I can manage basic tools but it's not my passion | technology_coding: medium |
| Not for me — I'd rather do something hands-on or offline | technology_coding: low |

---

### Interest — Health & Medicine
> **If someone around you gets hurt or falls sick, how do you react?**

| Option | Signal |
|--------|--------|
| I stay calm and want to help — medical situations don't bother me | health_medicine: high |
| I try to help, but prefer someone else to take charge | health_medicine: medium |
| I'd rather step back — medical stuff makes me uncomfortable | health_medicine: low |

---

### Interest — Business & Money
> **If you and friends were running a small stall or project, which role fits you best?**

| Option | Signal |
|--------|--------|
| Managing the money, pricing, marketing — the business side | business_money: high |
| Helping with tasks, but not worried about profits | business_money: medium |
| I'd rather just do the creative or fun parts, not the business | business_money: low |

---

### Interest — Science & Research
> **When you hear about a scientific mystery or new discovery, what do you want to do?**

| Option | Signal |
|--------|--------|
| Dig into the data, form a hypothesis, figure out why it works | science_research: high |
| Read the summary — interesting, but I don't need the details | science_research: medium |
| I'm fine not knowing; science details don't interest me | science_research: low |

---

### Interest — Design & Visual
> **When you see a poster, room layout, or website design, what do you notice?**

| Option | Signal |
|--------|--------|
| I immediately think about colours, composition, and how to improve it | design_visual: high |
| I appreciate good design but don't feel the urge to create | design_visual: medium |
| I rarely notice — I only care if something works | design_visual: low |

---

### Interest — Helping & Teaching
> **A friend struggles with a topic you understand well. What do you do?**

| Option | Signal |
|--------|--------|
| I sit with them and patiently explain until they get it | helping_teaching: high |
| I give a quick answer or point them to a resource, then move on | helping_teaching: medium |
| I'd help if I had to, but explaining things isn't really my thing | helping_teaching: low |

---

### Interest — Law & Justice
> **When you see an unfair rule or a dispute, what's your instinct?**

| Option | Signal |
|--------|--------|
| Study the rules, build an argument, and stand up for what's right | law_justice: high |
| Try to settle things peacefully, but avoid debates | law_justice: medium |
| Stay out of it — arguments and rules drain me | law_justice: low |

---

### Interest — Building & Engineering
> **A new appliance arrives and needs assembling. What do you do?**

| Option | Signal |
|--------|--------|
| Grab the tools and start — I'm curious about how it all fits together | building_engineering: high |
| Follow the manual step by step, but only if I have to | building_engineering: medium |
| Call someone else — I'd rather not deal with it | building_engineering: low |

---

### Interest — Media & Communication
> **If you had to share a message with a large audience, how would you do it?**

| Option | Signal |
|--------|--------|
| Write an article, record a video, or make a podcast — I enjoy creating content | media_communication: high |
| Post something quick on social media or just talk to them directly | media_communication: medium |
| I'd avoid it — being in the spotlight or creating content isn't for me | media_communication: low |

---

### Interest — Nature & Agriculture
> **How do you feel about spending a day working outdoors on a farm or in nature?**

| Option | Signal |
|--------|--------|
| I'd love it — working with plants, animals, or soil is satisfying | nature_agriculture: high |
| I enjoy nature as a hobby but wouldn't want it as work | nature_agriculture: medium |
| I prefer indoors — outdoor physical work isn't for me | nature_agriculture: low |

---

### Interest — Defence & Adventure
> **What kind of weekend activity excites you most?**

| Option | Signal |
|--------|--------|
| Trekking, martial arts, sports, or any physically challenging outdoor activity | defence_adventure: high |
| A casual walk or light sport with friends | defence_adventure: medium |
| Staying home — relaxing, gaming, or reading | defence_adventure: low |

---

### Interest — Numbers & Analysis
> **Someone hands you a messy table of numbers or a logic puzzle. Your reaction?**

| Option | Signal |
|--------|--------|
| Excited — I want to find the pattern and solve it | numbers_analysis: high |
| I'll glance at the summary, but won't dig into the raw numbers | numbers_analysis: medium |
| I'd close it — numbers and data aren't my thing | numbers_analysis: low |

---

## Phase 3 — Domain Drills *(only fired when one interest scores ≥ 70%)*

If the student scores highly in a specific interest cluster, one follow-up drill question is asked to narrow down within that domain. Only the relevant drill fires — not all five.

### Drill — Business
> **You enjoy the business side — which part appeals to you most?**

| Option | What it refines |
|--------|----------------|
| Sales, marketing, or building a brand | → media_communication boost |
| Finance, investments, or managing money | → numbers_analysis boost |
| Running operations and managing teams | → helping_teaching boost |
| Starting something new / entrepreneurship | → risk_taking boost |

---

### Drill — Health
> **You're interested in health — what draws you to it most?**

| Option | What it refines |
|--------|----------------|
| Treating patients — doctor, nurse, or paramedic | → patient_care signal |
| Lab work, diagnosis, or medical testing | → science_research boost |
| Mental health, counselling, or psychology | → helping_teaching boost |
| Healthcare management or hospital admin | → business_money boost |

---

### Drill — Technology
> **You enjoy tech — which area excites you most?**

| Option | What it refines |
|--------|----------------|
| Building apps, websites, or software | → technology_coding: very high |
| Hardware, electronics, or networking | → building_engineering boost |
| Data, AI, or machine learning | → numbers_analysis + science_research |
| IT support, systems, or computer repair | → technology_coding + building_engineering |

---

### Drill — Science
> **You enjoy science — which direction pulls you most?**

| Option | What it refines |
|--------|----------------|
| Lab experiments, chemistry, or biology | → health_medicine + science_research (lab path) |
| Maths, physics, or theoretical concepts | → numbers_analysis + science_research (physics path) |
| Environment, ecology, or field research | → nature_agriculture + science_research |
| Data, computing, or applied R&D | → numbers_analysis + technology_coding + science_research |

---

### Drill — Design
> **You have an eye for design — what kind of work excites you?**

| Option | What it refines |
|--------|----------------|
| Graphic design, branding, or visual content | → media_communication signal |
| Interior design, architecture, or spaces | → building_engineering boost |
| Fashion, jewellery, or product design | → design_visual: very high |
| Events, weddings, or experience design | → business_money + helping_teaching |

---

## Phase 4 — Personality (always asked)

### P1 — Social Style
> **In a group project or social situation, where do you naturally fit?**

| Option | Signal |
|--------|--------|
| Taking charge, talking, bouncing ideas — I'm energised by people | social: high |
| I can do both — team time and quiet solo work | social: neutral |
| I do my best work alone in a quiet space | social: low |

---

### P2 — Learning Style
> **When you learn something new, what works best for you?**

| Option | Signal |
|--------|--------|
| Doing it — hands-on, building, or practising in real life | practical: high |
| A mix — some theory, then trying it out | practical: neutral |
| Understanding concepts and thinking it through first | practical: low |

---

## Phase 5 — Aptitude *(adaptive, up to 3, skipped if confidence is already high)*

### Aptitude — Numerical
> **Splitting a bill or calculating a discount in your head — how does that feel?**

| Option | Score |
|--------|-------|
| Easy — I do it in seconds without thinking | 85 |
| I can manage, but I usually double-check with a calculator | 55 |
| I'd rather let someone else handle the numbers | 25 |

---

### Aptitude — Logical
> **When something breaks or you hit a tricky puzzle, what do you do?**

| Option | Score |
|--------|-------|
| I enjoy breaking it down step by step until I find the answer | 85 |
| I give it a try, but move on if it takes too long | 55 |
| I'd rather hand it to someone else | 25 |

---

### Aptitude — Verbal
> **How comfortable are you writing a message, reading long passages, or expressing ideas?**

| Option | Score |
|--------|-------|
| Very comfortable — I write clearly and express myself well | 85 |
| Fine enough, but writing does take me some effort | 55 |
| I struggle to put thoughts into words or read long texts | 25 |

---

### Aptitude — Spatial
> **Someone gives you directions verbally — left at the signal, then second right. What happens?**

| Option | Score |
|--------|-------|
| I picture it instantly and could sketch the route | 85 |
| I follow along okay, but need to hear it again to be sure | 55 |
| I get confused — I need a map or to see it in person | 25 |

---

### Aptitude — Scientific
> **When someone explains how something works — like an engine or a plant's growth — what do you do?**

| Option | Score |
|--------|-------|
| I grasp it quickly and want to know why it works that way | 85 |
| I get the basic idea but don't wonder about the details | 55 |
| I find these explanations hard to follow | 25 |

---

## Phase 6 — Practical Constraints (always asked)

### C1 — Budget
> **Can your family manage private college fees if needed?**

| Option | Value |
|--------|-------|
| Yes — fees aren't a concern | no_constraint |
| Up to around ₹1 lakh per year is okay | medium |
| We need very low-cost or government college options | low |

---

### C2 — Location
> **Are you open to studying outside Kerala?**

| Option | Value |
|--------|-------|
| I'd prefer to stay in Kerala | kerala |
| Anywhere in India is fine | india |
| Gulf / Middle East is an option for me | gulf |
| Open to anywhere including abroad | abroad |

---

## Phase 7 — Hobbies & Risk *(fallback / optional)*

### Hobbies *(injected if student gave no clear interest signal after 3 questions, OR asked near the end if not yet covered)*
> **Outside school, what do you enjoy doing most?**

| Option | Interest cluster seeded |
|--------|------------------------|
| Sports, gym, or outdoor activities | defence_adventure |
| Drawing, design, music, or making art | design_visual |
| Coding, gaming, or fixing tech devices | technology_coding |
| Helping people, volunteering, or tutoring | helping_teaching |
| Writing, videos, photography, or social media | media_communication |
| Gardening, animals, or spending time in nature | nature_agriculture |
| Reading, science projects, or experimenting | science_research |
| Business ideas, events, or organising things | business_money |

---

### Risk Appetite *(only asked if engine is still undecided at the end)*
> **When starting something new with uncertain outcomes, how do you feel?**

| Option | Signal |
|--------|--------|
| Excited — I like taking big bets for big rewards | risk_taking: high |
| Open to some risk, but I want a safety net | risk_taking: neutral |
| I prefer a clear, stable, well-planned path | risk_taking: low |

---

## Summary

| Phase | Questions | Always? |
|-------|-----------|---------|
| Goal + Stated career | 2 | ✅ Yes |
| Stream | 1 | Only if not set during intake |
| Favourite subjects | 1 (multi-select) | ✅ Yes |
| Interest questions | 1–8 (adaptive) | Until confident |
| Domain drills | 0–1 per domain | Only if interest ≥ 70% |
| Personality | 2 | ✅ Yes |
| Aptitude | 0–3 (adaptive) | Skipped if already confident |
| Budget + Location | 2 | ✅ Yes |
| Hobbies | 1 | If stuck, or near end |
| Risk | 1 | Only if still undecided |
| **Total** | **~10–14** | |
