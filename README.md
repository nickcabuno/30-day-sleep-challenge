# 30 Day Sleep Challenge

Vanilla HTML/CSS/JS frontend + Supabase backend (auth, Postgres, Realtime).

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is fine).
2. **Run the schema.** In the Supabase dashboard, open the SQL Editor, paste the contents of
   [`supabase-schema.sql`](supabase-schema.sql), and run it. This creates the `profiles`,
   `checkins`, and `chat_messages` tables, their RLS policies, and enables Realtime on chat.
3. **(Optional) Turn off email confirmation** for faster local testing: Authentication →
   Providers → Email → disable "Confirm email". Leave it on for a real deployment.
4. **Fill in `config.js`** with your project's URL and anon key (Settings → API in the Supabase
   dashboard), and set `CHALLENGE_START_DATE` to Day 1 of the challenge.
5. **Open `index.html`** (via a local server, e.g. `npx serve .`) and sign up. The first account
   won't be an admin — promote it by running in the SQL Editor:
   ```sql
   update profiles set is_admin = true where username = 'your_username';
   ```

## How it works

- **Auth** — `auth.js` wraps Supabase Auth (email + password). Signing up stores a chosen
  `username` and auto-creates a `profiles` row via a DB trigger.
- **Daily check-in** — `challenge.html` / `app.js` render a 30-day grid from
  `CHALLENGE_START_DATE`. Only *today's* cell is clickable; it opens a modal asking for a sleep
  rating (1-10), hours slept (1-10), and free-text reasoning, then writes a row to `checkins`.
- **Privacy** — RLS on `checkins` restricts reads to the owning user or an admin
  (`is_admin = true` on their `profiles` row). No one else can see another user's answers.
- **Chat** — `chat-widget.js` / `chat-widget.css` is a public, realtime chat (Postgres Realtime
  via `postgres_changes`) rendered as a dark drawer docked at the bottom of every authenticated
  page. It starts collapsed (peeking the header + latest message); tap or swipe it up to expand,
  swipe/tap down to collapse. Typing `@` opens an autocomplete of usernames; admins additionally
  see an `@all` option, rendered as a highlighted broadcast tag.
- **Admin** — `admin.html` / `admin.js` (only reachable/visible to `is_admin` users) shows the
  full roster and every user's check-ins. `is_admin` itself can only be changed via the Supabase
  SQL Editor, not through the app, so users can't self-promote.

## Files

| File | Purpose |
|---|---|
| `config.js` | Supabase URL/anon key + challenge start date |
| `supabase-schema.sql` | Tables, RLS policies, triggers |
| `auth.js` | Supabase client + signup/login/logout helpers |
| `nav.js` | Shared top nav bar |
| `index.html` | Sign in / sign up |
| `challenge.html`, `app.js` | 30-day calendar + check-in modal |
| `chat-widget.css`, `chat-widget.js` | Swipeable chat drawer w/ @mentions, embedded on every authenticated page |
| `admin.html`, `admin.js` | Admin roster + all users' entries |
