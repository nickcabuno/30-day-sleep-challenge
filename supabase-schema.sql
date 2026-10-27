-- Get Your Z's — Supabase schema
-- Safe to re-run: every statement is idempotent (create-if-not-exists /
-- drop-policy-if-exists / add-column-if-not-exists), so re-running this
-- after the big Oct-2026 revamp just applies the new pieces in place.

create extension if not exists "pgcrypto";

-- ───────────────────────── profiles ─────────────────────────
-- One row per signed-up user. Created automatically on signup via trigger below.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

-- Display name shown in Community/Rewards/Chat; defaults to username.
alter table profiles add column if not exists nickname text;
alter table profiles add column if not exists show_on_leaderboard boolean not null default true;
alter table profiles add column if not exists badge_announcements boolean not null default true;

-- Auto-create a profile row whenever a new auth user signs up.
-- Username comes from the "username" field passed in signup options.data.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Prevent users from promoting themselves to admin through the client API.
-- is_admin can only be changed by running SQL directly in the Supabase SQL Editor
-- (which has no auth.jwt() request context, so this guard is skipped there).
create or replace function prevent_self_admin_promotion()
returns trigger as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and auth.uid() is not null then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists profiles_lock_is_admin on profiles;
create trigger profiles_lock_is_admin
  before update on profiles
  for each row execute function prevent_self_admin_promotion();

-- ───────────────────────── checkins ─────────────────────────
-- One row per user per challenge day (1-30). Private to the user + admins.
create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  day int not null check (day between 1 and 30),
  entry_date date not null default current_date,
  created_at timestamptz default now(),
  unique (user_id, day)
);

-- Oct-2026 revamp: the daily check-in became bedtime/wake time + mood +
-- strategies + energy instead of the old 1-10 scales + free-text reasoning.
alter table checkins drop column if exists sleep_rating;
alter table checkins drop column if exists hours_slept;
alter table checkins drop column if exists reasoning;
alter table checkins add column if not exists bedtime time;
alter table checkins add column if not exists wake_time time;
alter table checkins add column if not exists mood text;
alter table checkins add column if not exists strategies text[] not null default '{}';
alter table checkins add column if not exists energy text;

alter table checkins drop constraint if exists checkins_mood_check;
alter table checkins add constraint checkins_mood_check check (mood in ('great', 'good', 'okay', 'poor'));
alter table checkins drop constraint if exists checkins_energy_check;
alter table checkins add constraint checkins_energy_check check (energy in ('low', 'moderate', 'high'));

-- ─────────────────────── chat_messages ──────────────────────
-- Public chat, visible to every signed-in user. mentions holds the
-- lowercase usernames mentioned (or 'all' for an admin broadcast).
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  username text not null,
  body text not null,
  mentions text[] not null default '{}',
  created_at timestamptz default now()
);

-- ─────────────────────── community_posts ────────────────────
-- Public forum posts, separate from the live chat. Likes live in post_likes.
create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists post_likes (
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

-- ───────────────────────── polls ─────────────────────────────
-- Admin-created weekly polls. One vote per user per poll (changeable).
create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  created_by uuid not null references profiles(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  label text not null,
  position int not null default 0
);

create table if not exists poll_votes (
  poll_id uuid not null references polls(id) on delete cascade,
  option_id uuid not null references poll_options(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (poll_id, user_id)
);

-- Optional personal reflection attached to a poll/week. Private to the user.
create table if not exists poll_reflections (
  poll_id uuid not null references polls(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  updated_at timestamptz default now(),
  primary key (poll_id, user_id)
);

-- ────────────────────── Row Level Security ──────────────────
alter table profiles          enable row level security;
alter table checkins          enable row level security;
alter table chat_messages     enable row level security;
alter table community_posts   enable row level security;
alter table post_likes        enable row level security;
alter table polls             enable row level security;
alter table poll_options      enable row level security;
alter table poll_votes        enable row level security;
alter table poll_reflections  enable row level security;

-- profiles: readable by anyone signed in (needed to resolve usernames/nicknames
-- for @mentions, chat, community, and the leaderboard); writable only by the
-- owning user (is_admin itself is locked by the trigger above).
drop policy if exists "profiles select" on profiles;
drop policy if exists "profiles update own" on profiles;
create policy "profiles select" on profiles for select to authenticated using (true);
create policy "profiles update own" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- checkins: a user sees/writes only their own entries; admins can see everyone's.
drop policy if exists "checkins select own or admin" on checkins;
drop policy if exists "checkins insert own" on checkins;
drop policy if exists "checkins update own" on checkins;
create policy "checkins select own or admin" on checkins for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );
create policy "checkins insert own" on checkins for insert to authenticated
  with check (user_id = auth.uid());
create policy "checkins update own" on checkins for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- chat_messages: public to every signed-in user; only the author can post as themselves.
drop policy if exists "chat select all" on chat_messages;
drop policy if exists "chat insert own" on chat_messages;
create policy "chat select all" on chat_messages for select to authenticated using (true);
create policy "chat insert own" on chat_messages for insert to authenticated
  with check (user_id = auth.uid());

-- community_posts / post_likes: public to every signed-in user; write only your own.
drop policy if exists "posts select all" on community_posts;
drop policy if exists "posts insert own" on community_posts;
drop policy if exists "posts delete own" on community_posts;
create policy "posts select all" on community_posts for select to authenticated using (true);
create policy "posts insert own" on community_posts for insert to authenticated
  with check (user_id = auth.uid());
create policy "posts delete own" on community_posts for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "likes select all" on post_likes;
drop policy if exists "likes insert own" on post_likes;
drop policy if exists "likes delete own" on post_likes;
create policy "likes select all" on post_likes for select to authenticated using (true);
create policy "likes insert own" on post_likes for insert to authenticated
  with check (user_id = auth.uid());
create policy "likes delete own" on post_likes for delete to authenticated
  using (user_id = auth.uid());

-- polls: everyone can read; only admins can create. Votes/reflections are per-user.
drop policy if exists "polls select all" on polls;
drop policy if exists "polls insert admin" on polls;
create policy "polls select all" on polls for select to authenticated using (true);
create policy "polls insert admin" on polls for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "poll_options select all" on poll_options;
drop policy if exists "poll_options insert admin" on poll_options;
create policy "poll_options select all" on poll_options for select to authenticated using (true);
create policy "poll_options insert admin" on poll_options for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "poll_votes select all" on poll_votes;
drop policy if exists "poll_votes insert own" on poll_votes;
drop policy if exists "poll_votes update own" on poll_votes;
create policy "poll_votes select all" on poll_votes for select to authenticated using (true);
create policy "poll_votes insert own" on poll_votes for insert to authenticated
  with check (user_id = auth.uid());
create policy "poll_votes update own" on poll_votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "reflections select own" on poll_reflections;
drop policy if exists "reflections insert own" on poll_reflections;
drop policy if exists "reflections update own" on poll_reflections;
create policy "reflections select own" on poll_reflections for select to authenticated
  using (user_id = auth.uid());
create policy "reflections insert own" on poll_reflections for insert to authenticated
  with check (user_id = auth.uid());
create policy "reflections update own" on poll_reflections for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────── get_leaderboard() ───────────────────────
-- Exposes only aggregate counts + computed points per user (never the
-- actual private checkin content), so the leaderboard/badges can rank
-- everyone without widening checkins' RLS. security definer bypasses RLS
-- internally; the function body itself only ever returns counts.
create or replace function get_leaderboard()
returns table (
  user_id uuid,
  username text,
  nickname text,
  is_admin boolean,
  show_on_leaderboard boolean,
  checkin_count bigint,
  post_count bigint,
  poll_vote_count bigint,
  points bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    coalesce(p.nickname, p.username),
    p.is_admin,
    p.show_on_leaderboard,
    coalesce(c.cnt, 0),
    coalesce(cp.cnt, 0),
    coalesce(pv.cnt, 0),
    coalesce(c.cnt, 0) * 10 + coalesce(cp.cnt, 0) * 2 + coalesce(pv.cnt, 0) * 1
  from profiles p
  left join (select user_id, count(*) cnt from checkins group by user_id) c on c.user_id = p.id
  left join (select user_id, count(*) cnt from community_posts group by user_id) cp on cp.user_id = p.id
  left join (select user_id, count(*) cnt from poll_votes group by user_id) pv on pv.user_id = p.id;
$$;

grant execute on function get_leaderboard() to authenticated;

-- Enable Realtime on chat + community posts so updates push to the browser.
-- Guarded so re-running the script doesn't error on an already-added table.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table chat_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_posts'
  ) then
    alter publication supabase_realtime add table community_posts;
  end if;
end $$;
