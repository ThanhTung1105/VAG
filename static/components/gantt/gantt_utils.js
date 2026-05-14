/* ═══════════════════════════════════════════════════════
   PMO.Gantt — Shared utilities for Gantt chart
   Pure functions: no DOM, no rendering.
   Date parsing, timeline math, status/health/pct compute,
   flatten data into rows.
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.Gantt = {

  /* ── Date parsing ── */

  /** Parse ISO date string → Date (Vietnam timezone) */
  PD: function(s) {
    if (!s) return null;
    if (s instanceof Date) return s;
    return new Date(s.length <= 10 ? s + 'T00:00:00+07:00' : s);
  },

  NOW: (function() { var d = new Date(); d.setHours(0,0,0,0); return d; })(),

  /* ── Compute status / health / %finished / %approved ── */

  calcPctFinished: function(item) {
    if (item.finishStatus !== undefined)
      return (item.finishStatus === 'finished' || item.finishStatus === 'approved') ? 100 : 0;
    if (item.subtasks && item.subtasks.length > 0) {
      var done = item.subtasks.filter(function(s) { return PMO.Gantt.calcPctFinished(s) >= 100; }).length;
      return Math.round(done / item.subtasks.length * 100);
    }
    if (item.tasks && item.tasks.length > 0) {
      var done = item.tasks.filter(function(t) { return PMO.Gantt.calcPctFinished(t) >= 100; }).length;
      return Math.round(done / item.tasks.length * 100);
    }
    return 0;
  },

  calcPctApproved: function(item) {
    if (item.finishStatus !== undefined)
      return item.finishStatus === 'approved' ? 100 : 0;
    if (item.subtasks && item.subtasks.length > 0) {
      var done = item.subtasks.filter(function(s) { return PMO.Gantt.calcPctApproved(s) >= 100; }).length;
      return Math.round(done / item.subtasks.length * 100);
    }
    if (item.tasks && item.tasks.length > 0) {
      var done = item.tasks.filter(function(t) { return PMO.Gantt.calcPctApproved(t) >= 100; }).length;
      return Math.round(done / item.tasks.length * 100);
    }
    return 0;
  },

  calcStatus: function(item) {
    if (item.cancelled) return 'cancelled';
    var pF = this.calcPctFinished(item);
    var pA = this.calcPctApproved(item);
    if (pA >= 100) return 'completed';
    if (pF >= 100 && pA < 100) return 'in_review';
    var ps = this.PD(item.plannedStart);
    if (ps && this.NOW >= ps && pF < 100) return 'in_progress';
    return 'not_started';
  },

  calcHealth: function(item) {
    var st = this.calcStatus(item);
    if (st === 'completed' || st === 'cancelled') return 'on_track';
    var ps = this.PD(item.plannedStart), pf = this.PD(item.plannedFinish);
    if (!ps || !pf) return 'on_track';
    var af = item.actualFinish ? this.PD(item.actualFinish) : null;
    if (af && af > pf) return 'behind_schedule';
    if (!af && st !== 'completed' && this.NOW > pf) return 'behind_schedule';
    var dur = pf - ps;
    if (dur > 0) {
      var elapsed = this.NOW - ps;
      if (elapsed >= dur * 0.9 && this.NOW <= pf) return 'at_risk';
    }
    return 'on_track';
  },

  plannedDays: function(item) {
    var ps = this.PD(item.plannedStart), pf = this.PD(item.plannedFinish);
    if (!ps || !pf) return 0;
    return Math.max(1, Math.round((pf - ps) / 86400000));
  },

  /* ── Aggregate for phase / project ── */

  calcPhaseStatus: function(ph) {
    if (!ph.workPackages || ph.workPackages.length === 0) {
      var ps = this.PD(ph.plannedStart);
      if (ps && this.NOW >= ps) return 'in_progress';
      return 'not_started';
    }
    var self = this;
    var statuses = ph.workPackages.map(function(wp) { return self.calcStatus(wp); });
    if (statuses.every(function(s) { return s === 'completed'; })) return 'completed';
    if (statuses.some(function(s) { return s === 'in_progress' || s === 'in_review'; })) return 'in_progress';
    return 'not_started';
  },

  calcPhaseHealth: function(ph) {
    if (!ph.workPackages || ph.workPackages.length === 0) {
      var ps = this.PD(ph.plannedStart), pf = this.PD(ph.plannedFinish);
      if (ps && pf && this.NOW > pf) return 'behind_schedule';
      if (ps && pf) { var dur = pf - ps; if (dur > 0 && (this.NOW - ps) >= dur * 0.9 && this.NOW <= pf) return 'at_risk'; }
      return 'on_track';
    }
    var self = this;
    var healths = ph.workPackages.map(function(wp) { return self.calcHealth(wp); });
    if (healths.indexOf('behind_schedule') >= 0) return 'behind_schedule';
    if (healths.indexOf('at_risk') >= 0) return 'at_risk';
    return 'on_track';
  },

  calcPhasePctF: function(ph) {
    if (!ph.workPackages || !ph.workPackages.length) return 0;
    var self = this;
    var d = ph.workPackages.filter(function(w) { return self.calcPctFinished(w) >= 100; }).length;
    return Math.round(d / ph.workPackages.length * 100);
  },

  calcPhasePctA: function(ph) {
    if (!ph.workPackages || !ph.workPackages.length) return 0;
    var self = this;
    var d = ph.workPackages.filter(function(w) { return self.calcPctApproved(w) >= 100; }).length;
    return Math.round(d / ph.workPackages.length * 100);
  },

  calcProjectStatus: function(prj) {
    var self = this;
    var all = []; prj.phases.forEach(function(p) { (p.workPackages || []).forEach(function(w) { all.push(w); }); });
    if (!all.length) return 'not_started';
    if (all.every(function(w) { return self.calcStatus(w) === 'completed'; })) return 'completed';
    if (all.some(function(w) { var s = self.calcStatus(w); return s === 'in_progress' || s === 'in_review'; })) return 'in_progress';
    return 'not_started';
  },

  calcProjectHealth: function(prj) {
    var self = this;
    var all = []; prj.phases.forEach(function(p) { (p.workPackages || []).forEach(function(w) { all.push(w); }); });
    if (!all.length) return 'on_track';
    if (all.some(function(w) { return self.calcHealth(w) === 'behind_schedule'; })) return 'behind_schedule';
    if (all.some(function(w) { return self.calcHealth(w) === 'at_risk'; })) return 'at_risk';
    return 'on_track';
  },

  calcProjectPctF: function(prj) {
    var self = this;
    var all = []; prj.phases.forEach(function(p) { (p.workPackages || []).forEach(function(w) { all.push(w); }); });
    if (!all.length) return 0;
    return Math.round(all.filter(function(w) { return self.calcPctFinished(w) >= 100; }).length / all.length * 100);
  },

  calcProjectPctA: function(prj) {
    var self = this;
    var all = []; prj.phases.forEach(function(p) { (p.workPackages || []).forEach(function(w) { all.push(w); }); });
    if (!all.length) return 0;
    return Math.round(all.filter(function(w) { return self.calcPctApproved(w) >= 100; }).length / all.length * 100);
  },

  /* ── Timeline math ── */

  /** Day width in pixels for given scale + zoom */
  dayW: function(scale, zoom) {
    var base = { month: 3.2, week: 8.8, day: 16.8 };
    return (base[scale] || 16.8) * (zoom / 100);
  },

  /** Date → pixel offset from minDate */
  d2px: function(date, minDate, scale, zoom) {
    if (!date) return null;
    var d = (typeof date === 'string') ? this.PD(date) : date;
    return ((d - minDate) / 864e5) * this.dayW(scale, zoom);
  },

  /** Scan DATA to find min/max dates, add padding */
  timeRange: function(data) {
    var mn = null, mx = null;
    var self = this;
    function scan(items) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.plannedStart) { var d = self.PD(it.plannedStart); if (!mn || d < mn) mn = d; }
        if (it.plannedFinish) { var d = self.PD(it.plannedFinish); if (!mx || d > mx) mx = d; }
        if (it.phases) scan(it.phases);
        if (it.workPackages) scan(it.workPackages);
        if (it.tasks) scan(it.tasks);
        if (it.projects) scan(it.projects);
      }
    }
    scan(data.programs);
    // Fallback if no dates found at all
    if (!mn) mn = new Date();
    if (!mx) mx = new Date();
    mn = new Date(mn); mn.setDate(mn.getDate() - 14);
    mx = new Date(mx); mx.setDate(mx.getDate() + 14);
    return { mn: mn, mx: mx };
  },

  /** Generate timeline columns: days, months, weeks */
  genTimeline: function(mn, mx, scale, zoom) {
    var dw = this.dayW(scale, zoom);
    var days = [], d = new Date(mn);
    while (d <= mx) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }

    var months = {}, weeks = {};
    var mN = ['','Th01','Th02','Th03','Th04','Th05','Th06','Th07','Th08','Th09','Th10','Th11','Th12'];
    var self = this;

    days.forEach(function(dy, i) {
      var k = dy.getFullYear() + '-' + String(dy.getMonth()+1).padStart(2,'0');
      if (!months[k]) months[k] = { l: '', d: [], si: i };
      months[k].d.push(dy);
      months[k].l = mN[dy.getMonth()+1] + '/' + dy.getFullYear();
    });

    days.forEach(function(dy, i) {
      var wk = self.isoWeek(dy);
      var k = dy.getFullYear() + '-W' + String(wk).padStart(2,'0');
      if (!weeks[k]) weeks[k] = { l: 'W' + wk, d: [], si: i };
      weeks[k].d.push(dy);
    });

    return { days: days, months: months, weeks: weeks, dw: dw };
  },

  /** ISO week number */
  isoWeek: function(d) {
    var dt = new Date(d.getTime());
    dt.setHours(0,0,0,0);
    dt.setDate(dt.getDate() + 3 - (dt.getDay() + 6) % 7);
    var w1 = new Date(dt.getFullYear(), 0, 4);
    return 1 + Math.round(((dt - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7);
  },

  DAY_NAMES: ['CN','T2','T3','T4','T5','T6','T7'],

  /* ── Flatten data into rows ── */

  /**
   * @param {object} data — the full DATA object
   * @param {object} state — { view, drill, exp (Set of expanded ids) }
   * @returns {Array} flat rows
   */
  flatten: function(data, state) {
    var R = [], V = state.view, self = this;

    if (state.drill) {
      var ph = this.findPhase(data, state.drill);
      if (ph) {
        R.push(this._phaseRow(ph, 0, null));
        (ph.workPackages || []).forEach(function(wp) {
          R.push(self._wpRow(wp, 1, ph.id, false));
          self._pushTasksSubs(R, wp, 2, state);
        });
      }
      return R;
    }

    data.programs.forEach(function(prg) {
      R.push(self._enrichRow(prg, 'program', 0, null));
      if (!state.exp.has(prg.id)) return;

      prg.projects.forEach(function(prj) {
        if (V === 'strategy') {
          R.push({
            id: prj.id, name: prj.name, type: 'project', depth: 1, parentId: prg.id,
            hasChildren: false, isStratPrj: true,
            status: self.calcProjectStatus(prj), health: self.calcProjectHealth(prj),
            pctFinished: self.calcProjectPctF(prj), pctApproved: self.calcProjectPctA(prj),
            _prj: prj
          });
        } else {
          R.push(self._enrichRow(prj, 'project', 1, prg.id));
          if (!state.exp.has(prj.id)) return;

          prj.phases.forEach(function(ph) {
            R.push(self._phaseRow(ph, 2, prj.id));

            if (V === 'control') {
              if (!state.exp.has(ph.id)) return;
              (ph.workPackages || []).forEach(function(wp) {
                if (!wp.milestone || wp.milestone === 'none') return;
                R.push(self._wpRow(wp, 3, ph.id, true));
              });
            } else {
              // operation
              if (!state.exp.has(ph.id)) return;
              (ph.workPackages || []).forEach(function(wp) {
                R.push(self._wpRow(wp, 3, ph.id, false));
                self._pushTasksSubs(R, wp, 4, state);
              });
            }
          });
        }
      });
    });

    return R;
  },

  _enrichRow: function(item, type, depth, parentId) {
    return {
      id: item.id, name: item.name, type: type, depth: depth, parentId: parentId,
      hasChildren: (item.projects || item.phases || item.workPackages || item.tasks || []).length > 0,
      plannedStart: item.plannedStart, plannedFinish: item.plannedFinish,
      pic: item.pic, approver: item.approver, assignees: item.assignees,
      milestone: item.milestone, ketQuaChinh: item.ketQuaChinh, note: item.note,
      executionMode: item.executionMode, cancelled: item.cancelled,
      actualStart: item.actualStart, actualFinish: item.actualFinish,
      _src: item
    };
  },

  _phaseRow: function(ph, depth, parentId) {
    return {
      id: ph.id, name: ph.name, type: 'phase', depth: depth, parentId: parentId,
      projectId: parentId,
      hasChildren: (ph.workPackages || []).length > 0,
      plannedStart: ph.plannedStart, plannedFinish: ph.plannedFinish,
      status: this.calcPhaseStatus(ph), health: this.calcPhaseHealth(ph),
      pctFinished: this.calcPhasePctF(ph), pctApproved: this.calcPhasePctA(ph),
      _src: ph
    };
  },

  _wpRow: function(wp, depth, parentId, msOnly) {
    return {
      id: wp.id, name: wp.name, type: 'wp', depth: depth, parentId: parentId,
      milestoneOnly: msOnly,
      hasChildren: !msOnly && (wp.tasks || []).length > 0,
      plannedStart: wp.plannedStart, plannedFinish: wp.plannedFinish,
      pic: wp.pic, approver: wp.approver, assignees: wp.assignees,
      milestone: wp.milestone, ketQuaChinh: wp.ketQuaChinh, note: wp.note,
      status: this.calcStatus(wp), health: this.calcHealth(wp),
      pctFinished: this.calcPctFinished(wp), pctApproved: this.calcPctApproved(wp),
      actualStart: wp.actualStart, actualFinish: wp.actualFinish,
      _src: wp
    };
  },

  _pushTasksSubs: function(R, wp, baseD, state) {
    if (!state.exp.has(wp.id)) return;
    var self = this;
    (wp.tasks || []).forEach(function(t) {
      R.push({
        id: t.id, name: t.name, type: 'task', depth: baseD, parentId: wp.id,
        hasChildren: (t.subtasks || []).length > 0,
        plannedStart: t.plannedStart, plannedFinish: t.plannedFinish,
        pic: t.pic, approver: t.approver, assignees: t.assignees,
        executionMode: t.executionMode, cancelled: t.cancelled,
        actualStart: t.actualStart, actualFinish: t.actualFinish,
        status: self.calcStatus(t), health: self.calcHealth(t),
        pctFinished: self.calcPctFinished(t), pctApproved: self.calcPctApproved(t),
        _src: t
      });
      if (!state.exp.has(t.id)) return;
      (t.subtasks || []).forEach(function(st) {
        R.push({
          id: st.id, name: st.name, type: 'subtask', depth: baseD + 1, parentId: t.id,
          hasChildren: false,
          status: st.finishStatus === 'approved' ? 'completed' : st.finishStatus === 'finished' ? 'in_review' : 'not_started',
          health: 'on_track',
          pctFinished: self.calcPctFinished(st), pctApproved: self.calcPctApproved(st),
          finishStatus: st.finishStatus
        });
      });
    });
  },

  findPhase: function(data, id) {
    for (var i = 0; i < data.programs.length; i++) {
      var p = data.programs[i];
      for (var j = 0; j < p.projects.length; j++) {
        var prj = p.projects[j];
        for (var k = 0; k < prj.phases.length; k++) {
          if (prj.phases[k].id === id) return prj.phases[k];
        }
      }
    }
    return null;
  },

  /* ── Row height helper ── */
  /** Row height — reads from cfg if provided, else defaults */
  rowHeight: function(row, cfg) {
    cfg = cfg || { rowH: { program: 40, stratPrj: 88, default: 36 } };
    if (row.type === 'program') return cfg.rowH.program;
    if (row.isStratPrj) return cfg.rowH.stratPrj;
    return cfg.rowH.default;
  },

  /* ── Columns per view ── */
  getColumns: function(view) {
    var n = { k: 'name', l: 'Hạng mục', w: 260 };
    if (view === 'strategy') return [n, {k:'status',l:'Trạng thái',w:120}, {k:'health',l:'Sức khỏe',w:110}];
    if (view === 'control') return [n, {k:'pic',l:'PIC',w:100}, {k:'health',l:'Sức khỏe',w:110}, {k:'deadline',l:'Deadline',w:90}, {k:'status',l:'Trạng thái',w:120}];
    return [n, {k:'pic',l:'PIC',w:100}, {k:'assignees',l:'Assignees',w:100}, {k:'health',l:'Sức khỏe',w:110}, {k:'deadline',l:'Deadline',w:90}, {k:'status',l:'Trạng thái',w:120}, {k:'kqc',l:'KQ chính',w:110}, {k:'note',l:'',w:36}];
  },

  /* ── Health color helper ── */
  healthColor: function(h) {
    if (h === 'at_risk') return 'var(--c-ar)';
    if (h === 'behind_schedule') return 'var(--c-bs)';
    return 'var(--c-ip)';
  },

  /* ── Phase color (deterministic from id) ── */
  phaseColor: function(id) {
    var cs = ['#0066B3','#3B82F6','#06B6D4','#8B5CF6','#EC4899','#F59E0B','#10B981'];
    var h = 0;
    for (var i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
    return cs[Math.abs(h) % cs.length];
  },

  /* ── Virtual scroll helpers ── */

  /**
   * Given flat rows, compute cumulative Y positions.
   * Returns array of {y, h} for each row.
   */
  computeRowPositions: function(rows, cfg) {
    var positions = [], y = 0;
    for (var i = 0; i < rows.length; i++) {
      var h = this.rowHeight(rows[i], cfg);
      positions.push({ y: y, h: h });
      y += h;
    }
    return positions;
  },

  /**
   * Given scroll top + viewport height + row positions,
   * return { startIdx, endIdx } of visible rows (with overscan).
   */
  visibleRange: function(scrollTop, viewportH, positions, overscan) {
    overscan = overscan || 5;
    var total = positions.length;
    if (total === 0) return { startIdx: 0, endIdx: 0 };

    // Binary search for start
    var lo = 0, hi = total - 1, startIdx = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (positions[mid].y + positions[mid].h <= scrollTop) { lo = mid + 1; }
      else { startIdx = mid; hi = mid - 1; }
    }

    // Find end
    var endIdx = startIdx;
    var bottomEdge = scrollTop + viewportH;
    while (endIdx < total && positions[endIdx].y < bottomEdge) endIdx++;

    // Apply overscan
    startIdx = Math.max(0, startIdx - overscan);
    endIdx = Math.min(total, endIdx + overscan);

    return { startIdx: startIdx, endIdx: endIdx };
  }
};
