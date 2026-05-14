/* ═══════════════════════════════════════════════════════
   PMO.ChipMember — Member & Group chips
   Compact design: small avatar + name, thin border
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.ChipMember = {
  initials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  },

  render(name, opts = {}) {
    const ini = this.initials(name);
    const removable = opts.removable !== false;
    let html = `<span class="pmo-chip" data-name="${name}">`;
    html += `<span class="chip-av">${ini}</span>`;
    html += `<span class="chip-name">${name}</span>`;
    if (removable) html += `<span class="chip-x">×</span>`;
    html += '</span>';
    return html;
  },

  renderWithRole(name, role, opts = {}) {
    const ini = this.initials(name);
    const removable = opts.removable !== false;
    let html = `<span class="pmo-chip has-role" data-name="${name}">`;
    html += `<span class="chip-av">${ini}</span>`;
    html += `<span class="chip-info"><span class="chip-name">${name}</span>`;
    if (role) html += `<span class="chip-role">${role}</span>`;
    html += `</span>`;
    if (removable) html += `<span class="chip-x">×</span>`;
    html += '</span>';
    return html;
  },

  /** Inline chip for table cells — compact: [🔵LN] Name */
  renderInline(name) {
    const ini = this.initials(name);
    return `<span class="pmo-chip-inline" title="${name}"><span class="chi-av">${ini}</span>${name}</span>`;
  },

  renderInlineGroup(groupName, color, members) {
    const ini = (groupName || '?').slice(0, 2).toUpperCase();
    const tipItems = (members || []).map(n => {
      const mi = this.initials(n);
      return `<span class="chip-grp-tip-item"><span class="pmo-avatar sm" style="width:18px;height:18px;font-size:7px">${mi}</span>${n}</span>`;
    }).join('');
    return `<span class="pmo-chip-inline grp" data-grp-tip="${this._escAttr(tipItems)}" title="${groupName}"><span class="chi-av" style="background:${color}">${ini}</span>${groupName}</span>`;
  },

  /** Compact for table — inline chips, group-aware */
  renderCompact(names, maxShow) {
    if (!names || !names.length) return '';
    maxShow = maxShow || 4;
    const nameSet = new Set(names);
    const groups = (PMO.MemberField && PMO.MemberField.getGroups) ? PMO.MemberField.getGroups() : [];
    const covered = new Set();
    let chips = [];

    groups.forEach(g => {
      const gm = g.member_names || [];
      if (gm.length > 0 && gm.every(n => nameSet.has(n))) {
        chips.push(this.renderInlineGroup(g.name, g.color || '#F97316', gm));
        gm.forEach(n => covered.add(n));
      }
    });
    names.forEach(n => {
      if (covered.has(n)) return;
      chips.push(this.renderInline(n));
    });

    const allTip = names.map(n => {
      const mi = this.initials(n);
      return `<span class="chip-grp-tip-item"><span class="pmo-avatar sm" style="width:18px;height:18px;font-size:7px">${mi}</span>${n}</span>`;
    }).join('');

    let html = `<span class="pmo-chip-compact" data-grp-tip="${this._escAttr(allTip)}">`;
    const show = Math.min(chips.length, maxShow);
    for (let i = 0; i < show; i++) html += chips[i];
    if (chips.length > maxShow) html += `<span class="pmo-chip-inline more">+${chips.length - maxShow}</span>`;
    html += '</span>';
    return html;
  },

  renderList(items, opts = {}) {
    const showAdd = opts.showAdd !== false;
    const maxLines = opts.maxLines || 3;
    const linesCls = maxLines !== 3 ? ` lines-${maxLines}` : '';
    const style = maxLines > 5 || ![2,3,4,5].includes(maxLines) ? ` style="--chip-lines:${maxLines}"` : '';
    let html = `<div class="pmo-chip-list${linesCls}"${style}>`;

    const names = (items || []).map(i => typeof i === 'string' ? i : i.name);
    const nameSet = new Set(names);
    const groups = (PMO.MemberField && PMO.MemberField.getGroups) ? PMO.MemberField.getGroups() : [];
    const renderedAsGroup = new Set();

    groups.forEach(g => {
      const gm = g.member_names || [];
      if (gm.length > 0 && gm.every(n => nameSet.has(n))) {
        const ini = (g.name || '?').slice(0, 2).toUpperCase();
        const color = g.color || '#F97316';
        const tipItems = gm.map(n => {
          const mi = this.initials(n);
          return `<span class="chip-grp-tip-item"><span class="pmo-avatar sm" style="width:18px;height:18px;font-size:7px">${mi}</span>${n}</span>`;
        }).join('');
        html += `<span class="pmo-chip-group" data-group="${g.name}" data-members="${gm.join(',')}" data-grp-tip="${this._escAttr(tipItems)}">`;
        html += `<span class="chip-grp-av" style="background:${color}">${ini}</span>`;
        html += `<span class="chip-name">${g.name}</span>`;
        if (opts.removable !== false) html += `<span class="chip-x">×</span>`;
        html += '</span>';
        gm.forEach(n => renderedAsGroup.add(n));
      }
    });

    (items || []).forEach(item => {
      const name = typeof item === 'string' ? item : item.name;
      if (renderedAsGroup.has(name)) return;
      html += typeof item === 'string' ? this.render(item, opts) : this.renderWithRole(item.name, item.role, opts);
    });

    if (showAdd) html += '<button class="pmo-chip-add">+ Thêm</button>';
    html += '</div>';
    return html;
  },

  collectNames(container) {
    const nameSet = new Set();
    container.querySelectorAll('.pmo-chip[data-name]').forEach(c => { if (c.dataset.name) nameSet.add(c.dataset.name); });
    container.querySelectorAll('.pmo-chip-group[data-members]').forEach(c => { (c.dataset.members || '').split(',').filter(Boolean).forEach(n => nameSet.add(n)); });
    return [...nameSet];
  },

  _showGroupTooltip(anchor, html) {
    this._hideGroupTooltip();
    const tip = document.createElement('div');
    tip.className = 'chip-grp-tooltip'; tip.id = 'pmoGrpTip';
    tip.innerHTML = html;
    document.body.appendChild(tip);
    const rect = anchor.getBoundingClientRect();
    tip.style.left = rect.left + 'px'; tip.style.top = (rect.bottom + 6) + 'px';
    const tRect = tip.getBoundingClientRect();
    if (tRect.right > window.innerWidth) tip.style.left = (window.innerWidth - tRect.width - 8) + 'px';
    if (tRect.bottom > window.innerHeight) tip.style.top = (rect.top - tRect.height - 6) + 'px';
  },
  _hideGroupTooltip() { const t = document.getElementById('pmoGrpTip'); if (t) t.remove(); },
  _escAttr(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
};

// Global tooltip delegation — safe for text nodes (mouseover/mouseout, not mouseenter)
document.addEventListener('mouseover', function(e) {
  var el = e.target; if (el.nodeType !== 1) el = el.parentElement; if (!el) return;
  var tip = el.closest('[data-grp-tip]');
  if (tip) PMO.ChipMember._showGroupTooltip(tip, tip.dataset.grpTip);
});
document.addEventListener('mouseout', function(e) {
  var el = e.target; if (el.nodeType !== 1) el = el.parentElement; if (!el) return;
  var tip = el.closest('[data-grp-tip]');
  if (tip) PMO.ChipMember._hideGroupTooltip();
});
