/* ═══════════════════════════════════════════════════════
   PMO.TaskList — Task list inside WP popover
   renderList(tasks, opts) → HTML
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.TaskList = {
  LINK_SVG: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6.5 9.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5l-1 1"/><path d="M9.5 6.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5l1-1"/></svg>',

  EXEC_ICONS: {
    independent:'📋', online:'💻', offline:'🏢',
    workshop:'🛠️', site_visit:'📍', presentation:'📊'
  },
  EXEC_CLS: {
    independent:'independent', online:'online', offline:'offline',
    workshop:'workshop', site_visit:'site_visit', presentation:'presentation'
  },
  EXEC_LABELS: {
    independent:'Independent', online:'Online', offline:'Offline',
    workshop:'Workshop', site_visit:'Site Visit', presentation:'Presentation'
  },

  /**
   * @param {object} t — task data
   * t.id, t.name, t.execMode, t.status, t.health,
   * t.pctFinished, t.pctApproved, t.plannedStart, t.plannedFinish,
   * t.pic, t.deliverableUrl, t.noteCount
   */
  renderItem: function(t) {
    var health = t.health || 'on_track';
    var ini = t.pic ? (PMO.Avatar ? PMO.Avatar.initials(t.pic) : t.pic.slice(0,2).toUpperCase()) : '';

    var html = '<div class="pmo-task-item" data-task-id="' + (t.id||'') + '" draggable="true">';
    html += '<div class="ti-drag" title="Kéo để sắp xếp">⠿</div>';
    html += '<div class="ti-bar ' + health + '"></div>';
    html += '<div class="ti-content">';

    // Row 1: name + link icon + PIC
    html += '<div class="ti-row1">';
    html += '<span class="ti-name">' + (t.name||'') + '</span>';
    if (t.deliverableUrl) {
      html += '<button class="ti-icon-btn" title="Mở kết quả" onclick="event.stopPropagation();window.open(\'' + t.deliverableUrl + '\',\'_blank\')">' + this.LINK_SVG + '</button>';
    }
    if (t.pic) {
      html += '<span class="ti-pic">';
      html += '<span class="pmo-avatar sm">' + ini + '</span>';
      html += '<span class="ti-pic-name">' + t.pic + '</span>';
      html += '</span>';
    }
    html += '</div>';

    // Row 2: exec mode (optional) + status + health + date range
    html += '<div class="ti-row2">';
    if (t.execMode) {
      var em = t.execMode;
      var emIcon = this.EXEC_ICONS[em] || '📋';
      var emCls = this.EXEC_CLS[em] || 'independent';
      var emLabel = this.EXEC_LABELS[em] || em;
      html += '<span class="pmo-exec-mode ' + emCls + '"><span class="em-icon">' + emIcon + '</span>' + emLabel + '</span>';
    }
    if (PMO.StatusChip) html += PMO.StatusChip.render(t.status || 'not_started', health);
    if (PMO.HealthChip) html += PMO.HealthChip.render(health);
    if (t.plannedStart || t.plannedFinish) {
      var hasTime = (t.plannedStart && t.plannedStart.indexOf(' ') > 0) || (t.plannedFinish && t.plannedFinish.indexOf(' ') > 0);
      html += '<span class="ti-date">';
      if (PMO.Date) html += PMO.Date.renderRange(t.plannedStart || '', t.plannedFinish || '', {showTime: hasTime});
      else html += (t.plannedStart||'') + '→' + (t.plannedFinish||'');
      html += '</span>';
    }
    html += '</div>';

    // Row 3: progress bar + stats
    var pf = t.pctFinished || 0;
    var pa = t.pctApproved || 0;
    html += '<div class="ti-row3">';
    html += '<div class="ti-bar-wrap">';
    if (PMO.Bar) html += PMO.Bar.render({pctFinished: pf, pctApproved: pa, health: health, status: t.status});
    html += '</div>';
    html += '<span class="ti-prog-stats"><span class="ti-prog-num">' + pf + '%</span> xong, <span class="ti-prog-num">' + pa + '%</span> duyệt</span>';
    html += '</div>';

    html += '</div>';
    html += '</div>';
    return html;
  },

  /**
   * Compact card for Kanban (~220px width)
   * Shows: health bar + name + status/health chips + PIC + date + %
   */
  renderCard: function(t) {
    var health = t.health || 'on_track';
    var ini = t.pic ? (PMO.Avatar ? PMO.Avatar.initials(t.pic) : t.pic.slice(0,2).toUpperCase()) : '';
    var pf = t.pctFinished || 0;

    var html = '<div class="pmo-task-card" data-task-id="' + (t.id||'') + '">';
    html += '<div class="tc-bar ' + health + '"></div>';
    html += '<div class="tc-body">';

    // Name (max 2 lines)
    html += '<div class="tc-name">' + (t.name||'') + '</div>';

    // Chips: exec mode + health
    html += '<div class="tc-chips">';
    var em = t.execMode || 'independent';
    var emIcon = this.EXEC_ICONS[em] || '📋';
    var emCls = this.EXEC_CLS[em] || 'independent';
    var emLabel = this.EXEC_LABELS[em] || em;
    html += '<span class="pmo-exec-mode ' + emCls + '"><span class="em-icon">' + emIcon + '</span>' + emLabel + '</span>';
    if (PMO.HealthChip) html += PMO.HealthChip.render(health);
    html += '</div>';

    // Meta: PIC avatar + date + progress %
    html += '<div class="tc-meta">';
    if (t.pic) html += '<span class="pmo-avatar sm">' + ini + '</span>' + t.pic;
    if (t.plannedFinish) {
      var dateStr = t.plannedFinish;
      if (dateStr.indexOf(' ') > 0) dateStr = dateStr.split(' ')[0];
      html += '<span>→' + dateStr + '</span>';
    }
    html += '<span class="tc-pct">' + pf + '%</span>';
    html += '</div>';

    html += '</div></div>';
    return html;
  },
  /**
   * @param {Array} items
   * @param {object} opts
   * opts.title — header title (default 'Tasks')
   * opts.showAdd — show add button (default true)
   * opts.addAction — data-action on add button (default 'add-task-from-list')
   * opts.addLabel — add button text (default '+ Tạo')
   * opts.emptyText — empty state text (default 'Chưa có task nào')
   */
  renderList: function(items, opts) {
    opts = opts || {};
    var title = opts.title || 'Tasks';
    var emptyText = opts.emptyText || 'Chưa có mục nào';
    var addAction = opts.addAction || 'add-task-from-list';
    var addLabel = opts.addLabel || '+ Tạo';
    var html = '';

    // Header
    html += '<div class="pmo-task-list-header">';
    html += '<span class="tl-title">' + title;
    if (items && items.length) html += '<span class="tl-count">' + items.length + '</span>';
    html += '</span>';
    if (opts.showAdd !== false) {
      html += '<button class="pmo-chip-add" data-action="' + addAction + '" style="margin:0;font-size:10px;padding:2px 8px">' + addLabel + '</button>';
    }
    html += '</div>';

    // List
    html += '<div class="pmo-task-list">';
    if (!items || !items.length) {
      html += '<div class="pmo-task-list-empty">' + emptyText + '</div>';
    } else {
      for (var i = 0; i < items.length; i++) {
        html += this.renderItem(items[i]);
      }
    }
    html += '</div>';

    return html;
  },

  /** Bind drag & drop reorder */
  bindDrag: function(container, childType) {
    var list = container.querySelector('.pmo-task-list');
    if (!list) return;
    var dragItem = null;

    list.addEventListener('dragstart', function(e) {
      var item = e.target.closest('.pmo-task-item[draggable]');
      if (!item) return;
      dragItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    list.addEventListener('dragover', function(e) {
      e.preventDefault();
      var target = e.target.closest('.pmo-task-item');
      if (!target || target === dragItem) return;
      var rect = target.getBoundingClientRect();
      var mid = rect.top + rect.height / 2;
      list.querySelectorAll('.pmo-task-item').forEach(function(el) { el.classList.remove('drop-above', 'drop-below'); });
      if (e.clientY < mid) target.classList.add('drop-above');
      else target.classList.add('drop-below');
    });

    list.addEventListener('drop', function(e) {
      e.preventDefault();
      var target = e.target.closest('.pmo-task-item');
      if (!target || !dragItem || target === dragItem) return;
      var rect = target.getBoundingClientRect();
      var mid = rect.top + rect.height / 2;
      if (e.clientY < mid) list.insertBefore(dragItem, target);
      else list.insertBefore(dragItem, target.nextSibling);
      list.querySelectorAll('.pmo-task-item').forEach(function(el) { el.classList.remove('drop-above', 'drop-below'); });
      // Save new order to DB
      var order = [];
      list.querySelectorAll('.pmo-task-item[data-task-id]').forEach(function(el) { order.push(el.dataset.taskId); });
      if (PMO.API && childType) PMO.API.put('/reorder', { child_type: childType, order: order });
    });

    list.addEventListener('dragend', function() {
      if (dragItem) { dragItem.classList.remove('dragging'); dragItem = null; }
      list.querySelectorAll('.pmo-task-item').forEach(function(el) { el.classList.remove('drop-above', 'drop-below'); });
    });
  }
};
