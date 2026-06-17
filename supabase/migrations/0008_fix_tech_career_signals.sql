-- Migration 0008: Fix tech career signal weights and personality_fit tags.
-- Root cause audit (session d3003c68) identified 4 scoring problems:
--
-- (1) numbers_analysis co-signal dilutes technology_coding score:
--     software_engineer signals = [technology_coding:1.0, numbers_analysis:0.6]
--     A student who says "I love coding" but never mentions "data analysis" scores
--     only 0.625 instead of 1.0, while hotel_manager (which has no numbers_analysis
--     requirement) scores comparably on interest.
--
-- (2) software_engineer personality_fit=['analytical','structured'] is too strict:
--     students who code for practical/creative reasons (not pure analysis) get 0.5
--     even when they match structured perfectly. Practical builders code too.
--
-- (3) cybersecurity_analyst personality_fit=['analytical','structured'] same issue:
--     ethical hackers and security engineers are often hands-on practical problem-solvers.
--
-- (4) journalist personality_fit=['social','risk_taking'] is too broad:
--     any student with high risk_taking (e.g., entrepreneurial students) matches
--     journalist even when they have zero media interest from the chat.

-- Fix 1: Remove numbers_analysis from tech career interest signals.
delete from public.career_signal
  where career_id = 'software_engineer'
    and signal_type = 'interest'
    and signal_key = 'numbers_analysis';

delete from public.career_signal
  where career_id = 'cybersecurity_analyst'
    and signal_type = 'interest'
    and signal_key = 'numbers_analysis';

-- Fix 2: software_engineer personality_fit — replace analytical with practical.
-- Coders who build things are practical and structured, not necessarily 'analytical'
-- in the personality sense (which overlaps more with data scientist / researcher).
update public.careers
  set personality_fit = array['structured', 'practical']
  where id = 'software_engineer';

-- Fix 3: cybersecurity_analyst personality_fit — add practical alongside analytical.
-- Security work is hands-on problem-solving, not pure analysis.
update public.careers
  set personality_fit = array['analytical', 'practical']
  where id = 'cybersecurity_analyst';

-- Fix 4: journalist personality — replace risk_taking with analytical.
-- Journalists need investigative analytical thinking. risk_taking is too broad
-- and causes entrepreneurial students to spuriously match journalist.
update public.careers
  set personality_fit = array['social', 'analytical']
  where id = 'journalist';

update public.career_signal
  set signal_key = 'analytical', weight = 0.6
  where career_id = 'journalist'
    and signal_type = 'personality'
    and signal_key = 'risk_taking';
