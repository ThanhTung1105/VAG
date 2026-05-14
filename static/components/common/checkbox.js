/* ═══════════════════════════════════════════════════════
   pmo-check — Checkbox JS
   PMO.Checkbox.render(checked?) → HTML
   PMO.Checkbox.bind(container) — auto-bind click toggle
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.Checkbox = {
  SVG: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.5 6L5 8.5L9.5 3.5"/></svg>',

  render(checked) {
    return `<span class="pmo-check${checked ? ' checked' : ''}">${this.SVG}</span>`;
  },

  bind(container) {
    (container || document).querySelectorAll('.pmo-check').forEach(el => {
      el.addEventListener('click', () => el.classList.toggle('checked'));
    });
  }
};
