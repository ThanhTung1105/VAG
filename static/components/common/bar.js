/* ═══════════════════════════════════════════════════════
   pmo-bar — Progress Bar JS
   PMO.Bar.render({ pctFinished, pctApproved, health, status, overdueRatio }) → HTML
   overdueRatio: 0-1, portion of bar width that is overdue extension
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.Bar = {
  healthColor(health) {
    if (health === 'at_risk') return 'var(--c-ar)';
    if (health === 'behind_schedule') return 'var(--c-bs)';
    if (health === 'on_track') return 'var(--c-ip)';
    return 'var(--c-ip)';
  },

  /**
   * @param {object} opts
   * @param {number} opts.pctFinished - 0-100
   * @param {number} opts.pctApproved - 0-100
   * @param {string} opts.health - on_track|at_risk|behind_schedule
   * @param {string} opts.status - for cancelled detection
   * @param {number} [opts.overdueRatio] - 0-1, how much extra width for overdue
   * @returns {string} HTML
   */
  render(opts) {
    const { pctFinished = 0, pctApproved = 0, health = 'on_track', status, overdueRatio = 0 } = opts;

    // Cancelled = grey
    if (status === 'cancelled') {
      const innerPct = overdueRatio > 0 ? (1 - overdueRatio) * 100 : 100;
      let html = `<div class="pmo-bar"><div class="pmo-bar-inner" style="width:${innerPct}%">`;
      html += `<div class="pmo-bar-bg" style="background:var(--c-ca)"></div>`;
      if (pctFinished > 0) html += `<div class="pmo-bar-finished" style="width:${Math.min(pctFinished, 100)}%;background:var(--c-ca)"></div>`;
      if (pctApproved > 0) html += `<div class="pmo-bar-approved" style="width:${Math.min(pctApproved, 100)}%;background:var(--c-ca)"></div>`;
      html += `<div class="pmo-bar-cancelled"></div>`;
      html += `</div></div>`;
      return html;
    }

    // Color: completed = green, otherwise health color
    const c = status === 'completed' ? 'var(--c-co)' : this.healthColor(health);
    const innerPct = overdueRatio > 0 ? (1 - overdueRatio) * 100 : 100;

    let html = `<div class="pmo-bar"><div class="pmo-bar-inner" style="width:${innerPct}%">`;
    html += `<div class="pmo-bar-bg" style="background:${c}"></div>`;
    if (pctFinished > 0) html += `<div class="pmo-bar-finished" style="width:${Math.min(pctFinished, 100)}%;background:${c}"></div>`;
    if (pctApproved > 0) html += `<div class="pmo-bar-approved" style="width:${Math.min(pctApproved, 100)}%;background:${c}"></div>`;
    html += `</div>`;
    if (overdueRatio > 0) html += `<div class="pmo-bar-overdue" style="left:${innerPct}%;width:${overdueRatio * 100}%"></div>`;
    html += `</div>`;
    return html;
  }
};
