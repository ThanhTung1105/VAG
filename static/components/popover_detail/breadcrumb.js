/* ═══════════════════════════════════════════════════════
   PMO.Breadcrumb
   render(segments) → HTML
   segments: [{label, level, id}], last one = current
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.Breadcrumb = {
  render: function(segments) {
    if (!segments || !segments.length) return '';
    var html = '<nav class="pmo-breadcrumb">';
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      if (i > 0) html += '<span class="pmo-bc-sep">/</span>';
      html += '<span class="pmo-bc-item"';
      if (s.id) html += ' data-level="' + (s.level||'') + '" data-id="' + s.id + '"';
      html += '>' + s.label + '</span>';
    }
    html += '</nav>';
    return html;
  }
};
