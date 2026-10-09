(function () {
  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString();
  }
  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function renderRoster(profiles, checkins) {
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
          <tr><th>User</th><th>Day</th><th>Date</th><th>Sleep rating</th><th>Hours</th><th>Reasoning</th></tr>
        </thead>
        <tbody>
          ${sorted
            .map(
              (c) => `
            <tr>
              <td>@${escapeHtml(byUsername[c.user_id] || '?')}</td>
              <td>${c.day}</td>
              <td>${c.entry_date}</td>
              <td>${c.sleep_rating}/10</td>
              <td>${c.hours_slept}/10</td>
              <td>${escapeHtml(c.reasoning) || '<span class="muted">—</span>'}</td>
            </tr>`
            )
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
      window.location.href = 'challenge.html';
      return;
    }

    SC_NAV.render('admin', profile);

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
