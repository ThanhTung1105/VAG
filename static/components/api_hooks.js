/* ═══════════════════════════════════════════════════════
   PMO.APIHooks v3 — Centralized persistence layer.

   ARCHITECTURE:
   1. _collectState(ovP, row) — reads ALL editable fields
      from overview panel DOM into a flat payload object.
      Called once when user clicks "Cập nhật".

   2. Event delegation on popover container — a single
      click listener catches ALL subtask/approve actions
      and calls the appropriate API endpoint.

   3. _buildOverviewPanel override — fixes gantt.js
      hardcoded empty strings for executionNote/deliverableUrl.

   4. _buildPanels override — passes subtask assignee.

   NO monkey-patching individual component methods.
   NO MutationObservers (unreliable, cause loops).
   ═══════════════════════════════════════════════════════ */
(function() {
  var GC = PMO.GanttChart;
  var API = PMO.API;
  if (!GC || !API) return;

  // Fetch current user for filters
  API._me = '';
  API.get('/auth/me').then(function(u) { if (u && u.display_name) API._me = u.display_name; }).catch(function() {});

  // Load members + groups for picker
  API._membersLoaded = false;
  API.get('/members-and-groups').then(function(data) {
    if (data && PMO.MemberField) {
      if (data.members) PMO.MemberField.setMembers(data.members);
      if (data.groups) PMO.MemberField.setGroups(data.groups);
    }
    API._membersLoaded = true;
  }).catch(function() { API._membersLoaded = true; });

  // Module-level reference for subtask popover (assigned inside onMount, used by _openDetail)
  var _openSubtaskPopoverGlobal = null;

  /* ══════════════════════════════════════════════════════
     _bindNotePanel — module-level, used by both task and subtask popovers
     ══════════════════════════════════════════════════════ */
  function _bindNotePanel(container, noteRefTable, noteRefId, source) {
    var nList = container.querySelector('.pmo-note-list');
    var ta = container.querySelector('.ni-textarea');
    var sb = container.querySelector('.ni-send');
    var sc = container.closest('.panel-scroll') || container;
    if (!nList) return;
    if (noteRefId) {
      API.fetchNotes(noteRefTable, noteRefId).then(function(notes) {
        if (!notes || !notes.length) return;
        var em = nList.querySelector('.pmo-note-empty'); if (em) em.remove();
        var LL = { subtask:'Subtask', task:'Task', work_package:'WP', phase:'Phase', project:'Project', program:'Program' };
        notes.forEach(function(n) {
          var sl = source;
          if (n.ref_table !== noteRefTable || n.ref_id !== noteRefId) {
            sl = (LL[n.ref_table] || n.ref_table);
            if (n.ref_name) sl += ': ' + n.ref_name;
          }
          var tmp = document.createElement('div');
          tmp.innerHTML = PMO.Note.renderItem({
            id: n.id, author: n.author || 'Admin',
            time: n.created_at ? n.created_at.replace('T', ' ').slice(0, 16) : '',
            content: n.content, source: sl, isOwner: true
          });
          var ne = tmp.firstElementChild; ne.dataset.noteDbId = n.id;
          nList.appendChild(ne);
        });
      });
    }
    if (sb && ta) {
      var newSb = sb.cloneNode(true); sb.parentNode.replaceChild(newSb, sb); sb = newSb;
      var newTa = ta.cloneNode(true); ta.parentNode.replaceChild(newTa, ta); ta = newTa;
      ta.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 80) + 'px'; });
      function doSend() {
        var t = ta.value.trim(); if (!t || !noteRefId) return;
        API.createNote(noteRefTable, noteRefId, t).then(function(n) {
          var em = nList.querySelector('.pmo-note-empty'); if (em) em.remove();
          var tmp = document.createElement('div');
          tmp.innerHTML = PMO.Note.renderItem({ id: n.id, author: n.author || 'Admin', time: n.created_at ? n.created_at.replace('T', ' ').slice(0, 16) : '', content: n.content, source: source, isOwner: true });
          var ne = tmp.firstElementChild; ne.dataset.noteDbId = n.id; nList.appendChild(ne);
          if (sc) sc.scrollTop = sc.scrollHeight; ta.value = ''; ta.style.height = 'auto';
        }).catch(function(err) { console.error('Note create:', err); });
      }
      sb.addEventListener('click', doSend);
      ta.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });
    }
    nList.addEventListener('click', function(e) {
      var btn = e.target.closest('.ni-act-btn'); if (!btn) return;
      var ne = btn.closest('.pmo-note-item'); if (!ne) return;
      var dbId = ne.dataset.noteDbId;
      if (btn.dataset.act === 'delete') {
        ne.remove();
        if (!nList.querySelector('.pmo-note-item')) nList.innerHTML = '<div class="pmo-note-empty">Chưa có ghi chú nào</div>';
        if (dbId) API.del('/notes/' + dbId).catch(function(err) { console.error('Note del:', err); });
      } else if (btn.dataset.act === 'edit') {
        var c = ne.querySelector('.ni-content'); var oldText = c.textContent.trim();
        c.setAttribute('contenteditable', 'true'); c.focus();
        c.style.cssText = 'background:#FFFBEB;padding:4px;border-radius:4px;outline:1.5px solid var(--c-ar)';
        c.addEventListener('blur', function() {
          c.removeAttribute('contenteditable'); c.style.cssText = '';
          var newText = c.textContent.trim();
          if (newText && newText !== oldText && dbId) API.put('/notes/' + dbId, { content: newText }).catch(function(err) { console.error('Note edit:', err); });
        }, { once: true });
      }
    });
  }

  /* ══════════════════════════════════════════════════════
     _openSubtaskPopoverGlobal — subtask popover (module level)
     ══════════════════════════════════════════════════════ */
  _openSubtaskPopoverGlobal = function(stData, parentRow, gantt, taskBreadcrumb) {
    if (!PMO.PopoverShell) return;
    var parentSrc = (parentRow && parentRow._src) ? parentRow._src : {};
    var ctn = document.createElement('div');
    gantt.el.appendChild(ctn);
    var stBc = (taskBreadcrumb || []).concat([{ label: stData.name || 'Đầu việc', level: 'subtask', id: 'st' + stData.id }]);
    var h = '<div class="panel-full">';
    h += PMO.Field.row('Trạng thái', PMO.SubtaskStatus ? PMO.SubtaskStatus.render(stData.finishStatus || 'unfinished', { editable: true }) : stData.finishStatus);
    h += PMO.Field.row('PIC (task)', PMO.MemberField ? PMO.MemberField.renderSingle(parentSrc.pic || '', '', {}) : (parentSrc.pic || '—'));
    h += PMO.Field.row('Approver (task)', PMO.MemberField ? PMO.MemberField.renderSingle(parentSrc.approver || '', '', {}) : (parentSrc.approver || '—'));
    var aItems = (stData.assignees || []).map(function(n) { return { name: n }; });
    h += PMO.Field.row('Người thực hiện', PMO.MemberField ? PMO.MemberField.renderList(aItems, { maxLines: 2, editable: true }) : '');
    h += PMO.Field.row('Kế hoạch', PMO.Date ? PMO.Date.renderRange(stData.plannedStart || '', stData.plannedFinish || '', { editable: true }) : '');
    h += PMO.Field.row('Thực hiện', PMO.Date ? PMO.Date.renderRange(stData.actualStart || '', stData.actualFinish || '', { editable: true }) : '');
    h += PMO.Field.rowCol('KQ chính', PMO.Textbox ? PMO.Textbox.render(stData.keyResult || '', { block: true, placeholder: 'Nhập kết quả chính...' }) : '');
    h += PMO.Field.row('Link kết quả', PMO.DeliverableLink ? PMO.DeliverableLink.render(stData.deliverableUrl || '', { editable: true }) : '');
    h += '</div>';
    var notesH = '<div class="panel-scroll"><div class="pmo-note-list"><div class="pmo-note-empty">Chưa có ghi chú nào</div></div></div><div class="panel-footer"><div class="pmo-note-input" style="border-top:none;margin:0;padding:0"><textarea class="ni-textarea" placeholder="Nhập ghi chú..." rows="1"></textarea><button class="ni-send" title="Gửi">' + (PMO.Note ? PMO.Note.SEND_SVG : '➤') + '</button></div></div>';
    var trailH = PMO.Trail ? '<div class="panel-full">' + PMO.Trail.renderList([]) + '</div>' : '';
    PMO.PopoverShell.mount(ctn, {
      breadcrumb: stBc, level: 'subtask', title: stData.name || '', description: '', editable: true,
      tabs: [{ key: 'overview', label: 'Tổng quan' }, { key: 'notes', label: 'Ghi chú' }, { key: 'history', label: 'Lịch sử' }],
      activeTab: 'overview', panels: { overview: h, notes: notesH, history: trailH },
      onSave: function() {
        var ovP = ctn.querySelector('[data-panel="overview"]'); if (!ovP) return;
        var payload = {};
        var tEl = ctn.querySelector('.ph-title'); if (tEl) payload.content = tEl.textContent.trim();
        var sEl = ovP.querySelector('.pmo-st-status[data-sts]'); if (sEl) payload.finish_status = sEl.dataset.sts;
        payload.assignee_names = PMO.ChipMember ? PMO.ChipMember.collectNames(ovP) : [];
        ovP.querySelectorAll('.pmo-field').forEach(function(f) {
          var lbl = (f.querySelector('.f-label') || {}).textContent || '';
          var dEl = f.querySelector('.pmo-date[data-cfg]'); if (!dEl) return;
          try { var cfg = JSON.parse(dEl.dataset.cfg);
            if (lbl.indexOf('Kế hoạch') >= 0) { payload.planned_start = cfg.d ? dmyToIso(cfg.d + (cfg.t ? ' ' + cfg.t : '')) : null; payload.planned_finish = cfg.d2 ? dmyToIso(cfg.d2 + (cfg.t2 ? ' ' + cfg.t2 : '')) : null; }
            if (lbl.indexOf('Thực hiện') >= 0) { payload.actual_start = cfg.d ? dmyToIso(cfg.d + (cfg.t ? ' ' + cfg.t : '')) : null; payload.actual_finish = cfg.d2 ? dmyToIso(cfg.d2 + (cfg.t2 ? ' ' + cfg.t2 : '')) : null; }
          } catch (ex) {}
        });
        var krEl = ovP.querySelector('.pmo-textbox'); if (krEl) payload.key_result = krEl.textContent.trim();
        var dlEl = ovP.querySelector('.dl-input'); if (dlEl) payload.deliverable_url = dlEl.textContent.trim();
        API.updateSubtask(stData.id, payload).then(function() { gantt._refreshFromAPI(); });
      },
      onClose: function() { ctn.remove(); },
      onMount: function(el) {
        if (PMO.SubtaskStatus) PMO.SubtaskStatus.bind(el);
        el.querySelectorAll('[data-member-list]').forEach(function(w) { w.addEventListener('click', function(ev) { if (ev.target.closest('.pmo-chip-add') || ev.target.closest('[data-member-list]')) PMO.MemberField._openListPicker(w); }); });
        var nP = el.querySelector('[data-panel="notes"]'); if (nP) _bindNotePanel(nP, 'subtask', stData.id, 'subtask');
        var tEl = el.querySelector('[data-panel="history"]');
        if (tEl && PMO.Trail) { API.fetchTrail('subtask', stData.id).then(function(res) { if (!res || !res.entries || !res.entries.length) return; var list = tEl.querySelector('.pmo-trail-list'); if (!list) return; var em = list.querySelector('.pmo-trail-empty'); if (em) em.remove(); var m = { create: 'add', update: 'edit', 'delete': 'delete' }; res.entries.forEach(function(entry) { var tmp = document.createElement('div'); tmp.innerHTML = PMO.Trail.renderItem({ source: entry.source || 'user', time: entry.created_at ? entry.created_at.replace('T', ' ').slice(0, 16) : '', action: m[entry.action] || 'edit', level: 'subtask', target: entry.object_name || '', attr: entry.field_name || null, oldVal: entry.old_value || undefined, newVal: entry.new_value || undefined, user: entry.actor || 'System' }); list.appendChild(tmp.firstElementChild); }); }); }
      }
    });
  };

  /* ══════════════════════════════════════════════════════
     HELPERS
     ══════════════════════════════════════════════════════ */

  /** dd/mm/yyyy HH:MM → yyyy-mm-ddTHH:MM */
  function dmyToIso(s) {
    if (!s) return null;
    s = s.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 16); // already ISO, keep time
    // dd/mm/yyyy or dd/mm/yyyy HH:MM
    var parts = s.split(/\s+/);
    var dmy = parts[0].split('/');
    if (dmy.length !== 3) return null;
    var iso = dmy[2] + '-' + dmy[1] + '-' + dmy[0];
    if (parts[1]) iso += 'T' + parts[1];
    return iso;
  }

  /** Re-fetch tree, re-render. Normalize data fields. */
  GC._refreshFromAPI = function() {
    API.fetchTree().then(function(data) {
      _normalizeTree(data);
      GC.data = data;
      GC.render();
    }).catch(function(err) { console.error('Refresh:', err); });
  };

  /** Normalize tree data: copy keyResult → ketQuaChinh for tasks */
  function _normalizeTree(data) {
    if (!data || !data.programs) return;
    data.programs.forEach(function(prg) {
      (prg.projects || []).forEach(function(prj) {
        (prj.phases || []).forEach(function(ph) {
          (ph.workPackages || []).forEach(function(wp) {
            (wp.tasks || []).forEach(function(t) {
              if (t.keyResult && !t.ketQuaChinh) t.ketQuaChinh = t.keyResult;
            });
          });
        });
      });
    });
  }

  /* ══════════════════════════════════════════════════════
     FIX FLATTEN: Use backend status/health/pct instead of
     client-side recalculation. Backend is the source of truth.
     ══════════════════════════════════════════════════════ */
  var G = PMO.Gantt;
  if (G) {
    // _enrichRow: program/project — add backend status/health/pct
    var _origEnrich = G._enrichRow;
    G._enrichRow = function(item, type, depth, parentId) {
      var r = _origEnrich.call(this, item, type, depth, parentId);
      // Use backend values when available
      if (item.status) r.status = item.status;
      if (item.health) r.health = item.health;
      if (item.pctFinished !== undefined) r.pctFinished = item.pctFinished;
      if (item.pctApproved !== undefined) r.pctApproved = item.pctApproved;
      return r;
    };

    // _phaseRow: use backend status/health instead of client-side calc
    var _origPhaseRow = G._phaseRow;
    G._phaseRow = function(ph, depth, parentId) {
      var r = _origPhaseRow.call(this, ph, depth, parentId);
      if (ph.status) r.status = ph.status;
      if (ph.health) r.health = ph.health;
      if (ph.pctFinished !== undefined) r.pctFinished = ph.pctFinished;
      if (ph.pctApproved !== undefined) r.pctApproved = ph.pctApproved;
      return r;
    };

    // _wpRow: use backend values
    var _origWpRow = G._wpRow;
    G._wpRow = function(wp, depth, parentId, msOnly) {
      var r = _origWpRow.call(this, wp, depth, parentId, msOnly);
      if (wp.status) r.status = wp.status;
      if (wp.health) r.health = wp.health;
      if (wp.pctFinished !== undefined) r.pctFinished = wp.pctFinished;
      if (wp.pctApproved !== undefined) r.pctApproved = wp.pctApproved;
      // Also pass keyResult for task KQC column
      r.keyResult = wp.keyResult || wp.ketQuaChinh;
      return r;
    };

    // Override healthColor to use proper CSS variables
    G.healthColor = function(h) {
      if (h === 'at_risk') return 'var(--c-ar)';
      if (h === 'behind_schedule') return 'var(--c-bs)';
      if (h === 'on_track') return 'var(--c-ot, var(--c-ip))';
      return 'var(--c-ip)';
    };
  }

  /* ══════════════════════════════════════════════════════
     FIX CELL RENDERERS: read-only cells, deadline with time
     ══════════════════════════════════════════════════════ */

  // Deadline cell: show time when available, NOT editable in cell
  GC._cellDL = function(r) {
    if (!r.plannedFinish) return '';
    var d = this.G.PD(r.plannedFinish), st = r.status || 'not_started';
    var ov = d < this.G.NOW && st !== 'completed';
    var hasTime = r.plannedFinish.indexOf('T') > 0 && !r.plannedFinish.endsWith('T00:00');
    return PMO.Date ? PMO.Date.render(r.plannedFinish, { showTime: hasTime, overdue: ov, editable: false }) : '';
  };

  // Status cell: NOT editable in cell (edit in popover only)
  GC._cellStatus = function(r) {
    var st = r.status || 'not_started', hl = r.health || 'on_track';
    return PMO.StatusChip ? PMO.StatusChip.render(st, hl, { editable: false }) : st;
  };

  // Health cell: NOT editable in cell
  GC._cellHealth = function(r) {
    var hl = r.health || 'on_track';
    return PMO.HealthChip ? PMO.HealthChip.render(hl, { editable: false }) : hl;
  };

  // KQC cell: NOT editable in cell, support both WP + Task
  GC._cellKqc = function(r) {
    if (r.type === 'program' || r.type === 'project' || r.type === 'phase') return '';
    var val = r.ketQuaChinh || r.keyResult || '';
    return PMO.Summary ? PMO.Summary.render(val, { editable: false, placeholder: '' }) : '';
  };

  // PIC cell: NOT editable in cell (click → opens popover detail)
  GC._cellPic = function(r) {
    if (!r.pic && (r.type === 'program' || r.type === 'project' || r.type === 'phase')) return '';
    if (!r.pic) return '<span class="gantt-pic-label">—</span>';
    return '<span class="gantt-pic-label">' + (PMO.Avatar ? PMO.Avatar.render(r.pic, 'sm') : '') +
      '<span class="gantt-pic-name">' + this._esc(r.pic) + '</span></span>';
  };

  // Assignees cell: NOT editable in cell
  GC._cellAssignees = function(r) {
    if (r.type === 'program' || r.type === 'project' || r.type === 'phase') return '';
    if (!r.assignees || !r.assignees.length) return '<span class="gantt-assignees-label">—</span>';
    return '<span class="gantt-assignees-label">' + (PMO.Avatar ? PMO.Avatar.renderGroup(r.assignees, 'sm', 3) : '') + '</span>';
  };

  // Name cell: NOT editable inline (use PMO.Textbox without editable)
  GC._cellName = function(r) {
    var h = '';
    if (r.hasChildren) {
      var ex = this.state.exp.has(r.id) || (this.state.drill && (r.type === 'phase' || r.type === 'wp'));
      h += '<button class="gantt-tog ' + (ex ? '' : 'col') + '" data-tog="' + r.id + '">' + this.CFG.TOGGLE_SVG + '</button>';
    } else h += '<span class="gantt-tog-ph"></span>';
    var li = this.CFG.LEVEL_ICONS[r.type];
    if (li) h += '<span class="gantt-li ' + li.cls + '">' + li.label + '</span>';
    h += '<span class="gantt-name-text">' + this._esc(r.name) + '</span>';
    return h;
  };

  /* ══════════════════════════════════════════════════════
     FIX 3: Default expand in operation mode → show tasks
     Override _resetExp to expand: programs → projects →
     active phases → all WPs inside active phases
     ══════════════════════════════════════════════════════ */
  GC._resetExp = function() {
    this.state.exp.clear();
    var s = this;
    this.data.programs.forEach(function(p) {
      s.state.exp.add(p.id);
      p.projects.forEach(function(pj) {
        s.state.exp.add(pj.id);
        if (s.state.view === 'strategy') return;
        pj.phases.forEach(function(ph) {
          // Use backend status instead of client-side calc
          var phStatus = ph.status || 'not_started';
          if (phStatus !== 'not_started') {
            s.state.exp.add(ph.id);
            // In operation mode: also expand WPs to show tasks
            if (s.state.view === 'operation') {
              (ph.workPackages || []).forEach(function(wp) {
                s.state.exp.add(wp.id);
              });
            }
          }
        });
      });
    });
  };

  // Phase arrow color: use health-based color
  if (G) {
    G.phaseColor = function(id) {
      // Look up the phase in GC.data to get its health
      var health = 'on_track';
      var data = GC.data;
      if (data && data.programs) {
        for (var i = 0; i < data.programs.length; i++) {
          var prj_list = data.programs[i].projects || [];
          for (var j = 0; j < prj_list.length; j++) {
            var phases = prj_list[j].phases || [];
            for (var k = 0; k < phases.length; k++) {
              if (phases[k].id === id) { health = phases[k].health || 'on_track'; break; }
            }
          }
        }
      }
      return this.healthColor(health);
    };
  }

  /* ══════════════════════════════════════════════════════
     Override _renderRRows: show phase arrow in drill-down
     Original hides phase arrow when this.state.drill is set.
     ══════════════════════════════════════════════════════ */
  var _origRenderRRows = GC._renderRRows;
  GC._renderRRows = function(startIdx, endIdx) {
    var vs = this.ref('rpVs'), self = this, phInfos = [];
    vs.querySelectorAll('.gantt-tl-row,.gantt-bar-c,.gantt-ph-arrow,.gantt-ph-dashline,.gantt-ms,.gantt-strat-sub').forEach(function(e) { e.remove(); });

    for (var i = startIdx; i < endIdx && i < this.rows.length; i++) {
      var row = this.rows[i], pos = this.rowPos[i];
      var tlr = document.createElement('div');
      tlr.className = 'gantt-tl-row lv-' + row.type;
      tlr.dataset.rowId = row.id;
      tlr.style.top = pos.y + 'px';
      tlr.style.height = pos.h + 'px';
      tlr.addEventListener('mouseenter', function() { self._hlRow(this.dataset.rowId, false); });
      tlr.addEventListener('mouseleave', function() { self._hlRow(null, false); });
      vs.appendChild(tlr);

      if (row.isStratPrj) {
        this._renderStratRow(vs, row, pos);
      }
      // Phase arrow: show in BOTH normal and drill-down mode
      else if (row.type === 'phase' && row.plannedStart && row.plannedFinish) {
        var x1 = this.G.d2px(row.plannedStart, this.mn, this.state.scale, this.state.zoom);
        var x2 = this.G.d2px(row.plannedFinish, this.mn, this.state.scale, this.state.zoom);
        if (x1 !== null && x2 !== null) {
          var color = this.G.phaseColor(row.id);
          var isFirst = !phInfos.some(function(p) { return p.pid === (row.projectId || row.parentId); });
          var a = document.createElement('div');
          a.className = 'gantt-ph-arrow';
          a.style.left = x1 + 'px';
          a.style.width = (x2 - x1) + 'px';
          a.style.top = (pos.y + pos.h / 2) + 'px';
          a.style.transform = 'translateY(-50%)';
          a.innerHTML = PMO.PhaseArrow ? PMO.PhaseArrow.render(this._esc(row.name), color, isFirst) : '';
          vs.appendChild(a);
          phInfos.push({ row: row, x1: x1, x2: x2, pid: row.projectId || row.parentId, y: pos.y, h: pos.h });
        }
      }
      else if (row.milestoneOnly) { this._addMs(vs, row, pos); }
      else if ((row.type === 'wp' || row.type === 'task') && row.plannedStart && row.plannedFinish) {
        this._addBar(vs, row, pos);
        if (row.type === 'wp' && row.milestone && row.milestone !== 'none') this._addMs(vs, row, pos);
      }
    }

    // Phase dashlines
    var byPrj = {};
    phInfos.forEach(function(p) { if (!byPrj[p.pid]) byPrj[p.pid] = []; byPrj[p.pid].push(p); });
    Object.values(byPrj).forEach(function(phs) {
      for (var j = 0; j < phs.length - 1; j++) {
        var dl = document.createElement('div');
        dl.className = 'gantt-ph-dashline';
        dl.style.left = (phs[j].x2 - 1) + 'px';
        dl.style.top = (phs[j].y + phs[j].h) + 'px';
        dl.style.height = Math.max(0, phs[j + 1].y - phs[j].y - phs[j].h) + 'px';
        vs.appendChild(dl);
      }
    });
  };

  /* ══════════════════════════════════════════════════════
     _collectState — THE CORE
     Reads every editable field from the popover DOM.
     Returns a flat object ready to send to backend.
     ══════════════════════════════════════════════════════ */
  function _collectState(container, row) {
    var payload = {};
    var type = row.type;

    // ── Header: title ──
    var titleEl = container.querySelector('.ph-title');
    if (titleEl) payload.name = titleEl.textContent.trim();

    // ── Header: description (ph-desc in header) ──
    // All levels now have description in DB
    var descEl = container.querySelector('.ph-desc');
    if (descEl) payload.description = descEl.textContent.trim();

    // ── Overview panel ──
    var ovP = container.querySelector('[data-panel="overview"]');
    if (!ovP) return payload;

    // Walk each .pmo-field row and read by label
    ovP.querySelectorAll('.pmo-field').forEach(function(field) {
      var labelEl = field.querySelector('.f-label');
      if (!labelEl) return;
      var label = labelEl.textContent.trim();

      switch (label) {
        case 'Hình thức':
          var emChip = field.querySelector('.pmo-exec-mode[data-mode]');
          if (emChip) payload.execution_mode = emChip.dataset.mode;
          var emDetail = field.querySelector('.pmo-exec-detail');
          if (emDetail) payload.execution_note = emDetail.textContent.trim();
          break;

        case 'Kết quả':
        case 'Link kết quả':
          var dlInput = field.querySelector('.dl-input');
          if (dlInput) payload.deliverable_url = dlInput.textContent.trim();
          break;

        case 'Mô tả':
          // Description is read from ph-desc header (line 64) for program/project
          // Don't overwrite here — they show the same field
          break;

        case 'KQ chính':
          var sum = field.querySelector('.pmo-summary');
          if (sum) payload.key_result = sum.textContent.trim();
          break;

        case 'Milestone':
          var ms = field.querySelector('.pmo-ms-field[data-ms-level]');
          if (ms) payload.milestone = ms.dataset.msLevel;
          break;

        case 'Kế hoạch':
          var dateEl = field.querySelector('.pmo-date[data-cfg]');
          if (dateEl) {
            try {
              var cfg = JSON.parse(dateEl.dataset.cfg);
              var ps = cfg.d || '';
              if (cfg.t) ps += ' ' + cfg.t;
              var pf = cfg.d2 || '';
              if (cfg.t2) pf += ' ' + cfg.t2;
              payload.planned_start = dmyToIso(ps);
              payload.planned_finish = dmyToIso(pf);
            } catch (e) {}
          }
          break;

        case 'Thực hiện':
          var dateEl = field.querySelector('.pmo-date[data-cfg]');
          if (dateEl) {
            try {
              var cfg = JSON.parse(dateEl.dataset.cfg);
              var as = cfg.d || '';
              if (cfg.t) as += ' ' + cfg.t;
              var af = cfg.d2 || '';
              if (cfg.t2) af += ' ' + cfg.t2;
              payload.actual_start = dmyToIso(as);
              payload.actual_finish = dmyToIso(af);
            } catch (e) {}
          }
          break;

        case 'PIC':
          var picEl = field.querySelector('.pmo-member-single');
          if (picEl) payload.pic_name = picEl.dataset.member || '';
          break;

        case 'Approver':
          var appEl = field.querySelector('.pmo-member-single');
          if (appEl) payload.approver_name = appEl.dataset.member || '';
          break;

        case 'Assignees':
          payload.assignee_names = PMO.ChipMember ? PMO.ChipMember.collectNames(field) : [];
          break;
      }
    });

    return payload;
  }

  /* ══════════════════════════════════════════════════════
     _collectSubtaskStates — use PMO.Subtask.collectStates (proper component)
     ══════════════════════════════════════════════════════ */
  function _collectSubtaskStates(stP) {
    if (PMO.Subtask && PMO.Subtask.collectStates) {
      return PMO.Subtask.collectStates(stP);
    }
    // Fallback
    var states = [];
    stP.querySelectorAll('.pmo-subtask').forEach(function(el) {
      states.push({
        stId: el.dataset.stId || '',
        dbId: parseInt((el.dataset.stId || '').replace('st', '')) || null,
        content: (el.querySelector('.st-content') || {}).textContent || '',
        assignees: [],
        finishStatus: el.dataset.fs || 'unfinished',
        isNew: (el.dataset.stId || '').indexOf('st_') === 0
      });
    });
    return states;
  }

  /* ══════════════════════════════════════════════════════
     _buildShell OVERRIDE — rename views + add Thực thi
     ══════════════════════════════════════════════════════ */
  var _origBuildShell = GC._buildShell;
  GC._buildShell = function() {
    _origBuildShell.call(this);
    // Rename buttons
    var btns = this.el.querySelectorAll('[data-view]');
    btns.forEach(function(b) {
      if (b.dataset.view === 'strategy') b.textContent = 'Chiến lược';
      if (b.dataset.view === 'control') b.textContent = 'Kế hoạch';
      if (b.dataset.view === 'operation') b.textContent = 'Điều hành';
    });
    // Add Thực thi button after Điều hành
    var opBtn = this.el.querySelector('[data-view="operation"]');
    if (opBtn) {
      var exBtn = document.createElement('button');
      exBtn.className = 'gantt-tb-btn';
      exBtn.dataset.view = 'execution';
      exBtn.textContent = 'Thực thi';
      opBtn.after(exBtn);
    }
  };

  /* ══════════════════════════════════════════════════════
     render OVERRIDE — delegate execution to PMO.ExecView
     ══════════════════════════════════════════════════════ */
  var _origRender = GC.render;
  GC.render = function() {
    if (this.state.view === 'execution') {
      if (PMO.ExecView) PMO.ExecView.show(this);
      return;
    }
    // Hide exec view if visible
    if (PMO.ExecView) PMO.ExecView.hide(this);
    _origRender.call(this);
  };

  /* ══════════════════════════════════════════════════════
     _setView OVERRIDE — clean delegation
     ══════════════════════════════════════════════════════ */
  var _origSetView = GC._setView;
  var _viewUrlMap = {strategy:'chien_luoc', control:'ke_hoach', operation:'dieu_hanh', execution:'thuc_thi'};
  GC._setView = function(v) {
    // Update URL
    var slug = _viewUrlMap[v] || v;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '/gantt/' + slug);
    }
    if (v === 'execution') {
      this.state.view = v;
      this.state.drill = null;
      this._updBtns();
      this.render();
    } else {
      _origSetView.call(this, v);
    }
  };

  /* ══════════════════════════════════════════════════════
     _buildOverviewPanel OVERRIDE
     Fixes gantt.js hardcoded '' for executionNote, deliverableUrl
     ══════════════════════════════════════════════════════ */
  GC._buildOverviewPanel = function(row) {
    var src = row._src || {};
    var st = row.status || this.G.calcStatus(row);
    var hl = row.health || this.G.calcHealth(row);
    var h = '<div class="panel-full">';

    if (row.type === 'task' && PMO.ExecMode) {
      var em = (src.executionMode || 'independent').toLowerCase().replace(/\s+/g, '_');
      h += PMO.Field.rowCol('Hình thức', PMO.ExecMode.render(em, src.executionNote || '', { editable: true }));
    }
    // Deliverable link — all levels have it now
    if (PMO.DeliverableLink) {
      h += PMO.Field.row('Link kết quả', PMO.DeliverableLink.render(src.deliverableUrl || '', { editable: true }));
    }

    h += PMO.Field.row('Trạng thái',
      (PMO.StatusChip ? PMO.StatusChip.render(st, hl, { editable: true }) : st) + ' ' +
      (PMO.HealthChip ? PMO.HealthChip.render(hl, { editable: true }) : hl));

    if (PMO.ProgressInline)
      h += PMO.Field.row('Tiến độ', PMO.ProgressInline.render(row.pctFinished || 0, row.pctApproved || 0, hl, st));

    if ((row.type === 'program' || row.type === 'project') && PMO.Summary)
      h += PMO.Field.rowCol('Mô tả', PMO.Summary.render(src.description || '', { editable: true }));

    if (row.type === 'wp' && PMO.Summary)
      h += PMO.Field.rowCol('KQ chính', PMO.Summary.render(src.ketQuaChinh || '', { editable: true }));

    if (row.type === 'task' && PMO.Summary)
      h += PMO.Field.rowCol('KQ chính', PMO.Summary.render(src.keyResult || '', { editable: true }));

    if (src.plannedStart || src.plannedFinish) {
      var hasTime = (src.plannedStart && src.plannedStart.indexOf('T') > 0 && !src.plannedStart.endsWith('T00:00')) ||
                    (src.plannedFinish && src.plannedFinish.indexOf('T') > 0 && !src.plannedFinish.endsWith('T00:00'));
      h += PMO.Field.row('Kế hoạch', PMO.Date ? PMO.Date.renderRange(src.plannedStart || '', src.plannedFinish || '', { showTime: hasTime, editable: true }) : '');
    }
    if (src.actualStart || src.actualFinish) {
      var hasTime = (src.actualStart && src.actualStart.indexOf('T') > 0 && !src.actualStart.endsWith('T00:00')) ||
                    (src.actualFinish && src.actualFinish.indexOf('T') > 0 && !src.actualFinish.endsWith('T00:00'));
      h += PMO.Field.row('Thực hiện', PMO.Date ? PMO.Date.renderRange(src.actualStart || '', src.actualFinish || '', { showTime: hasTime, editable: true }) : '');
    }

    if (row.type === 'wp' || row.type === 'task') {
      h += PMO.Field.row('PIC', PMO.MemberField ? PMO.MemberField.renderSingle(src.pic || '', '', { editable: true }) : '');
      h += PMO.Field.row('Approver', PMO.MemberField ? PMO.MemberField.renderSingle(src.approver || '', '', { editable: true }) : '');
      h += PMO.Field.row('Assignees', PMO.MemberField ? PMO.MemberField.renderList((src.assignees || []).map(function(n) { return { name: n }; }), { maxLines: 2, editable: true }) : '');
    }
    if (row.type === 'wp' && PMO.MilestoneField)
      h += PMO.Field.row('Milestone', PMO.MilestoneField.render(src.milestone || 'none', hl, { editable: true }));

    h += '</div>';
    return h;
  };

  /* ══════════════════════════════════════════════════════
     _buildTabs OVERRIDE — ensure Notes + History on ALL levels
     ══════════════════════════════════════════════════════ */
  var _origBT = GC._buildTabs;
  GC._buildTabs = function(row) {
    var tabs = _origBT.call(this, row);
    // Ensure 'notes' tab exists for all levels (Program was missing it)
    var hasNotes = tabs.some(function(t) { return t.key === 'notes'; });
    var hasHistory = tabs.some(function(t) { return t.key === 'history'; });
    if (!hasNotes) {
      // Insert notes before history (or at end)
      var histIdx = -1;
      for (var i = 0; i < tabs.length; i++) { if (tabs[i].key === 'history') { histIdx = i; break; } }
      if (histIdx >= 0) tabs.splice(histIdx, 0, { key: 'notes', label: 'Ghi chú' });
      else tabs.push({ key: 'notes', label: 'Ghi chú' });
    }
    if (!hasHistory) {
      tabs.push({ key: 'history', label: 'Lịch sử' });
    }
    return tabs;
  };

  /* ══════════════════════════════════════════════════════
     _buildPanels OVERRIDE — fix subtask assignee
     + ensure notes + history panels exist for ALL levels
     ══════════════════════════════════════════════════════ */
  var _origBP = GC._buildPanels;
  GC._buildPanels = function(row) {
    var p = _origBP.call(this, row);
    var src = row._src || {};

    // Ensure notes panel exists for ALL levels (Program was missing)
    if (!p.notes && PMO.Note) {
      p.notes = '<div class="panel-scroll"><div class="pmo-note-list"><div class="pmo-note-empty">Chưa có ghi chú nào</div></div></div>' +
        '<div class="panel-footer"><div class="pmo-note-input" style="border-top:none;margin:0;padding:0">' +
        '<textarea class="ni-textarea" placeholder="Nhập ghi chú..." rows="1"></textarea>' +
        '<button class="ni-send" title="Gửi">' + PMO.Note.SEND_SVG + '</button></div></div>';
    }

    // Ensure history panel exists for ALL levels
    if (!p.history) {
      p.history = PMO.Trail
        ? '<div class="panel-full">' + PMO.Trail.renderList([]) + '</div>'
        : '<div class="panel-full"><div style="color:var(--t3);text-align:center;padding:40px;font-size:12px">Chưa có lịch sử</div></div>';
    }

    // Task subtask override (assignee from tree data)
    if (row.type === 'task' && PMO.Subtask) {
      var sts = (src.subtasks || []).map(function(st) {
        return {
          id: st.id, content: st.name, finishStatus: st.finishStatus,
          assignee: st.assignee || '',
          assignees: st.assignees || (st.assignee ? [st.assignee] : []),
          plannedStart: st.plannedStart || '',
          plannedFinish: st.plannedFinish || '',
          actualStart: st.actualStart || '',
          actualFinish: st.actualFinish || '',
          keyResult: st.keyResult || '',
          deliverableUrl: st.deliverableUrl || '',
          notes: []
        };
      });
      p.subtasks = '<div class="panel-scroll">' + PMO.Subtask.renderList(sts, { showAdd: false }) +
        '</div><div class="panel-footer"><div class="pmo-subtask-add" data-action="add-subtask" style="margin:0;padding:4px 0">' +
        PMO.Subtask.ADD_SVG + ' Thêm đầu việc</div></div>';
    }
    if (row.type === 'task' && PMO.Approve) {
      var ai = (src.subtasks || []).filter(function(st) {
        return st.finishStatus === 'finished' || st.finishStatus === 'approved';
      }).map(function(st) {
        return { id: st.id, content: st.name, assignee: st.assignee || '', finishedAt: '', status: st.finishStatus === 'approved' ? 'approved' : 'pending' };
      });
      p.approve = '<div class="panel-full"><div id="popApprove_' + row.id + '">' + PMO.Approve.renderList(ai) + '</div></div>';
    }
    return p;
  };

  /* ══════════════════════════════════════════════════════
     _bindInteractions — disable cell-level editing
     + add auto-center toggle button
     + add user info / logout / admin link
     ══════════════════════════════════════════════════════ */
  var _origBI = GC._bindInteractions;
  GC._bindInteractions = function() {
    _origBI.call(this);
    var self = this;

    var tbRight = this.el.querySelector('.gantt-tb-right');
    if (tbRight) {
      // Auto-center button
      var acBtn = document.createElement('button');
      acBtn.className = 'gantt-tb-btn active';
      acBtn.dataset.act = 'autocenter';
      acBtn.textContent = '⊕ Tự căn giữa';
      tbRight.insertBefore(acBtn, tbRight.firstChild);
      acBtn.addEventListener('click', function() {
        self.state.autoCenter = !self.state.autoCenter;
        acBtn.classList.toggle('active', self.state.autoCenter);
        if (self.state.autoCenter) self.scrollToToday();
      });
    }

    this.state.autoCenter = true;
  };

  // Override _hlRow: only auto-scroll when autoCenter is ON
  var _origHlRow = GC._hlRow;
  GC._hlRow = function(id, autoScroll) {
    // Replace autoScroll with state.autoCenter check
    var shouldScroll = autoScroll && this.state.autoCenter;
    this.state.hlId = id;
    this.el.querySelectorAll('.gantt-row,.gantt-tl-row,.gantt-bar-c').forEach(function(el) {
      el.classList.toggle('hl', el.dataset.rowId === id);
    });
    if (id && shouldScroll) {
      var bar = this.ref('rpVs').querySelector('.gantt-bar-c[data-row-id="' + id + '"]');
      // Also try phase arrow
      if (!bar) {
        var arrows = this.ref('rpVs').querySelectorAll('.gantt-ph-arrow');
        var row = this.rows.find(function(r) { return r.id === id; });
        if (row && row.type === 'phase') {
          // Find the arrow by position match
          var rp = this.ref('rpBody');
          var x = this.G.d2px(row.plannedStart, this.mn, this.state.scale, this.state.zoom);
          if (x !== null && rp) {
            var w = this.G.d2px(row.plannedFinish, this.mn, this.state.scale, this.state.zoom) - x;
            rp.scrollTo({ left: Math.max(0, x + w / 2 - rp.clientWidth / 2), behavior: 'smooth' });
            return;
          }
        }
      }
      if (bar) {
        var rp = this.ref('rpBody');
        if (rp) {
          var tL = parseFloat(bar.style.left) || 0;
          var tW = parseFloat(bar.style.width) || 0;
          rp.scrollTo({ left: Math.max(0, tL + tW / 2 - rp.clientWidth / 2), behavior: 'smooth' });
        }
      }
    }
  };

  /* ══════════════════════════════════════════════════════
     _openDetail — THE BIG ONE
     ══════════════════════════════════════════════════════ */
  GC._openDetail = function(row) {
    if (!PMO.PopoverShell) return;

    // Subtask: redirect to subtask-specific popover
    if (row.type === 'subtask') {
      var stDbId = API.toDbId(row.id);
      if (!stDbId) return;
      var self2 = this;
      // Find parent task row for PIC/Approver
      var parentTaskRow = null;
      if (row.parentId) {
        parentTaskRow = this.rows.find(function(r) { return r.id === row.parentId; });
      }
      API.get('/subtasks/' + stDbId).then(function(stData) {
        var taskBc = parentTaskRow ? self2._buildBreadcrumb(parentTaskRow) : [];
        _openSubtaskPopoverGlobal(stData, parentTaskRow, self2, taskBc);
      });
      return;
    }

    var self = this, src = row._src || {}, bc = this._buildBreadcrumb(row);
    var container = document.createElement('div');
    this.el.appendChild(container);
    var refTable = API.typeToRefTable(row.type);
    var refDbId = API.toDbId(row.id);

    PMO.PopoverShell.mount(container, {
      breadcrumb: bc, level: row.type, title: row.name,
      description: src.description || '', editable: true,
      tabs: this._buildTabs(row), activeTab: 'overview',
      panels: this._buildPanels(row),

      /* ════════════════════════════════════
         onSave — collect ALL state, 1 API call
         ════════════════════════════════════ */
      onSave: function() {
        // Collect from DOM
        var payload = _collectState(container, row);

        // Update in-memory src for immediate re-render
        if (payload.name) src.name = payload.name;
        if (payload.description !== undefined) src.description = payload.description;
        self.render();

        if (!refDbId) return;

        // Also collect subtask changes (assignee, content)
        var stP = container.querySelector('[data-panel="subtasks"]');
        if (stP) {
          var stStates = _collectSubtaskStates(stP);
          var promises = [];
          stStates.forEach(function(st) {
            if (st.isNew && st.content) {
              // New subtask — create with all fields
              promises.push(API.post('/tasks/' + API.toDbId(row.id) + '/subtasks', {
                content: st.content,
                assignee_names: st.assignees || [],
                planned_start: st.plannedStart || null,
                planned_finish: st.plannedFinish || null,
                key_result: st.keyResult || null,
                deliverable_url: st.deliverableUrl || null,
              }));
            } else if (st.dbId) {
              // Existing — update all fields
              promises.push(API.updateSubtask(st.dbId, {
                content: st.content,
                assignee_names: st.assignees || [],
                planned_start: st.plannedStart || null,
                planned_finish: st.plannedFinish || null,
                key_result: st.keyResult || null,
                deliverable_url: st.deliverableUrl || null,
              }));
            }
          });
          // Fire subtask saves, then refresh after ALL complete
          var stPromise = promises.length ? Promise.all(promises) : Promise.resolve();
          stPromise.catch(function(err) { console.error('Subtask saves:', err); });
        }

        console.log('[PMO.API] Save:', row.type, row.id, payload);
        var mainPromise = refDbId ? API.updateByType(row.type, row.id, payload) : Promise.resolve();
        // Wait for BOTH main save and subtask saves before refresh
        var stDone = typeof stPromise !== 'undefined' ? stPromise : Promise.resolve();
        Promise.all([mainPromise, stDone])
          .then(function() { self._refreshFromAPI(); })
          .catch(function(err) { console.error('Save:', err); self._refreshFromAPI(); });
      },

      /* ════════════════════════════════════
         onMount — hook real-time interactions
         ════════════════════════════════════ */
      onMount: function(el) {

        /* ── Subtasks: bind original UI ── */
        var stP = el.querySelector('[data-panel="subtasks"]');
        if (stP && PMO.Subtask) {
          PMO.Subtask.bind(stP, { currentUser: 'Admin' });

          // Single delegated listener for real-time actions
          // (checkbox and delete need immediate API call, not wait for save)
          stP.addEventListener('click', function(e) {
            // Checkbox — immediate persist
            var check = e.target.closest('.st-check');
            if (check) {
              var stEl = check.closest('.pmo-subtask'); if (!stEl) return;
              var dbId = API.toDbId(stEl.dataset.stId); if (!dbId) return;
              API.toggleFinish(dbId).then(function() { self._refreshFromAPI(); })
                .catch(function(err) { console.error('Toggle:', err); });
              return;
            }
          });

          // Delete — capture phase (original removes element)
          stP.addEventListener('click', function(e) {
            var del = e.target.closest('[data-action="delete-subtask"]');
            if (!del) return;
            var stEl = del.closest('.pmo-subtask'); if (!stEl) return;
            var dbId = API.toDbId(stEl.dataset.stId); if (!dbId) return;
            API.deleteSubtask(dbId).then(function() { self._refreshFromAPI(); })
              .catch(function(err) { console.error('Del:', err); });
          }, true);

          // Subtask notes — intercept toggle-notes, bind API note panel
          stP.addEventListener('click', function(e) {
            var togBtn = e.target.closest('[data-action="toggle-notes"]');
            if (!togBtn) return;
            var stEl = togBtn.closest('.pmo-subtask'); if (!stEl) return;
            var notesArea = stEl.querySelector('.st-notes');
            if (!notesArea) return;
            var dbId = API.toDbId(stEl.dataset.stId);
            // Wait for PMO.Note.bind to run (from subtask.js toggle handler)
            // Then override with our API-backed version
            if (!notesArea.dataset._apibound && dbId) {
              setTimeout(function() {
                notesArea.dataset._apibound = '1';
                _bindNotePanel(notesArea, 'subtask', dbId, 'subtask');
              }, 150);
            }
          });

          // Add subtask — keep as pending DOM element, save on "Cập nhật"
          stP.addEventListener('click', function(e) {
            var addBtn = e.target.closest('[data-action="add-subtask"]');
            if (!addBtn) return;
          });

          // Subtask detail popover — click on content or edit button
          stP.addEventListener('click', function(e) {
            // Don't intercept check, delete, notes, add, assignee actions
            if (e.target.closest('.st-check') || e.target.closest('[data-action="delete-subtask"]') ||
                e.target.closest('[data-action="toggle-notes"]') || e.target.closest('[data-action="add-subtask"]') ||
                e.target.closest('.st-assignees-wrap') || e.target.closest('.pmo-chip-add') ||
                e.target.closest('[data-member-list]') || e.target.closest('.pmo-date') ||
                e.target.closest('.pmo-textbox') || e.target.closest('.dl-input')) return;
            var stEl = e.target.closest('.pmo-subtask');
            if (!stEl) return;
            var stId = stEl.dataset.stId;
            var dbId = API.toDbId(stId);
            if (!dbId) return; // new subtask, not saved yet

            // Fetch fresh subtask data
            API.get('/subtasks/' + dbId).then(function(stData) {
              var taskBc = self._buildBreadcrumb(row);
              _openSubtaskPopover(stData, row, self, taskBc);
            });
          });
        }

        /* ── Subtask detail popover ── */
        function _openSubtaskPopover(stData, parentRow, gantt, taskBreadcrumb) {
          _openSubtaskPopoverGlobal(stData, parentRow, gantt, taskBreadcrumb);
        }

        /* ── Approve — capture phase ── */
        var apEl = el.querySelector('[id^="popApprove_"]');
        if (apEl && PMO.Approve) {
          apEl.addEventListener('click', function(e) {
            var btn = e.target.closest('.ap-btn');
            if (btn && btn.dataset.act === 'approve') {
              var it = btn.closest('.pmo-approve-item'); if (!it) return;
              var dbId = API.toDbId(it.dataset.apId); if (!dbId) return;
              API.approveSubtask(dbId, 'approve').then(function() { self._refreshFromAPI(); });
              return;
            }
            var sb = e.target.closest('.ap-reason-send');
            if (sb) {
              var it = sb.closest('.pmo-approve-item'); if (!it) return;
              var dbId = API.toDbId(it.dataset.apId); if (!dbId) return;
              API.approveSubtask(dbId, 'reject').then(function() { self._refreshFromAPI(); });
            }
          }, true);
          PMO.Approve.bind(apEl);
        }

        // Task tab "Ghi chú" panel — uses module-level _bindNotePanel
        var noteP = el.querySelector('[data-panel="notes"]');
        if (noteP && PMO.Note) {
          _bindNotePanel(noteP, refTable, refDbId, row.type);
        }

        /* ── Trail ── */
        var trEl = el.querySelector('[data-panel="history"]');
        if (trEl && PMO.Trail) {
          if (refDbId) {
            API.fetchTrail(refTable, refDbId).then(function(res) {
              if (!res || !res.entries || !res.entries.length) return;
              var list = trEl.querySelector('.pmo-trail-list'); if (!list) return;
              var em = list.querySelector('.pmo-trail-empty'); if (em) em.remove();
              var m = { create: 'add', update: 'edit', 'delete': 'delete' };
              res.entries.forEach(function(e) {
                var tmp = document.createElement('div');
                tmp.innerHTML = PMO.Trail.renderItem({
                  source: e.source || 'user', time: e.created_at ? e.created_at.replace('T', ' ').slice(0, 16) : '',
                  action: m[e.action] || 'edit', level: e.ref_table === 'work_package' ? 'wp' : e.ref_table,
                  target: e.object_name || '', attr: e.field_name || null,
                  oldVal: e.old_value || undefined, newVal: e.new_value || undefined,
                  user: e.actor || 'System'
                });
                list.appendChild(tmp.firstElementChild);
              });
            });
          }
          PMO.Trail.bind(trEl);
        }

        /* ── Add task ── */
        var atBtn = el.querySelector('[data-action="add-task-from-list"]');
        if (atBtn && PMO.AddTask) {
          atBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var ov = el.querySelector('[data-pop-overlay]'); if (ov) ov.remove();
            var ac = document.createElement('div'); self.el.appendChild(ac);
            PMO.AddTask.open(ac, {
              breadcrumb: bc.slice(0),
              onCreate: function(td) {
                var wpDbId = API.toDbId(row.id);
                if (wpDbId) {
                  API.createTask(wpDbId, { name: td.title, execution_mode: (td.execMode || 'independent').toLowerCase().replace(/\s+/g, '_') })
                    .then(function() { ac.remove(); self._refreshFromAPI(); })
                    .catch(function(err) { console.error('Add task:', err); ac.remove(); });
                } else { ac.remove(); self.render(); }
              }
            });
          });
        }

        /* ── Task item clicks ── */
        el.querySelectorAll('.pmo-task-item').forEach(function(item) {
          item.addEventListener('click', function(e) {
            // Don't navigate when dragging
            if (item.classList.contains('dragging')) return;
            if (e.target.closest('.ti-drag')) return;
            var tr = self.rows.find(function(r) { return r.id === item.dataset.taskId; });
            if (tr) { var ov = el.querySelector('[data-pop-overlay]'); if (ov) ov.remove(); self._openDetail(tr); }
          });
        });

        /* ── Drag reorder for all child list panels ── */
        if (PMO.TaskList && PMO.TaskList.bindDrag) {
          var childTypeMap = { projects: 'project', phases: 'phase', wps: 'work_package', tasks: 'task' };
          ['projects', 'phases', 'wps', 'tasks'].forEach(function(panelKey) {
            var panel = el.querySelector('[data-panel="' + panelKey + '"]');
            if (panel) PMO.TaskList.bindDrag(panel, childTypeMap[panelKey]);
          });
        }
        // Subtask drag reorder
        if (PMO.Subtask && PMO.Subtask.bindDrag) {
          var stPanel = el.querySelector('[data-panel="subtasks"]');
          if (stPanel) PMO.Subtask.bindDrag(stPanel);
        }
      }
    });
  };

  /* ══════════════════════════════════════════════════════
     5. POLLING — multi-user sync
     Polls /api/portfolio/version every 15s.
     If version changes (another user made edits),
     re-fetch tree and re-render Gantt.
     Pauses while popover is open (to avoid losing edits).
     ══════════════════════════════════════════════════════ */
  (function initPolling() {
    var POLL_MS = 10000;
    var _ver = null;
    var _pollCount = 0;

    function _doRefresh() {
      console.log('[Sync] fetching tree...');
      fetch('/api/portfolio?_t=' + Date.now())
        .then(function(r) { return r.json(); })
        .then(function(data) {
          _normalizeTree(data);
          GC.data = data;
          GC.render();
          console.log('[Sync] gantt re-rendered');
          return fetch('/api/portfolio/version?_t=' + Date.now());
        })
        .then(function(r) { return r.json(); })
        .then(function(d) { _ver = d.version; })
        .catch(function(e) { console.error('[Sync] refresh err:', e); });
    }

    function poll() {
      _pollCount++;
      if (document.querySelector('.pmo-pop-overlay')) {
        setTimeout(poll, POLL_MS);
        return;
      }
      fetch('/api/portfolio/version?_t=' + Date.now())
        .then(function(r) { return r.json(); })
        .then(function(d) {
          console.log('[Sync] poll #' + _pollCount + ' ver=' + d.version + ' last=' + _ver);
          if (_ver === null || _ver === undefined) {
            _ver = d.version;
          } else if (d.version !== _ver) {
            console.log('[Sync] REFRESH!');
            _ver = d.version;
            _doRefresh();
          }
          setTimeout(poll, POLL_MS);
        })
        .catch(function(e) {
          console.error('[Sync] poll error:', e);
          setTimeout(poll, POLL_MS);
        });
    }

    GC._refreshFromAPI = _doRefresh;

    setTimeout(poll, POLL_MS);
    console.log('[Sync] started, interval:', POLL_MS, 'baseline:', _ver);
  })();

})();
