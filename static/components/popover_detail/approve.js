/* ═══════════════════════════════════════════════════════
   PMO.Approve — Subtask approval item + list
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.Approve = {
  /**
   * @param {object} item
   * item.id, item.content, item.assignee, item.finishedAt,
   * item.status ('pending'|'approved'|'rejected'),
   * item.approver, item.approvedAt, item.note
   */
  renderItem: function(item) {
    var st = item.status || 'pending';
    var isPending = st === 'pending';
    var ini = item.assignee ? (PMO.Avatar ? PMO.Avatar.initials(item.assignee) : item.assignee.slice(0,2).toUpperCase()) : '';

    var html = '<div class="pmo-approve-item" data-ap-id="' + (item.id||'') + '" data-status="' + st + '">';

    // Avatar
    if (item.assignee) html += '<span class="pmo-avatar sm">' + ini + '</span>';

    // Body
    html += '<div class="ap-body">';
    html += '<div class="ap-header">';
    html += '<span class="ap-content">' + (item.content||'') + '</span>';
    var badgeLabel = st === 'approved' ? 'Đã duyệt' : st === 'rejected' ? 'Từ chối' : 'Chờ duyệt';
    html += '<span class="ap-badge ' + st + '">' + badgeLabel + '</span>';
    html += '</div>';

    // Meta
    html += '<div class="ap-meta">';
    html += '<span class="ap-by">' + (item.assignee||'') + '</span>';
    if (item.finishedAt) html += ' · hoàn thành ' + item.finishedAt;
    if (item.approvedAt && st !== 'pending') html += ' · ' + (st==='approved'?'duyệt':'từ chối') + ' ' + item.approvedAt;
    html += '</div>';

    // Approver note
    if (item.note) {
      html += '<div class="ap-note' + (st==='approved'?' approve-note':'') + '">' + item.note + '</div>';
    }

    // Reject reason input (hidden)
    if (isPending) {
      html += '<div class="ap-reason" data-reason-for="' + (item.id||'') + '"><textarea placeholder="Lý do từ chối..."></textarea><button class="ap-reason-send">Từ chối</button></div>';
    }
    html += '</div>';

    // Actions
    if (isPending) {
      html += '<div class="ap-actions">';
      html += '<button class="ap-btn approve" data-act="approve">✓ Duyệt</button>';
      html += '<button class="ap-btn reject" data-act="reject">✕ Từ chối</button>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  },

  renderList: function(items) {
    var html = '<div class="pmo-approve-list">';
    if (!items || !items.length) {
      html += '<div class="pmo-approve-empty">Không có đầu việc nào chờ duyệt</div>';
    } else {
      for (var i = 0; i < items.length; i++) {
        html += this.renderItem(items[i]);
      }
    }
    html += '</div>';
    return html;
  },

  bind: function(container) {
    container.addEventListener('click', function(e) {
      var btn = e.target.closest('.ap-btn');
      if (!btn) return;
      var itemEl = btn.closest('.pmo-approve-item');
      if (!itemEl) return;

      if (btn.dataset.act === 'approve') {
        // Approve immediately
        itemEl.dataset.status = 'approved';
        var badge = itemEl.querySelector('.ap-badge');
        badge.className = 'ap-badge approved';
        badge.textContent = 'Đã duyệt';
        var actions = itemEl.querySelector('.ap-actions');
        if (actions) actions.remove();
        var reason = itemEl.querySelector('.ap-reason');
        if (reason) reason.remove();
      } else if (btn.dataset.act === 'reject') {
        // Show reason input
        var reasonEl = itemEl.querySelector('.ap-reason');
        if (reasonEl) {
          reasonEl.classList.toggle('open');
          if (reasonEl.classList.contains('open')) {
            reasonEl.querySelector('textarea').focus();
          }
        }
      }
    });

    // Reject confirm
    container.addEventListener('click', function(e) {
      var sendBtn = e.target.closest('.ap-reason-send');
      if (!sendBtn) return;
      var reasonEl = sendBtn.closest('.ap-reason');
      var itemEl = sendBtn.closest('.pmo-approve-item');
      var text = reasonEl.querySelector('textarea').value.trim();

      itemEl.dataset.status = 'rejected';
      var badge = itemEl.querySelector('.ap-badge');
      badge.className = 'ap-badge rejected';
      badge.textContent = 'Từ chối';
      var actions = itemEl.querySelector('.ap-actions');
      if (actions) actions.remove();
      reasonEl.remove();

      // Add rejection note to the approve item display
      var noteText = 'Từ chối' + (text ? ': ' + text : '');
      var note = document.createElement('div');
      note.className = 'ap-note';
      note.textContent = noteText;
      itemEl.querySelector('.ap-body').appendChild(note);

      // Also add as a note entry in subtask's notes (if subtask exists on page)
      var stId = itemEl.dataset.apId;
      if (stId && PMO.Note) {
        var stEl = document.querySelector('[data-st-id="' + stId + '"]');
        if (stEl) {
          // Update subtask status to rejected
          stEl.dataset.fs = 'rejected';
          stEl.className = stEl.className.replace(/\b(unfinished|finished|approved|rejected)\b/g, '') + ' rejected';
          var stBadge = stEl.querySelector('.st-status');
          if (stBadge) { stBadge.className = 'st-status rejected'; stBadge.textContent = 'Từ chối'; }
          var stCheck = stEl.querySelector('.st-check');
          if (stCheck) stCheck.classList.remove('checked');
          // Add note to subtask notes area
          var notesArea = stEl.querySelector('.st-notes');
          if (notesArea) {
            var noteList = notesArea.querySelector('.pmo-note-list');
            if (noteList) {
              var empty = noteList.querySelector('.pmo-note-empty');
              if (empty) empty.remove();
              var tmp = document.createElement('div');
              tmp.innerHTML = PMO.Note.renderItem({
                id: 'rj_' + Date.now(),
                author: 'Approver',
                time: PMO.Note._now(),
                content: noteText,
                source: 'Phê duyệt',
                isOwner: false
              });
              noteList.appendChild(tmp.firstElementChild);
              notesArea.classList.add('open');
            }
          }
        }
      }
    });
  }
};
