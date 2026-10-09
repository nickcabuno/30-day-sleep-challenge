/* Renders the shared top nav into #nav-root. Call SC_NAV.render(activePage, profile). */
window.SC_THEME = {
  get() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  },
  set(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('sc-theme', theme); } catch (e) {}
  },
  toggle() {
    SC_THEME.set(SC_THEME.get() === 'dark' ? 'light' : 'dark');
  }
};

const ICON_SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const ICON_MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';

window.SC_NAV = {
  render(activePage, profile) {
    const root = document.getElementById('nav-root');
    if (!root) return;
    const links = [];
    if (profile && profile.is_admin) {
      links.push({ id: 'admin', href: 'admin.html', label: 'Admin' });
    }
    const linkHtml = links
      .map(
        (l) =>
          `<a href="${l.href}" class="${l.id === activePage ? 'active' : ''}">${l.label}</a>`
      )
      .join('');
    root.innerHTML = `
      <nav class="topnav">
        <div class="brand">30 Day Sleep Challenge</div>
        <div class="links">
          ${linkHtml}
          <button class="theme-toggle" id="nav-theme-toggle" type="button" aria-label="Toggle dark mode"></button>
          <span class="username">@${profile ? profile.username : ''}</span>
        </div>
      </nav>
    `;
    const themeBtn = document.getElementById('nav-theme-toggle');
    const paintThemeIcon = () => {
      themeBtn.innerHTML = SC_THEME.get() === 'dark' ? ICON_SUN : ICON_MOON;
    };
    paintThemeIcon();
    themeBtn.addEventListener('click', () => {
      SC_THEME.toggle();
      paintThemeIcon();
    });
  }
};
