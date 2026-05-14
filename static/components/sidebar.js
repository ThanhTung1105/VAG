/* ═══════════════════════════════════════════════════════
   PMO.Sidebar — shared sidebar injected into all pages.
   Auto-detects current route for active highlight.
   ═══════════════════════════════════════════════════════ */
(function() {
  var ITEMS = [
    { href: '/my-tasks', icon: 'check',   label: 'Việc của tôi' },
    { href: '/report',   icon: 'chart',   label: 'Báo cáo' },
    { divider: true },
    { href: '/gantt',    icon: 'gantt',   label: 'Gantt Chart' },
    { href: '/kanban',   icon: 'kanban',  label: 'Kanban' },
    { href: '/raiqd',    icon: 'raiqd',   label: 'RAIQD' },
    { href: '/workload', icon: 'clock',   label: 'Khối lượng CV' },
  ];

  var ICONS = {
    check: '<path d="M4 4h12a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z"/><path d="M7 9l2 2 4-4"/>',
    chart: '<rect x="3" y="10" width="3" height="7" rx=".5"/><rect x="8.5" y="6" width="3" height="11" rx=".5"/><rect x="14" y="3" width="3" height="14" rx=".5"/>',
    gantt: '<rect x="3" y="4" width="8" height="3" rx="1"/><rect x="6" y="9" width="10" height="3" rx="1"/><rect x="4" y="14" width="6" height="3" rx="1"/>',
    kanban: '<rect x="2" y="3" width="5" height="14" rx="1"/><rect x="8" y="3" width="5" height="10" rx="1"/><rect x="14" y="3" width="4" height="7" rx="1"/>',
    raiqd: '<path d="M10 3l7 4v6l-7 4-7-4V7z"/><path d="M10 3v14"/><path d="M3 7l7 4 7-4"/>',
    clock: '<circle cx="10" cy="10" r="7"/><path d="M10 7v3l2 2"/>',
    settings: '<circle cx="10" cy="7" r="3"/><path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6"/>',
    admin: '<circle cx="10" cy="10" r="3"/><path d="M10 2v2m0 12v2m-5.66-2.34l1.42-1.42m8.48-8.48l1.42-1.42M2 10h2m12 0h2m-2.34 5.66l-1.42-1.42M5.76 5.76L4.34 4.34"/>',
    logout: '<path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3"/><path d="M13 14l4-4-4-4"/><line x1="17" y1="10" x2="7" y2="10"/>',
  };

  function svg(name) {
    return '<svg viewBox="0 0 20 20">' + (ICONS[name] || '') + '</svg>';
  }

  var path = window.location.pathname;

  var h = '<nav class="pmo-sidebar" id="pmoSidebar">';

  // Profile
  h += '<div class="sb-profile">';
  h += '<div class="sb-avatar" id="sbAvatar">?</div>';
  h += '<div class="sb-label" style="display:flex;flex-direction:column;gap:1px">';
  h += '<span class="sb-username" id="sbUsername">...</span>';
  h += '<span class="sb-role" id="sbRole"></span>';
  h += '</div></div>';

  // Nav
  h += '<div class="sb-nav">';
  ITEMS.forEach(function(it) {
    if (it.divider) { h += '<div class="sb-div"></div>'; return; }
    var active = path === it.href ? ' active' : '';
    h += '<a href="' + it.href + '" class="sb-item' + active + '" data-tip="' + it.label + '">';
    h += '<div class="sb-icon">' + svg(it.icon) + '</div>';
    h += '<span class="sb-label">' + it.label + '</span>';
    h += '</a>';
  });
  h += '</div>';

  // Bottom
  h += '<div class="sb-bottom">';
  h += '<a href="/admin" class="sb-item" id="sbAdminLink" data-tip="Quản trị" style="display:none">';
  h += '<div class="sb-icon">' + svg('admin') + '</div>';
  h += '<span class="sb-label">Quản trị</span></a>';
  h += '<a href="/settings" class="sb-item" data-tip="Cài đặt">';
  h += '<div class="sb-icon">' + svg('settings') + '</div>';
  h += '<span class="sb-label">Cài đặt</span></a>';
  h += '<a href="javascript:void(0)" class="sb-item sb-logout" id="sbLogout" data-tip="Đăng xuất">';
  h += '<div class="sb-icon">' + svg('logout') + '</div>';
  h += '<span class="sb-label">Đăng xuất</span></a>';
  h += '</div></nav>';

  // Inject at body start
  document.body.insertAdjacentHTML('afterbegin', h);

  // Load user
  fetch('/api/auth/me')
    .then(function(r) { return r.json(); })
    .then(function(u) {
      if (u.error) { window.location.href = '/login'; return; }
      document.getElementById('sbAvatar').textContent = (u.display_name || '?')[0].toUpperCase();
      document.getElementById('sbUsername').textContent = u.display_name;
      document.getElementById('sbRole').textContent = u.system_role === 'admin' ? 'Quản trị viên' : 'Thành viên';
      if (u.system_role === 'admin') document.getElementById('sbAdminLink').style.display = '';
      window._pmoUser = u;
    })
    .catch(function() { window.location.href = '/login'; });

  // Logout
  document.getElementById('sbLogout').addEventListener('click', function() {
    fetch('/api/auth/logout', { method: 'POST' }).then(function() { window.location.href = '/login'; });
  });
})();
