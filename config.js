/* Public Supabase config — the anon key is safe to expose; RLS
 * policies restrict reads/writes to the owning user (or admins).
 * Create a new Supabase project, run supabase-schema.sql in its
 * SQL Editor, then paste its URL + anon key below.
 */
window.SC_CONFIG = {
  SUPABASE_URL: 'https://vygbihnmeyhhpgeblqpd.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Z2JpaG5tZXloaHBnZWJscXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NTU1MDksImV4cCI6MjEwNzEzMTUwOX0.v1E0m13Em1LJYDNppe_0qjYpBkSZ73Q1pNWHgo85EnY',

  // Day 1 of the challenge. Everything else is computed from this.
  CHALLENGE_START_DATE: '2026-01-20',
  CHALLENGE_LENGTH_DAYS: 30
};
