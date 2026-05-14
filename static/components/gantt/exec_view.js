/* ═══════════════════════════════════════════════════════
   PMO.ExecView — Execution View (Thực thi)
   Standalone — own container, own scroll, own CSS
   Uses shared components: Avatar, Date, StatusChip, HealthChip,
     SubtaskStatus, Milestone, Bar, Textbox
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.ExecView = {
  _ctn: null,        // container element
  _colW: null,       // column widths {key: px}
  _rows: null,       // flattened rows
  _exp: null,        // expanded Set (shared with gantt state)
  _gantt: null,      // reference to GanttChart

  TOGGLE_SVG: '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3.5L5 7L8 3.5"/></svg>',

  LEVEL_ICONS: {},

  COLS: [
    { key:'name',       label:'Tên',              w:300, minW:150 },
    { key:'pic',        label:'PIC',              w:110, minW:60 },
    { key:'approver',   label:'Approver',         w:110, minW:60 },
    { key:'assignees',  label:'Người thực hiện',  w:140, minW:80 },
    { key:'dates',      label:'Thời gian',        w:150, minW:80 },
    { key:'progress',   label:'Tiến độ',          w:100, minW:70 },
    { key:'execMode',   label:'Hình thức',        w:130, minW:80 },
    { key:'execNote',   label:'Cách làm',         w:160, minW:80 },
    { key:'status',     label:'Trạng thái',       w:110, minW:70 },
    { key:'health',     label:'Sức khỏe',         w:100, minW:70 },
    { key:'completedAt',label:'Hoàn thành lúc',   w:110, minW:60 },
    { key:'keyResult',  label:'KQ chính',         w:180, minW:80 },
    { key:'link',       label:'Link',             w:50,  minW:40 },
    { key:'notes',      label:'Ghi chú',          w:50,  minW:40 },
  ],

  show: function(ganttChart) {
    this._gantt = ganttChart;
    this._exp = ganttChart.state.exp;
    var mainEl = ganttChart.el.querySelector('.gantt-main');
    if (!mainEl) return;

    // Hide gantt panels
    ganttChart.ref('lp').style.display = 'none';
    ganttChart.el.querySelector('.gantt-rp').style.display = 'none';

    // Create or reuse container
    if (!this._ctn) {
      this._ctn = document.createElement('div');
      this._ctn.className = 'exec-container';
      mainEl.appendChild(this._ctn);
    }
    this._ctn.style.display = '';

    if (!this._colW) {
      this._colW = {};
      var cw = this._colW;
      this.COLS.forEach(function(c) { cw[c.key] = c.w; });
    }
    // Auto-widen columns based on data (run once after first render)
    if (!this._colAutoSized) {
      this._colAutoSized = 1; // 1=pending, 2=done
      this._autoSizeColumns(ganttChart.data);
    }

    // Expand ALL levels for execution view
    var data = ganttChart.data, exp = this._exp;
    (data.programs || []).forEach(function(p) {
      exp.add(p.id);
      (p.projects || []).forEach(function(pj) {
        exp.add(pj.id);
        (pj.phases || []).forEach(function(ph) {
          exp.add(ph.id);
          (ph.workPackages || []).forEach(function(wp) {
            exp.add(wp.id);
            (wp.tasks || []).forEach(function(t) { exp.add(t.id); });
          });
        });
      });
    });

    // First show: load groups + personal sorts, then render
    // Re-render (after refresh): render immediately with fresh data
    var self2 = this;
    if (!this._initialized) {
      this._initialized = true;
      this._loadPersonalSorts(ganttChart.data, function() {
        self2._waitForGroups(function() {
          self2._render();
        });
      });
    } else {
      // Already initialized — render immediately with fresh gantt.data
      this._render();
    }
  },

  _waitForGroups: function(cb) {
    var groups = (PMO.MemberField && PMO.MemberField.getGroups) ? PMO.MemberField.getGroups() : [];
    if (groups.length > 0) { cb(); return; }
    // Groups not loaded yet — fetch directly
    fetch('/api/members-and-groups').then(function(r) { return r.json(); }).then(function(data) {
      if (data && PMO.MemberField) {
        if (data.members) PMO.MemberField.setMembers(data.members);
        if (data.groups) PMO.MemberField.setGroups(data.groups);
      }
      if (PMO.API) PMO.API._membersLoaded = true;
      cb();
    }).catch(function() { cb(); });
  },

  _loadPersonalSorts: function(data, cb) {
    if (!PMO.API) { cb(); return; }
    this._personalSorts = this._personalSorts || {};
    var taskIds = [];
    (data.programs || []).forEach(function(p) {
      (p.projects || []).forEach(function(pj) {
        (pj.phases || []).forEach(function(ph) {
          (ph.workPackages || []).forEach(function(wp) {
            (wp.tasks || []).forEach(function(t) {
              var tid = typeof t.id === 'string' ? parseInt(t.id.replace(/\D/g, '')) : t.id;
              if (t.subtasks && t.subtasks.length > 1) taskIds.push(tid);
            });
          });
        });
      });
    });
    if (!taskIds.length) { cb(); return; }
    var self = this, done = 0;
    taskIds.forEach(function(tid) {
      PMO.API.get('/subtask-sort/' + tid).then(function(res) {
        if (res && res.order && res.order.length) self._personalSorts['_sort_' + tid] = res.order;
      }).catch(function() {}).finally(function() { done++; if (done >= taskIds.length) cb(); });
    });
  },

  hide: function(ganttChart) {
    if (ganttChart.ref('lp')) ganttChart.ref('lp').style.display = '';
    var rp = ganttChart.el.querySelector('.gantt-rp');
    if (rp) rp.style.display = '';
    if (this._ctn) this._ctn.style.display = 'none';
  },

  /** Auto-size columns based on content — run after first render to measure actual DOM */
  _autoSizeColumns: function(data) {
    // Defer to after first render — measure actual cell widths
    var self = this;
    requestAnimationFrame(function() {
      if (!self._ctn) return;
      var changed = false;
      self.COLS.forEach(function(c) {
        if (c.key === 'name' || c.key === 'keyResult' || c.key === 'link' || c.key === 'notes' || c.key === 'execNote') return;
        var maxW = 0;
        // Measure header
        var hcell = self._ctn.querySelector('.exec-hcell[data-col="' + c.key + '"]');
        if (hcell) maxW = Math.max(maxW, hcell.scrollWidth + 12);
        // Measure body cells (sample first 50)
        var cells = self._ctn.querySelectorAll('.exec-cell[data-col="' + c.key + '"]');
        var limit = Math.min(cells.length, 50);
        for (var i = 0; i < limit; i++) {
          var cw = cells[i].scrollWidth + 8;
          if (cw > maxW) maxW = cw;
        }
        if (maxW > self._colW[c.key]) {
          self._colW[c.key] = Math.min(maxW, 250); // cap at 250
          changed = true;
        }
      });
      if (changed) self._render(); // re-render with new widths
      self._colAutoSized = 2; // prevent loop: 1=first, 2=done
    });
  },

  /* ── Flatten with expand/collapse ── */
  _flatten: function(data) {
    var R = [], exp = this._exp, self = this;
    (data.programs || []).forEach(function(prg) {
      R.push(self._mkRow(prg, 'program', 0, true));
      if (!exp.has(prg.id)) return;
      (prg.projects || []).forEach(function(prj) {
        R.push(self._mkRow(prj, 'project', 1, true));
        if (!exp.has(prj.id)) return;
        (prj.phases || []).forEach(function(ph) {
          R.push(self._mkRow(ph, 'phase', 2, true));
          if (!exp.has(ph.id)) return;
          (ph.workPackages || []).forEach(function(wp) {
            R.push(self._mkRow(wp, 'wp', 3, true, wp));
            if (!exp.has(wp.id)) return;
            (wp.tasks || []).forEach(function(t) {
              R.push(self._mkRow(t, 'task', 4, true, null, t));
              if (!exp.has(t.id)) return;
              // Apply personal sort order if available
              var subs = (t.subtasks || []).slice();
              var taskDbId = typeof t.id === 'string' ? parseInt(t.id.replace(/\D/g, '')) : t.id;
              var sortKey = '_sort_' + taskDbId;
              if (self._personalSorts && self._personalSorts[sortKey]) {
                var order = self._personalSorts[sortKey];
                subs.sort(function(a, b) {
                  var aId = typeof a.id === 'string' ? parseInt(a.id.replace(/\D/g, '')) : a.id;
                  var bId = typeof b.id === 'string' ? parseInt(b.id.replace(/\D/g, '')) : b.id;
                  var ai = order.indexOf(aId), bi = order.indexOf(bId);
                  if (ai === -1) ai = 9999;
                  if (bi === -1) bi = 9999;
                  return ai - bi;
                });
              }
              subs.forEach(function(st) {
                R.push({
                  type:'subtask', depth:5, id:st.id, name:st.name, hasChildren:false,
                  assignees: st.assignees || (st.assignee ? [st.assignee] : []),
                  pic: t.pic, approver: t.approver,
                  plannedStart: st.plannedStart, plannedFinish: st.plannedFinish,
                  actualFinish: st.actualFinish, finishStatus: st.finishStatus,
                  keyResult: st.keyResult || '', deliverableUrl: st.deliverableUrl || '',
                  _src: st, parentId: t.id
                });
              });
            });
          });
        });
      });
    });
    return R;
  },

  _mkRow: function(item, type, depth, hasChildren, wp, task) {
    var G = PMO.Gantt;
    var r = {
      type: type, depth: depth, id: item.id, name: item.name,
      hasChildren: hasChildren,
      pctFinished: item.pctFinished != null ? item.pctFinished : (G.calcPctFinished ? G.calcPctFinished(item) : 0),
      pctApproved: item.pctApproved != null ? item.pctApproved : (G.calcPctApproved ? G.calcPctApproved(item) : 0),
      status: item.status || (G.calcStatus ? G.calcStatus(item) : ''),
      health: item.health || (G.calcHealth ? G.calcHealth(item) : 'on_track'),
      pic: item.pic || '', approver: item.approver || '',
      assignees: item.assignees || [],
      executionMode: item.executionMode || '',
      plannedStart: item.plannedStart || '', plannedFinish: item.plannedFinish || '',
      _src: item
    };
    if (wp) { r.milestone = wp.milestone; }
    return r;
  },

  /* ── Main render ── */
  _render: function() {
    var self = this, cw = this._colW, gantt = this._gantt;
    var rows = this._flatten(gantt.data);
    this._rows = rows;
    // Also set gantt.rows so _openDetail works
    gantt.rows = rows;

    var totalW = 0;
    this.COLS.forEach(function(c) { totalW += cw[c.key]; });

    // Header — with filter icons (Excel-style, right corner)
    var h = '<div class="exec-head"><div class="exec-head-inner" style="width:' + totalW + 'px">';
    this.COLS.forEach(function(c) {
      h += '<div class="exec-hcell" data-col="' + c.key + '" style="width:' + cw[c.key] + 'px">' + c.label;
      if (PMO.ExecFilter) h += PMO.ExecFilter.headerIcon(c.key);
      h += '<span class="exec-resize" data-resize="' + c.key + '"></span></div>';
    });
    h += '</div></div>';

    // Filter row — inside head area so it scrolls together
    if (PMO.ExecFilter) {
      if (!PMO.ExecFilter._state) {
        var currentUser = (PMO.API && PMO.API._me) ? PMO.API._me : '';
        PMO.ExecFilter.init(currentUser);
      }
      h += '<div class="exec-filter-area"><div class="exec-filter-inner" style="width:' + totalW + 'px">';
      h += PMO.ExecFilter.renderRow(this.COLS, cw);
      h += '</div></div>';
    }

    // Apply filters
    var visibleRows = rows;
    if (PMO.ExecFilter) {
      visibleRows = PMO.ExecFilter.applyFilters(rows);
    }

    // Body
    h += '<div class="exec-scroll"><div class="exec-inner" style="width:' + totalW + 'px">';
    visibleRows.forEach(function(r) {
      var origIdx = rows.indexOf(r);
      var isSt = r.type === 'subtask';
      var indent = r.depth * 22;
      // Level color for gradient
      var lvColor = self._levelColor(r.type);
      h += '<div class="exec-row lv-' + r.type + '" data-idx="' + origIdx + '" data-id="' + r.id + '"' + (isSt ? ' draggable="true"' : '') + '>';
      self.COLS.forEach(function(c) {
        var w = cw[c.key];
        var extra = c.key === 'name' ? ' exec-cell-name' : '';
        var cellStyle = 'width:' + w + 'px;';
        if (c.key === 'name') {
          // Name cell: indent area = white, then level color starts
          cellStyle += 'padding-left:' + (8 + indent) + 'px;';
          cellStyle += 'background:linear-gradient(90deg, #fff ' + indent + 'px, ' + lvColor + ' ' + indent + 'px);';
        }
        h += '<div class="exec-cell' + extra + '" data-col="' + c.key + '" style="' + cellStyle + '">';
        h += self._cell(c.key, r);
        h += '</div>';
      });
      h += '<div class="exec-row-resize"></div>';
      h += '</div>';
    });
    h += '</div></div>';

    this._ctn.innerHTML = h;

    // Scroll sync — header, filter, body all sync horizontally
    var sc = this._ctn.querySelector('.exec-scroll');
    var hi = this._ctn.querySelector('.exec-head-inner');
    var fi = this._ctn.querySelector('.exec-filter-inner');
    if (sc) {
      sc.addEventListener('scroll', function() {
        var x = sc.scrollLeft;
        if (hi) hi.style.transform = 'translateX(-' + x + 'px)';
        if (fi) fi.style.transform = 'translateX(-' + x + 'px)';
      });
    }

    // Bind filter — header icons + filter row
    if (PMO.ExecFilter) {
      var headEl = this._ctn.querySelector('.exec-head');
      if (headEl) PMO.ExecFilter.bindHeader(headEl, function() { self._render(); });
      var filterArea = this._ctn.querySelector('.exec-filter-area');
      if (filterArea) PMO.ExecFilter.bind(filterArea, function() { self._render(); });
    }

    // Click
    this._ctn.querySelectorAll('.exec-row').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (e.target.closest('.exec-link') || e.target.closest('.exec-note-icon')) return;
        // Toggle expand
        var tog = e.target.closest('.exec-tog');
        if (tog) { e.stopPropagation(); self._toggle(tog.dataset.tog); return; }

        // Subtask checkbox — toggle finish status
        var chk = e.target.closest('.exec-st-check');
        if (chk) {
          e.stopPropagation();
          self._toggleSubtaskFinish(chk);
          return;
        }

        // Subtask approve/reject popover
        var stApprove = e.target.closest('[data-st-approve]');
        if (stApprove) {
          e.stopPropagation();
          self._openApprovePopover(stApprove, stApprove.dataset.stApprove, 'subtask');
          return;
        }

        // Task bulk approve/reject popover
        var taskApprove = e.target.closest('[data-task-approve]');
        if (taskApprove) {
          e.stopPropagation();
          self._openApprovePopover(taskApprove, taskApprove.dataset.taskApprove, 'task');
          return;
        }

        var r = rows[parseInt(el.dataset.idx)];
        if (r) gantt._openDetail(r);
      });
    });

    // Resize + Drag + Row height
    this._bindResize();
    this._bindRowResize();
    this._bindDrag();
  },

  /** Toggle subtask finish — optimistic UI */
  _toggleSubtaskFinish: function(chkEl) {
    var stId = chkEl.dataset.stId;
    var dbId = typeof stId === 'string' ? parseInt(stId.replace(/\D/g, '')) : stId;
    if (!dbId || !PMO.API) return;

    // Optimistic: toggle UI immediately
    var curFs = chkEl.dataset.fs;
    var newFs = curFs === 'unfinished' ? 'finished' : 'unfinished';
    chkEl.dataset.fs = newFs;
    chkEl.className = 'exec-st-check' + (newFs === 'finished' ? ' finished' : newFs === 'approved' ? ' approved' : '');
    // Update name text color
    var nameEl = chkEl.parentElement.querySelector('.exec-name-text');
    if (nameEl) {
      nameEl.classList.remove('exec-st-finished', 'exec-st-approved');
      if (newFs === 'finished') nameEl.classList.add('exec-st-finished');
    }
    // Update status chip in same row
    var row = chkEl.closest('.exec-row');
    if (row) {
      var stsCell = row.querySelector('[data-col="status"]');
      if (stsCell && PMO.SubtaskStatus) {
        if (newFs === 'finished') {
          stsCell.innerHTML = '<span class="exec-sts-action" data-st-approve="' + stId + '">' + PMO.SubtaskStatus.render(newFs) + '</span>';
        } else {
          stsCell.innerHTML = PMO.SubtaskStatus.render(newFs);
        }
      }
    }

    // Backend async — refresh tree silently after
    var self = this;
    PMO.API.toggleFinish(dbId).then(function() {
      self._gantt._refreshFromAPI();
    }).catch(function() {
      // Revert on error
      chkEl.dataset.fs = curFs;
      chkEl.className = 'exec-st-check' + (curFs === 'finished' ? ' finished' : curFs === 'approved' ? ' approved' : '');
    });
  },

  /** Open approve/reject popover for subtask or task */
  _openApprovePopover: function(anchor, itemId, level) {
    var old = document.getElementById('pmoApprovePop');
    if (old) old.remove();
    var self = this;
    var rect = anchor.getBoundingClientRect();

    var pop = document.createElement('div');
    pop.id = 'pmoApprovePop';
    pop.className = 'exec-approve-pop';
    pop.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + (rect.bottom + 4) + 'px;z-index:600';

    if (level === 'subtask') {
      pop.innerHTML = '<div class="eap-item eap-approve" data-action="approve">✓ Duyệt</div>' +
                      '<div class="eap-item eap-reject" data-action="reject">✕ Từ chối</div>';
    } else {
      pop.innerHTML = '<div class="eap-item eap-approve" data-action="approve-all">✓ Duyệt tất cả</div>' +
                      '<div class="eap-item eap-reject" data-action="reject-all">✕ Từ chối tất cả</div>';
    }

    document.body.appendChild(pop);

    pop.addEventListener('click', function(e) {
      var item = e.target.closest('.eap-item');
      if (!item) return;
      var action = item.dataset.action;
      pop.remove();

      if (action === 'approve' || action === 'reject') {
        var dbId = typeof itemId === 'string' ? parseInt(itemId.replace(/\D/g, '')) : itemId;
        if (dbId && PMO.API) {
          PMO.API.approveSubtask(dbId, action).then(function() { self._gantt._refreshFromAPI(); });
        }
      } else if (action === 'approve-all' || action === 'reject-all') {
        var act = action === 'approve-all' ? 'approve' : 'reject';
        // Find all pending subtasks under this task
        var taskRow = self._rows.find(function(r) { return r.id === itemId; });
        if (!taskRow || !taskRow._src) return;
        var pending = (taskRow._src.subtasks || []).filter(function(st) { return st.finishStatus === 'finished'; });
        var done = 0;
        pending.forEach(function(st) {
          var dbStId = typeof st.id === 'string' ? parseInt(st.id.replace(/\D/g, '')) : st.id;
          if (dbStId && PMO.API) {
            PMO.API.approveSubtask(dbStId, act).then(function() {
              done++;
              if (done >= pending.length) self._gantt._refreshFromAPI();
            });
          }
        });
      }
    });

    setTimeout(function() {
      document.addEventListener('click', function h(ev) {
        if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('click', h); }
      });
    }, 50);
  },

  _toggle: function(id) {
    if (this._exp.has(id)) this._exp.delete(id); else this._exp.add(id);
    this._render();
  },

  _levelColor: function(type) {
    switch (type) {
      case 'program':  return '#B8D4EA';
      case 'project':  return '#CEDFEE';
      case 'phase':    return '#DEEAF3';
      case 'wp':       return '#EBF1F7';
      case 'task':     return '#F5F7FA';
      case 'subtask':  return '#EDEEF1';
      default:         return '#FFFFFF';
    }
  },

  /* ── Cell renderer — uses proper components ── */
  _cell: function(key, r) {
    var isSt = r.type === 'subtask';
    var isParent = !isSt;
    var src = r._src || {};

    switch (key) {
      case 'name':
        var h = '';
        // Toggle
        if (isParent && r.hasChildren) {
          var ex = this._exp.has(r.id);
          h += '<button class="exec-tog gantt-tog ' + (ex ? '' : 'col') + '" data-tog="' + r.id + '">' + this.TOGGLE_SVG + '</button>';
        } else if (isParent) {
          h += '<span class="gantt-tog-ph"></span>';
        }
        // Subtask: checkbox before name
        if (isSt) {
          var fs = r.finishStatus || 'unfinished';
          var chkCls = fs === 'approved' ? ' approved' : fs === 'finished' ? ' finished' : '';
          h += '<span class="exec-st-check' + chkCls + '" data-st-id="' + r.id + '" data-fs="' + fs + '">';
          h += PMO.Checkbox ? PMO.Checkbox.SVG : '☐';
          h += '</span>';
        }
        // Level icon (emoji)
        var li = this.LEVEL_ICONS[r.type];
        if (li) h += '<span class="exec-level-icon">' + li.label + '</span>';
        // Milestone icon for WP
        if (r.type === 'wp' && r.milestone && r.milestone !== 'none' && PMO.Milestone) {
          h += PMO.Milestone.render(r.milestone, r.health || 'on_track');
        }
        // Name text — color by finish status for subtask
        if (isSt) {
          var nCls = r.finishStatus === 'approved' ? 'exec-st-approved' : r.finishStatus === 'finished' ? 'exec-st-finished' : '';
          h += '<span class="exec-name-text ' + nCls + '">' + _e(r.name) + '</span>';
        } else {
          h += '<span class="exec-name-text">' + _e(r.name) + '</span>';
        }
        return h;

      case 'pic':
        var pic = r.pic || src.pic || '';
        if (!pic) return '';
        return PMO.ChipMember ? PMO.ChipMember.renderInline(pic) : pic;

      case 'approver':
        var ap = r.approver || src.approver || '';
        if (!ap) return '';
        return PMO.ChipMember ? PMO.ChipMember.renderInline(ap) : ap;

      case 'assignees':
        var as = isSt ? (r.assignees || []) : (src.assignees || r.assignees || []);
        if (!as.length) return '';
        // Inline chips with group detection
        var chipHtml = PMO.ChipMember ? PMO.ChipMember.renderCompact(as, 6) : as.join(', ');
        return '<div class="exec-assignee-wrap">' + chipHtml + '</div>';

      case 'execMode':
        var em = r.executionMode || src.executionMode || '';
        if (!em) return '';
        if (PMO.ExecMode) return PMO.ExecMode.render(em.toLowerCase().replace(/\s+/g, '_'), '', {});
        return em;

      case 'dates':
        var ds = r.plannedStart || src.plannedStart || '';
        var df = r.plannedFinish || src.plannedFinish || '';
        if (!ds && !df) return '';
        if (!PMO.Date) return ds + ' → ' + df;
        if (ds && df && ds !== df) return PMO.Date.renderRange(ds, df, {showTime:'auto'});
        return PMO.Date.render(ds || df, {showTime:'auto'});

      case 'completedAt':
        if (isSt && r.finishStatus === 'approved' && r.actualFinish) {
          return PMO.Date ? PMO.Date.render(r.actualFinish, {showTime:'auto'}) : r.actualFinish;
        }
        return '';

      case 'status':
        if (isSt) {
          var stStatus = r.finishStatus || 'unfinished';
          if (stStatus === 'finished') {
            // Clickable "Chờ duyệt" for approver
            return '<span class="exec-sts-action" data-st-approve="' + r.id + '">' + (PMO.SubtaskStatus ? PMO.SubtaskStatus.render(stStatus) : stStatus) + '</span>';
          }
          return PMO.SubtaskStatus ? PMO.SubtaskStatus.render(stStatus) : '';
        }
        // Task level — check if has pending subtasks for bulk approve
        if (r.type === 'task' && r.status) {
          var hasPending = (src.subtasks || []).some(function(st) { return st.finishStatus === 'finished'; });
          if (hasPending) {
            return '<span class="exec-sts-action" data-task-approve="' + r.id + '">' + (PMO.StatusChip ? PMO.StatusChip.render(r.status, r.health || 'on_track') : r.status) + '</span>';
          }
        }
        if (r.status && PMO.StatusChip) return PMO.StatusChip.render(r.status, r.health || 'on_track');
        return '';

      case 'health':
        if (isParent && r.health && PMO.HealthChip) return PMO.HealthChip.render(r.health);
        return '';

      case 'progress':
        if (!isParent) return '';
        var pF = r.pctFinished || 0, pA = r.pctApproved || 0;
        var fClr = pF >= 80 ? 'var(--c-co,#16A34A)' : pF >= 40 ? 'var(--c-ar,#EAB308)' : pF > 0 ? 'var(--c-ip,#1A8CFF)' : 'var(--t3,#9CA3AF)';
        var aClr = pA >= 80 ? 'var(--c-co,#16A34A)' : pA >= 40 ? 'var(--c-ar,#EAB308)' : pA > 0 ? 'var(--c-ip,#1A8CFF)' : 'var(--t3,#9CA3AF)';
        return '<span class="exec-pct-text"><span style="color:' + fClr + ';font-weight:700">' + pF + '%</span> <span class="exec-pct-label">xong</span> · <span style="color:' + aClr + ';font-weight:700">' + pA + '%</span> <span class="exec-pct-label">duyệt</span></span>';

      case 'execNote':
        var en = src.executionNote || src.execution_note || '';
        if (!en) return '';
        return '<span class="exec-kr" title="' + _e(en) + '">' + _e(en) + '</span>';

      case 'keyResult':
        var kr = isSt ? r.keyResult : (src.ketQuaChinh || src.keyResult || '');
        if (!kr) return '';
        return '<span class="exec-kr" title="' + _e(kr) + '">' + _e(kr) + '</span>';

      case 'link':
        var url = isSt ? r.deliverableUrl : (src.deliverableUrl || '');
        if (!url) return '';
        return '<a href="' + _e(url) + '" target="_blank" class="exec-link" onclick="event.stopPropagation()">🔗</a>';

      case 'notes':
        return '<span class="exec-note-icon">💬</span>';

      default: return '';
    }
  },

  /* ── Column resize ── */
  _bindResize: function() {
    var self = this, ctn = this._ctn;
    ctn.addEventListener('mousedown', function(e) {
      var h = e.target.closest('.exec-resize');
      if (!h) return;
      e.preventDefault();
      var key = h.dataset.resize, hcell = h.closest('.exec-hcell');
      var startX = e.clientX, startW = hcell.offsetWidth;
      var minW = 40;
      self.COLS.forEach(function(c) { if (c.key === key) minW = c.minW; });
      document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
      function onM(ev) {
        var nw = Math.max(minW, startW + ev.clientX - startX);
        self._colW[key] = nw;
        ctn.querySelectorAll('[data-col="' + key + '"]').forEach(function(el) { el.style.width = nw + 'px'; });
        var tw = 0; self.COLS.forEach(function(c) { tw += self._colW[c.key]; });
        var hi = ctn.querySelector('.exec-head-inner'), bi = ctn.querySelector('.exec-inner');
        if (hi) hi.style.width = tw + 'px';
        if (bi) bi.style.width = tw + 'px';
      }
      function onU() { document.removeEventListener('mousemove', onM); document.removeEventListener('mouseup', onU); document.body.style.cursor = ''; document.body.style.userSelect = ''; }
      document.addEventListener('mousemove', onM); document.addEventListener('mouseup', onU);
    });
  },

  /* ── Row height resize ── */
  _bindRowResize: function() {
    var ctn = this._ctn;
    ctn.addEventListener('mousedown', function(e) {
      var handle = e.target.closest('.exec-row-resize');
      if (!handle) return;
      e.preventDefault();
      e.stopPropagation();
      var row = handle.closest('.exec-row');
      if (!row) return;
      var startY = e.clientY;
      var startH = row.offsetHeight;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      function onM(ev) {
        var newH = Math.max(28, startH + ev.clientY - startY);
        row.style.minHeight = newH + 'px';
        row.querySelectorAll('.exec-cell').forEach(function(c) { c.style.minHeight = newH + 'px'; });
      }
      function onU() {
        document.removeEventListener('mousemove', onM);
        document.removeEventListener('mouseup', onU);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      document.addEventListener('mousemove', onM);
      document.addEventListener('mouseup', onU);
    });
  },

  /* ── Drag & drop with DB persistence ── */
  _bindDrag: function() {
    var inner = this._ctn.querySelector('.exec-inner');
    if (!inner) return;
    var self = this, dr = null;
    inner.addEventListener('dragstart', function(e) { dr = e.target.closest('.exec-row[draggable]'); if (dr) { dr.style.opacity = '.4'; e.dataTransfer.effectAllowed = 'move'; } });
    inner.addEventListener('dragover', function(e) { e.preventDefault(); var t = e.target.closest('.exec-row[draggable]'); if (t && t !== dr) t.style.borderTop = '2px solid var(--brand)'; });
    inner.addEventListener('dragleave', function(e) { var t = e.target.closest('.exec-row[draggable]'); if (t) t.style.borderTop = ''; });
    inner.addEventListener('drop', function(e) {
      e.preventDefault();
      var t = e.target.closest('.exec-row[draggable]');
      if (t && dr && t !== dr) {
        t.style.borderTop = '';
        inner.insertBefore(dr, t);
        // Save order: find parent task, collect subtask order
        self._saveSubtaskOrder(inner, dr);
      }
    });
    inner.addEventListener('dragend', function() { if (dr) { dr.style.opacity = ''; dr = null; } inner.querySelectorAll('.exec-row').forEach(function(r) { r.style.borderTop = ''; }); });
  },

  _saveSubtaskOrder: function(inner, droppedRow) {
    // Find the parent task of the dropped subtask
    var drIdx = parseInt(droppedRow.dataset.idx);
    var drRow = this._rows[drIdx];
    if (!drRow || drRow.type !== 'subtask') return;
    var taskId = drRow.parentId;
    if (!taskId) return;
    // DB task ID (strip prefix)
    var dbTaskId = typeof taskId === 'string' ? parseInt(taskId.replace(/\D/g, '')) : taskId;

    // Collect current DOM order of subtasks under this task
    var order = [];
    inner.querySelectorAll('.exec-row.lv-subtask').forEach(function(el) {
      var idx = parseInt(el.dataset.idx);
      var r = PMO.ExecView._rows[idx];
      if (r && r.parentId === taskId) {
        var stDbId = typeof r.id === 'string' ? parseInt(r.id.replace(/\D/g, '')) : r.id;
        order.push(stDbId);
      }
    });

    // Save via API
    if (PMO.API) {
      PMO.API.put('/subtask-sort/' + dbTaskId, { order: order });
    }
  }
};

function _e(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
