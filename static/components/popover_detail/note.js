/* ═══════════════════════════════════════════════════════
   PMO.Note — Note item, list, input
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.Note = {
  SEND_SVG: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 1.3L14.8 8 1.5 14.7V9.2L10 8 1.5 6.8z"/></svg>',
  EDIT_SVG: '✎',
  DEL_SVG: '✕',

  /**
   * Render single note
   * @param {object} n — {id, author, time, content, source, edited, isOwner}
   */
  renderItem: function(n) {
    var ini = PMO.Avatar ? PMO.Avatar.initials(n.author) : (n.author||'?').slice(0,2).toUpperCase();
    var html = '<div class="pmo-note-item" data-note-id="' + (n.id||'') + '">';
    html += '<span class="pmo-avatar sm ni-avatar">' + ini + '</span>';
    html += '<div class="ni-body">';
    html += '<div class="ni-header">';
    html += '<span class="ni-name">' + (n.author||'') + '</span>';
    html += '<span class="ni-time">' + (n.time||'') + '</span>';
    if (n.source) html += '<span class="ni-source">' + n.source + '</span>';
    html += '</div>';
    html += '<div class="ni-content">' + (n.content||'').replace(/\n/g,'<br>') + '</div>';
    if (n.edited) html += '<div class="ni-edited">(đã chỉnh sửa)</div>';
    html += '</div>';
    if (n.isOwner) {
      html += '<div class="ni-actions">';
      html += '<button class="ni-act-btn" data-act="edit" title="Sửa">' + this.EDIT_SVG + '</button>';
      html += '<button class="ni-act-btn" data-act="delete" title="Xóa">' + this.DEL_SVG + '</button>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  },

  /**
   * Render note list + input
   * @param {Array} notes — array of note objects
   * @param {object} opts — {placeholder, currentUser}
   */
  renderList: function(notes, opts) {
    opts = opts || {};
    var html = '<div class="pmo-note-list" id="noteList">';
    if (!notes || !notes.length) {
      html += '<div class="pmo-note-empty">Chưa có ghi chú nào</div>';
    } else {
      for (var i = 0; i < notes.length; i++) {
        html += this.renderItem(notes[i]);
      }
    }
    html += '</div>';
    // Input
    html += '<div class="pmo-note-input">';
    html += '<textarea class="ni-textarea" placeholder="' + (opts.placeholder || 'Nhập ghi chú...') + '" rows="1"></textarea>';
    html += '<button class="ni-send" title="Gửi">' + this.SEND_SVG + '</button>';
    html += '</div>';
    return html;
  },

  /**
   * Bind interactive behaviors to a container
   */
  bind: function(container, opts) {
    opts = opts || {};
    var list = container.querySelector('.pmo-note-list');
    var textarea = container.querySelector('.ni-textarea');
    var sendBtn = container.querySelector('.ni-send');

    // Auto-scroll to bottom
    if (list) list.scrollTop = list.scrollHeight;

    // Auto-resize textarea
    if (textarea) {
      textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
      });
    }

    // Send
    if (sendBtn && textarea) {
      var self = this;
      function doSend() {
        var text = textarea.value.trim();
        if (!text) return;
        var note = {
          id: 'n_' + Date.now(),
          author: opts.currentUser || 'Bạn',
          time: self._now(),
          content: text,
          source: opts.source || null,
          isOwner: true
        };
        // Remove empty state
        var empty = list.querySelector('.pmo-note-empty');
        if (empty) empty.remove();
        // Append
        var tmp = document.createElement('div');
        tmp.innerHTML = self.renderItem(note);
        list.appendChild(tmp.firstElementChild);
        list.scrollTop = list.scrollHeight;
        textarea.value = '';
        textarea.style.height = 'auto';
        if (opts.onSend) opts.onSend(note);
      }
      sendBtn.addEventListener('click', doSend);
      textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
      });
    }

    // Edit & Delete via delegation
    if (list) {
      list.addEventListener('click', function(e) {
        var btn = e.target.closest('.ni-act-btn');
        if (!btn) return;
        var noteEl = btn.closest('.pmo-note-item');
        if (!noteEl) return;
        if (btn.dataset.act === 'delete') {
          noteEl.remove();
          if (!list.querySelector('.pmo-note-item')) {
            list.innerHTML = '<div class="pmo-note-empty">Chưa có ghi chú nào</div>';
          }
        } else if (btn.dataset.act === 'edit') {
          var contentEl = noteEl.querySelector('.ni-content');
          var oldText = contentEl.textContent;
          contentEl.setAttribute('contenteditable', 'true');
          contentEl.focus();
          contentEl.style.background = '#FFFBEB';
          contentEl.style.padding = '4px';
          contentEl.style.borderRadius = '4px';
          contentEl.style.outline = '1.5px solid var(--c-ar)';
          var save = function() {
            contentEl.removeAttribute('contenteditable');
            contentEl.style.background = '';
            contentEl.style.padding = '';
            contentEl.style.borderRadius = '';
            contentEl.style.outline = '';
            if (contentEl.textContent.trim() !== oldText) {
              var edited = noteEl.querySelector('.ni-edited');
              if (!edited) {
                edited = document.createElement('div');
                edited.className = 'ni-edited';
                edited.textContent = '(đã chỉnh sửa)';
                contentEl.after(edited);
              }
            }
          };
          contentEl.addEventListener('blur', save, {once:true});
          contentEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); contentEl.blur(); }
          });
        }
      });
    }
  },

  _now: function() {
    var d = new Date();
    return String(d.getDate()).padStart(2,'0') + '/' +
      String(d.getMonth()+1).padStart(2,'0') + '/' +
      d.getFullYear() + ' ' +
      String(d.getHours()).padStart(2,'0') + ':' +
      String(d.getMinutes()).padStart(2,'0');
  }
};
