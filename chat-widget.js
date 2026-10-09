/* Docked chat drawer, present on every authenticated page.
 * Starts collapsed (peeking the header + latest message) at the bottom
 * of the viewport; tap or swipe up to expand, swipe down / tap close to collapse.
 */
(function () {
  const ICON_CHAT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  const ICON_CHEVRON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  const ICON_SEND = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>';

  const AVATAR_PALETTE = ['#f97066', '#f6a723', '#2dd4bf', '#6c8cff', '#c77dff', '#56c870', '#ff8fab', '#5fb7ff'];
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

  function mountMarkup() {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="chat-drawer" id="chat-drawer">
        <div class="cw-draghandle" id="cw-draghandle"><span></span></div>
        <div class="cw-header" id="cw-header">
          <div class="cw-header-left" id="cw-header-left">
            <span class="cw-icon">${ICON_CHAT}</span>
            <span class="cw-title">Chat</span>
            <span class="cw-unread" id="cw-unread"></span>
          </div>
          <button class="cw-close" id="cw-close" aria-label="Toggle chat" type="button">${ICON_CHEVRON}</button>
        </div>
        <div class="cw-preview" id="cw-preview">Say hello to the group.</div>
        <div class="cw-messages" id="cw-messages"></div>
        <div class="cw-inputrow">
          <div class="cw-mention-menu" id="cw-mention-menu"></div>
          <textarea id="cw-input" rows="1" placeholder="Start chatting"></textarea>
          <button class="cw-send" id="cw-send" type="button" aria-label="Send">${ICON_SEND}</button>
        </div>
      </div>
    `;
    document.body.appendChild(root.firstElementChild);
  }

  (async function init() {
    const auth = await SC.requireAuth();
    if (!auth) return;
    const profile = auth.profile;

    mountMarkup();

    const drawer = document.getElementById('chat-drawer');
    const headerLeft = document.getElementById('cw-header-left');
    const dragHandle = document.getElementById('cw-draghandle');
    const preview = document.getElementById('cw-preview');
    const closeBtn = document.getElementById('cw-close');
    const messagesEl = document.getElementById('cw-messages');
    const input = document.getElementById('cw-input');
    const sendBtn = document.getElementById('cw-send');
    const menuEl = document.getElementById('cw-mention-menu');
    const unreadDot = document.getElementById('cw-unread');

    let profiles = [];
    let lastRenderedSender = null;
    let lastRenderedAt = 0;
    let mentionStart = -1, mentionActiveIndex = 0, currentSuggestions = [];

    function setExpanded(expanded) {
      drawer.classList.toggle('expanded', expanded);
      if (expanded) {
        unreadDot.classList.remove('show');
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }
    function toggleExpanded() {
      setExpanded(!drawer.classList.contains('expanded'));
    }

    // Tap-or-swipe on the handle/header-left/preview toggles the drawer.
    // (The close button has its own click handler and deliberately sits
    // outside header-left so the two never both fire for the same tap.)
    function attachSwipe(el) {
      let startY = null;
      el.addEventListener('pointerdown', (e) => {
        startY = e.clientY;
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointerup', (e) => {
        if (startY === null) return;
        const deltaY = startY - e.clientY; // positive = swiped up
        startY = null;
        const expanded = drawer.classList.contains('expanded');
        if (Math.abs(deltaY) < 10) { toggleExpanded(); return; }
        if (deltaY > 10 && !expanded) setExpanded(true);
        else if (deltaY < -10 && expanded) setExpanded(false);
      });
      el.addEventListener('pointercancel', () => { startY = null; });
    }
    attachSwipe(dragHandle);
    attachSwipe(headerLeft);
    attachSwipe(preview);
    closeBtn.addEventListener('click', () => toggleExpanded());

    function renderBody(body) {
      const usernames = new Set(profiles.map((p) => p.username.toLowerCase()));
      return escapeHtml(body).replace(/@(\w+)/g, (match, name) => {
        const lower = name.toLowerCase();
        if (lower === 'all') return `<span class="mention-all">@all</span>`;
        if (usernames.has(lower)) return `<span class="mention">@${name}</span>`;
        return match;
      });
    }

    function appendMessage(msg, scroll) {
      const grouped = msg.user_id === lastRenderedSender && new Date(msg.created_at) - lastRenderedAt < 5 * 60 * 1000;
      lastRenderedSender = msg.user_id;
      lastRenderedAt = new Date(msg.created_at);

      const row = document.createElement('div');
      row.className = 'cw-msg' + (grouped ? ' grouped' : '');
      const avatarHtml = grouped
        ? '<div class="cw-avatar spacer"></div>'
        : `<div class="cw-avatar" style="background:${colorForUsername(msg.username)}">${msg.username.slice(0, 1).toUpperCase()}</div>`;
      const headHtml = grouped
        ? ''
        : `<div class="cw-msg-head"><span class="cw-username" style="color:${colorForUsername(msg.username)}">@${escapeHtml(msg.username)}</span><span class="cw-time">${relTime(msg.created_at)}</span></div>`;

      row.innerHTML = `${avatarHtml}<div class="cw-body">${headHtml}<div class="cw-text">${renderBody(msg.body)}</div></div>`;
      messagesEl.appendChild(row);
      if (scroll) messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function setPreview(msg) {
      preview.innerHTML = `<b>@${escapeHtml(msg.username)}</b> ${escapeHtml(msg.body).slice(0, 60)}`;
    }

    async function loadMessages() {
      const { data, error } = await SC.client
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(300);
      if (error) throw error;
      messagesEl.innerHTML = '';
      lastRenderedSender = null;
      if (data.length === 0) {
        messagesEl.innerHTML = '<div class="cw-empty">No messages yet — say hello.</div>';
      } else {
        data.forEach((m) => appendMessage(m, false));
        setPreview(data[data.length - 1]);
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function subscribeRealtime() {
      SC.client
        .channel('chat_messages_live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
          const empty = messagesEl.querySelector('.cw-empty');
          if (empty) empty.remove();
          appendMessage(payload.new, true);
          setPreview(payload.new);
          if (!drawer.classList.contains('expanded') && payload.new.user_id !== profile.id) {
            unreadDot.classList.add('show');
          }
        })
        .subscribe();
    }

    function extractMentions(body) {
      const usernames = new Set(profiles.map((p) => p.username.toLowerCase()));
      const found = new Set();
      (body.match(/@(\w+)/g) || []).forEach((m) => {
        const name = m.slice(1).toLowerCase();
        if (name === 'all' || usernames.has(name)) found.add(name);
      });
      return [...found];
    }

    async function sendMessage() {
      const body = input.value.trim();
      if (!body) return;
      sendBtn.disabled = true;
      try {
        const { error } = await SC.client.from('chat_messages').insert({
          user_id: profile.id,
          username: profile.username,
          body,
          mentions: extractMentions(body)
        });
        if (error) throw error;
        input.value = '';
        autoGrow(input);
        hideMentionMenu();
      } catch (err) {
        alert(err.message || 'Could not send message.');
      } finally {
        sendBtn.disabled = false;
      }
    }

    function autoGrow(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 100) + 'px';
    }

    function mentionCandidates() {
      const names = profiles.map((p) => p.username);
      if (profile.is_admin) names.unshift('all');
      return names;
    }
    function hideMentionMenu() {
      menuEl.classList.remove('show');
      mentionStart = -1;
      currentSuggestions = [];
    }
    function updateMentionMenu() {
      const caret = input.selectionStart;
      const uptoCaret = input.value.slice(0, caret);
      const match = uptoCaret.match(/(?:^|\s)@(\w*)$/);
      if (!match) { hideMentionMenu(); return; }
      mentionStart = caret - match[1].length - 1;
      const partial = match[1].toLowerCase();
      currentSuggestions = mentionCandidates().filter((n) => n.toLowerCase().startsWith(partial));
      if (currentSuggestions.length === 0) { hideMentionMenu(); return; }
      mentionActiveIndex = 0;
      menuEl.innerHTML = currentSuggestions
        .map((n, i) => `<div data-i="${i}" class="${i === 0 ? 'active' : ''}">@${n}</div>`)
        .join('');
      menuEl.classList.add('show');
      [...menuEl.children].forEach((el) =>
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          applyMention(currentSuggestions[Number(el.dataset.i)]);
        })
      );
    }
    function applyMention(username) {
      const caret = input.selectionStart;
      const before = input.value.slice(0, mentionStart);
      const after = input.value.slice(caret);
      const insert = `@${username} `;
      input.value = before + insert + after;
      const newCaret = before.length + insert.length;
      input.setSelectionRange(newCaret, newCaret);
      hideMentionMenu();
      input.focus();
    }
    function highlightMenuIndex(delta) {
      if (currentSuggestions.length === 0) return;
      mentionActiveIndex = (mentionActiveIndex + delta + currentSuggestions.length) % currentSuggestions.length;
      [...menuEl.children].forEach((el, i) => el.classList.toggle('active', i === mentionActiveIndex));
    }

    input.addEventListener('input', () => { autoGrow(input); updateMentionMenu(); });
    input.addEventListener('keydown', (e) => {
      if (menuEl.classList.contains('show')) {
        if (e.key === 'ArrowDown') { e.preventDefault(); highlightMenuIndex(1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); highlightMenuIndex(-1); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyMention(currentSuggestions[mentionActiveIndex]); return; }
        if (e.key === 'Escape') { hideMentionMenu(); return; }
      }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    sendBtn.addEventListener('click', sendMessage);

    profiles = await SC.listProfiles();
    await loadMessages();
    subscribeRealtime();

    window.ChatWidget = { expand: () => setExpanded(true), collapse: () => setExpanded(false) };
  })();
})();
