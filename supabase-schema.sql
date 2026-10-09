-- 30 Day Sleep Challenge — Supabase schema
-- Run this once in the Supabase SQL Editor (a NEW project, separate from knoll-run-golf).

create extension if not exists "pgcrypto";

-- ───────────────────────── profiles ─────────────────────────
-- One row per signed-up user. Created automatically on signup via trigger below.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
-- Username comes from the "username" field passed in signup options.data.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
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
  sleep_rating int not null check (sleep_rating between 1 and 10),
  hours_slept int not null check (hours_slept between 1 and 10),
  reasoning text,
  created_at timestamptz default now(),
  unique (user_id, day)
);

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

-- ────────────────────── Row Level Security ──────────────────
alter table profiles      enable row level security;
alter table checkins      enable row level security;
alter table chat_messages enable row level security;

-- profiles: readable by anyone signed in (needed to resolve usernames
-- for @mentions, chat display, and the admin roster); writable only by
-- the owning user (is_admin itself is locked by the trigger above).
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

-- Enable Realtime on chat so new messages push to the browser.
-- Run this once (ignored if already added):
alter publication supabase_realtime add table chat_messages;
