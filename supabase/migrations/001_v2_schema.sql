-- ReadAlong v2 — Full Schema
-- Run in Supabase SQL Editor for your NEW v2 project.
-- auth.users is managed automatically by Supabase when Google OAuth is configured.

-- ============================================================
-- 1. PROFILES (public mirror of auth.users)
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text,
  avatar_url    text,
  highlight_color text not null default 'blue'
                  check (highlight_color in ('blue','amber','emerald','rose','violet','orange')),
  created_at    timestamptz default now()
);

-- Auto-create a profile row whenever a user signs up via Google OAuth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. BOOKS (metadata only — no content stored here)
-- ============================================================
create table public.books (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,   -- e.g. 'pride-and-prejudice'
  title         text not null,
  author        text not null,
  gutenberg_id  integer,               -- null = use local file (e.g. 1984)
  total_cycles  integer not null,      -- pre-computed, used for progress bar
  cover_url     text,
  description   text,
  created_at    timestamptz default now()
);

-- ============================================================
-- 3. READING ROOMS (replaces reading_pairs)
-- ============================================================
create table public.reading_rooms (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.books on delete cascade,
  invite_code   text unique not null,  -- 6 uppercase alphanumeric chars
  created_by    uuid not null references public.profiles on delete cascade,
  status        text not null default 'waiting'
                  check (status in ('waiting', 'active', 'completed')),
  created_at    timestamptz default now()
);

create index idx_rooms_invite_code on public.reading_rooms (invite_code);

-- ============================================================
-- 4. ROOM MEMBERS (max 2 per room)
-- ============================================================
create table public.room_members (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.reading_rooms on delete cascade,
  user_id       uuid not null references public.profiles on delete cascade,
  highlight_color text not null default 'blue'
                  check (highlight_color in ('blue','amber','emerald','rose','violet','orange')),
  joined_at     timestamptz default now(),
  unique (room_id, user_id)
);

create index idx_room_members_room on public.room_members (room_id);
create index idx_room_members_user on public.room_members (user_id);

-- ============================================================
-- 5. USER PROGRESS
-- ============================================================
create table public.user_progress (
  id                    uuid primary key default gen_random_uuid(),
  room_id               uuid not null references public.reading_rooms on delete cascade,
  user_id               uuid not null references public.profiles on delete cascade,
  current_cycle_index   integer not null default 0,
  completed_cycle_index integer not null default -1,
  updated_at            timestamptz default now(),
  unique (room_id, user_id)
);

-- ============================================================
-- 6. CYCLE RESPONSES
-- ============================================================
create table public.cycle_responses (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.reading_rooms on delete cascade,
  user_id     uuid not null references public.profiles on delete cascade,
  cycle_index integer not null,
  interpretation text not null
                check (char_length(interpretation) >= 300 and char_length(interpretation) <= 840),
  submitted_at  timestamptz default now(),
  unique (room_id, user_id, cycle_index)
);

-- ============================================================
-- 7. HIGHLIGHTS
-- ============================================================
create table public.highlights (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.reading_rooms on delete cascade,
  user_id         uuid not null references public.profiles on delete cascade,
  cycle_index     integer not null,
  paragraph_index integer not null,
  start_char      integer not null,
  end_char        integer not null,
  text_snippet    text not null,
  color           text not null default 'blue',
  created_at      timestamptz default now()
);

create index idx_highlights_room_cycle on public.highlights (room_id, cycle_index);

-- ============================================================
-- 8. PARAGRAPH NOTES
-- ============================================================
create table public.paragraph_notes (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.reading_rooms on delete cascade,
  user_id         uuid not null references public.profiles on delete cascade,
  cycle_index     integer not null,
  paragraph_index integer not null,
  content         text not null,
  created_at      timestamptz default now()
);

create index idx_notes_room_cycle on public.paragraph_notes (room_id, cycle_index);

-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.reading_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.user_progress enable row level security;
alter table public.cycle_responses enable row level security;
alter table public.highlights enable row level security;
alter table public.paragraph_notes enable row level security;

-- Profiles: users can read all profiles (for partner display), edit only their own
create policy "Profiles are publicly readable" on public.profiles for select using (true);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

-- Books: publicly readable
create policy "Books are publicly readable" on public.books for select using (true);

-- Rooms: readable by members; creatable by authenticated users
create policy "Room members can read their room" on public.reading_rooms
  for select using (
    auth.uid() in (select user_id from public.room_members where room_id = id)
    or auth.uid() = created_by
  );
create policy "Authenticated users can create rooms" on public.reading_rooms
  for insert with check (auth.uid() = created_by);
create policy "Room creator can update status" on public.reading_rooms
  for update using (auth.uid() = created_by);

-- Room members: readable by room participants
create policy "Room members can see each other" on public.room_members
  for select using (
    auth.uid() in (select user_id from public.room_members rm where rm.room_id = room_id)
  );
create policy "Authenticated users can join rooms" on public.room_members
  for insert with check (auth.uid() = user_id);

-- Progress: readable by room participants, writable by owner
create policy "Room participants can view progress" on public.user_progress
  for select using (
    auth.uid() in (select user_id from public.room_members where room_id = user_progress.room_id)
  );
create policy "Users can manage their own progress" on public.user_progress
  for all using (auth.uid() = user_id);

-- Responses: readable by room participants after both have submitted (handled in app logic)
create policy "Room participants can view responses" on public.cycle_responses
  for select using (
    auth.uid() in (select user_id from public.room_members where room_id = cycle_responses.room_id)
  );
create policy "Users can submit their own responses" on public.cycle_responses
  for insert with check (auth.uid() = user_id);

-- Highlights and notes: readable by room participants, writable by owner
create policy "Room participants can view highlights" on public.highlights
  for select using (
    auth.uid() in (select user_id from public.room_members where room_id = highlights.room_id)
  );
create policy "Users can manage their own highlights" on public.highlights
  for all using (auth.uid() = user_id);

create policy "Room participants can view notes" on public.paragraph_notes
  for select using (
    auth.uid() in (select user_id from public.room_members where room_id = paragraph_notes.room_id)
  );
create policy "Users can manage their own notes" on public.paragraph_notes
  for all using (auth.uid() = user_id);
