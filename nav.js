/* App shell: gradient header band + bottom tab bar, shared across every
 * authenticated page. Call SC_SHELL.renderHeader(opts) and
 * SC_SHELL.renderTabs(activeTab, profile). */
window.SC_THEME = {
  get() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  },
  set(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('sc-theme', theme); } catch (e) {}
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#4c3f94' : '#7c6fe6');
  },
  toggle() {
    SC_THEME.set(SC_THEME.get() === 'dark' ? 'light' : 'dark');
  }
};

const SC_ICONS = {
  sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  moonToggle: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
  gear: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  moon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
  community: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  trophy: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4"/></svg>',
  poll: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  shield: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
};

const SC_TABS = [
  { id: 'home', href: 'home.html', label: 'Home', icon: SC_ICONS.home },
  { id: 'sleep-log', href: 'sleep-log.html', label: 'Sleep Log', icon: SC_ICONS.moon },
  { id: 'community', href: 'community.html', label: 'Community', icon: SC_ICONS.community },
  { id: 'rewards', href: 'rewards.html', label: 'Rewards', icon: SC_ICONS.trophy },
  { id: 'polls', href: 'polls.html', label: 'Polls', icon: SC_ICONS.poll },
  { id: 'privacy', href: 'privacy.html', label: 'Privacy', icon: SC_ICONS.shield }
];

window.SC_SHELL = {
  /* opts: { title, subtitle, chips: [{label, value}], profile } */
  renderHeader(opts) {
    const root = document.getElementById('header-root');
    if (!root) return;
    const profile = opts.profile;
    const chipsHtml = (opts.chips || [])
      .map((c) => `<div class="chip"><div class="chip-label">${c.label}</div><div class="chip-value">${c.value}</div></div>`)
      .join('');
    const adminBtn = profile && profile.is_admin
      ? `<a class="icon-btn" href="admin.html" aria-label="Admin" title="Admin">${SC_ICONS.gear}</a>`
      : '';
    root.innerHTML = `
      <div class="app-header">
        <div class="app-header-top">
          <div class="app-header-title"><span class="icon">${SC_ICONS.moon}</span><span>${opts.title}</span></div>
          <div class="app-header-actions">
            ${adminBtn}
            <button class="icon-btn" id="shell-theme-toggle" type="button" aria-label="Toggle dark mode"></button>
          </div>
        </div>
        ${opts.subtitle ? `<p class="app-header-sub">${opts.subtitle}</p>` : ''}
        ${chipsHtml ? `<div class="app-header-chips">${chipsHtml}</div>` : ''}
      </div>
    `;
    const themeBtn = document.getElementById('shell-theme-toggle');
    const paint = () => { themeBtn.innerHTML = SC_THEME.get() === 'dark' ? SC_ICONS.sun : SC_ICONS.moonToggle; };
    paint();
    themeBtn.addEventListener('click', () => { SC_THEME.toggle(); paint(); });
  },

  renderTabs(activeTab) {
    const root = document.getElementById('tabbar-root');
    if (!root) return;
    root.innerHTML = `
      <nav class="tab-bar">
        ${SC_TABS.map(
          (t) => `
          <a href="${t.href}" class="tab-item ${t.id === activeTab ? 'active' : ''}">
            ${t.icon}
            <span>${t.label}</span>
          </a>`
        ).join('')}
      </nav>
    `;
  }
};
