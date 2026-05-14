/* ═══════════════════════════════════════════════════════
   PMO.PopoverShell — Detail popover container
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.PopoverShell = {
  LEVEL_LABELS: {
    program: 'Program', project: 'Project', phase: 'Phase',
    wp: 'Work Package', task: 'Task', subtask: 'Sub-task'
  },

  render: function(opts) {
    opts = opts || {};
    var ed = opts.editable !== false;
    var level = opts.level || 'task';
    var levelLabel = this.LEVEL_LABELS[level] || level;

    var html = '<div class="pmo-pop-overlay" data-pop-overlay>';
    html += '<div class="pmo-pop">';

    // ── Header zone ──
    html += '<div class="pmo-pop-header">';
    html += '<button class="pmo-pop-close" data-pop-close title="Đóng">✕</button>';

    // Breadcrumb — only show parents (exclude last item = current)
    if (opts.breadcrumb && opts.breadcrumb.length > 1 && PMO.Breadcrumb) {
      var parentCrumbs = opts.breadcrumb.slice(0, -1);
      html += '<div class="ph-breadcrumb">' + PMO.Breadcrumb.render(parentCrumbs) + '</div>';
    }

    // Title row: color bar + level label + title
    html += '<div class="ph-title-row">';
    html += '<div class="ph-level-bar ' + level + '"></div>';
    html += '<div class="ph-title-block">';
    html += '<div class="ph-level-label">' + levelLabel + '</div>';
    if (ed) {
      html += '<div class="ph-title" contenteditable="true">' + (opts.title || '') + '</div>';
    } else {
      html += '<div class="ph-title">' + (opts.title || '') + '</div>';
    }
    html += '</div></div>';

    // Description
    if (ed) {
      html += '<div class="ph-desc" contenteditable="true">' + (opts.description || '') + '</div>';
    } else if (opts.description) {
      html += '<div class="ph-desc">' + opts.description + '</div>';
    }
    html += '</div>';

    // ── Tab bar ──
    if (opts.tabs && opts.tabs.length > 0) {
      html += '<div class="pmo-pop-tabs">';
      var activeTab = opts.activeTab || opts.tabs[0].key;
      for (var i = 0; i < opts.tabs.length; i++) {
        var t = opts.tabs[i];
        html += '<div class="pmo-pop-tab' + (t.key === activeTab ? ' active' : '') + '" data-tab="' + t.key + '">';
        html += t.label;
        if (t.count) html += '<span class="tab-count">' + t.count + '</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    // ── Body ──
    html += '<div class="pmo-pop-body">';
    if (opts.tabs && opts.panels) {
      var activeTab = opts.activeTab || opts.tabs[0].key;
      for (var i = 0; i < opts.tabs.length; i++) {
        var t = opts.tabs[i];
        html += '<div class="pmo-pop-panel' + (t.key === activeTab ? ' active' : '') + '" data-panel="' + t.key + '">';
        html += (opts.panels[t.key] || '');
        html += '</div>';
      }
    }
    html += '</div>';

    // ── Action footer ──
    if (opts.editable !== false) {
      html += '<div class="pmo-pop-actions">';
      html += '<button class="pa-btn" data-pop-cancel>Hủy</button>';
      html += '<button class="pa-btn primary" data-pop-save>Cập nhật</button>';
      html += '</div>';
    }

    html += '</div></div>';
    return html;
  },

  mount: function(containerEl, opts) {
    containerEl.innerHTML = this.render(opts);
    this.bind(containerEl, opts);
    if (opts.onMount) opts.onMount(containerEl);
  },

  bind: function(containerEl, opts) {
    opts = opts || {};
    var tabs = containerEl.querySelectorAll('.pmo-pop-tab');
    var panels = containerEl.querySelectorAll('.pmo-pop-panel');

    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        tabs.forEach(function(t) { t.classList.remove('active'); });
        panels.forEach(function(p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var target = containerEl.querySelector('[data-panel="' + tab.dataset.tab + '"]');
        if (target) target.classList.add('active');
      });
    });

    var overlay = containerEl.querySelector('[data-pop-overlay]');
    function closePop() { if (overlay) overlay.remove(); }

    // Close button = cancel
    var closeBtn = containerEl.querySelector('[data-pop-close]');
    if (closeBtn) closeBtn.addEventListener('click', closePop);

    // Cancel button
    var cancelBtn = containerEl.querySelector('[data-pop-cancel]');
    if (cancelBtn) cancelBtn.addEventListener('click', closePop);

    // Click overlay background = cancel
    if (overlay) overlay.addEventListener('click', function(e) { if (e.target === overlay) closePop(); });

    // Save button
    var saveBtn = containerEl.querySelector('[data-pop-save]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        if (opts.onSave) opts.onSave(containerEl);
        closePop();
      });
    }
  }
};
