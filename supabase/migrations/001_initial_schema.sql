-- ReadAlong Database Migration
-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- ============================================================
-- 1. USERS (simple, two hardcoded users, plaintext passwords)
-- ============================================================
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  name          text unique not null,
  password      text,
  created_at    timestamptz default now()
);

-- Seed the two users (passwords set on first login)
insert into public.users (name) values ('Ishaan'), ('Dhriti');

-- ============================================================
-- 2. BOOKS
-- ============================================================
create table public.books (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  author        text,
  total_cycles  integer not null,
  cover_url     text,
  created_at    timestamptz default now()
);

-- ============================================================
-- 3. CYCLES (text chunks — story content only)
-- ============================================================
create table public.cycles (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.books on delete cascade,
  cycle_index   integer not null,
  content       text not null,
  word_count    integer not null,
  chapter_title text,
  created_at    timestamptz default now(),
  unique (book_id, cycle_index)
);

create index idx_cycles_book on public.cycles (book_id, cycle_index);

-- ============================================================
-- 4. READING PAIRS
-- ============================================================
create table public.reading_pairs (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.books on delete cascade,
  user_a        uuid not null references public.users on delete cascade,
  user_b        uuid references public.users on delete set null,
  status        text not null default 'active'
                  check (status in ('active', 'completed')),
  created_at    timestamptz default now()
);

-- ============================================================
-- 5. USER PROGRESS
-- ============================================================
create table public.user_progress (
  id                    uuid primary key default gen_random_uuid(),
  reading_pair_id       uuid not null references public.reading_pairs on delete cascade,
  user_id               uuid not null references public.users on delete cascade,
  current_cycle_index   integer not null default 0,
  completed_cycle_index integer not null default -1,
  updated_at            timestamptz default now(),
  unique (reading_pair_id, user_id)
);

-- ============================================================
-- 6. CYCLE RESPONSES
-- ============================================================
create table public.cycle_responses (
  id                uuid primary key default gen_random_uuid(),
  reading_pair_id   uuid not null references public.reading_pairs on delete cascade,
  user_id           uuid not null references public.users on delete cascade,
  cycle_index       integer not null,
  interpretation    text not null
                      check (char_length(interpretation) >= 300
                         and char_length(interpretation) <= 840),
  submitted_at      timestamptz default now(),
  unique (reading_pair_id, user_id, cycle_index)
);
