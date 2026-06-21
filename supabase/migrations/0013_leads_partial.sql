-- Allow partial leads created at start-quiz Q0 (before stream and district
-- are known). stream and district are filled in at Q1 and onboarding respectively.

ALTER TABLE leads ALTER COLUMN stream DROP NOT NULL;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_stream_check;
ALTER TABLE leads ADD CONSTRAINT leads_stream_check
  CHECK (stream IS NULL OR stream IN ('science_bio','science_maths','science_cs','commerce','humanities'));

ALTER TABLE leads ALTER COLUMN district DROP NOT NULL;
