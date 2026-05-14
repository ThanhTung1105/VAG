/* ═══════════════════════════════════════════════════════
   PMO.SeverityChip — Severity badge with dropdown edit
   PMO.RaiqdStatus — Open/Closed badge with dropdown edit
   Uses PMO._dd (shared dropdown manager from status_chip.js)
   ═══════════════════════════════════════════════════════ */

PMO.SeverityChip = {
  LEVELS: ['low', 'medium', 'high', 'critical'],
  LABELS: { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' },

  render: function(severity, opts) {
    opts = opts || {};
    var ed = opts.editable ? ' editable' : '';
    return '<span class="pmo-severity' + ed + '" data-sev="' + (severity || 'medium') + '">' +
      (this.LABELS[severity] || severity || 'Medium') + '</span>';
  },

  bind: function(container) {
    var self = this;
    container.addEventListener('click', function(e) {
      var chip = e.target.closest('.pmo-severity.editable');
      if (!chip) return;
      e.stopPropagation();

      // Build dropdown
      var rect = chip.getBoundingClientRect();
      var dd = document.createElement('div');
      dd.className = 'pmo-sev-dd';
      dd.style.cssText = 'position:fixed;left:'+rect.left+'px;top:'+(rect.bottom+2)+'px;z-index:500;' +
        'background:var(--bg-white,#fff);border:1px solid var(--b-light,#e5e7eb);border-radius:6px;' +
        'box-shadow:0 4px 16px rgba(0,0,0,.1);min-width:120px;padding:4px;';

      self.LEVELS.forEach(function(lv) {
        var opt = document.createElement('div');
        opt.className = 'pmo-sev-opt';
        opt.dataset.val = lv;
        opt.innerHTML = '<span class="pmo-severity" data-sev="'+lv+'" style="pointer-events:none">'+self.LABELS[lv]+'</span>';
        opt.style.cssText = 'padding:6px 8px;border-radius:4px;cursor:pointer;';
        opt.addEventListener('mouseenter', function() { opt.style.background = 'var(--bg-app,#f8f9fb)'; });
        opt.addEventListener('mouseleave', function() { opt.style.background = ''; });
        opt.addEventListener('click', function(ev) {
          ev.stopPropagation();
          chip.dataset.sev = lv;
          chip.textContent = self.LABELS[lv];
          dd.remove();
        });
        dd.appendChild(opt);
      });

      document.body.appendChild(dd);
      setTimeout(function() {
        document.addEventListener('click', function h() { dd.remove(); document.removeEventListener('click', h); });
      }, 50);
    });
  }
};

PMO.RaiqdStatus = {
  OPTIONS: ['open', 'closed'],
  LABELS: { open: 'Đang mở', closed: 'Đã đóng' },

  render: function(status, opts) {
    opts = opts || {};
    var ed = opts.editable ? ' editable' : '';
    return '<span class="pmo-raiqd-status' + ed + '" data-rs="' + (status || 'open') + '">' +
      (this.LABELS[status] || status || 'Đang mở') + '</span>';
  },

  bind: function(container) {
    var self = this;
    container.addEventListener('click', function(e) {
      var chip = e.target.closest('.pmo-raiqd-status.editable');
      if (!chip) return;
      e.stopPropagation();

      var rect = chip.getBoundingClientRect();
      var dd = document.createElement('div');
      dd.style.cssText = 'position:fixed;left:'+rect.left+'px;top:'+(rect.bottom+2)+'px;z-index:500;' +
        'background:var(--bg-white,#fff);border:1px solid var(--b-light,#e5e7eb);border-radius:6px;' +
        'box-shadow:0 4px 16px rgba(0,0,0,.1);min-width:100px;padding:4px;';

      self.OPTIONS.forEach(function(st) {
        var opt = document.createElement('div');
        opt.innerHTML = '<span class="pmo-raiqd-status" data-rs="'+st+'" style="pointer-events:none">'+self.LABELS[st]+'</span>';
        opt.style.cssText = 'padding:6px 8px;border-radius:4px;cursor:pointer;';
        opt.addEventListener('mouseenter', function() { opt.style.background = 'var(--bg-app,#f8f9fb)'; });
        opt.addEventListener('mouseleave', function() { opt.style.background = ''; });
        opt.addEventListener('click', function(ev) {
          ev.stopPropagation();
          chip.dataset.rs = st;
          chip.textContent = self.LABELS[st];
          dd.remove();
        });
        dd.appendChild(opt);
      });

      document.body.appendChild(dd);
      setTimeout(function() {
        document.addEventListener('click', function h() { dd.remove(); document.removeEventListener('click', h); });
      }, 50);
    });
  }
};
