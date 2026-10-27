(function () {
  let profile;

  async function saveNickname() {
    const value = document.getElementById('nickname-input').value.trim() || profile.username;
    const btn = document.getElementById('save-nickname-btn');
    btn.disabled = true;
    try {
      const { error } = await SC.client.from('profiles').update({ nickname: value }).eq('id', profile.id);
      if (error) throw error;
      const saved = document.getElementById('nickname-saved');
      saved.textContent = 'Saved!';
      saved.classList.add('show');
      setTimeout(() => saved.classList.remove('show'), 2000);
    } catch (err) {
      alert(err.message || 'Could not save nickname.');
    } finally {
      btn.disabled = false;
    }
  }

  async function updateFlag(column, value) {
    await SC.client.from('profiles').update({ [column]: value }).eq('id', profile.id);
  }

  (async function init() {
    const auth = await SC.requireAuth();
    if (!auth) return;
    profile = auth.profile;

    SC_SHELL.renderHeader({ title: 'Privacy & Profile', profile });
    SC_SHELL.renderTabs('privacy');

    document.getElementById('nickname-input').value = profile.nickname || profile.username;
    document.getElementById('toggle-leaderboard').checked = profile.show_on_leaderboard;
    document.getElementById('toggle-badges').checked = profile.badge_announcements;
    document.getElementById('toggle-theme').checked = SC_THEME.get() === 'dark';

    document.getElementById('save-nickname-btn').addEventListener('click', saveNickname);
    document.getElementById('toggle-leaderboard').addEventListener('change', (e) => updateFlag('show_on_leaderboard', e.target.checked));
    document.getElementById('toggle-badges').addEventListener('change', (e) => updateFlag('badge_announcements', e.target.checked));
    document.getElementById('toggle-theme').addEventListener('change', (e) => SC_THEME.set(e.target.checked ? 'dark' : 'light'));
  })();
})();
