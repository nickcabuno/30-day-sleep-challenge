/* Shared Supabase client + auth helpers. Loaded on every page after config.js. */
window.SC = (function () {
  const client = supabase.createClient(
    window.SC_CONFIG.SUPABASE_URL,
    window.SC_CONFIG.SUPABASE_ANON_KEY
  );

  async function signUp(email, password, username) {
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      throw new Error('Username must be 3-20 characters: letters, numbers, underscore.');
    }
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { username: clean } }
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await client.auth.signOut();
    window.location.href = 'index.html';
  }

  async function getSession() {
    const { data } = await client.auth.getSession();
    return data.session;
  }

  async function getProfile(userId) {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  async function listProfiles() {
    const { data, error } = await client.from('profiles').select('*').order('username');
    if (error) throw error;
    return data;
  }

  // Call at the top of every protected page. Redirects to index.html if signed out.
  async function requireAuth() {
    const session = await getSession();
    if (!session) {
      window.location.href = 'index.html';
      return null;
    }
    const profile = await getProfile(session.user.id);
    return { session, profile };
  }

  return { client, signUp, signIn, signOut, getSession, getProfile, listProfiles, requireAuth };
})();
