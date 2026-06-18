#!/usr/bin/env bash
# Simulates a student who first says "I don't know", then "no", then "I like plants"
# and traces the profile + final recommendations.

set -e
BASE="http://localhost:3000"
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

divider() { echo -e "\n${CYAN}──────────────────────────────────────────${RESET}"; }

# ── 1. Create session ─────────────────────────────────────────────────────────
divider
echo -e "${BOLD}Step 1: Create session${RESET}"
SESSION_RESP=$(curl -s -X POST "$BASE/api/session" \
  -H 'content-type: application/json' \
  -d '{"language":"en"}')
SESSION_ID=$(echo "$SESSION_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['sessionId'])")
echo "Session ID: $SESSION_ID"

# ── 2. Onboard student (Science Bio, 70%, no specific idea) ───────────────────
divider
echo -e "${BOLD}Step 2: Onboarding (Science Bio student, 70%)${RESET}"
ONBOARD=$(curl -s -X POST "$BASE/api/onboarding" \
  -H 'content-type: application/json' \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"name\": \"Test Student\",
    \"phone\": \"9999999999\",
    \"age\": 17,
    \"district\": \"Thiruvananthapuram\",
    \"stream\": \"science_bio\",
    \"percentage\": 70,
    \"preferredLanguage\": \"en\",
    \"consentGiven\": true
  }")
echo "Onboarding: $ONBOARD"

# ── Helper: send a chat message and show AI's reply ──────────────────────────
chat_turn() {
  local STAGE="$1"
  local MSG="$2"
  local LABEL="$3"

  RESP=$(curl -s -X POST "$BASE/api/chat" \
    -H 'content-type: application/json' \
    -d "{\"sessionId\": \"$SESSION_ID\", \"stage\": \"$STAGE\", \"message\": $(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$MSG")}")

  echo -e "\n${YELLOW}Student [${LABEL}]:${RESET} $MSG"
  AI_Q=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('question','[no question]'))" 2>/dev/null || echo "[error parsing]")
  echo -e "${GREEN}AI:${RESET} $AI_Q"
}

# ── 3. Opening turn (no message → AI speaks first) ────────────────────────────
divider
echo -e "${BOLD}Step 3: Conversation (plants-interested student)${RESET}"
FIRST=$(curl -s -X POST "$BASE/api/chat" \
  -H 'content-type: application/json' \
  -d "{\"sessionId\": \"$SESSION_ID\", \"stage\": \"interests\"}")
FIRST_Q=$(echo "$FIRST" | python3 -c "import sys,json; print(json.load(sys.stdin).get('question','[no question]'))")
echo -e "\n${GREEN}AI (opening):${RESET} $FIRST_Q"

# ── 4. The scenario: unsure → no → likes plants ───────────────────────────────
chat_turn "interests" "I don't know" "turn 1 – unsure"
chat_turn "interests" "no" "turn 2 – no"
chat_turn "interests" "I like plants and nature a lot" "turn 3 – likes plants"

# Continue filling profile for other stages
chat_turn "academics" "Biology and Chemistry feel easy for me" "academics – strong subjects"
chat_turn "academics" "I prefer practical work like lab experiments" "academics – practical"
chat_turn "academics" "science subjects are my favourite" "academics – favourite"
chat_turn "personality" "I like working outdoors and with living things" "personality – work style"
chat_turn "personality" "I prefer figuring things out on my own, not following strict rules" "personality – independent"
chat_turn "personality" "I'm okay with risks if it's something I care about" "personality – risk"
chat_turn "aspiration" "I would like to study more, maybe a Masters" "aspiration – goal"
chat_turn "aspiration" "I want a job that lets me work with nature, maybe research" "aspiration – job type"
chat_turn "aspiration" "Something related to environment or agriculture or animals" "aspiration – sector"
chat_turn "constraints" "My family says study costs are fine, they can manage" "constraints – budget"
chat_turn "constraints" "I can move to another city if needed" "constraints – location"
chat_turn "constraints" "No specific family pressure, they want me to be happy" "constraints – family"
chat_turn "reflection" "I would not enjoy sitting in an office doing paperwork" "reflection – dislikes"
chat_turn "reflection" "I really love the idea of field work, observing nature" "reflection – likes fieldwork"
chat_turn "reflection" "That's everything I think" "reflection – done"

# ── 5. Show the built profile ─────────────────────────────────────────────────
divider
echo -e "${BOLD}Step 4: Profile built from conversation${RESET}"
PROFILE=$(curl -s "$BASE/api/profile?session=$SESSION_ID" 2>/dev/null || echo "{}")
echo "$PROFILE" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  p = d.get('profile', {})
  print('\nInterests:')
  for k,v in sorted((p.get('interests') or {}).items(), key=lambda x: -x[1]): print(f'  {k}: {v:.2f}')
  print('\nAptitude:')
  for k,v in sorted((p.get('aptitude') or {}).items(), key=lambda x: -x[1]): print(f'  {k}: {v:.0f}')
  print('\nPersonality:')
  for k,v in (p.get('personality') or {}).items(): print(f'  {k}: {v:.2f}')
  print('\nAcademic:')
  a = p.get('academic', {})
  print(f'  stream: {a.get(\"stream\")}  pct: {a.get(\"percentage\")}')
  print(f'  strong: {a.get(\"strongSubjects\")}')
  print('\nAspiration:')
  asp = p.get('aspiration', {})
  for k,v in asp.items(): print(f'  {k}: {v}')
  print('\nConstraints:')
  con = p.get('constraints', {})
  for k,v in con.items(): print(f'  {k}: {v}')
  print(f'\nCompleteness: {d.get(\"completeness\",\"?\")}%')
except Exception as e:
  print('Parse error:', e)
  print(sys.stdin.read())
" 2>/dev/null || echo "(profile endpoint not available — showing raw)"

# ── 6. Generate recommendation ────────────────────────────────────────────────
divider
echo -e "${BOLD}Step 5: Recommendations${RESET}"
REC=$(curl -s -X POST "$BASE/api/recommendation" \
  -H 'content-type: application/json' \
  -d "{\"sessionId\": \"$SESSION_ID\"}")

echo "$REC" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  if 'error' in d:
    print('ERROR:', d['error'])
    sys.exit(0)
  print(f'\nOverall confidence: {d.get(\"overallConfidence\",0)*100:.0f}%')
  print(f'\nTop careers:')
  for i,c in enumerate(d.get('top',[]),1):
    print(f'  {i}. {c[\"name\"]} — fit {c[\"fitScore\"]*100:.0f}%, confidence {c[\"confidence\"]*100:.0f}%')
    for f in c.get('factors',[])[:3]:
      print(f'     • {f[\"dimension\"]}: {f[\"contribution\"]*100:.1f}%  ({f[\"label\"]})')
  print()
  exp = d.get('explanation','')
  if exp:
    print('AI explanation:')
    print(exp)
  caveats = d.get('caveats',[])
  if caveats:
    print('\nCaveats:')
    for cv in caveats: print(' -', cv)
except Exception as e:
  print('Parse error:', e)
  print(d if isinstance(d,str) else json.dumps(d,indent=2)[:1000])
"

divider
echo -e "${BOLD}Done.${RESET}"
