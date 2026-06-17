-- Fix civil_services_officer personality_fit.
-- 'analytical' was incorrectly listed as a required personality trait.
-- IAS/IPS officers are fundamentally social leaders; analytical aptitude is
-- already captured by the aptitude signals (verbal:0.9, logical:0.8).
-- Having 'analytical' in personality_fit penalised socially-oriented humanities
-- students who are genuinely suited to civil services — fixing it to ['social'].
update public.careers
set personality_fit = array['social']
where id = 'civil_services_officer';
