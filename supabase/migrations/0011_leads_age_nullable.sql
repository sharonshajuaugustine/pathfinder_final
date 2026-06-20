-- age is now collected in the start quiz (stored in student_profiles._age)
-- and fetched at onboarding submission time. Sessions created before the start
-- quiz Q0 was added will not have age, so the column must allow NULL.
ALTER TABLE leads ALTER COLUMN age DROP NOT NULL;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_age_check;
ALTER TABLE leads ADD CONSTRAINT leads_age_check CHECK (age IS NULL OR age BETWEEN 10 AND 110);

-- is_minor is derived from age, so it must also be nullable.
ALTER TABLE leads ALTER COLUMN is_minor DROP NOT NULL;
