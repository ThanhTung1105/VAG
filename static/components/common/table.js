/* ═══════════════════════════════════════════════════════
   pmo-table — Data Table JS
   PMO.Table.init(tableEl) — bind resize + sort
   PMO.Table.render(container, { columns, rows }) — render full table
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.Table = {

  /**
   * Initialize a .pmo-table: bind column resize, row resize, sort clicks
   * @param {HTMLElement} wrapEl - the .pmo-table-wrap element
   */
  init(wrapEl) {
    const table = wrapEl.querySelector('.pmo-table');
    if (!table) return;

    this._initColResize(table);
    this._initRowResize(table);
    this._initSort(table);
  },

  /* ── Column Resize ── */
  _initColResize(table) {
    table.querySelectorAll('th .col-resize').forEach(handle => {
      let startX, startW, th;

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        th = handle.closest('th');
        startX = e.clientX;
        startW = th.offsetWidth;
        handle.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMove = (ev) => {
          const diff = ev.clientX - startX;
          const newW = Math.max(40, startW + diff);
          th.style.width = newW + 'px';
          th.style.minWidth = newW + 'px';
        };
        const onUp = () => {
          handle.classList.remove('dragging');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  },

  /* ── Row Resize ── */
  _initRowResize(table) {
    table.querySelectorAll('td:first-child .row-resize').forEach(handle => {
      let startY, startH, tr;

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        tr = handle.closest('tr');
        startY = e.clientY;
        startH = tr.offsetHeight;
        handle.classList.add('dragging');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';

        const onMove = (ev) => {
          const diff = ev.clientY - startY;
          const newH = Math.max(32, startH + diff);
          tr.style.height = newH + 'px';
          // Set all cells to match
          tr.querySelectorAll('td').forEach(td => td.style.height = newH + 'px');
        };
        const onUp = () => {
          handle.classList.remove('dragging');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  },

  /* ── Sort ── */
  _initSort(table) {
    table.querySelectorAll('th.sortable').forEach(th => {
      th.querySelector('.th-inner').addEventListener('click', () => {
        const idx = Array.from(th.parentElement.children).indexOf(th);
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        // Toggle sort direction
        const wasAsc = th.classList.contains('sort-asc');
        // Clear all sort states
        table.querySelectorAll('th').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));

        const dir = wasAsc ? 'desc' : 'asc';
        th.classList.add('sort-' + dir);

        // Sort rows
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort((a, b) => {
          const aVal = (a.children[idx]?.textContent || '').trim().toLowerCase();
          const bVal = (b.children[idx]?.textContent || '').trim().toLowerCase();
          // Try numeric
          const aNum = parseFloat(aVal), bNum = parseFloat(bVal);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return dir === 'asc' ? aNum - bNum : bNum - aNum;
          }
          return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        });
        rows.forEach(r => tbody.appendChild(r));
      });
    });
  },

  /* ── Sort icon SVG ── */
  SORT_SVG: '<svg class="sort-icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3L7 11M7 3L4 6M7 3L10 6"/></svg>',

  /* ── Row resize handle ── */
  ROW_RESIZE: '<div class="row-resize"></div>',

  /**
   * Render a table into a container
   * @param {HTMLElement} container
   * @param {object} opts
   * @param {Array<{key,label,width?,sortable?,align?,render?}>} opts.columns
   * @param {Array<object>} opts.rows - data objects
   * @param {string} [opts.emptyText] - shown when no rows
   */
  render(container, opts) {
    const { columns, rows, emptyText = 'Không có dữ liệu' } = opts;

    let html = '<div class="pmo-table-wrap"><table class="pmo-table">';

    // HEAD
    html += '<thead><tr>';
    columns.forEach(col => {
      const w = col.width ? ` style="width:${col.width}px;min-width:${col.width}px"` : '';
      const sortCls = col.sortable ? ' sortable' : '';
      html += `<th class="${sortCls}"${w}>`;
      html += `<div class="th-inner">${col.label}${col.sortable ? this.SORT_SVG : ''}</div>`;
      html += '<div class="col-resize"></div>';
      html += '</th>';
    });
    html += '</tr></thead>';

    // BODY
    html += '<tbody>';
    if (rows.length === 0) {
      html += `<tr><td colspan="${columns.length}"><div class="pmo-table-empty">${emptyText}</div></td></tr>`;
    } else {
      rows.forEach((row, ri) => {
        html += '<tr>';
        columns.forEach((col, ci) => {
          const alignCls = col.align === 'center' ? ' cell-center' : col.align === 'right' ? ' cell-num' : '';
          html += `<td class="${alignCls}">`;
          // Custom render or plain value
          if (col.render) {
            html += col.render(row[col.key], row, ri);
          } else {
            html += `<span class="cell-text">${row[col.key] ?? ''}</span>`;
          }
          // Row resize handle on first cell only
          if (ci === 0) html += this.ROW_RESIZE;
          html += '</td>';
        });
        html += '</tr>';
      });
    }
    html += '</tbody></table>';

    // Footer
    if (rows.length > 0) {
      html += `<div class="pmo-table-footer"><span>${rows.length} dòng</span></div>`;
    }

    html += '</div>';
    container.innerHTML = html;

    // Init interactions
    this.init(container.querySelector('.pmo-table-wrap'));
  }
};
