/* ═══════════════════════════════════════════════════════
   PMO.AddTask — Create new task popover
   Uses EXACT popover_shell DOM structure:
     .pmo-pop-overlay > .pmo-pop >
       .pmo-pop-header
       .pmo-pop-body > .pmo-pop-panel.active >
         .panel-scroll (fields + subtask list)
         .panel-footer (+ Thêm đầu việc)
       .pmo-pop-actions
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.AddTask = {

  _today: function() {
    var d = new Date();
    return String(d.getDate()).padStart(2,'0') + '/' +
      String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
  },

  open: function(containerEl, opts) {
    opts = opts || {};
    var today = this._today();

    var html = '';

    // ── Overlay + Shell (from popover_shell.css) ──
    html += '<div class="pmo-pop-overlay pmo-add-task" data-pop-overlay>';
    html += '<div class="pmo-pop">';

    // ── Header (identical to popover_shell) ──
    html += '<div class="pmo-pop-header">';
    html += '<button class="pmo-pop-close" data-pop-close title="Đóng">✕</button>';
    if (opts.breadcrumb && PMO.Breadcrumb) {
      html += '<div class="ph-breadcrumb">' + PMO.Breadcrumb.render(opts.breadcrumb) + '</div>';
    }
    html += '<div class="ph-title-row">';
    html += '<div class="ph-level-bar task"></div>';
    html += '<div class="ph-title-block">';
    html += '<div class="ph-level-label">Tạo Task mới</div>';
    html += '<div class="ph-title" contenteditable="true" id="addTaskTitle"></div>';
    html += '</div></div>';
    html += '<div class="ph-desc" contenteditable="true" id="addTaskDesc"></div>';
    html += '</div>';

    // ── No tab bar — straight to body ──

    // ── Body ──
    html += '<div class="pmo-pop-body">';
    html += '<div class="pmo-pop-panel active">';

    // Fields area — fixed, no scroll
    html += '<div class="at-fields">';
    html += PMO.Field.rowCol('Hình thức', PMO.ExecMode.render('independent', '', {editable:true}));
    html += PMO.Field.row('Kế hoạch', PMO.Date.renderRange(today, today, {showTime:false, editable:true}));
    html += PMO.Field.row('PIC', PMO.MemberField.renderSingle('', '', {editable:true}));
    html += PMO.Field.row('Approver', PMO.MemberField.renderSingle('', '', {editable:true}));
    html += PMO.Field.row('Assignees', PMO.MemberField.renderList([], {maxLines:2, editable:true}));
    html += '</div>';

    // Subtask section — own scroll container, takes remaining space
    html += '<div class="at-subtask-section">';
    html += '<div class="pmo-at-section">Đầu việc</div>';
    html += '<div class="at-subtask-scroll">';
    html += '<div class="pmo-subtask-list" id="addTaskSubtaskList"></div>';
    html += '</div>';
    html += '</div>';

    // panel-footer: sticky "+ Thêm đầu việc"
    html += '<div class="panel-footer">';
    html += '<div class="pmo-subtask-add" data-action="add-subtask" style="margin:0;padding:4px 0">';
    html += '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><circle cx="7" cy="7" r="5.5"/><path d="M7 4.5v5M4.5 7h5"/></svg> Thêm đầu việc';
    html += '</div></div>';

    html += '</div>'; // end pmo-pop-panel
    html += '</div>'; // end pmo-pop-body

    // ── Action footer (identical to popover_shell) ──
    html += '<div class="pmo-pop-actions">';
    html += '<button class="pa-btn" data-pop-cancel>Hủy</button>';
    html += '<button class="pa-btn primary disabled" id="addTaskCreate" data-pop-save>Tạo task</button>';
    html += '</div>';

    html += '</div>'; // end pmo-pop
    html += '</div>'; // end overlay

    containerEl.innerHTML = html;
    this._bind(containerEl, opts);
  },

  _bind: function(containerEl, opts) {
    var overlay = containerEl.querySelector('[data-pop-overlay]');
    var titleEl = containerEl.querySelector('#addTaskTitle');
    var createBtn = containerEl.querySelector('#addTaskCreate');

    function closePop() { if (overlay) overlay.remove(); }

    // Close / Cancel / Overlay click
    var closeBtn = containerEl.querySelector('[data-pop-close]');
    if (closeBtn) closeBtn.addEventListener('click', closePop);
    var cancelBtn = containerEl.querySelector('[data-pop-cancel]');
    if (cancelBtn) cancelBtn.addEventListener('click', closePop);
    if (overlay) overlay.addEventListener('click', function(e) { if (e.target === overlay) closePop(); });

    // Auto-focus title
    if (titleEl) {
      setTimeout(function() { titleEl.focus(); }, 100);
      titleEl.addEventListener('input', function() {
        if (titleEl.textContent.trim().length > 0) createBtn.classList.remove('disabled');
        else createBtn.classList.add('disabled');
      });
    }

    // Subtask bind — bind to .pmo-pop-panel so both panel-scroll and panel-footer are covered
    var panel = containerEl.querySelector('.pmo-pop-panel');
    if (panel) PMO.Subtask.bind(panel, {currentUser: 'Bạn'});

    // Create button
    if (createBtn) {
      createBtn.addEventListener('click', function() {
        if (createBtn.classList.contains('disabled')) return;

        var data = {};
        data.title = titleEl ? titleEl.textContent.trim() : '';
        var descEl = containerEl.querySelector('#addTaskDesc');
        data.description = descEl ? descEl.textContent.trim() : '';

        var emChip = containerEl.querySelector('.pmo-exec-mode');
        data.execMode = emChip ? (emChip.dataset.mode || 'independent') : 'independent';
        var emDetail = containerEl.querySelector('.pmo-exec-detail');
        data.execDetail = emDetail ? emDetail.textContent.trim() : '';

        var singles = containerEl.querySelectorAll('.pmo-member-single');
        data.pic = singles[0] ? (singles[0].dataset.member || '') : '';
        data.approver = singles[1] ? (singles[1].dataset.member || '') : '';

        data.assignees = [];
        containerEl.querySelectorAll('.pmo-member-list-wrap .pmo-chip').forEach(function(c) {
          if (c.dataset.name) data.assignees.push(c.dataset.name);
        });

        data.subtasks = [];
        containerEl.querySelectorAll('.pmo-subtask').forEach(function(st) {
          var content = st.querySelector('.st-content');
          var text = content ? content.textContent.trim() : '';
          if (text) data.subtasks.push({ content: text, assignee: st.dataset.assignee || '' });
        });

        if (opts.onCreate) opts.onCreate(data);
        closePop();
      });
    }
  }
};
