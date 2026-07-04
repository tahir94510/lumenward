-- Lumenward — global leaderboard schema (Supabase).
-- Copyright (c) 2026 Lumenward. All rights reserved.
--
-- HOW TO RUN (one time):
--   Supabase Dashboard -> your project -> SQL Editor -> paste this file -> Run.
--
-- Fixes the 404 on POST /rest/v1/scores: PostgREST returns 404 until this
-- table exists. After running, game-over score submissions return 201 and
-- the in-game TOP GUARDIANS list starts filling.
--
-- Idempotent: safe to re-run.

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  name text not null default 'GUARDIAN',
  score bigint not null,
  created_at timestamptz not null default now()
);

-- Fast top-N queries.
create index if not exists scores_score_desc_idx on public.scores (score desc);

alter table public.scores enable row level security;

-- Anonymous players may submit sane scores (clamped) and read the board.
drop policy if exists "anon can insert" on public.scores;
create policy "anon can insert" on public.scores
  for insert to anon
  with check (
    score >= 0
    and score < 100000000
    and char_length(name) <= 24
  );

drop policy if exists "anon can read" on public.scores;
create policy "anon can read" on public.scores
  for select to anon
  using (true);

-- No update/delete policies on purpose: submitted scores are immutable from
-- the client. Manage rows from the dashboard (service role) if needed.
