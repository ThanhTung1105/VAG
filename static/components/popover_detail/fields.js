/* ═══════════════════════════════════════════════════════
   PMO.Field — Popover detail field components
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

/* ── Field Row layout ── */
PMO.Field = {
  row: function(label, valueHTML) {
    return '<div class="pmo-field"><span class="f-label">' + label + '</span><div class="f-value">' + valueHTML + '</div></div>';
  },
  rowCol: function(label, valueHTML) {
    return '<div class="pmo-field"><span class="f-label">' + label + '</span><div class="f-value col">' + valueHTML + '</div></div>';
  }
};

/* ── Execution Mode ── */
PMO.ExecMode = {
  MODES: {
    independent:  { label: 'Independent',      icon: '📋', cls: 'independent' },
    online:       { label: 'Online Meeting',    icon: '💻', cls: 'online' },
    offline:      { label: 'Offline Meeting',   icon: '🏢', cls: 'offline' },
    workshop:     { label: 'Workshop',          icon: '🛠️', cls: 'workshop' },
    site_visit:   { label: 'Site Visit',        icon: '📍', cls: 'site_visit' },
    presentation: { label: 'Presentation',      icon: '📊', cls: 'presentation' }
  },
  ARROW: '<svg class="chip-arrow" viewBox="0 0 12 12" fill="currentColor"><path d="M3 4.5L6 7.5L9 4.5"/></svg>',

  render: function(mode, detail, opts) {
    opts = opts || {};
    var m = this.MODES[mode] || this.MODES.independent;
    var ed = opts.editable === true;
    var html = '';
    // Chip
    html += '<span class="pmo-exec-mode ' + m.cls + (ed ? ' editable' : '') + '"';
    if (ed) html += ' data-mode="' + mode + '"';
    html += '><span class="em-icon">' + m.icon + '</span>' + m.label;
    if (ed) html += this.ARROW;
    html += '</span>';
    // Detail text
    var detailText = detail || '';
    if (ed) {
      html += '<div class="pmo-exec-detail" contenteditable="true" data-placeholder="Mô tả cách thực hiện hoặc link meeting...">' + detailText + '</div>';
    } else if (detailText) {
      html += '<div class="pmo-exec-detail locked">' + detailText + '</div>';
    }
    return html;
  },

  _handleClick: function(el) {
    if (PMO._dd && PMO._dd.src === el) { PMO._dd.close(); return; }
    var current = el.dataset.mode;
    var self = this;
    var items = [];
    for (var k in this.MODES) {
      var m = this.MODES[k];
      items.push({ key: k, label: m.icon + ' ' + m.label, color: 'transparent', active: k === current });
    }
    PMO._dd.open(el, items, function(key) {
      var m = self.MODES[key];
      el.className = 'pmo-exec-mode ' + m.cls + ' editable';
      el.dataset.mode = key;
      // Update chip content
      el.innerHTML = '<span class="em-icon">' + m.icon + '</span>' + m.label + self.ARROW;
    });
  }
};

// Delegation
document.addEventListener('mousedown', function(e) {
  var el = e.target.closest('.pmo-exec-mode.editable');
  if (el) { e.stopPropagation(); PMO.ExecMode._handleClick(el); }
});

/* ── Deliverable Link ── */
PMO.DeliverableLink = {
  LINK_SVG: '<svg class="dl-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6.5 9.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5l-1 1"/><path d="M9.5 6.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5l1-1"/></svg>',
  OPEN_SVG: '↗',

  render: function(url, opts) {
    opts = opts || {};
    var ed = opts.editable !== false;
    var html = '<div class="pmo-deliverable">';
    html += this.LINK_SVG;
    if (ed) {
      html += '<div class="dl-input" contenteditable="true"' + (url ? ' data-has-link="true"' : '') + '>' + (url || '') + '</div>';
    } else {
      if (url) {
        html += '<span class="dl-input" data-has-link="true" style="cursor:pointer" onclick="window.open(\'' + url + '\',\'_blank\')">' + url + '</span>';
      } else {
        html += '<span class="dl-input" style="cursor:default"><span style="color:var(--t3);font-style:italic">Chưa có link</span></span>';
      }
    }
    if (url) {
      html += '<button class="dl-open" title="Mở link" onclick="window.open(\'' + url + '\',\'_blank\')">' + this.OPEN_SVG + '</button>';
    }
    html += '</div>';
    return html;
  }
};

/* ── Summary ── */
PMO.Summary = {
  render: function(text, opts) {
    opts = opts || {};
    var ed = opts.editable !== false;
    var placeholder = opts.placeholder || 'Ghi kết quả chính đạt được...';
    if (ed) {
      return '<div class="pmo-summary" contenteditable="true" data-placeholder="' + placeholder + '">' + (text || '') + '</div>';
    }
    return '<div class="pmo-summary locked">' + (text || '<span style="color:var(--t3);font-style:italic">Chưa có</span>') + '</div>';
  }
};

/* ── Progress Inline ── */
PMO.ProgressInline = {
  render: function(pctFinished, pctApproved, health, status) {
    var html = '<div class="pmo-progress-inline">';
    html += '<div class="pi-bar">';
    if (PMO.Bar) {
      html += PMO.Bar.render({ pctFinished: pctFinished, pctApproved: pctApproved, health: health, status: status });
    }
    html += '</div>';
    html += '<div class="pi-stats">';
    html += '<span class="pi-stat"><span class="pi-num">' + (pctFinished || 0) + '%</span><span class="pi-unit"> xong</span></span>';
    html += '<span class="pi-stat"><span class="pi-num">' + (pctApproved || 0) + '%</span><span class="pi-unit"> duyệt</span></span>';
    html += '</div>';
    html += '</div>';
    return html;
  }
};

/* ── Milestone Field (editable) ── */
PMO.MilestoneField = {
  LEVELS: { big: {label:'Big ★', icon:'★'}, small: {label:'Small ◇', icon:'◇'}, none: {label:'Không có', icon:'—'} },
  ARROW: '<svg class="chip-arrow" viewBox="0 0 12 12" fill="currentColor"><path d="M3 4.5L6 7.5L9 4.5"/></svg>',

  render: function(level, health, opts) {
    opts = opts || {};
    var ed = opts.editable === true;
    var l = this.LEVELS[level] || this.LEVELS.none;
    var html = '<span class="pmo-ms-field' + (ed ? ' editable' : '') + '" data-ms-level="' + (level||'none') + '" data-ms-health="' + (health||'on_track') + '">';
    if (PMO.Milestone) html += PMO.Milestone.render(level, health);
    html += ' <span style="font-size:12px;color:var(--t2)">' + l.label + '</span>';
    if (ed) html += this.ARROW;
    html += '</span>';
    return html;
  },

  _handleClick: function(el) {
    if (PMO._dd && PMO._dd.src === el) { PMO._dd.close(); return; }
    var current = el.dataset.msLevel;
    var health = el.dataset.msHealth;
    var self = this;
    var items = [
      {key:'big', label:'★ Big — mốc quan trọng', color:'#1A8CFF', active: current==='big'},
      {key:'small', label:'◇ Small — mốc phụ', color:'#93C5FD', active: current==='small'},
      {key:'none', label:'— Không có', color:'#D1D5DB', active: current==='none'}
    ];
    PMO._dd.open(el, items, function(key) {
      var tmp = document.createElement('div');
      tmp.innerHTML = self.render(key, health, {editable:true});
      el.parentNode.replaceChild(tmp.firstElementChild, el);
    });
  }
};

document.addEventListener('mousedown', function(e) {
  var el = e.target.closest('.pmo-ms-field.editable');
  if (el) { e.stopPropagation(); PMO.MilestoneField._handleClick(el); }
});

/* ── Member Field (single / list, editable) ── */
PMO.MemberField = {
  /** Default members — override via PMO.MemberField.setMembers(arr) */
  _members: [
    {id:'m1',name:'Long NNL',role:'BI Analyst'},
    {id:'m2',name:'Hà NTT',role:'Admin'},
    {id:'m3',name:'Minh PT',role:'IT'},
    {id:'m4',name:'Anh LTD',role:'GĐ Điều hành'},
    {id:'m5',name:'Citek Team',role:'Đối tác SAP'},
    {id:'m6',name:'Dũng NV',role:'Kế toán'},
    {id:'m7',name:'Trang LH',role:'Nhân sự'}
  ],

  /** Call this to set members from database */
  setMembers: function(arr) { this._members = arr; },
  getMembers: function() { return this._members; },
  _groups: [],
  setGroups: function(arr) { this._groups = arr; },
  getGroups: function() { return this._groups; },
  ARROW: '<svg class="chip-arrow" viewBox="0 0 12 12" fill="currentColor"><path d="M3 4.5L6 7.5L9 4.5"/></svg>',
  SEARCH_SVG: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" stroke-width="1.5" style="flex-shrink:0"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',

  _ini: function(name) {
    return PMO.Avatar ? PMO.Avatar.initials(name) : (name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
  },

  /** Single member — click chip to open picker popover */
  renderSingle: function(name, role, opts) {
    opts = opts || {};
    var ed = opts.editable !== false;
    var html = '<span class="pmo-member-single' + (ed ? ' editable' : '') + '" data-member="' + (name||'') + '">';
    if (name) {
      var ini = this._ini(name);
      html += '<span class="pmo-chip has-role" style="cursor:'+(ed?'pointer':'default')+'"><span class="chip-av">' + ini + '</span>';
      html += '<span class="chip-info"><span class="chip-name">' + name + '</span>';
      if (role) html += '<span class="chip-role">' + role + '</span>';
      html += '</span>';
      if (ed) html += this.ARROW;
      html += '</span>';
    } else {
      html += '<button class="pmo-chip-add" style="margin:0">Chọn</button>';
    }
    html += '</span>';
    return html;
  },

  /** Assignee list — chip list with "+ Thêm" button */
  renderList: function(items, opts) {
    opts = opts || {};
    return '<div class="pmo-member-list-wrap" data-member-list>' +
      PMO.ChipMember.renderList(items, {maxLines: opts.maxLines || 2, showAdd: opts.editable !== false}) +
      '</div>';
  },

  /** Build popover HTML for member selection */
  _buildPopoverHTML: function(mode, selectedNames) {
    var sel = new Set(selectedNames || []);
    var html = '<div class="pmo-popover open" style="position:fixed;z-index:9999;width:280px">';
    html += '<div class="pmo-popover-search">';
    html += this.SEARCH_SVG;
    html += '<input placeholder="Tìm hoặc nhập tên mới..." autocomplete="off" class="pop-search-input">';
    html += '<button class="pop-add-btn" style="display:none">Thêm</button>';
    html += '</div>';
    html += '<div class="pmo-popover-list">';
    if (mode === 'single') {
      html += '<div class="pmo-popover-item' + (sel.size === 0 ? ' selected' : '') + '" data-id="" data-name="">';
      html += '<span class="pi-check">✓</span><span style="color:var(--t3)">Bỏ chọn</span></div>';
    }
    var self = this;
    // Groups section (multi mode only)
    var groups = this.getGroups();
    if (groups.length && mode !== 'single') {
      html += '<div class="pop-section-label">Nhóm</div>';
      groups.forEach(function(g) {
        var gm = g.member_names || [];
        var allIn = gm.length > 0 && gm.every(function(n) { return sel.has(n); });
        html += '<div class="pmo-popover-item pop-group-item' + (allIn ? ' selected' : '') + '" data-group-id="' + g.id + '" data-group-name="' + g.name + '" data-group-members="' + gm.join(',') + '" data-color="' + (g.color || '#F97316') + '">';
        html += '<span class="pi-check">✓</span>';
        html += '<span class="pop-grp-av" style="background:' + (g.color || '#F97316') + '">' + (g.name || '?').slice(0,2).toUpperCase() + '</span>';
        html += '<span class="pop-grp-name">' + g.name + '</span>';
        html += '<span class="pop-grp-count">' + gm.length + '</span>';
        html += '</div>';
      });
      html += '<div class="pop-section-label">Thành viên</div>';
    }
    // Members section
    this.getMembers().forEach(function(m) {
      var isSel = sel.has(m.name);
      html += '<div class="pmo-popover-item' + (isSel ? ' selected' : '') + '" data-id="' + m.id + '" data-name="' + m.name + '" data-role="' + (m.role||'') + '">';
      html += '<span class="pi-check">✓</span>';
      html += '<span class="pmo-avatar sm" style="width:22px;height:22px;font-size:8px">' + self._ini(m.name) + '</span>';
      html += m.name;
      if (m.role) html += '<span style="color:var(--t3);font-size:10px;margin-left:auto">' + m.role + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  },

  /** Open single-choice picker popover on body */
  _openSinglePicker: function(el) {
    this._closePopover();
    var self = this;
    var current = el.dataset.member;

    var pop = document.createElement('div');
    pop.innerHTML = this._buildPopoverHTML('single', current ? [current] : []);
    var popEl = pop.firstElementChild;
    popEl.classList.add('single');
    document.body.appendChild(popEl);

    var rect = el.getBoundingClientRect();
    popEl.style.left = rect.left + 'px';
    popEl.style.top = (rect.bottom + 4) + 'px';
    popEl.id = 'pmoMemberPop';

    var input = popEl.querySelector('.pop-search-input');
    var addBtn = popEl.querySelector('.pop-add-btn');
    input.focus();

    // Search filter
    input.addEventListener('input', function() {
      var q = input.value.toLowerCase();
      popEl.querySelectorAll('.pmo-popover-item').forEach(function(it) {
        var n = (it.dataset.name || '').toLowerCase();
        it.style.display = (!n && !q) || n.indexOf(q) >= 0 ? '' : 'none';
      });
      addBtn.style.display = q.length >= 1 ? '' : 'none';
    });

    // Free-type add
    addBtn.addEventListener('mousedown', function(ev) {
      ev.preventDefault(); ev.stopPropagation();
      var val = input.value.trim();
      if (val) {
        self._closePopover();
        var tmp = document.createElement('div');
        tmp.innerHTML = self.renderSingle(val, '', {editable:true});
        el.parentNode.replaceChild(tmp.firstElementChild, el);
      }
    });

    // Item click
    popEl.querySelectorAll('.pmo-popover-item').forEach(function(item) {
      item.addEventListener('mousedown', function(ev) {
        ev.preventDefault(); ev.stopPropagation();
        self._closePopover();
        var name = item.dataset.name;
        var role = item.dataset.role || '';
        var tmp = document.createElement('div');
        tmp.innerHTML = self.renderSingle(name, role, {editable:true});
        el.parentNode.replaceChild(tmp.firstElementChild, el);
      });
    });

    // Close on outside
    self._setCloseHandler(popEl, el);
  },

  /** Open multi-choice picker for assignee list */
  _openListPicker: function(wrapEl) {
    this._closePopover();
    var self = this;
    var chipList = wrapEl.querySelector('.pmo-chip-list');
    if (!chipList) return;

    // Gather current names from chips (individuals + group members expanded)
    var currentNames = [];
    chipList.querySelectorAll('.pmo-chip[data-name]').forEach(function(c) {
      if (c.dataset.name) currentNames.push(c.dataset.name);
    });
    chipList.querySelectorAll('.pmo-chip-group[data-members]').forEach(function(c) {
      (c.dataset.members || '').split(',').filter(Boolean).forEach(function(n) {
        if (currentNames.indexOf(n) === -1) currentNames.push(n);
      });
    });

    var pop = document.createElement('div');
    pop.innerHTML = this._buildPopoverHTML('multi', currentNames);
    var popEl = pop.firstElementChild;
    document.body.appendChild(popEl);
    popEl.id = 'pmoMemberPop';

    var addBtn = wrapEl.querySelector('.pmo-chip-add');
    var rect = addBtn ? addBtn.getBoundingClientRect() : wrapEl.getBoundingClientRect();
    popEl.style.left = rect.left + 'px';
    popEl.style.top = (rect.bottom + 4) + 'px';

    var input = popEl.querySelector('.pop-search-input');
    var freeBtn = popEl.querySelector('.pop-add-btn');
    input.focus();

    // Search filter
    input.addEventListener('input', function() {
      var q = input.value.toLowerCase();
      popEl.querySelectorAll('.pmo-popover-item').forEach(function(it) {
        var n = (it.dataset.name || '').toLowerCase();
        it.style.display = n.indexOf(q) >= 0 ? '' : 'none';
      });
      freeBtn.style.display = q.length >= 1 ? '' : 'none';
    });

    // Free-type add
    freeBtn.addEventListener('mousedown', function(ev) {
      ev.preventDefault(); ev.stopPropagation();
      var val = input.value.trim();
      if (val) {
        self._addChipToList(chipList, val, '');
        input.value = '';
        freeBtn.style.display = 'none';
        input.focus();
      }
    });

    // Item toggle — members AND groups
    popEl.querySelectorAll('.pmo-popover-item').forEach(function(item) {
      item.addEventListener('mousedown', function(ev) {
        ev.preventDefault(); ev.stopPropagation();

        // ── Group item click (Phương án 3: group = shortcut) ──
        if (item.dataset.groupId) {
          var gMembers = (item.dataset.groupMembers || '').split(',').filter(Boolean);
          var gName = item.dataset.groupName;
          var gColor = item.dataset.color || '#F97316';
          item.classList.toggle('selected');
          var adding = item.classList.contains('selected');

          if (adding) {
            // ADD: select all group members + add group chip
            gMembers.forEach(function(mName) {
              var mItem = popEl.querySelector('.pmo-popover-item[data-name="' + mName + '"]');
              if (mItem && !mItem.classList.contains('selected')) mItem.classList.add('selected');
              self._addChipToList(chipList, mName, '');
            });
            self._addGroupChipToList(chipList, gName, gMembers, gColor);
          } else {
            // REMOVE: only remove members EXCLUSIVE to this group
            // (not in any other selected group, and not individually added without group)
            var otherSelectedGroups = [];
            popEl.querySelectorAll('.pop-group-item.selected').forEach(function(gi) {
              if (gi.dataset.groupName !== gName) {
                otherSelectedGroups.push((gi.dataset.groupMembers || '').split(',').filter(Boolean));
              }
            });
            var protectedMembers = new Set();
            otherSelectedGroups.forEach(function(gm) { gm.forEach(function(n) { protectedMembers.add(n); }); });

            gMembers.forEach(function(mName) {
              if (protectedMembers.has(mName)) return; // protected by another group
              var mItem = popEl.querySelector('.pmo-popover-item[data-name="' + mName + '"]');
              if (mItem) mItem.classList.remove('selected');
              var chip = chipList.querySelector('.pmo-chip[data-name="' + mName + '"]');
              if (chip) chip.remove();
            });
            // Remove group chip
            var gChip = chipList.querySelector('.pmo-chip-group[data-group="' + gName + '"]');
            if (gChip) gChip.remove();
          }
          return;
        }

        // ── Regular member item click ──
        var name = item.dataset.name;
        if (!name) return;
        var role = item.dataset.role || '';
        item.classList.toggle('selected');
        if (item.classList.contains('selected')) {
          self._addChipToList(chipList, name, role);
        } else {
          var chip = chipList.querySelector('.pmo-chip[data-name="' + name + '"]');
          if (chip) chip.remove();
          // Uncheck any group that contained this member (no longer "all in")
          popEl.querySelectorAll('.pop-group-item.selected').forEach(function(gi) {
            var gm = (gi.dataset.groupMembers || '').split(',');
            if (gm.indexOf(name) >= 0) {
              gi.classList.remove('selected');
              var gChip = chipList.querySelector('.pmo-chip-group[data-group="' + gi.dataset.groupName + '"]');
              if (gChip) gChip.remove();
            }
          });
        }
      });
    });

    // Enter = add free-type
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); freeBtn.click(); }
    });

    // Close on outside
    self._setCloseHandler(popEl, wrapEl);
  },

  _addChipToList: function(chipList, name, role) {
    // Check if already exists
    if (chipList.querySelector('.pmo-chip[data-name="' + name + '"]')) return;
    var addBtn = chipList.querySelector('.pmo-chip-add');
    var ini = this._ini(name);
    var chip = document.createElement('span');
    chip.className = 'pmo-chip';
    chip.dataset.name = name;
    chip.innerHTML = '<span class="chip-av">' + ini + '</span>' + name + '<span class="chip-x">×</span>';
    chip.querySelector('.chip-x').addEventListener('click', function(e) { e.stopPropagation(); chip.remove(); });
    if (addBtn) chipList.insertBefore(chip, addBtn);
    else chipList.appendChild(chip);
  },

  _addGroupChipToList: function(chipList, groupName, memberNames, color) {
    // Check if already exists
    if (chipList.querySelector('.pmo-chip-group[data-group="' + groupName + '"]')) return;
    var addBtn = chipList.querySelector('.pmo-chip-add');
    var chip = document.createElement('span');
    chip.className = 'pmo-chip-group';
    chip.dataset.group = groupName;
    chip.dataset.members = memberNames.join(',');
    var ini = groupName.slice(0, 2).toUpperCase();
    chip.innerHTML = '<span class="chip-grp-av" style="background:' + color + '">' + ini + '</span>' + groupName + '<span class="chip-x">×</span>';
    // Tooltip — positioned by JS on hover
    var tipHtml = memberNames.map(function(n) {
      var mi = PMO.Avatar ? PMO.Avatar.initials(n) : n.slice(0,2).toUpperCase();
      return '<span class="chip-grp-tip-item"><span class="pmo-avatar sm" style="width:18px;height:18px;font-size:7px">' + mi + '</span>' + n + '</span>';
    }).join('');
    chip.addEventListener('mouseenter', function() {
      PMO.ChipMember._showGroupTooltip(chip, tipHtml);
    });
    chip.addEventListener('mouseleave', function() {
      PMO.ChipMember._hideGroupTooltip();
    });
    chip.querySelector('.chip-x').addEventListener('click', function(e) {
      e.stopPropagation();
      memberNames.forEach(function(n) {
        var mc = chipList.querySelector('.pmo-chip[data-name="' + n + '"]');
        if (mc) mc.remove();
      });
      chip.remove();
    });
    var firstMemberChip = chipList.querySelector('.pmo-chip');
    if (firstMemberChip) chipList.insertBefore(chip, firstMemberChip);
    else if (addBtn) chipList.insertBefore(chip, addBtn);
    else chipList.appendChild(chip);
  },

  /** Open group member popover — shows members in group, click to open group management */
  _openGroupPopover: function(grpChip) {
    this._closePopover();
    var groupName = grpChip.dataset.group;
    var memberStr = grpChip.dataset.members || '';
    var memberNames = memberStr.split(',').filter(Boolean);
    var self = this;

    var pop = document.createElement('div');
    pop.className = 'pmo-popover open';
    pop.id = 'pmoMemberPop';
    pop.style.cssText = 'position:fixed;z-index:9999;width:220px';

    var html = '<div class="pop-grp-header" style="padding:10px 12px;border-bottom:1px solid var(--b-light);display:flex;align-items:center;gap:8px">';
    // Find group color
    var groups = this.getGroups();
    var gColor = '#F97316';
    groups.forEach(function(g) { if (g.name === groupName) gColor = g.color || '#F97316'; });
    var ini = (groupName || '').slice(0, 2).toUpperCase();
    html += '<span class="pop-grp-av" style="background:' + gColor + ';width:28px;height:28px;font-size:10px">' + ini + '</span>';
    html += '<div><div style="font-weight:700;font-size:12px">' + groupName + '</div>';
    html += '<div style="font-size:10px;color:var(--t3)">' + memberNames.length + ' thành viên</div></div>';
    html += '</div>';

    html += '<div class="pmo-popover-list" style="max-height:200px">';
    memberNames.forEach(function(n) {
      var mi = self._ini(n);
      html += '<div class="pmo-popover-item" style="cursor:default">';
      html += '<span class="pmo-avatar sm" style="width:22px;height:22px;font-size:8px">' + mi + '</span>';
      html += n;
      html += '</div>';
    });
    html += '</div>';
    pop.innerHTML = html;

    document.body.appendChild(pop);
    var rect = grpChip.getBoundingClientRect();
    pop.style.left = rect.left + 'px';
    pop.style.top = (rect.bottom + 6) + 'px';

    // Ensure it's on screen
    var popRect = pop.getBoundingClientRect();
    if (popRect.right > window.innerWidth) pop.style.left = (window.innerWidth - popRect.width - 8) + 'px';
    if (popRect.bottom > window.innerHeight) pop.style.top = (rect.top - popRect.height - 6) + 'px';

    this._setCloseHandler(pop, grpChip);
  },

  _closePopover: function() {
    var existing = document.getElementById('pmoMemberPop');
    if (existing) existing.remove();
    // Remove any dangling close handler
    if (this._activeCloseHandler) {
      document.removeEventListener('mousedown', this._activeCloseHandler);
      this._activeCloseHandler = null;
    }
  },

  _setCloseHandler: function(popEl, anchorEl) {
    var self = this;
    // Remove previous handler first
    if (this._activeCloseHandler) {
      document.removeEventListener('mousedown', this._activeCloseHandler);
    }
    this._activeCloseHandler = function(ev) {
      if (!popEl.contains(ev.target) && !anchorEl.contains(ev.target)) {
        self._closePopover();
      }
    };
    setTimeout(function() { document.addEventListener('mousedown', self._activeCloseHandler); }, 0);
  }
};

// Delegation for single member click
document.addEventListener('mousedown', function(e) {
  // Group chip avatar click → open group member popover
  var grpAv = e.target.closest('.pmo-chip-group .chip-grp-av');
  if (grpAv) {
    e.stopPropagation();
    var grpChip = grpAv.closest('.pmo-chip-group');
    if (grpChip) PMO.MemberField._openGroupPopover(grpChip);
    return;
  }
  var el = e.target.closest('.pmo-member-single.editable');
  if (el) { e.stopPropagation(); PMO.MemberField._openSinglePicker(el); return; }
  // Delegation for list "+ Thêm" button
  var addBtn = e.target.closest('.pmo-member-list-wrap .pmo-chip-add');
  if (addBtn) {
    e.stopPropagation();
    var wrap = addBtn.closest('.pmo-member-list-wrap');
    if (wrap) PMO.MemberField._openListPicker(wrap);
  }
});
