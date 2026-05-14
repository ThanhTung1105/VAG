/* ═══════════════════════════════════════════════════════
   PMO.HealthChip — Health chip with editable dropdown
   Requires PMO._dd (from status_chip.js or standalone)
   Includes event delegation for .pmo-health.editable
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

/* Ensure dropdown manager exists (in case loaded without status_chip.js) */
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

PMO.HealthChip = {
  LABELS: {on_track:'Đúng tiến độ',at_risk:'Có rủi ro',behind_schedule:'Chậm tiến độ'},
  CLS: {on_track:'h-ot',at_risk:'h-ar',behind_schedule:'h-bs'},
  COLORS: {on_track:'#16A34A',at_risk:'#EAB308',behind_schedule:'#DC2626'},
  ARROW: '<svg class="chip-arrow" viewBox="0 0 12 12" fill="currentColor"><path d="M3 4.5L6 7.5L9 4.5"/></svg>',

  render: function(health, opts) {
    opts = opts || {};
    var cls = this.CLS[health] || 'h-ot';
    var label = this.LABELS[health] || health;
    var ed = opts.editable === true;
    var html = '<span class="pmo-health ' + cls + (ed ? ' editable' : '') + '"';
    if (ed) html += ' data-h="' + health + '"';
    html += '>' + label + (ed ? this.ARROW : '') + '</span>';
    return html;
  },

  _click: function(el) {
    if (PMO._dd.src === el) { PMO._dd.close(); return; }
    var self = this;
    var current = el.dataset.h;
    var items = [];
    for (var k in this.LABELS) {
      items.push({key:k, label:this.LABELS[k], color:this.COLORS[k], active:k===current});
    }
    PMO._dd.open(el, items, function(key) {
      var newHTML = self.render(key, {editable:true});
      var tmp = document.createElement('div');
      tmp.innerHTML = newHTML;
      var newEl = tmp.firstElementChild;
      el.parentNode.replaceChild(newEl, el);
    });
  }
};

document.addEventListener('mousedown', function(e) {
  var el = e.target.closest('.pmo-health.editable');
  if (el) { e.stopPropagation(); PMO.HealthChip._click(el); }
});
