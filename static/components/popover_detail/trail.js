/* ═══════════════════════════════════════════════════════
   PMO.Trail — Audit trail item + list
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.Trail = {
  ACTION_LABELS: { add:'Thêm', edit:'Sửa', delete:'Xóa' },
  LEVEL_LABELS: { program:'Program', project:'Project', phase:'Phase', wp:'Work Package', task:'Task', subtask:'Sub-task' },

  /**
   * @param {object} t
   * t.source: 'user'|'system'
   * t.time: string
   * t.action: 'add'|'edit'|'delete'
   * t.level: 'program'|'project'|'phase'|'wp'|'task'|'subtask'
   * t.target: string (tên đối tượng)
   * t.attr: string (thuộc tính, optional)
   * t.oldVal: string (giá trị cũ, optional)
   * t.newVal: string (giá trị mới, optional)
   * t.user: string (người thực hiện)
   */
  renderItem: function(t) {
    var actCls = 'act-' + (t.action || 'edit');
    var html = '<div class="pmo-trail-item ' + actCls + '">';
    html += '<div class="tr-dot-col"><span class="tr-dot"></span></div>';
    html += '<div class="tr-body">';

    // Header
    html += '<div class="tr-header">';
    html += '<span class="tr-time">' + (t.time || '') + '</span>';
    html += '<span class="tr-source-badge ' + (t.source || 'user') + '">' + (t.source === 'system' ? 'Hệ thống' : (t.user || 'User')) + '</span>';
    html += '</div>';

    // Action line
    var verb = this.ACTION_LABELS[t.action] || t.action;
    var levelLabel = this.LEVEL_LABELS[t.level] || t.level || '';
    html += '<div class="tr-action">';
    html += '<span class="act-verb ' + (t.action||'') + '">' + verb + '</span> ';
    if (levelLabel) html += '<span class="act-level">' + levelLabel + ':</span> ';
    html += '<span class="act-target">' + (t.target || '') + '</span>';
    html += '</div>';

    // Change detail (for edit)
    if (t.action === 'edit' && t.attr) {
      html += '<div class="tr-change">';
      html += '<span class="tr-attr">' + t.attr + ':</span> ';
      if (t.oldVal !== undefined) html += '<span class="tr-old">' + t.oldVal + '</span>';
      html += '<span class="tr-arrow">→</span>';
      if (t.newVal !== undefined) html += '<span class="tr-new">' + t.newVal + '</span>';
      html += '</div>';
    }

    html += '</div></div>';
    return html;
  },

  renderList: function(trails) {
    var html = '<div class="pmo-trail-list">';
    if (!trails || !trails.length) {
      html += '<div class="pmo-trail-empty">Chưa có lịch sử nào</div>';
    } else {
      for (var i = 0; i < trails.length; i++) {
        html += this.renderItem(trails[i]);
      }
    }
    html += '</div>';
    return html;
  },

  bind: function(container) {
    var list = container.querySelector('.pmo-trail-list');
    if (list) list.scrollTop = list.scrollHeight;
  }
};
