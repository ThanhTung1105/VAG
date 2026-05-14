/* ═══════════════════════════════════════════════════════
   pmo-popover — Assign Member Popover JS
   PMO.AssignMember.init(containerEl, opts)
   opts.mode: 'free'|'single'|'multi'
   opts.members: [{name, id}]
   opts.selected: [id]
   opts.onSelect(selected): callback
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.AssignMember = {
  init(containerEl, opts = {}) {
    const mode = opts.mode || 'multi';
    const members = opts.members || [];
    const selected = new Set(opts.selected || []);
    const onSelect = opts.onSelect || (() => {});

    const pop = containerEl.querySelector('.pmo-popover');
    if (!pop) return;

    // Mode class
    if (mode === 'single') pop.classList.add('single');

    // Search filter
    const input = pop.querySelector('input');
    if (input) {
      input.addEventListener('input', () => {
        const q = input.value.toLowerCase();
        pop.querySelectorAll('.pmo-popover-item').forEach(item => {
          const name = item.dataset.name || '';
          item.style.display = name.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    }

    // Free-type add
    const addBtn = pop.querySelector('.pop-add-btn');
    if (addBtn && mode === 'free') {
      addBtn.addEventListener('click', () => {
        const val = input?.value?.trim();
        if (val) {
          selected.add(val);
          onSelect([...selected]);
          if (input) input.value = '';
        }
      });
    }

    // Item click
    pop.querySelectorAll('.pmo-popover-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        if (mode === 'single') {
          pop.querySelectorAll('.pmo-popover-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          selected.clear();
          selected.add(id);
          onSelect([...selected]);
          pop.classList.remove('open');
        } else {
          item.classList.toggle('selected');
          if (selected.has(id)) selected.delete(id); else selected.add(id);
          onSelect([...selected]);
        }
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!containerEl.contains(e.target)) pop.classList.remove('open');
    });
  }
};
