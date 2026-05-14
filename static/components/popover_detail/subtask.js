/* ═══════════════════════════════════════════════════════
   PMO.Subtask — Subtask item + list for task popover
   Uses shared components: MemberField, Date, Textbox, DeliverableLink
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.Subtask = {
  CHECK_SVG: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.5 6L5 8.5L9.5 3.5"/></svg>',
  NOTE_SVG: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2.5 2h9a1 1 0 011 1v7a1 1 0 01-1 1h-9a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M4.5 5h5M4.5 7.5h3"/></svg>',
  ADD_SVG: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5.5"/><path d="M7 4.5v5M4.5 7h5"/></svg>',
  EXPAND_SVG: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 5l2 2 2-2"/></svg>',

  renderItem: function(st) {
    var fs = st.finishStatus || 'unfinished';
    var checked = fs !== 'unfinished';
    var noteCount = (st.notes && st.notes.length) || 0;
    var assignees = st.assignees || (st.assignee ? [st.assignee] : []);
    var assigneeItems = assignees.map(function(n) { return { name: n }; });

    var html = '<div class="pmo-subtask ' + fs + '" data-st-id="' + (st.id || '') + '" data-fs="' + fs + '">';
    html += '<div class="st-main">';
    // Checkbox
    html += '<span class="pmo-check st-check' + (checked ? ' checked' : '') + '">' + this.CHECK_SVG + '</span>';
    // Body
    html += '<div class="st-body">';
    // Row 1: Content + status badge
    html += '<div class="st-row1">';
    html += '<span class="st-content">' + (st.content || '') + '</span>';
    var statusLabel = fs === 'approved' ? 'Đã duyệt' : fs === 'finished' ? 'Chờ duyệt' : fs === 'rejected' ? 'Từ chối' : '';
    if (statusLabel) html += '<span class="st-status ' + fs + '">' + statusLabel + '</span>';
    html += '</div>';

    // Row 2: Assignees (using PMO.MemberField.renderList)
    html += '<div class="st-row2">';
    html += '<div class="st-assignees-wrap">';
    if (PMO.MemberField) {
      html += PMO.MemberField.renderList(assigneeItems, { maxLines: 1, editable: true });
    }
    html += '</div>';
    html += '</div>';

    // Row 3: Dates (planned start → finish)
    html += '<div class="st-row3">';
    html += '<span class="st-field-label">Kế hoạch</span>';
    if (PMO.Date) {
      html += PMO.Date.renderRange(st.plannedStart || '', st.plannedFinish || '', { editable: true });
    }
    html += '</div>';

    // Row 4: Key result + Deliverable (collapsible detail)
    html += '<div class="st-detail">';
    html += '<div class="st-detail-row">';
    html += '<span class="st-field-label">KQ chính</span>';
    html += PMO.Textbox ? PMO.Textbox.render(st.keyResult || '', { placeholder: 'Nhập kết quả...', block: false }) : '<span>' + (st.keyResult || '') + '</span>';
    html += '</div>';
    html += '<div class="st-detail-row">';
    html += '<span class="st-field-label">Link KQ</span>';
    html += PMO.DeliverableLink ? PMO.DeliverableLink.render(st.deliverableUrl || '', { editable: true }) : '<span>' + (st.deliverableUrl || '') + '</span>';
    html += '</div>';
    html += '</div>';

    // Meta row: notes toggle
    html += '<div class="st-meta-row">';
    html += '<div class="st-notes-toggle" data-action="toggle-notes">' + this.NOTE_SVG + ' ' + (noteCount > 0 ? noteCount + ' ghi chú' : 'Ghi chú') + '</div>';
    html += '</div>';

    html += '</div>'; // .st-body
    // Edit/Delete actions
    html += '<div class="st-actions">';
    html += '<button class="st-act-btn" data-action="edit-subtask" title="Sửa">✎</button>';
    html += '<button class="st-act-btn delete" data-action="delete-subtask" title="Xóa">✕</button>';
    html += '</div>';
    html += '</div>'; // .st-main

    // Notes area
    html += '<div class="st-notes" data-st-notes="' + (st.id || '') + '">';
    if (PMO.Note) {
      html += PMO.Note.renderList(st.notes || [], { placeholder: 'Ghi chú cho đầu việc này...' });
    }
    html += '</div>';
    html += '</div>'; // .pmo-subtask
    return html;
  },

  renderList: function(subtasks, opts) {
    opts = opts || {};
    var html = '<div class="pmo-subtask-list">';
    for (var i = 0; i < (subtasks || []).length; i++) {
      html += this.renderItem(subtasks[i]);
    }
    if (opts.showAdd !== false) {
      html += '<div class="pmo-subtask-add" data-action="add-subtask">' + this.ADD_SVG + ' Thêm đầu việc</div>';
    }
    html += '</div>';
    return html;
  },

  bind: function(container, opts) {
    opts = opts || {};
    var self = this;

    // Bind PMO.MemberField list pickers inside subtask assignee wraps
    container.querySelectorAll('.st-assignees-wrap [data-member-list]').forEach(function(wrap) {
      wrap.addEventListener('click', function(e) {
        if (e.target.closest('.pmo-chip-add') || e.target.closest('[data-member-list]'))
          PMO.MemberField._openListPicker(wrap);
      });
    });

    container.addEventListener('click', function(e) {
      // Checkbox toggle
      var check = e.target.closest('.st-check');
      if (check) {
        var stEl = check.closest('.pmo-subtask');
        var fs = stEl.dataset.fs;
        if (fs === 'unfinished') {
          check.classList.add('checked');
          stEl.dataset.fs = 'finished';
          stEl.className = stEl.className.replace(/\b(unfinished|finished|approved|rejected)\b/g, '') + ' finished';
          var badge = stEl.querySelector('.st-status');
          if (badge) { badge.className = 'st-status finished'; badge.textContent = 'Chờ duyệt'; }
          else {
            var row1 = stEl.querySelector('.st-row1');
            if (row1) row1.insertAdjacentHTML('beforeend', '<span class="st-status finished">Chờ duyệt</span>');
          }
        } else if (fs === 'finished') {
          check.classList.remove('checked');
          stEl.dataset.fs = 'unfinished';
          stEl.className = stEl.className.replace(/\b(unfinished|finished|approved|rejected)\b/g, '') + ' unfinished';
          var badge = stEl.querySelector('.st-status');
          if (badge) { badge.className = 'st-status unfinished'; badge.textContent = ''; }
        }
        return;
      }

      // Assignee change — handled by PMO.MemberField above
      // (click on .pmo-chip-add or [data-member-list] triggers _openListPicker)

      // Notes toggle
      var togBtn = e.target.closest('[data-action="toggle-notes"]');
      if (togBtn) {
        var stEl = togBtn.closest('.pmo-subtask');
        var notesArea = stEl.querySelector('.st-notes');
        if (notesArea) {
          notesArea.classList.toggle('open');
          if (notesArea.classList.contains('open') && !notesArea._bound && PMO.Note) {
            PMO.Note.bind(notesArea, { currentUser: opts.currentUser || 'Bạn' });
            notesArea._bound = true;
          }
        }
        return;
      }

      // Edit subtask — let click bubble up to api_hooks.js _openSubtaskPopover
      var editBtn = e.target.closest('[data-action="edit-subtask"]');
      if (editBtn) {
        // Don't prevent — api_hooks.js click handler will catch .pmo-subtask click
        return;
      }

      // Delete subtask
      var delBtn = e.target.closest('[data-action="delete-subtask"]');
      if (delBtn) {
        delBtn.closest('.pmo-subtask').remove();
        return;
      }

      // Add subtask
      var addBtn = e.target.closest('[data-action="add-subtask"]');
      if (addBtn) {
        var list = container.querySelector('.pmo-subtask-list');
        if (!list) return;
        var newSt = { id: 'st_' + Date.now(), content: '', finishStatus: 'unfinished', assignees: [], plannedStart: '', plannedFinish: '', keyResult: '', deliverableUrl: '', notes: [] };
        var tmp = document.createElement('div');
        tmp.innerHTML = self.renderItem(newSt);
        list.appendChild(tmp.firstElementChild);
        var scrollArea = list.closest('.panel-scroll') || list.parentElement;
        if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
        // Focus content for editing
        var newEl = list.querySelector('[data-st-id="' + newSt.id + '"]');
        if (newEl) {
          var contentEl = newEl.querySelector('.st-content');
          contentEl.setAttribute('contenteditable', 'true');
          contentEl.style.cssText = 'background:#FFFBEB;padding:2px 4px;border-radius:3px;outline:1.5px solid var(--c-ar)';
          contentEl.focus();
          contentEl.addEventListener('blur', function() {
            contentEl.removeAttribute('contenteditable');
            contentEl.style.cssText = '';
          }, { once: true });
          contentEl.addEventListener('keydown', function(ev) { if (ev.key === 'Enter') { ev.preventDefault(); contentEl.blur(); } });
          // Bind MemberField for new subtask
          var newWrap = newEl.querySelector('.st-assignees-wrap [data-member-list]');
          if (newWrap) {
            newWrap.addEventListener('click', function(ev) {
              if (ev.target.closest('.pmo-chip-add') || ev.target.closest('[data-member-list]'))
                PMO.MemberField._openListPicker(newWrap);
            });
          }
        }
      }
    });
  },

  /** Collect subtask states from DOM for save */
  collectStates: function(container) {
    var states = [];
    container.querySelectorAll('.pmo-subtask').forEach(function(el) {
      // Assignees — expand group chips into individual names
      var assigneesWrap = el.querySelector('.st-assignees-wrap');
      var assignees = (assigneesWrap && PMO.ChipMember) ? PMO.ChipMember.collectNames(assigneesWrap) : [];
      // Dates from PMO.Date range
      var dateEl = el.querySelector('.st-row3 .pmo-date[data-cfg]');
      var plannedStart = '', plannedFinish = '';
      if (dateEl) {
        try {
          var cfg = JSON.parse(dateEl.dataset.cfg);
          plannedStart = cfg.d || '';
          plannedFinish = cfg.d2 || '';
        } catch (e) {}
      }
      // Key result
      var krEl = el.querySelector('.st-detail .pmo-textbox');
      var keyResult = krEl ? krEl.textContent.trim() : '';
      // Deliverable URL
      var dlEl = el.querySelector('.st-detail .dl-input');
      var deliverableUrl = dlEl ? dlEl.textContent.trim() : '';

      states.push({
        stId: el.dataset.stId || '',
        dbId: (el.dataset.stId || '').indexOf('st_') === 0 ? null : parseInt((el.dataset.stId || '').replace('st', '')),
        content: (el.querySelector('.st-content') || {}).textContent || '',
        assignees: assignees,
        finishStatus: el.dataset.fs || 'unfinished',
        plannedStart: plannedStart,
        plannedFinish: plannedFinish,
        keyResult: keyResult,
        deliverableUrl: deliverableUrl,
        isNew: (el.dataset.stId || '').indexOf('st_') === 0
      });
    });
    return states;
  },

  /** Drag reorder subtasks — saves sort_order to DB */
  bindDrag: function(container) {
    var list = container.querySelector('.pmo-subtask-list');
    if (!list) return;
    var dragItem = null;

    // Make subtask items draggable
    list.querySelectorAll('.pmo-subtask').forEach(function(el) { el.setAttribute('draggable', 'true'); });

    list.addEventListener('dragstart', function(e) {
      var item = e.target.closest('.pmo-subtask[draggable]');
      if (!item) return;
      dragItem = item;
      item.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });
    list.addEventListener('dragover', function(e) {
      e.preventDefault();
      var target = e.target.closest('.pmo-subtask');
      if (!target || target === dragItem) return;
      list.querySelectorAll('.pmo-subtask').forEach(function(el) { el.style.borderTop = ''; });
      target.style.borderTop = '2px solid var(--brand)';
    });
    list.addEventListener('drop', function(e) {
      e.preventDefault();
      var target = e.target.closest('.pmo-subtask');
      if (!target || !dragItem || target === dragItem) return;
      list.insertBefore(dragItem, target);
      list.querySelectorAll('.pmo-subtask').forEach(function(el) { el.style.borderTop = ''; });
      // Save order
      var order = [];
      list.querySelectorAll('.pmo-subtask[data-st-id]').forEach(function(el) { order.push(el.dataset.stId); });
      if (PMO.API) PMO.API.put('/reorder', { child_type: 'subtask', order: order });
    });
    list.addEventListener('dragend', function() {
      if (dragItem) { dragItem.style.opacity = ''; dragItem = null; }
      list.querySelectorAll('.pmo-subtask').forEach(function(el) { el.style.borderTop = ''; });
    });
  }
};
