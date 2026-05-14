/* ═══════════════════════════════════════════════════════
   PMO.ExecFilter — Filter system for execution view
   - Filter icon in header cell (Excel-style, right corner)
   - Filter row below header with toggles + search
   - Hierarchy-aware filtering
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.ExecFilter = {
  FILTER_SVG: '<svg class="ef-ico" viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 2.5h11L8 7.5v4l-2 1v-5z"/></svg>',
  X_SVG: '<svg viewBox="0 0 10 10" width="8" height="8" fill="currentColor"><path d="M2.5 1.8L5 4.3l2.5-2.5.7.7L5.7 5l2.5 2.5-.7.7L5 5.7 2.5 8.2l-.7-.7L4.3 5 1.8 2.5z"/></svg>',

  _state: null,
  _currentUser: null,

  init: function(currentUser) {
    this._currentUser = currentUser || '';
    if (!this._state) {
      this._state = {
        name: '', status: [], health: [], execMode: [],
        pic: 'all', approver: 'all', assignees: 'all',
        dates: 'all', completedAt: 'all'
      };
    }
  },

  /** Render filter icon inside header cell (appended after label) */
  headerIcon: function(colKey) {
    var filterable = ['status','health','pic','approver','assignees','execMode'];
    if (filterable.indexOf(colKey) === -1) return '';
    return '<span class="ef-hbtn" data-filter-open="' + colKey + '">' + this.FILTER_SVG + '</span>';
  },

  /** Render filter row */
  renderRow: function(cols, colWidths) {
    var self = this, s = this._state;
    var h = '';
    cols.forEach(function(c) {
      var w = colWidths[c.key];
      h += '<div class="ef-cell" data-col="' + c.key + '" style="width:' + w + 'px;flex-shrink:0">';
      switch (c.key) {
        case 'name':
          h += '<div class="ef-search"><input class="ef-input" type="text" placeholder="Tìm kiếm..." data-filter="name" value="' + _e(s.name) + '">' + self.FILTER_SVG + '</div>';
          break;
        case 'pic': case 'approver': case 'assignees':
          var isMe = s[c.key] === 'me';
          h += '<div class="ef-member">';
          h += '<button class="ef-toggle' + (isMe ? ' on' : '') + '" data-toggle="' + c.key + '">Có tôi</button>';
          h += '</div>';
          break;
        case 'dates': case 'completedAt':
          var cur = s[c.key];
          h += '<div class="ef-date">';
          h += '<button class="ef-dtog' + (cur === 'week' ? ' on' : '') + '" data-dtog="' + c.key + ':week">Tuần này</button>';
          h += '<button class="ef-dtog' + (cur === 'today' ? ' on' : '') + '" data-dtog="' + c.key + ':today">Hôm nay</button>';
          if (cur !== 'all') h += '<button class="ef-clear-x" data-dclear="' + c.key + '" title="Bỏ lọc">' + self.X_SVG + '</button>';
          h += '</div>';
          break;
        default: break;
      }
      h += '</div>';
    });
    return '<div class="exec-filter-row">' + h + '</div>';
  },

  /** Bind events */
  bind: function(container, onFilterChange) {
    var self = this;

    // Name search — debounced, preserves cursor
    var nameInput = container.querySelector('[data-filter="name"]');
    if (nameInput) {
      var timer = null;
      nameInput.addEventListener('input', function() {
        clearTimeout(timer);
        var val = this.value;
        timer = setTimeout(function() {
          self._state.name = val.trim().toLowerCase();
          onFilterChange();
          // Restore focus after re-render
          setTimeout(function() {
            var inp = container.querySelector ? container.querySelector('[data-filter="name"]') : null;
            // container might be stale after re-render, use ExecView._ctn
            var ctn = PMO.ExecView && PMO.ExecView._ctn;
            if (ctn) {
              var fresh = ctn.querySelector('[data-filter="name"]');
              if (fresh) { fresh.focus(); fresh.setSelectionRange(val.length, val.length); }
            }
          }, 10);
        }, 300);
      });
    }

    // "Có tôi" toggle
    container.addEventListener('click', function(e) {
      var tog = e.target.closest('[data-toggle]');
      if (tog) {
        var col = tog.dataset.toggle;
        self._state[col] = self._state[col] === 'me' ? 'all' : 'me';
        onFilterChange();
        return;
      }

      // Date toggles — mutual exclusive
      var dtog = e.target.closest('[data-dtog]');
      if (dtog) {
        var parts = dtog.dataset.dtog.split(':');
        var col = parts[0], val = parts[1];
        // Toggle: if already selected, turn off
        self._state[col] = self._state[col] === val ? 'all' : val;
        onFilterChange();
        return;
      }

      // Date clear X
      var dclear = e.target.closest('[data-dclear]');
      if (dclear) {
        self._state[dclear.dataset.dclear] = 'all';
        onFilterChange();
        return;
      }

      // Multi-select dropdown
      var fbtn = e.target.closest('[data-filter-open]');
      if (fbtn) {
        e.stopPropagation();
        self._openDropdown(fbtn, fbtn.dataset.filterOpen, onFilterChange);
      }
    });
  },

  /** Also bind header filter icons (called separately on header) */
  bindHeader: function(headerEl, onFilterChange) {
    var self = this;
    headerEl.addEventListener('click', function(e) {
      var btn = e.target.closest('.ef-hbtn');
      if (!btn) return;
      e.stopPropagation();
      self._openDropdown(btn, btn.dataset.filterOpen, onFilterChange);
    });
  },

  _openDropdown: function(anchor, key, onFilterChange) {
    var old = document.querySelector('.ef-dropdown'); if (old) old.remove();
    var self = this, rect = anchor.getBoundingClientRect();
    var dd = document.createElement('div'); dd.className = 'ef-dropdown';
    dd.style.cssText = 'position:fixed;left:' + Math.min(rect.left, window.innerWidth - 240) + 'px;top:' + (rect.bottom + 4) + 'px;z-index:600';

    var values = this._collectValues(key);
    var selected = (this._state[key] instanceof Array) ? this._state[key] : [];

    var hdr = '<div class="efd-header"><span class="efd-title">Lọc ' + this._labelFor(key) + '</span>';
    if (selected.length) hdr += '<button class="efd-clear">Xóa lọc</button>';
    hdr += '</div>';
    dd.innerHTML = hdr;

    var list = document.createElement('div'); list.className = 'efd-list';
    values.forEach(function(v) {
      var chk = selected.indexOf(v.key) >= 0;
      var opt = document.createElement('label'); opt.className = 'efd-opt';
      opt.innerHTML = '<input type="checkbox"' + (chk ? ' checked' : '') + '><span class="efd-label">' + v.html + '</span>';
      opt.querySelector('input').addEventListener('change', function() {
        var idx = selected.indexOf(v.key);
        if (this.checked && idx === -1) selected.push(v.key);
        else if (!this.checked && idx >= 0) selected.splice(idx, 1);
        self._state[key] = selected;
        onFilterChange();
      });
      list.appendChild(opt);
    });
    dd.appendChild(list);

    var clr = dd.querySelector('.efd-clear');
    if (clr) clr.addEventListener('click', function() { self._state[key] = []; dd.remove(); onFilterChange(); });

    document.body.appendChild(dd);
    setTimeout(function() { document.addEventListener('click', function h(ev) { if (!dd.contains(ev.target)) { dd.remove(); document.removeEventListener('click', h); } }); }, 50);
  },

  _labelFor: function(k) { return {status:'Trạng thái',health:'Sức khỏe',execMode:'Hình thức',pic:'PIC',approver:'Approver',assignees:'Người thực hiện'}[k] || k; },

  _collectValues: function(key) {
    var rows = PMO.ExecView._rows || [], seen = {}, result = [];
    rows.forEach(function(r) {
      var vals = [];
      if (key === 'status') { var s = r.type === 'subtask' ? r.finishStatus : r.status; if (s) vals.push(s); }
      else if (key === 'health') { if (r.health) vals.push(r.health); }
      else if (key === 'execMode') { var em = r.executionMode || (r._src && r._src.executionMode); if (em) vals.push(em.toLowerCase().replace(/\s+/g,'_')); }
      else if (key === 'pic') { var p = r.pic || (r._src && r._src.pic); if (p) vals.push(p); }
      else if (key === 'approver') { var a = r.approver || (r._src && r._src.approver); if (a) vals.push(a); }
      else if (key === 'assignees') { (r.assignees || []).forEach(function(a) { vals.push(a); }); }
      vals.forEach(function(v) {
        if (seen[v]) return; seen[v] = true;
        var html = v;
        if ((key === 'status') && PMO.SubtaskStatus && (v === 'unfinished' || v === 'finished' || v === 'approved')) html = PMO.SubtaskStatus.render(v);
        else if (key === 'status' && PMO.StatusChip) html = PMO.StatusChip.render(v, 'on_track');
        else if (key === 'health' && PMO.HealthChip) html = PMO.HealthChip.render(v);
        else if (key === 'execMode' && PMO.ExecMode) html = PMO.ExecMode.render(v, '', {});
        else if (PMO.Avatar) html = PMO.Avatar.render(v, 'sm') + ' ' + v;
        result.push({ key: v, html: html });
      });
    });
    return result;
  },

  /** Apply filters — hierarchy-aware */
  applyFilters: function(rows) {
    var s = this._state; if (!s) return rows;
    var has = s.name || (s.status && s.status.length) || (s.health && s.health.length) || (s.execMode && s.execMode.length) ||
      s.pic !== 'all' || s.approver !== 'all' || s.assignees !== 'all' ||
      s.dates !== 'all' || s.completedAt !== 'all';
    if (!has) return rows;

    var self = this, match = [];
    for (var i = 0; i < rows.length; i++) match[i] = self._rowMatch(rows[i]);
    // Hierarchy: parent visible if any descendant matches
    var vis = match.slice();
    for (var i = rows.length - 1; i >= 0; i--) {
      if (!vis[i]) continue;
      var cd = rows[i].depth;
      for (var j = i - 1; j >= 0; j--) {
        if (rows[j].depth < cd) { vis[j] = true; cd = rows[j].depth; if (cd === 0) break; }
      }
    }
    return rows.filter(function(_, i) { return vis[i]; });
  },

  _rowMatch: function(r) {
    var s = this._state;
    if (s.name && (r.name || '').toLowerCase().indexOf(s.name) === -1) return false;
    if (s.status && s.status.length) {
      var st = r.type === 'subtask' ? r.finishStatus : r.status;
      if (s.status.indexOf(st) === -1) return false;
    }
    if (s.health && s.health.length && r.type !== 'subtask') {
      if (s.health.indexOf(r.health || '') === -1) return false;
    }
    if (s.execMode && s.execMode.length) {
      var em = (r.executionMode || (r._src && r._src.executionMode) || '').toLowerCase().replace(/\s+/g, '_');
      if (s.execMode.indexOf(em) === -1) return false;
    }
    if (s.pic === 'me') { if ((r.pic || (r._src && r._src.pic) || '') !== this._currentUser) return false; }
    if (s.approver === 'me') { if ((r.approver || (r._src && r._src.approver) || '') !== this._currentUser) return false; }
    if (s.assignees === 'me') { if ((r.assignees || []).indexOf(this._currentUser) === -1) return false; }
    if (s.dates !== 'all') {
      var ds = r.plannedStart || (r._src && r._src.plannedStart) || '';
      var df = r.plannedFinish || (r._src && r._src.plannedFinish) || '';
      if (!this._dm(ds, df, s.dates)) return false;
    }
    if (s.completedAt !== 'all') {
      if (!r.actualFinish || !this._dm(r.actualFinish, r.actualFinish, s.completedAt)) return false;
    }
    return true;
  },

  _dm: function(s, e, mode) {
    if (!s && !e) return false;
    var now = new Date(), d1 = s ? new Date(s.length <= 10 ? s + 'T00:00:00' : s) : null, d2 = e ? new Date(e.length <= 10 ? e + 'T23:59:59' : e) : null;
    if (mode === 'today') { var ts = now.toISOString().slice(0,10); return (d1 && d1.toISOString().slice(0,10) === ts) || (d2 && d2.toISOString().slice(0,10) === ts) || (d1 && d2 && d1 <= now && now <= d2); }
    if (mode === 'week') { var m = new Date(now); m.setDate(m.getDate() - m.getDay() + 1); m.setHours(0,0,0,0); var su = new Date(m); su.setDate(su.getDate() + 6); su.setHours(23,59,59); return (d1 && d1 >= m && d1 <= su) || (d2 && d2 >= m && d2 <= su) || (d1 && d2 && d1 <= su && d2 >= m); }
    return true;
  }
};

function _e(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
