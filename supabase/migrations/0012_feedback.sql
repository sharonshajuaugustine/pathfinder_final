-- Feedback from students after viewing their recommendation.
-- One row per session (unique index enforces this).

create table if not exists feedback (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        not null references sessions(id) on delete cascade,
  reaction    text        not null check (reaction in ('love', 'good', 'okay', 'poor')),
  message     text        check (char_length(message) <= 1000),
  created_at  timestamptz not null default now()
);

create unique index if not exists feedback_session_unique on feedback(session_id);

alter table feedback enable row level security;

-- Service role bypasses RLS — all admin reads use service role.
-- Deny everything for the anon key so students can't read each other's feedback.
create policy "deny_anon" on feedback for all to anon using (false);
