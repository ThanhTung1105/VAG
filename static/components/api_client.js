/* ═══════════════════════════════════════════════════════
   PMO.API — API client for backend communication
   All mutations go through here → DB → re-fetch tree
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.API = {
  BASE: '/api',

  /* ── Generic helpers ─────────────────────────── */

  _json: function(method, url, body) {
    var fullUrl = this.BASE + url;
    console.log('[PMO.API]', method, fullUrl, body || '');
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    return fetch(fullUrl, opts).then(function(r) {
      if (!r.ok) {
        console.error('[PMO.API] FAIL', r.status, r.statusText);
        throw new Error('API ' + r.status + ': ' + r.statusText);
      }
      return r.json();
    });
  },

  get:    function(url)       { return this._json('GET', url); },
  post:   function(url, body) { return this._json('POST', url, body); },
  put:    function(url, body) { return this._json('PUT', url, body); },
  patch:  function(url, body) { return this._json('PATCH', url, body); },
  del:    function(url)       { return this._json('DELETE', url); },

  /* ── Portfolio tree ──────────────────────────── */

  fetchTree: function() {
    return this.get('/portfolio');
  },

  /* ── Subtask actions ─────────────────────────── */

  /** Toggle finish status: unfinished ↔ finished */
  toggleFinish: function(subtaskDbId) {
    return this.patch('/subtasks/' + subtaskDbId + '/finish', {});
  },

  /** Approve or reject a subtask */
  approveSubtask: function(subtaskDbId, action) {
    return this.patch('/subtasks/' + subtaskDbId + '/approve', { action: action });
  },

  /** Create a new subtask */
  createSubtask: function(taskDbId, content) {
    return this.post('/tasks/' + taskDbId + '/subtasks', { content: content });
  },

  /** Update subtask content */
  updateSubtask: function(subtaskDbId, data) {
    return this.put('/subtasks/' + subtaskDbId, data);
  },

  /** Delete a subtask */
  deleteSubtask: function(subtaskDbId) {
    return this.del('/subtasks/' + subtaskDbId);
  },

  /* ── Task actions ────────────────────────────── */

  createTask: function(wpDbId, data) {
    return this.post('/work-packages/' + wpDbId + '/tasks', data);
  },

  updateTask: function(taskDbId, data) {
    return this.put('/tasks/' + taskDbId, data);
  },

  deleteTask: function(taskDbId) {
    return this.del('/tasks/' + taskDbId);
  },

  /* ── Work Package actions ────────────────────── */

  updateWP: function(wpDbId, data) {
    return this.put('/work-packages/' + wpDbId, data);
  },

  /* ── Phase actions ───────────────────────────── */

  updatePhase: function(phaseDbId, data) {
    return this.put('/phases/' + phaseDbId, data);
  },

  /* ── Project actions ─────────────────────────── */

  updateProject: function(projectDbId, data) {
    return this.put('/projects/' + projectDbId, data);
  },

  /* ── Program actions ─────────────────────────── */

  updateProgram: function(programDbId, data) {
    return this.put('/programs/' + programDbId, data);
  },

  /* ── Notes ───────────────────────────────────── */

  fetchNotes: function(refTable, refDbId) {
    return this.get('/notes/' + refTable + '/' + refDbId);
  },

  createNote: function(refTable, refDbId, content) {
    return this.post('/notes/' + refTable + '/' + refDbId, {
      content: content
    });
  },

  deleteNote: function(noteId) {
    return this.del('/notes/' + noteId);
  },

  /* ── Audit Trail ─────────────────────────────── */

  fetchTrail: function(refTable, refDbId) {
    return this.get('/trail/' + refTable + '/' + refDbId);
  },

  /* ── ID helpers ──────────────────────────────── */

  /**
   * Frontend uses prefixed IDs: "prg1", "prj2", "wp3", "t4", "st5"
   * Backend uses raw numeric IDs.
   * These helpers convert between them.
   */
  toDbId: function(frontendId) {
    if (!frontendId) return null;
    var m = String(frontendId).match(/\d+$/);
    return m ? parseInt(m[0]) : null;
  },

  /** Determine ref_table from frontend ID prefix */
  toRefTable: function(frontendId) {
    if (!frontendId) return null;
    var s = String(frontendId);
    if (s.startsWith('prg')) return 'program';
    if (s.startsWith('prj')) return 'project';
    if (s.startsWith('ph'))  return 'phase';
    if (s.startsWith('wp'))  return 'work_package';
    if (s.startsWith('st'))  return 'subtask';
    if (s.startsWith('t'))   return 'task';
    return null;
  },

  /** Map row.type to ref_table */
  typeToRefTable: function(type) {
    var map = { program:'program', project:'project', phase:'phase', wp:'work_package', task:'task', subtask:'subtask' };
    return map[type] || type;
  },

  /** Generic update by frontend row type + id */
  updateByType: function(type, frontendId, data) {
    var dbId = this.toDbId(frontendId);
    if (!dbId) return Promise.reject('Invalid ID: ' + frontendId);
    switch(type) {
      case 'program': return this.updateProgram(dbId, data);
      case 'project': return this.updateProject(dbId, data);
      case 'phase':   return this.updatePhase(dbId, data);
      case 'wp':      return this.updateWP(dbId, data);
      case 'task':    return this.updateTask(dbId, data);
      default: return Promise.reject('Unknown type: ' + type);
    }
  }
};
