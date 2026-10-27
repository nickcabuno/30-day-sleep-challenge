(function () {
  const AVATAR_PALETTE = ['#f97066', '#f6a723', '#2dd4bf', '#6c8cff', '#c77dff', '#56c870', '#ff8fab', '#7c6fe6'];
  function colorForUsername(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
  }
  function relTime(ts) {
    const diffSec = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
    const mins = diffSec / 60, hours = mins / 60, days = hours / 24, months = days / 30, years = days / 365;
    if (diffSec < 60) return 'now';
    if (mins < 60) return Math.floor(mins) + 'm';
    if (hours < 24) return Math.floor(hours) + 'h';
    if (days < 30) return Math.floor(days) + 'd';
    if (months < 12) return Math.floor(months) + 'mo';
    return Math.floor(years) + 'y';
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let profile, profilesById = {};

  function displayName(userId, fallbackUsername) {
    const p = profilesById[userId];
    return (p && (p.nickname || p.username)) || fallbackUsername || 'unknown';
  }

  async function toggleLike(postId, liked, countEl, btnEl) {
    btnEl.disabled = true;
    try {
      if (liked) {
        await SC.client.from('post_likes').delete().eq('post_id', postId).eq('user_id', profile.id);
      } else {
        await SC.client.from('post_likes').insert({ post_id: postId, user_id: profile.id });
      }
      await loadFeed();
    } finally {
      btnEl.disabled = false;
    }
  }

  async function submitPost() {
    const input = document.getElementById('post-input');
    const body = input.value.trim();
    if (!body) return;
    const btn = document.getElementById('post-btn');
    btn.disabled = true;
    try {
      const { error } = await SC.client.from('community_posts').insert({ user_id: profile.id, body });
      if (error) throw error;
      input.value = '';
      await loadFeed();
    } catch (err) {
      alert(err.message || 'Could not post.');
    } finally {
      btn.disabled = false;
    }
  }

  async function loadFeed() {
    const [postsRes, likesRes] = await Promise.all([
      SC.client.from('community_posts').select('*').order('created_at', { ascending: false }).limit(100),
      SC.client.from('post_likes').select('*')
    ]);
    if (postsRes.error) throw postsRes.error;
    if (likesRes.error) throw likesRes.error;
    const posts = postsRes.data;
    const likes = likesRes.data;

    const likeCountByPost = {};
    const likedByMe = new Set();
    likes.forEach((l) => {
      likeCountByPost[l.post_id] = (likeCountByPost[l.post_id] || 0) + 1;
      if (l.user_id === profile.id) likedByMe.add(l.post_id);
    });

    const feed = document.getElementById('feed-list');
    if (posts.length === 0) {
      feed.innerHTML = '<div class="empty-state">No posts yet — share the first one.</div>';
      return;
    }
    feed.innerHTML = '';
    posts.forEach((p) => {
      const name = displayName(p.user_id, 'unknown');
      const isAdmin = profilesById[p.user_id] && profilesById[p.user_id].is_admin;
      const count = likeCountByPost[p.id] || 0;
      const liked = likedByMe.has(p.id);
      const row = document.createElement('div');
      row.className = 'post';
      row.innerHTML = `
        <div class="post-avatar" style="background:${colorForUsername(name)}">${name.slice(0, 1).toUpperCase()}</div>
        <div class="post-body">
          <div class="post-head">
            <span class="post-username">${escapeHtml(name)}</span>
            ${isAdmin ? '<span class="pill admin">Admin</span>' : ''}
            <span class="post-time">${relTime(p.created_at)} ago</span>
          </div>
          <div class="post-text">${escapeHtml(p.body)}</div>
          <div class="post-actions">
            <button class="like-btn ${liked ? 'liked' : ''}" data-post="${p.id}">♥ <span>${count}</span></button>
          </div>
        </div>
      `;
      const likeBtn = row.querySelector('.like-btn');
      likeBtn.addEventListener('click', () => toggleLike(p.id, liked, likeBtn.querySelector('span'), likeBtn));
      feed.appendChild(row);
    });
  }

  function subscribeRealtime() {
    SC.client
      .channel('community_posts_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, () => {
        loadFeed();
      })
      .subscribe();
  }

  (async function init() {
    const auth = await SC.requireAuth();
    if (!auth) return;
    profile = auth.profile;

    SC_SHELL.renderHeader({ title: 'Community', subtitle: 'Share what works for you. Celebrate others’ wins.', profile });
    SC_SHELL.renderTabs('community');

    const profiles = await SC.listProfiles();
    profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));

    await loadFeed();
    subscribeRealtime();

    document.getElementById('post-btn').addEventListener('click', submitPost);
  })();
})();
