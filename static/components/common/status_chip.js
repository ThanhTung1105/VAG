/* ═══════════════════════════════════════════════════════
   PMO._dd — Shared dropdown manager
   PMO.StatusChip — Status chip with editable dropdown
   Includes event delegation for .pmo-status.editable
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

/* Dropdown manager */
if (!PMO._dd) {
  PMO._dd = {
    el: null, src: null, _h: null,
    open: function(srcEl, items, onSelect) {
      this.close();
      this.src = srcEl;
      var dd = document.createElement('div');
      dd.className = 'pmo-chip-dd';
      this.el = dd;
      items.forEach(function(it) {
        var row = document.createElement('div');
        row.className = 'dd-item' + (it.active ? ' active' : '');
        row.innerHTML = '<span class="dd-dot" style="background:'+it.color+'"></span>'+it.label;
        row.addEventListener('mousedown', function(e) {
          e.preventDefault(); e.stopPropagation();
          PMO._dd.close();
          onSelect(it.key);
        });
        dd.appendChild(row);
      });
      document.body.appendChild(dd);
      var r = srcEl.getBoundingClientRect();
      dd.style.left = r.left + 'px';
      dd.style.top = (r.bottom + 4) + 'px';
      var self = this;
      this._h = function(e) {
        if (!dd.contains(e.target) && e.target !== srcEl && !srcEl.contains(e.target)) self.close();
      };
      setTimeout(function() { document.addEventListener('mousedown', self._h); }, 0);
    },
    close: function() {
      if (this.el) { this.el.remove(); this.el = null; }
      if (this._h) { document.removeEventListener('mousedown', this._h); this._h = null; }
      this.src = null;
    }
  };
}

/* StatusChip */
PMO.StatusChip = {
  LABELS: {not_started:'Chưa bắt đầu',in_progress:'Đang thực hiện',in_review:'Chờ duyệt',completed:'Hoàn thành',cancelled:'Đã hủy'},
  CLS: {not_started:'s-ns',in_progress:'s-ip',in_review:'s-ir',completed:'s-co',cancelled:'s-ca'},
  COLORS: {not_started:'#8C939A',in_progress:'#1A8CFF',in_review:'#8B5CF6',completed:'#16A34A',cancelled:'#6B7280'},
  ARROW: '<svg class="chip-arrow" viewBox="0 0 12 12" fill="currentColor"><path d="M3 4.5L6 7.5L9 4.5"/></svg>',

  render: function(status, health, opts) {
    opts = opts || {};
    var sCls = this.CLS[status] || 's-ns';
    var label = this.LABELS[status] || status;
    var hCls = '';
    if (health === 'at_risk') hCls = ' h-ar';
    else if (health === 'behind_schedule') hCls = ' h-bs';
    var ed = opts.editable === true;
    var html = '<span class="pmo-status ' + sCls + hCls + (ed ? ' editable' : '') + '"';
    if (ed) html += ' data-s="' + status + '" data-h="' + (health||'on_track') + '"';
    html += '>' + label + (ed ? this.ARROW : '') + '</span>';
    return html;
  },

  _click: function(el) {
    if (PMO._dd.src === el) { PMO._dd.close(); return; }
    var self = this;
    var current = el.dataset.s;
    var health = el.dataset.h;
    var items = [];
    for (var k in this.LABELS) {
      items.push({key:k, label:this.LABELS[k], color:this.COLORS[k], active:k===current});
    }
    PMO._dd.open(el, items, function(key) {
      var newHTML = self.render(key, health, {editable:true});
      var tmp = document.createElement('div');
      tmp.innerHTML = newHTML;
      var newEl = tmp.firstElementChild;
      el.parentNode.replaceChild(newEl, el);
    });
  }
};

document.addEventListener('mousedown', function(e) {
  var el = e.target.closest('.pmo-status.editable');
  if (el) { e.stopPropagation(); PMO.StatusChip._click(el); }
});
