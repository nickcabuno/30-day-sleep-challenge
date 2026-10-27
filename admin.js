(function () {
  const MOOD_LABEL = { great: 'Great', good: 'Good', okay: 'Okay', poor: 'Poor' };
  const ENERGY_LABEL = { low: 'Low', moderate: 'Moderate', high: 'High' };
  const STRATEGY_LABEL = {
    consistent_schedule: 'Consistent schedule',
    screen_free_winddown: 'Screen-free wind-down',
    relaxation_routine: 'Relaxation routine',
    comfortable_environment: 'Comfortable environment',
    academic_cutoff: 'Academic cutoff'
  };

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString();
  }
  function fmtTime(t) {
    if (!t) return '—';
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }
  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderRoster(profiles, checkins) {
    const countByUser = {};
    checkins.forEach((c) => (countByUser[c.user_id] = (countByUser[c.user_id] || 0) + 1));

    const body = document.getElementById('roster-body');
    body.innerHTML = profiles
      .map(
        (p) => `
        <tr>
          <td>@${escapeHtml(p.username)}</td>
          <td><span class="pill ${p.is_admin ? 'admin' : 'user'}">${p.is_admin ? 'Admin' : 'User'}</span></td>
          <td>${p.created_at ? fmtDate(p.created_at) : '—'}</td>
          <td>${countByUser[p.id] || 0} / ${window.SC_CONFIG.CHALLENGE_LENGTH_DAYS}</td>
        </tr>`
      )
      .join('');
  }

  function renderEntries(profiles, checkins) {
    const byUsername = {};
    profiles.forEach((p) => (byUsername[p.id] = p.username));

    const root = document.getElementById('entries-root');
    if (checkins.length === 0) {
      root.innerHTML = '<div class="empty-state">No check-ins yet.</div>';
      return;
    }
    const sorted = [...checkins].sort((a, b) => (a.day - b.day) || (a.user_id > b.user_id ? 1 : -1));
    root.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr><th>User</th><th>Day</th><th>Bedtime → Wake</th><th>Mood</th><th>Strategies</th><th>Energy</th></tr>
        </thead>
        <tbody>
          ${sorted
            .map((c) => {
              const strategies = (c.strategies || []).map((s) => STRATEGY_LABEL[s] || s).join(', ') || '—';
              return `
            <tr>
              <td>@${escapeHtml(byUsername[c.user_id] || '?')}</td>
              <td>${c.day}</td>
              <td>${fmtTime(c.bedtime)} → ${fmtTime(c.wake_time)}</td>
              <td>${MOOD_LABEL[c.mood] || c.mood}</td>
              <td>${strategies}</td>
              <td>${ENERGY_LABEL[c.energy] || c.energy}</td>
            </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    `;
  }

  (async function init() {
    const auth = await SC.requireAuth();
    if (!auth) return;
    const profile = auth.profile;

    if (!profile.is_admin) {
      window.location.href = 'home.html';
      return;
    }

    SC_SHELL.renderHeader({ title: 'Admin', subtitle: 'Roster and check-in data — admins only.', profile });
    SC_SHELL.renderTabs('admin');

    const [profiles, checkinsRes] = await Promise.all([
      SC.listProfiles(),
      SC.client.from('checkins').select('*')
    ]);
    if (checkinsRes.error) throw checkinsRes.error;
    const checkins = checkinsRes.data;

    renderRoster(profiles, checkins);
    renderEntries(profiles, checkins);
  })();
})();
