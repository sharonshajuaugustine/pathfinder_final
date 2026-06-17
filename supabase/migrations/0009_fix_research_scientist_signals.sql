-- Migration 0009: Fix Research Scientist interest signals.
--
-- Audit finding: research_scientist carried co-signals technology_coding (0.4)
-- and numbers_analysis (0.6) alongside science_research (1.0). A student whose
-- only stated interest is pure scientific research scored just
--   (1.0×0.8) / (1.0+0.6+0.4) = 0.40 on interest — diluted by two interests
-- they never expressed. This pushed genuine science-curious students far down
-- the ranking. Modern research does involve data/coding, but those should not
-- be PREREQUISITES that penalise a pure-science student.
--
-- Fix: remove technology_coding entirely; reduce numbers_analysis to 0.3 so it
-- is a mild bonus, not a heavy divisor.

delete from public.career_signal
  where career_id = 'research_scientist'
    and signal_type = 'interest'
    and signal_key = 'technology_coding';

update public.career_signal
  set weight = 0.3
  where career_id = 'research_scientist'
    and signal_type = 'interest'
    and signal_key = 'numbers_analysis';
