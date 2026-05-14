/* ═══════════════════════════════════════════════════════
   pmo-ms — Milestone Icon JS
   PMO.Milestone.render(level, health) → HTML string
   level: 'big'|'small'|'none'
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.Milestone = {
  healthColor(health) {
    if (health === 'at_risk') return 'var(--c-ar)';
    if (health === 'behind_schedule') return 'var(--c-bs)';
    return 'var(--c-ip)';
  },

  render(level, health) {
    if (!level || level === 'none') return '';
    const c = this.healthColor(health);
    if (level === 'big') return `<span class="pmo-ms"><span class="pmo-ms-star" style="color:${c}">★</span></span>`;
    return `<span class="pmo-ms"><span class="pmo-ms-diamond" style="border-color:${c}"></span></span>`;
  }
};
