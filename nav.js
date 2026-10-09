/* Renders the shared top nav into #nav-root. Call SC_NAV.render(activePage, profile). */
window.SC_NAV = {
  render(activePage, profile) {
    const root = document.getElementById('nav-root');
    if (!root) return;
    const links = [{ id: 'challenge', href: 'challenge.html', label: 'Challenge' }];
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
          <a href="#" id="nav-chat">Chat</a>
          <span class="username">@${profile ? profile.username : ''}</span>
          <a href="#" id="nav-logout">Log out</a>
        </div>
      </nav>
    `;
    document.getElementById('nav-chat').addEventListener('click', (e) => {
      e.preventDefault();
      if (window.ChatWidget) window.ChatWidget.expand();
    });
    document.getElementById('nav-logout').addEventListener('click', (e) => {
      e.preventDefault();
      SC.signOut();
    });
  }
};
