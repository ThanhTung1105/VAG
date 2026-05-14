/* ═══════════════════════════════════════════════════════
   pmo-avatar — Avatar JS
   PMO.Avatar.render(name, size?) → single avatar HTML
   PMO.Avatar.renderGroup(names, size?) → group HTML (PIC + "+N")
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.Avatar = {
  initials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  },

  render(name, size) {
    const ini = this.initials(name);
    const cls = size === 'sm' ? 'pmo-avatar sm' : 'pmo-avatar';
    return `<span class="${cls}" title="${name || ''}">${ini}</span>`;
  },

  renderGroup(names, size, maxShow) {
    if (!names || !names.length) return '';
    maxShow = maxShow || 3;
    const sz = size || '';
    let html = '<span class="pmo-avatar-group">';
    const show = Math.min(names.length, maxShow);
    for (let i = 0; i < show; i++) {
      html += this.render(names[i], sz);
    }
    if (names.length > maxShow) {
      const cls = sz === 'sm' ? 'pmo-avatar sm more' : 'pmo-avatar more';
      html += `<span class="${cls}">+${names.length - maxShow}</span>`;
    }
    html += '</span>';
    return html;
  }
};
