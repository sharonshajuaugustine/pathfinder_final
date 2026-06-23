-- Adds two optional columns introduced with the new start-quiz + aptitude flow.
--
--  * leads.gender — collected at start-quiz Q0 for data-collection goals.
--  * recommendations.caveats — kept for historical/admin inspection. The runtime
--    recomputes caveats on every request, so this column is NOT required for the
--    app to work; it just lets you persist a snapshot if desired.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS gender text
  CHECK (gender IS NULL OR gender IN ('male','female','other','prefer_not_to_say'));

ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS caveats jsonb NOT NULL DEFAULT '[]'::jsonb;
