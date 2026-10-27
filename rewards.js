(function () {
  const BADGES = [
    { id: 'first_steps', emoji: '🌱', name: 'First Steps', req: '1 day', check: (s) => s.checkin_count >= 1 },
    { id: 'night_owl', emoji: '🌙', name: 'Night Owl No More', req: '3 days', check: (s) => s.checkin_count >= 3 },
    { id: 'consistency_star', emoji: '⭐', name: 'Consistency Star', req: '5 days', check: (s) => s.checkin_count >= 5 },
    { id: 'community_voice', emoji: '💬', name: 'Community Voice', req: '1 post', check: (s) => s.post_count >= 1 },
    { id: 'poll_participant', emoji: '📊', name: 'Poll Participant', req: '1 vote', check: (s) => s.poll_vote_count >= 1 },
    { id: 'champion', emoji: '🏆', name: '30-Day Champion', req: '30 days', check: (s) => s.checkin_count >= 30 }
  ];

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderBadges(myStats) {
    const grid = document.getElementById('badge-grid');
    grid.innerHTML = BADGES.map((b) => {
      const earned = b.check(myStats);
      return `
        <div class="badge-tile ${earned ? 'earned' : ''}">
          <div class="badge-emoji">${b.emoji}</div>
          <div class="badge-name">${b.name}</div>
          <div class="badge-req">${b.req}</div>
        </div>
      `;
    }).join('');
  }

  function renderLeaderboard(allStats, myUserId) {
    const visible = allStats
      .filter((s) => s.show_on_leaderboard || s.user_id === myUserId)
      .sort((a, b) => b.points - a.points);
    const el = document.getElementById('leaderboard');
    if (visible.length === 0) {
      el.innerHTML = '<div class="empty-state">No one on the board yet.</div>';
      return;
    }
    el.innerHTML = visible
      .map((s, i) => {
        const mine = s.user_id === myUserId;
        return `
          <div class="leaderboard-row ${mine ? 'me' : ''}">
            <div class="lb-rank">${i + 1}.</div>
            <div class="lb-name">${escapeHtml(s.nickname || s.username)}${mine ? ' (you)' : ''}</div>
            <div class="lb-points">${s.points} pts</div>
          </div>
        `;
      })
      .join('');
  }

  function announceNewBadges(myStats, profile) {
    if (!profile.badge_announcements) return;
    const key = `sc-badges-seen-${profile.id}`;
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
    const earnedNow = BADGES.filter((b) => b.check(myStats)).map((b) => b.id);
    const newOnes = earnedNow.filter((id) => !seen.includes(id));
    newOnes.forEach((id) => {
      const badge = BADGES.find((b) => b.id === id);
      SC.client.from('chat_messages').insert({
        user_id: profile.id,
        username: profile.username,
        body: `🎉 earned the "${badge.name}" badge!`,
        mentions: []
      });
    });
    try { localStorage.setItem(key, JSON.stringify(earnedNow)); } catch (e) {}
  }

  (async function init() {
    const auth = await SC.requireAuth();
    if (!auth) return;
    const profile = auth.profile;

    SC_SHELL.renderHeader({ title: 'Rewards', subtitle: 'Celebrate healthy habits.', profile });
    SC_SHELL.renderTabs('rewards');

    const { data, error } = await SC.client.rpc('get_leaderboard');
    if (error) throw error;

    const myStats = data.find((s) => s.user_id === profile.id) || {
      checkin_count: 0, post_count: 0, poll_vote_count: 0, points: 0
    };

    renderBadges(myStats);
    renderLeaderboard(data, profile.id);
    announceNewBadges(myStats, profile);
  })();
})();
