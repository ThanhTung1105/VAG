/* ═══════════════════════════════════════════════════════
   PMO Misc Helpers — Date, Tooltip, Note, RAIQD, Textbox
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

/* ── Date ── */
PMO.Date = {
  _p(n) { return String(n).padStart(2, '0'); },
  _parse(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    if (typeof d === 'string') {
      // "dd/mm/yyyy" or "dd/mm/yyyy HH:MM"
      if (d.includes('/')) {
        const parts = d.split(/[\s]+/);
        const dmy = parts[0].split('/');
        const dt = new Date(+dmy[2], +dmy[1]-1, +dmy[0]);
        if (parts[1]) { const hm = parts[1].split(':'); dt.setHours(+hm[0], +hm[1] || 0); }
        return dt;
      }
      // ISO "yyyy-mm-dd" or "yyyy-mm-ddTHH:MM"
      if (d.match(/^\d{4}-\d{2}-\d{2}/)) {
        const dt = new Date(d.length <= 10 ? d + 'T00:00:00+07:00' : d);
        return dt;
      }
    }
    return new Date(d);
  },
  WEEKDAYS: ['CN','T2','T3','T4','T5','T6','T7'],

  _fmtD(dt) { return this._p(dt.getDate()) + '/' + this._p(dt.getMonth()+1) + '/' + dt.getFullYear(); },
  _fmtDW(dt) { return this.WEEKDAYS[dt.getDay()] + ', ' + this._fmtD(dt); },
  _fmtT(dt) { return this._p(dt.getHours()) + ':' + this._p(dt.getMinutes()); },
  _fmtDM(dt) { return this._p(dt.getDate()) + '/' + this._p(dt.getMonth()+1); },
  _toInput(dt) { return this._p(dt.getDate()) + '/' + this._p(dt.getMonth()+1) + '/' + dt.getFullYear(); },
  _toTimeInput(dt) { return this._p(dt.getHours()) + ':' + this._p(dt.getMinutes()); },

  render(d, opts = {}) {
    const ed = opts.editable === true;
    if (!d) {
      if (ed) {
        const cfg = { d: '', t: null, sw: false, ov: false };
        return `<span class="pmo-date editable" data-cfg='${JSON.stringify(cfg)}' onclick="PMO.Date._open(this)">Chọn ngày</span>`;
      }
      return '<span class="pmo-date">—</span>';
    }
    const dt = this._parse(d);
    const autoTime = opts.showTime === 'auto';
    const hasTime = dt && (dt.getHours() !== 0 || dt.getMinutes() !== 0);
    const st = opts.showTime === true || (autoTime && hasTime);
    const sw = opts.showWeekday === true;
    const ov = opts.overdue === true;
    const cls = 'pmo-date' + (ov ? ' overdue' : '') + (ed ? ' editable' : '');
    const datePart = sw ? this._fmtDW(dt) : this._fmtD(dt);
    const timePart = st ? '<br><span class="time">' + this._fmtT(dt) + '</span>' : '';
    let html = `<span class="${cls}"`;
    if (ed) {
      const cfg = { d: this._toInput(dt), t: st ? this._toTimeInput(dt) : null, sw, ov };
      html += ` data-cfg='${JSON.stringify(cfg)}' onclick="PMO.Date._open(this)"`;
    }
    html += `>${datePart}${timePart}</span>`;
    return html;
  },

  /** _dateBlock: renders one date as inline-block with date on top, time below, centered */
  _dateBlock(dt, showTime, showWeekday) {
    const d = showWeekday ? this._fmtDW(dt) : this._fmtD(dt);
    if (!showTime) return d;
    return '<span class="date-block">' + d + '<br><span class="time">' + this._fmtT(dt) + '</span></span>';
  },

  renderRange(d1, d2, opts = {}) {
    if (!d1 && !d2) return '<span class="pmo-date">—</span>';
    const dt1 = this._parse(d1), dt2 = this._parse(d2);
    if (!dt1 || !dt2) return this.render(d1 || d2, opts);

    const autoTime = opts.showTime === 'auto';
    const hasTime1 = dt1 && (dt1.getHours() !== 0 || dt1.getMinutes() !== 0);
    const hasTime2 = dt2 && (dt2.getHours() !== 0 || dt2.getMinutes() !== 0);
    const st = opts.showTime === true || (autoTime && (hasTime1 || hasTime2));
    const sw = opts.showWeekday === true;
    const ed = opts.editable === true;
    const ov = opts.overdue === true;
    const cls = 'pmo-date' + (ov ? ' overdue' : '') + (ed ? ' editable' : '');

    const sameDay = dt1.toDateString() === dt2.toDateString();
    const sameMo = dt1.getFullYear() === dt2.getFullYear() && dt1.getMonth() === dt2.getMonth();
    const sameYr = dt1.getFullYear() === dt2.getFullYear();

    let display;
    if (st && sameDay) {
      // Same day: date on top, "HH:MM–HH:MM" below centered
      display = (sw ? this._fmtDW(dt1) : this._fmtD(dt1)) + '<br><span class="time">' + this._fmtT(dt1) + '–' + this._fmtT(dt2) + '</span>';
    } else if (st) {
      // Different days with time: two date-blocks inline, separated by →
      display = this._dateBlock(dt1, true, sw) + '<span class="range-sep"> → </span>' + this._dateBlock(dt2, true, sw);
    } else if (sameMo) {
      display = this._p(dt1.getDate()) + '<span class="range-sep">→</span>' + this._p(dt2.getDate())
        + ' /' + this._p(dt1.getMonth()+1) + '/' + dt1.getFullYear();
    } else if (sameYr) {
      display = this._fmtDM(dt1) + '<span class="range-sep">→</span>' + this._fmtDM(dt2)
        + ' /' + dt1.getFullYear();
    } else {
      display = this._fmtD(dt1) + '<span class="range-sep"> → </span>' + this._fmtD(dt2);
    }

    let html = `<span class="${cls}"`;
    if (ed) {
      const cfg = {
        d: this._toInput(dt1), t: st ? this._toTimeInput(dt1) : null,
        d2: this._toInput(dt2), t2: st ? this._toTimeInput(dt2) : null,
        sw, ov, range: true
      };
      html += ` data-cfg='${JSON.stringify(cfg)}' onclick="PMO.Date._open(this)"`;
    }
    html += `>${display}</span>`;
    return html;
  },

  /* ── Edit popover ── */
  _open(el) {
    document.querySelectorAll('.pmo-date-edit.open').forEach(e => e.remove());
    // Read current values from inputs if popover was already open
    const cfg = JSON.parse(el.dataset.cfg);
    const isRange = cfg.range === true;
    const hasTime = !!cfg.t;
    const hasSw = cfg.sw === true;

    const pop = document.createElement('div');
    pop.className = 'pmo-date-edit open';
    let h = '';

    h += '<span class="ed-label">' + (isRange ? 'Ngày bắt đầu' : 'Ngày') + '</span>';
    h += '<div class="ed-row">' + this._dateInputHTML('d', cfg.d || '') + '</div>';
    if (hasTime) {
      h += '<div class="ed-row" style="margin-top:4px"><input class="ed-input time-input" data-f="t" placeholder="HH:MM" value="' + (cfg.t || '') + '"></div>';
    }

    if (isRange) {
      h += '<span class="ed-label">Ngày kết thúc</span>';
      h += '<div class="ed-row">' + this._dateInputHTML('d2', cfg.d2 || '') + '</div>';
      if (hasTime) {
        h += '<div class="ed-row" style="margin-top:4px"><input class="ed-input time-input" data-f="t2" placeholder="HH:MM" value="' + (cfg.t2 || '') + '"></div>';
      }
    }

    // Toggles
    h += '<div class="ed-toggles">';
    h += '<button class="ed-toggle' + (hasTime ? ' on' : '') + '" data-tog="time">' + (hasTime ? '✓ ' : '+ ') + 'Giờ</button>';
    h += '<button class="ed-toggle' + (isRange ? ' on' : '') + '" data-tog="end">' + (isRange ? '✓ ' : '+ ') + 'Ngày kết thúc</button>';
    h += '<button class="ed-toggle' + (hasSw ? ' on' : '') + '" data-tog="weekday">' + (hasSw ? '✓ ' : '+ ') + 'Hiển thị thứ</button>';
    h += '</div>';

    h += '<div class="ed-actions"><button class="ed-btn" data-act="cancel">Hủy</button><button class="ed-btn primary" data-act="save">Lưu</button></div>';
    pop.innerHTML = h;

    // Append to body (not inside el) to avoid clipping by parent overflow
    document.body.appendChild(pop);
    var rect = el.getBoundingClientRect();
    pop.style.left = rect.left + 'px';
    pop.style.top = (rect.bottom + 4) + 'px';

    // Init fixed-slash inputs
    pop.querySelectorAll('.ed-date-input').forEach(inp => this._bindDateInput(inp));
    var firstInput = pop.querySelector('.ed-input, .ed-date-input');
    if (firstInput) firstInput.focus();

    // Toggle handlers
    pop.querySelectorAll('.ed-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Save current input values back to cfg before re-rendering
        this._syncCfgFromPop(pop, cfg);
        const tog = btn.dataset.tog;
        if (tog === 'time') {
          if (cfg.t) { cfg.t = null; cfg.t2 = null; } else { cfg.t = '08:00'; if (cfg.range) cfg.t2 = '17:00'; }
        } else if (tog === 'end') {
          if (cfg.range) { cfg.range = false; cfg.d2 = null; cfg.t2 = null; } else { cfg.range = true; cfg.d2 = cfg.d; cfg.t2 = cfg.t; }
        } else if (tog === 'weekday') {
          cfg.sw = !cfg.sw;
        }
        pop.remove();
        el.dataset.cfg = JSON.stringify(cfg);
        PMO.Date._open(el);
      });
    });

    // Save
    pop.querySelector('[data-act="save"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this._syncCfgFromPop(pop, cfg);
      const showTime = !!cfg.t;
      const showWeekday = cfg.sw;
      const overdue = cfg.ov;
      if (cfg.range && cfg.d2) {
        const s1 = cfg.d + (cfg.t ? ' ' + cfg.t : '');
        const s2 = cfg.d2 + (cfg.t2 ? ' ' + cfg.t2 : '');
        el.outerHTML = PMO.Date.renderRange(s1, s2, { showTime, showWeekday, editable: true, overdue });
      } else {
        const s = cfg.d + (cfg.t ? ' ' + cfg.t : '');
        el.outerHTML = PMO.Date.render(s, { showTime, showWeekday, editable: true, overdue });
      }
      pop.remove();
    });

    pop.querySelector('[data-act="cancel"]').addEventListener('click', (e) => { e.stopPropagation(); pop.remove(); });
    const close = (e) => { if (!pop.contains(e.target) && !el.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
    pop.addEventListener('click', (e) => e.stopPropagation());
  },

  /** Sync input values back to cfg object */
  _syncCfgFromPop(pop, cfg) {
    const dI = pop.querySelector('[data-f="d"]'); if (dI) cfg.d = dI.value.trim();
    const tI = pop.querySelector('[data-f="t"]'); if (tI) cfg.t = tI.value.trim() || null;
    const d2I = pop.querySelector('[data-f="d2"]'); if (d2I) cfg.d2 = d2I.value.trim();
    const t2I = pop.querySelector('[data-f="t2"]'); if (t2I) cfg.t2 = t2I.value.trim() || null;
  },

  /** Generate date input HTML with fixed slashes */
  _dateInputHTML(field, value) {
    return '<input class="ed-input ed-date-input" data-f="' + field + '" placeholder="dd/mm/yyyy" value="' + value + '" maxlength="10">';
  },

  /** Bind date input: auto-insert slashes, prevent deleting them */
  _bindDateInput(inp) {
    inp.addEventListener('keydown', (e) => {
      const v = inp.value;
      const pos = inp.selectionStart;
      // Prevent deleting slashes at position 2 and 5
      if ((e.key === 'Backspace' && (pos === 3 || pos === 6)) ||
          (e.key === 'Delete' && (pos === 2 || pos === 5))) {
        e.preventDefault();
        return;
      }
    });
    inp.addEventListener('input', () => {
      let v = inp.value.replace(/[^\d/]/g, '');
      // Remove all slashes, then re-insert at right positions
      let digits = v.replace(/\//g, '');
      if (digits.length > 8) digits = digits.slice(0, 8);
      let out = '';
      for (let i = 0; i < digits.length; i++) {
        if (i === 2 || i === 4) out += '/';
        out += digits[i];
      }
      if (out !== inp.value) {
        const pos = inp.selectionStart;
        inp.value = out;
        // Adjust cursor: if we just auto-inserted a slash, move past it
        const newPos = out.length > v.length ? pos + 1 : pos;
        inp.setSelectionRange(Math.min(newPos, out.length), Math.min(newPos, out.length));
      }
    });
  }
};

/* ── Tooltip ── */
PMO.Tooltip = {
  el: null,
  init() {
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.className = 'pmo-tooltip';
    this.el.id = 'pmoTooltip';
    document.body.appendChild(this.el);
  },
  show(e, rows) {
    this.init();
    let html = '';
    if (rows.title) html += `<h4>${rows.title}</h4>`;
    Object.entries(rows).forEach(([k,v]) => {
      if (k === 'title') return;
      html += `<div class="tt-row"><span class="tt-label">${k}</span><span class="tt-val">${v}</span></div>`;
    });
    this.el.innerHTML = html;
    this.el.classList.add('vis');
    this.move(e);
  },
  move(e) { if (this.el) { this.el.style.left = (e.clientX+12)+'px'; this.el.style.top = (e.clientY-10)+'px'; }},
  hide() { if (this.el) this.el.classList.remove('vis'); }
};

/* ── Note Icon ── */
PMO.NoteIcon = {
  SVG: '<svg class="pmo-note" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 2.5h11a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 012 13V4a1.5 1.5 0 011.5-1.5z"/><path d="M5.5 6.5h7M5.5 9.5h4.5"/></svg>',
  render(note) {
    if (!note) return '';
    return `<span title="${note.replace(/"/g,'&quot;')}">${this.SVG}</span>`;
  }
};

/* ── RAIQD Chip ── */
PMO.RAIQD = {
  render(type, id) {
    const cls = { risk:'risk', issue:'issue', action:'action', question:'question', decision:'decision' }[type] || 'action';
    return `<span class="pmo-raiqd ${cls}">${id}</span>`;
  }
};

/* ── Phase Arrow ── */
PMO.PhaseArrow = {
  render(name, color, isFirst) {
    const cls = isFirst ? 'first' : 'mid';
    return `<span class="pmo-phase-arrow ${cls}" style="background:${color}">${name || ''}</span>`;
  }
};
PMO.Textbox = {
  render(text, opts = {}) {
    const locked = opts.locked ? ' locked' : '';
    const block = opts.block ? ' block' : '';
    const editable = opts.locked ? '' : ' contenteditable="true"';
    const ph = opts.placeholder ? ` data-placeholder="${opts.placeholder}"` : '';
    return `<span class="pmo-textbox${locked}${block}"${editable}${ph}>${text || ''}</span>`;
  }
};

/* ═══════════════════════════════════════════════════════
   PMO.SubtaskStatus — Status chip for subtask only
   Values: unfinished | finished | approved
   ═══════════════════════════════════════════════════════ */
PMO.SubtaskStatus = {
  LABELS: { unfinished: 'Chưa hoàn thành', finished: 'Chờ duyệt', approved: 'Đã duyệt' },
  CLS: { unfinished: 'sts-uf', finished: 'sts-fi', approved: 'sts-ap' },

  render: function(status, opts) {
    opts = opts || {};
    var cls = this.CLS[status] || 'sts-uf';
    var label = this.LABELS[status] || status || 'Chưa hoàn thành';
    var ed = opts.editable ? ' editable' : '';
    return '<span class="pmo-st-status ' + cls + ed + '" data-sts="' + (status || 'unfinished') + '">' + label + '</span>';
  },

  bind: function(container) {
    var self = this;
    container.addEventListener('click', function(e) {
      var chip = e.target.closest('.pmo-st-status.editable');
      if (!chip) return;
      e.stopPropagation();
      var rect = chip.getBoundingClientRect();
      var dd = document.createElement('div');
      dd.style.cssText = 'position:fixed;left:'+rect.left+'px;top:'+(rect.bottom+2)+'px;z-index:500;background:var(--bg-white,#fff);border:1px solid var(--b-light,#e5e7eb);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.1);min-width:140px;padding:4px;';
      ['unfinished','finished','approved'].forEach(function(st) {
        var opt = document.createElement('div');
        opt.innerHTML = '<span class="pmo-st-status ' + (self.CLS[st]||'') + '" style="pointer-events:none">' + self.LABELS[st] + '</span>';
        opt.style.cssText = 'padding:6px 8px;border-radius:4px;cursor:pointer;';
        opt.addEventListener('mouseenter', function() { opt.style.background='var(--bg-app,#f8f9fb)'; });
        opt.addEventListener('mouseleave', function() { opt.style.background=''; });
        opt.addEventListener('click', function(ev) { ev.stopPropagation(); chip.dataset.sts=st; chip.className='pmo-st-status '+(self.CLS[st]||'')+' editable'; chip.textContent=self.LABELS[st]; dd.remove(); });
        dd.appendChild(opt);
      });
      document.body.appendChild(dd);
      setTimeout(function() { document.addEventListener('click',function h(){dd.remove();document.removeEventListener('click',h);}); },50);
    });
  }
};
