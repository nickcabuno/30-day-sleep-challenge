# Get Your Z's

Vanilla HTML/CSS/JS frontend + Supabase backend (auth, Postgres, Realtime).
Purple-themed, mobile-first, with light/dark mode.

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is fine).
2. **Run the schema.** In the Supabase dashboard, open the SQL Editor, paste the contents of
   [`supabase-schema.sql`](supabase-schema.sql), and run it. It's idempotent — safe to re-run any
   time the schema changes (e.g. after the Oct-2026 revamp added Community/Rewards/Polls/Privacy).
3. **(Optional) Turn off email confirmation** for faster local testing: Authentication →
   Providers → Email → disable "Confirm email". Leave it on for a real deployment.
4. **Fill in `config.js`** with your project's URL and anon key (Settings → API in the Supabase
   dashboard), and set `CHALLENGE_START_DATE` to Day 1 of the challenge.
5. **Open `index.html`** (via a local server, e.g. `npx serve .`) and sign up. The first account
   won't be an admin — promote it by running in the SQL Editor:
   ```sql
   update profiles set is_admin = true where username = 'your_username';
   ```
   Free-tier Supabase projects auto-pause after a week of inactivity — if signup/login suddenly
   fails with "Failed to fetch", resume the project from the Supabase dashboard first.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Sign in / sign up |
| `home.html` | 30-day calendar, progress %, points, today's tip, quick links |
| `sleep-log.html` | Daily check-in form (bedtime, wake time, mood, strategies, energy) + history |
| `community.html` | Public forum: post, like, realtime feed |
| `rewards.html` | Badges (computed from your counts) + a privacy-respecting leaderboard |
| `polls.html` | Weekly poll (admins create it), vote/results, a personal weekly reflection |
| `privacy.html` | Nickname, leaderboard/badge-announcement toggles, dark mode |
| `admin.html` | Roster + every user's check-ins (admin-only; reached via the header's gear icon) |

Every page shares `nav.js` (the gradient header band + bottom tab bar + dark-mode toggle) and the
chat drawer (`chat-widget.js`/`.css`), which docks just above the tab bar and is styled from the
same theme variables as the rest of the app.

## How it works

- **Auth** — `auth.js` wraps Supabase Auth (email + password). Signing up stores a chosen
  `username` and auto-creates a `profiles` row via a DB trigger.
- **Privacy** — RLS restricts `checkins` to the owning user or an admin; nothing from a daily
  check-in (bedtime, mood, energy, etc.) is ever exposed to other users. Community posts and poll
  votes are separate, intentionally-public tables users opt into by posting/voting.
- **Points & badges** — computed live via the `get_leaderboard()` SQL function (10 pts/check-in +
  2 pts/post + 1 pt/vote), which only returns aggregate counts (never raw check-in content) so the
  leaderboard can rank everyone without widening `checkins`' RLS. Badges are milestone counts, not
  streaks. A user's `show_on_leaderboard` toggle (Privacy page) controls whether they appear.
- **Badge announcements** — when Rewards detects a newly-earned badge (tracked per-browser in
  `localStorage`) and the user's `badge_announcements` toggle is on, it posts a message to the
  Chat drawer announcing it.
- **Chat** — public, realtime (Postgres `postgres_changes`), docked bottom drawer; swipe/tap up to
  expand, swipe/tap down or the chevron to collapse. `@username` autocompletes; admins also get
  `@all`.
- **Polls** — admins create a question + options from the top of `polls.html`; everyone else votes
  once (changeable) and sees live percentage bars after voting.
- **Admin** — `is_admin` can only be changed via the Supabase SQL Editor, never through the app, so
  users can't self-promote.

## Notable judgment calls

A few things from the Oct-2026 mockup were deliberately scoped down or left out:
- The daily check-in form was fully replaced to match the mockup (bedtime/wake time/mood/
  strategies/energy) instead of the original 1-10 scales + free-text reasoning.
- Community posts support likes but not nested comment threads.
- Skipped the mockup's "Reset All Prototype Activity" button — that's prototyping-tool scaffolding
  (the mockup even says "Prototype only"), not something a real app with real data should have.
