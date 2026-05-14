/* ═══════════════════════════════════════════════════════
   PMO.WorkItemPicker — Tree browser for selecting a work item
   (program, project, phase, work_package, task).
   Shows breadcrumb hierarchy, drills into children.
   
   Usage:
     PMO.WorkItemPicker.open(anchorEl, {
       onSelect: function(table, id, breadcrumb) { ... }
     });
   
   Renders as floating popover anchored to anchorEl.
   ═══════════════════════════════════════════════════════ */
PMO.WorkItemPicker = {
  _tree: null,
  _pop: null,

  open: function(anchorEl, opts) {
    var self = this;
    var onSelect = opts.onSelect || function(){};

    // Close existing
    this.close();

    // Fetch tree if not cached
    if (this._tree) {
      this._show(anchorEl, this._tree, onSelect);
    } else {
      fetch('/api/portfolio')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          self._tree = data;
          self._show(anchorEl, data, onSelect);
        });
    }
  },

  close: function() {
    if (this._pop) { this._pop.remove(); this._pop = null; }
  },

  _show: function(anchorEl, tree, onSelect) {
    var self = this;
    var pop = document.createElement('div');
    pop.className = 'wip-popover';
    this._pop = pop;

    // Position
    var rect = anchorEl.getBoundingClientRect();
    pop.style.position = 'fixed';
    pop.style.left = rect.left + 'px';
    pop.style.top = (rect.bottom + 4) + 'px';
    pop.style.zIndex = 500;

    this._renderLevel(pop, tree, [], onSelect);
    document.body.appendChild(pop);

    // Close on outside click
    setTimeout(function() {
      document.addEventListener('click', function handler(e) {
        if (!pop.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) {
          self.close();
          document.removeEventListener('click', handler);
        }
      });
    }, 50);
  },

  _renderLevel: function(pop, tree, breadcrumb, onSelect) {
    var self = this;
    var h = '<div class="wip-header">';
    if (breadcrumb.length > 0) {
      h += '<button class="wip-back">←</button>';
    }
    h += '<span class="wip-title">' + (breadcrumb.length ? breadcrumb[breadcrumb.length-1].name : 'Chọn mục') + '</span>';
    h += '</div>';
    h += '<div class="wip-list">';

    // Build items based on current level
    var items = this._getItems(tree, breadcrumb);
    items.forEach(function(item) {
      var hasChildren = item.children && item.children.length > 0;
      h += '<div class="wip-item" data-table="' + item.table + '" data-id="' + item.id + '">';
      h += '<span class="wip-type">' + item.typeLabel + '</span>';
      h += '<span class="wip-name">' + (item.name || '').replace(/</g, '&lt;') + '</span>';
      if (hasChildren) h += '<button class="wip-drill">›</button>';
      h += '</div>';
    });

    if (!items.length) {
      h += '<div class="wip-empty">Không có mục con</div>';
    }
    h += '</div>';
    pop.innerHTML = h;

    // Back button
    var backBtn = pop.querySelector('.wip-back');
    if (backBtn) {
      backBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        breadcrumb.pop();
        self._renderLevel(pop, tree, breadcrumb, onSelect);
      });
    }

    // Item clicks: click = SELECT, drill button = go deeper
    pop.querySelectorAll('.wip-item').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        // If clicked the drill button, drill in instead
        if (e.target.closest('.wip-drill')) {
          var table = el.dataset.table;
          var id = parseInt(el.dataset.id);
          var name = el.querySelector('.wip-name').textContent;
          breadcrumb.push({ table: table, id: id, name: name });
          self._renderLevel(pop, tree, breadcrumb, onSelect);
          return;
        }
        // Otherwise: select this item
        var table = el.dataset.table;
        var id = parseInt(el.dataset.id);
        var name = el.querySelector('.wip-name').textContent;
        var bc = breadcrumb.map(function(b){return b.name;}).concat([name]).join(' → ');
        onSelect(table, id, bc, name);
        self.close();
      });
    });
  },

  _getItems: function(tree, breadcrumb) {
    if (breadcrumb.length === 0) {
      // Top level: programs
      return (tree.programs || []).map(function(p) {
        return { table: 'program', id: parseInt(p.id.replace('prg','')), name: p.name, typeLabel: 'PRG',
          children: p.projects };
      });
    }

    var last = breadcrumb[breadcrumb.length - 1];

    if (last.table === 'program') {
      // Show projects
      var prg = (tree.programs || []).find(function(p) { return parseInt(p.id.replace('prg','')) === last.id; });
      if (!prg) return [];
      return (prg.projects || []).map(function(p) {
        return { table: 'project', id: parseInt(p.id.replace('prj','')), name: p.name, typeLabel: 'PRJ',
          children: p.phases };
      });
    }

    if (last.table === 'project') {
      var phases = this._findProject(tree, last.id);
      return (phases || []).map(function(p) {
        return { table: 'phase', id: parseInt(p.id.replace('ph','')), name: p.name, typeLabel: 'PH',
          children: p.workPackages };
      });
    }

    if (last.table === 'phase') {
      var wps = this._findPhase(tree, last.id);
      return (wps || []).map(function(w) {
        return { table: 'work_package', id: parseInt(w.id.replace('wp','')), name: w.name, typeLabel: 'WP',
          children: w.tasks };
      });
    }

    if (last.table === 'work_package') {
      var tasks = this._findWP(tree, last.id);
      return (tasks || []).map(function(t) {
        return { table: 'task', id: parseInt(t.id.replace('t','')), name: t.name, typeLabel: 'TSK',
          children: [] };
      });
    }

    return [];
  },

  _findProject: function(tree, id) {
    for (var i=0; i<(tree.programs||[]).length; i++) {
      for (var j=0; j<(tree.programs[i].projects||[]).length; j++) {
        var p = tree.programs[i].projects[j];
        if (parseInt(p.id.replace('prj','')) === id) return p.phases;
      }
    }
    return [];
  },

  _findPhase: function(tree, id) {
    for (var i=0; i<(tree.programs||[]).length; i++) {
      for (var j=0; j<(tree.programs[i].projects||[]).length; j++) {
        for (var k=0; k<(tree.programs[i].projects[j].phases||[]).length; k++) {
          var ph = tree.programs[i].projects[j].phases[k];
          if (parseInt(ph.id.replace('ph','')) === id) return ph.workPackages;
        }
      }
    }
    return [];
  },

  _findWP: function(tree, id) {
    for (var i=0; i<(tree.programs||[]).length; i++) {
      for (var j=0; j<(tree.programs[i].projects||[]).length; j++) {
        for (var k=0; k<(tree.programs[i].projects[j].phases||[]).length; k++) {
          for (var l=0; l<(tree.programs[i].projects[j].phases[k].workPackages||[]).length; l++) {
            var wp = tree.programs[i].projects[j].phases[k].workPackages[l];
            if (parseInt(wp.id.replace('wp','')) === id) return wp.tasks;
          }
        }
      }
    }
    return [];
  },

  /** Render a display chip for a selected source/impact */
  renderChip: function(table, id, breadcrumb, opts) {
    opts = opts || {};
    var ed = opts.editable !== false;
    var typeLabels = {program:'PRG',project:'PRJ',phase:'PH',work_package:'WP',task:'TSK'};
    var h = '<span class="wip-chip' + (ed ? ' editable' : '') + '" data-table="' + (table||'') + '" data-id="' + (id||'') + '">';
    if (table && id) {
      h += '<span class="wip-chip-type">' + (typeLabels[table]||table) + '</span>';
      h += '<span class="wip-chip-bc">' + (breadcrumb || table + '#' + id) + '</span>';
      if (ed) h += '<button class="wip-chip-clear">&times;</button>';
    } else {
      h += '<button class="wip-chip-select">Chọn mục</button>';
    }
    h += '</span>';
    return h;
  }
};
