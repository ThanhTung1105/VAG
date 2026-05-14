/* ═══════════════════════════════════════════════════════
   PMO.GanttChart — Renderer with virtual scrolling
   ALL rendering uses library components. Zero hardcode.
   ═══════════════════════════════════════════════════════ */
window.PMO = window.PMO || {};

PMO.GanttChart = {
  el: null, data: null, state: null,
  rows: null, rowPos: null, tl: null, mn: null, tw: 0,

  CFG: {
    barH: 32,
    headerRowH: 32,
    rowH: { program: 40, stratPrj: 88, default: 36 },
    stratOffsets: { row1: 4, row2: 28, row3: 50, arrowH: 22 },
    kqcHalfW: 65,
    TOGGLE_SVG: '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3.5L5 7L8 3.5"/></svg>',
    LEVEL_ICONS: {
      program: { cls: 'prg', label: 'P' },
      project: { cls: 'prj', label: 'Pj' },
      phase:   { cls: 'ph',  label: 'Ph' }
    }
  },

  mount: function(containerEl, data) {
    this.el = containerEl; this.data = data;
    this.state = { view:'operation', scale:'day', zoom:100, exp:new Set(), allExp:false, hlId:null, drill:null };
    this._resetExp(); this._buildShell(); this._bindInteractions();
    this.render();
    var self = this; setTimeout(function(){ self.scrollToToday(); }, 100);
  },

  _buildShell: function() {
    var h = '';
    h += '<div class="gantt-tb">';
    h += '<span class="gantt-tb-brand">⬡ VietAnh PMO</span><div class="gantt-tb-sep"></div>';
    h += '<button class="gantt-tb-btn" data-view="strategy">Chiến lược</button>';
    h += '<button class="gantt-tb-btn" data-view="control">Kiểm soát</button>';
    h += '<button class="gantt-tb-btn active" data-view="operation">Vận hành</button>';
    h += '<div class="gantt-tb-sep"></div>';
    h += '<button class="gantt-tb-btn" data-scale="month">Tháng</button>';
    h += '<button class="gantt-tb-btn" data-scale="week">Tuần</button>';
    h += '<button class="gantt-tb-btn active" data-scale="day">Ngày</button>';
    h += '<div class="gantt-tb-right">';
    h += '<button class="gantt-tb-btn" data-act="today">◎ Hôm nay</button>';
    h += '<div class="gantt-tb-zoom"><button data-act="zoomout">−</button><span data-ref="zoomLbl">100%</span><button data-act="zoomin">+</button></div>';
    h += '<button class="gantt-tb-btn" data-act="expand">↕ Mở rộng</button>';
    h += '</div></div>';
    h += '<div class="gantt-main">';
    h += '<div class="gantt-lp" data-ref="lp"><div class="gantt-lp-head" data-ref="lpHead"><div class="gantt-lp-head-inner" data-ref="lpHeadIn"></div></div><div class="gantt-lp-body" data-ref="lpBody"><div class="gantt-vs" data-ref="lpVs"></div></div></div>';
    h += '<div class="gantt-rp"><div class="gantt-rp-head" data-ref="rpHead"><div class="gantt-rp-head-inner" data-ref="rpHeadIn"></div></div><div class="gantt-rp-body" data-ref="rpBody"><div class="gantt-canvas" data-ref="canvas"><div class="gantt-vs" data-ref="rpVs"></div></div></div></div>';
    h += '</div>';
    this.el.innerHTML = h;
    this._refs = {};
    var self = this;
    this.el.querySelectorAll('[data-ref]').forEach(function(el){ self._refs[el.dataset.ref] = el; });
  },

  ref: function(n){ return this._refs[n]; },
  G: PMO.Gantt,

  render: function() {
    this.rows = this.G.flatten(this.data, this.state);
    this.rowPos = this.G.computeRowPositions(this.rows, this.CFG);
    var range = this.G.timeRange(this.data);
    this.mn = range.mn;
    this.tl = this.G.genTimeline(range.mn, range.mx, this.state.scale, this.state.zoom);
    this.tw = this.tl.days.length * this.tl.dw;
    var totalH = this.rowPos.length > 0 ? this.rowPos[this.rowPos.length-1].y + this.rowPos[this.rowPos.length-1].h : 0;
    this._renderLHead(); this._renderRHead(); this._renderGrid();
    this.ref('lpVs').style.height = totalH+'px';
    this.ref('rpVs').style.height = totalH+'px';
    this.ref('canvas').style.width = this.tw+'px';
    this._renderVisibleRows();
  },

  _renderVisibleRows: function() {
    var r = this.G.visibleRange(this.ref('lpBody').scrollTop, this.ref('lpBody').clientHeight, this.rowPos, 5);
    this._renderLRows(r.startIdx, r.endIdx);
    this._renderRRows(r.startIdx, r.endIdx);
  },

  /* ══════════════ LEFT PANEL ══════════════ */

  _renderLHead: function() {
    var cols = this.G.getColumns(this.state.view), el = this.ref('lpHeadIn');
    var nR = this.state.scale==='month'?1:this.state.scale==='week'?2:3;
    this.ref('lpHead').style.height = (nR*this.CFG.headerRowH)+'px';
    this._cols = cols;
    if (!this._colWidths || this._colWidths.length !== cols.length)
      this._colWidths = cols.map(function(c){return c.w;});
    var h='', totalW=0;
    for (var i=0;i<cols.length;i++) {
      totalW += this._colWidths[i];
      h += '<div class="gantt-lp-hcell" style="width:'+this._colWidths[i]+'px" data-col-idx="'+i+'">'+cols[i].l+'<div class="gantt-col-resize" data-col-idx="'+i+'"></div></div>';
    }
    el.innerHTML = h; el.style.width = totalW+'px';
    this._totalColW = totalW;
    this.ref('lp').style.width = totalW+'px';
    this._bindColResize();
  },

  _renderLRows: function(startIdx, endIdx) {
    var vs = this.ref('lpVs');
    vs.querySelectorAll('.gantt-row').forEach(function(r){r.remove();});
    var cols=this._cols, widths=this._colWidths, totalW=this._totalColW, self=this;
    vs.style.width = totalW+'px';
    for (var i=startIdx;i<endIdx&&i<this.rows.length;i++) {
      var row=this.rows[i], pos=this.rowPos[i];
      var el=document.createElement('div');
      el.className='gantt-row lv-'+row.type; el.dataset.rowId=row.id; el.dataset.idx=i;
      el.style.top=pos.y+'px'; el.style.height=pos.h+'px'; el.style.width=totalW+'px';
      if (row.isStratPrj) el.classList.add('strat-prj');
      for (var ci=0;ci<cols.length;ci++) {
        var cell=document.createElement('div'); cell.className='gantt-cell'; cell.style.width=widths[ci]+'px';
        if (cols[ci].k==='name') { cell.classList.add('name'); cell.style.paddingLeft=(8+row.depth*20)+'px'; cell.innerHTML=self._cellName(row); }
        else cell.innerHTML=self._cellContent(cols[ci].k, row);
        el.appendChild(cell);
      }
      el.addEventListener('mouseenter', function(){self._hlRow(this.dataset.rowId,true);});
      el.addEventListener('mouseleave', function(){self._hlRow(null,false);});
      el.addEventListener('click', function(e){
        if (e.target.closest('.gantt-tog,.gantt-editable,.gantt-pic,.gantt-pic-empty,.gantt-assignees,.gantt-assignees-empty,.pmo-status.editable,.pmo-health.editable,.pmo-date.editable,.pmo-textbox')) return;
        var nameCell=e.target.closest('.gantt-cell.name'); if(!nameCell) return;
        var r=self.rows[+this.dataset.idx];
        if (self.state.view==='operation'&&r.type==='phase'&&!self.state.drill) self._drillIn(r.id);
        else self._openDetail(r);
      });
      vs.appendChild(el);
    }
  },

  /* ══════════════ CELL RENDERERS ══════════════ */

  _cellName: function(r) {
    var h='';
    if (r.hasChildren) {
      var ex = this.state.exp.has(r.id)||(this.state.drill&&(r.type==='phase'||r.type==='wp'));
      h += '<button class="gantt-tog '+(ex?'':'col')+'" data-tog="'+r.id+'">'+this.CFG.TOGGLE_SVG+'</button>';
    } else h += '<span class="gantt-tog-ph"></span>';
    var li = this.CFG.LEVEL_ICONS[r.type];
    if (li) h += '<span class="gantt-li '+li.cls+'">'+li.label+'</span>';
    // Use PMO.Textbox for editable name
    h += PMO.Textbox ? PMO.Textbox.render(this._esc(r.name), {}) : '<span>'+this._esc(r.name)+'</span>';
    return h;
  },

  _cellContent: function(k,r) {
    var fn = { pic:this._cellPic, assignees:this._cellAssignees, status:this._cellStatus,
      health:this._cellHealth, deadline:this._cellDL, kqc:this._cellKqc, note:this._cellNote };
    return fn[k] ? fn[k].call(this,r) : '';
  },

  _cellPic: function(r) {
    if (!r.pic&&(r.type==='program'||r.type==='project'||r.type==='phase')) return '';
    if (!r.pic) return '<span class="gantt-pic-empty" data-field="pic" data-row-id="'+r.id+'">Chọn</span>';
    return '<span class="gantt-pic" data-field="pic" data-row-id="'+r.id+'">'+(PMO.Avatar?PMO.Avatar.render(r.pic,'sm'):'')+'<span class="gantt-pic-name">'+this._esc(r.pic)+'</span></span>';
  },

  _cellAssignees: function(r) {
    if (r.type==='program'||r.type==='project'||r.type==='phase') return '';
    if (!r.assignees||!r.assignees.length) return '<span class="gantt-assignees-empty" data-field="assignees" data-row-id="'+r.id+'">+ Thêm</span>';
    return '<span class="gantt-assignees" data-field="assignees" data-row-id="'+r.id+'">'+(PMO.Avatar?PMO.Avatar.renderGroup(r.assignees,'sm',3):'')+'</span>';
  },

  _cellStatus: function(r) {
    var st=r.status||this.G.calcStatus(r), hl=r.health||this.G.calcHealth(r);
    return PMO.StatusChip ? PMO.StatusChip.render(st,hl,{editable:true}) : st;
  },

  _cellHealth: function(r) {
    var hl=r.health||this.G.calcHealth(r);
    return PMO.HealthChip ? PMO.HealthChip.render(hl,{editable:true}) : hl;
  },

  _cellDL: function(r) {
    if (!r.plannedFinish) return '';
    var d=this.G.PD(r.plannedFinish), st=r.status||this.G.calcStatus(r);
    var ov = d<this.G.NOW && st!=='completed';
    return PMO.Date ? PMO.Date.render(r.plannedFinish, {showTime:false, overdue:ov, editable:true}) : '';
  },

  _cellKqc: function(r) {
    if (r.type==='program'||r.type==='project'||r.type==='phase') return '';
    return PMO.Summary ? PMO.Summary.render(r.ketQuaChinh||'', {editable:true, placeholder:'KQ chính...'}) : '';
  },

  _cellNote: function(r) {
    if (r.type==='program'||r.type==='project'||r.type==='phase') return '';
    return PMO.NoteIcon ? PMO.NoteIcon.render(r.note||'') : '';
  },

  /* ══════════════ RIGHT PANEL HEADER ══════════════ */

  _renderRHead: function() {
    var inner=this.ref('rpHeadIn'); inner.style.width=this.tw+'px';
    var rH=this.CFG.headerRowH, s=this.state.scale, nR=s==='month'?1:s==='week'?2:3;
    this.ref('rpHead').style.height=(nR*rH)+'px';
    this.ref('lpHead').style.height=(nR*rH)+'px';
    var h='', tl=this.tl, NOW=this.G.NOW, DN=this.G.DAY_NAMES;
    h+='<div class="gantt-th-row" style="height:'+rH+'px">';
    Object.values(tl.months).forEach(function(m){h+='<div class="gantt-th-cell mo" style="width:'+(m.d.length*tl.dw)+'px">'+m.l+'</div>';});
    h+='</div>';
    if (s==='week'||s==='day') {
      h+='<div class="gantt-th-row" style="height:'+rH+'px">';
      Object.values(tl.weeks).forEach(function(w){h+='<div class="gantt-th-cell wk" style="width:'+(w.d.length*tl.dw)+'px">'+w.l+'</div>';});
      h+='</div>';
    }
    if (s==='day') {
      h+='<div class="gantt-th-row" style="height:'+rH+'px">';
      tl.days.forEach(function(dy){
        var isT=dy.toDateString()===NOW.toDateString();
        h+='<div class="gantt-th-cell dy'+(isT?' td':'')+'" style="width:'+tl.dw+'px">'+DN[dy.getDay()]+'<br>'+dy.getDate()+'</div>';
      });
      h+='</div>';
    }
    inner.innerHTML=h;
  },

  _renderGrid: function() {
    var canvas=this.ref('canvas');
    canvas.querySelectorAll('.gantt-gc,.gantt-today').forEach(function(e){e.remove();});
    var tl=this.tl, s=this.state.scale, NOW=this.G.NOW;
    var gl=document.createElement('div'); gl.style.cssText='position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:0';
    if (s==='month') { var idx=0; Object.values(tl.months).forEach(function(m,i){var c=document.createElement('div');c.className='gantt-gc '+(i%2?'odd':'even');c.style.left=(idx*tl.dw)+'px';c.style.width=(m.d.length*tl.dw)+'px';gl.appendChild(c);idx+=m.d.length;}); }
    else if (s==='week') { var idx=0; Object.values(tl.weeks).forEach(function(w,i){var c=document.createElement('div');c.className='gantt-gc '+(i%2?'odd':'even');c.style.left=(idx*tl.dw)+'px';c.style.width=(w.d.length*tl.dw)+'px';gl.appendChild(c);idx+=w.d.length;}); }
    else { tl.days.forEach(function(dy,i){var c=document.createElement('div');c.className='gantt-gc '+(i%2?'odd':'even');if(dy.toDateString()===NOW.toDateString())c.classList.add('td');c.style.left=(i*tl.dw)+'px';c.style.width=tl.dw+'px';gl.appendChild(c);}); }
    canvas.insertBefore(gl,canvas.firstChild);
    var tpx=this.G.d2px(NOW,this.mn,this.state.scale,this.state.zoom);
    if (tpx!==null&&tpx>=0&&tpx<=this.tw){var line=document.createElement('div');line.className='gantt-today';line.style.left=tpx+'px';canvas.appendChild(line);}
  },

  /* ══════════════ RIGHT PANEL ROWS ══════════════ */

  _renderRRows: function(startIdx, endIdx) {
    var vs=this.ref('rpVs'), self=this, phInfos=[];
    vs.querySelectorAll('.gantt-tl-row,.gantt-bar-c,.gantt-ph-arrow,.gantt-ph-dashline,.gantt-ms,.gantt-strat-sub').forEach(function(e){e.remove();});
    for (var i=startIdx;i<endIdx&&i<this.rows.length;i++) {
      var row=this.rows[i], pos=this.rowPos[i];
      var tlr=document.createElement('div'); tlr.className='gantt-tl-row lv-'+row.type; tlr.dataset.rowId=row.id;
      tlr.style.top=pos.y+'px'; tlr.style.height=pos.h+'px';
      tlr.addEventListener('mouseenter',function(){self._hlRow(this.dataset.rowId,false);});
      tlr.addEventListener('mouseleave',function(){self._hlRow(null,false);});
      vs.appendChild(tlr);

      if (row.isStratPrj) this._renderStratRow(vs,row,pos);
      else if (row.type==='phase'&&row.plannedStart&&row.plannedFinish&&!this.state.drill) {
        var x1=this.G.d2px(row.plannedStart,this.mn,this.state.scale,this.state.zoom);
        var x2=this.G.d2px(row.plannedFinish,this.mn,this.state.scale,this.state.zoom);
        if (x1!==null&&x2!==null) {
          var color=this.G.phaseColor(row.id);
          var isFirst=!phInfos.some(function(p){return p.pid===(row.projectId||row.parentId);});
          // Use PMO.PhaseArrow component
          var a=document.createElement('div'); a.className='gantt-ph-arrow';
          a.style.left=x1+'px'; a.style.width=(x2-x1)+'px'; a.style.top=(pos.y+pos.h/2)+'px'; a.style.transform='translateY(-50%)';
          a.innerHTML = PMO.PhaseArrow ? PMO.PhaseArrow.render(this._esc(row.name), color, isFirst) : '';
          vs.appendChild(a);
          phInfos.push({row:row,x1:x1,x2:x2,pid:row.projectId||row.parentId,y:pos.y,h:pos.h});
        }
      }
      else if (row.milestoneOnly) this._addMs(vs,row,pos);
      else if ((row.type==='wp'||row.type==='task')&&row.plannedStart&&row.plannedFinish) {
        this._addBar(vs,row,pos);
        if (row.type==='wp'&&row.milestone&&row.milestone!=='none') this._addMs(vs,row,pos);
      }
    }
    // Phase dashlines
    var byPrj={}; phInfos.forEach(function(p){if(!byPrj[p.pid])byPrj[p.pid]=[];byPrj[p.pid].push(p);});
    Object.values(byPrj).forEach(function(phs){
      for(var j=0;j<phs.length-1;j++){
        var dl=document.createElement('div');dl.className='gantt-ph-dashline';
        dl.style.left=(phs[j].x2-1)+'px'; dl.style.top=(phs[j].y+phs[j].h)+'px';
        dl.style.height=Math.max(0,phs[j+1].y-phs[j].y-phs[j].h)+'px'; vs.appendChild(dl);
      }
    });
  },

  _addBar: function(vs,row,pos) {
    var x1=this.G.d2px(row.plannedStart,this.mn,this.state.scale,this.state.zoom);
    var x2=this.G.d2px(row.plannedFinish,this.mn,this.state.scale,this.state.zoom);
    if(x1===null||x2===null) return;
    var w=Math.max(x2-x1,4), st=row.status||this.G.calcStatus(row), hl=row.health||this.G.calcHealth(row);
    var pf=this.G.PD(row.plannedFinish), af=row.actualFinish?this.G.PD(row.actualFinish):null;
    var isOD=pf&&((af&&af>pf)||(!af&&st!=='completed'&&this.G.NOW>pf));
    var odRatio=0;
    if(isOD){var end=af||this.G.NOW;var odW=Math.max(0,this.G.d2px(end,pf,this.state.scale,this.state.zoom)||0);odRatio=odW/(w+odW);}
    var c=document.createElement('div');c.className='gantt-bar-c';c.dataset.rowId=row.id;
    c.style.left=x1+'px'; c.style.width=(isOD?w+(odRatio*w/(1-odRatio)):w)+'px';
    c.style.top=(pos.y+(pos.h-this.CFG.barH)/2)+'px'; c.style.height=this.CFG.barH+'px'; c.style.transform='none';
    c.innerHTML=PMO.Bar.render({pctFinished:row.pctFinished||0,pctApproved:row.pctApproved||0,health:hl,status:st,overdueRatio:odRatio});
    var self=this;
    c.addEventListener('mouseenter',function(e){self._showTip(e,row);});
    c.addEventListener('mouseleave',function(){self._hideTip();});
    c.addEventListener('mousemove',function(e){self._moveTip(e);});
    c.addEventListener('click',function(){self._hideTip();self._openDetail(row);});
    vs.appendChild(c);
  },

  _addMs: function(vs,row,pos) {
    var mx=this.G.d2px(row.plannedFinish,this.mn,this.state.scale,this.state.zoom); if(mx===null) return;
    var hl=row.health||this.G.calcHealth(row);
    var el=document.createElement('div');el.className='gantt-ms'; el.style.left=mx+'px'; el.style.top=(pos.y+pos.h/2)+'px';
    el.innerHTML=PMO.Milestone?PMO.Milestone.render(row.milestone,hl):'';
    vs.appendChild(el);
  },

  _renderStratRow: function(vs,row,pos) {
    var prj=null, self=this;
    this.data.programs.forEach(function(p){p.projects.forEach(function(pj){if(pj.id===row.id)prj=pj;});});
    if(!prj) return;
    var SO=this.CFG.stratOffsets;
    // Sub-row 1: phase arrows using PMO.PhaseArrow
    var sr1=document.createElement('div');sr1.className='gantt-strat-sub row1';sr1.style.top=(pos.y+SO.row1)+'px';
    prj.phases.forEach(function(ph,idx){
      var x1=self.G.d2px(ph.plannedStart,self.mn,self.state.scale,self.state.zoom);
      var x2=self.G.d2px(ph.plannedFinish,self.mn,self.state.scale,self.state.zoom);
      if(x1===null||x2===null) return;
      var c=self.G.phaseColor(ph.id);
      var a=document.createElement('div');a.style.cssText='position:absolute;left:'+x1+'px;width:'+(x2-x1)+'px;height:'+SO.arrowH+'px';
      a.innerHTML=PMO.PhaseArrow?PMO.PhaseArrow.render(self._esc(ph.name),c,idx===0):'';
      sr1.appendChild(a);
    });
    vs.appendChild(sr1);
    // Sub-row 2: milestones using PMO.Milestone
    var sr2=document.createElement('div');sr2.className='gantt-strat-sub row2';sr2.style.top=(pos.y+SO.row2)+'px';
    var bigWps=[];
    prj.phases.forEach(function(ph){(ph.workPackages||[]).forEach(function(w){if(w.milestone==='big')bigWps.push(w);});});
    bigWps.forEach(function(wp){
      var mx=self.G.d2px(wp.plannedFinish,self.mn,self.state.scale,self.state.zoom); if(mx===null) return;
      var ic=document.createElement('div');ic.style.cssText='position:absolute;left:'+mx+'px;transform:translateX(-50%)';
      ic.innerHTML=PMO.Milestone?PMO.Milestone.render('big',self.G.calcHealth(wp)):'';
      sr2.appendChild(ic);
    });
    vs.appendChild(sr2);
    // Sub-row 3: KQC text
    var sr3=document.createElement('div');sr3.className='gantt-strat-sub row3';sr3.style.top=(pos.y+SO.row3)+'px';
    var kqcItems=[];
    bigWps.forEach(function(wp){var mx=self.G.d2px(wp.plannedFinish,self.mn,self.state.scale,self.state.zoom);if(mx===null||!wp.ketQuaChinh)return;kqcItems.push({x:mx,text:wp.ketQuaChinh});});
    kqcItems.sort(function(a,b){return a.x-b.x;});
    var lastRight=-Infinity, halfW=this.CFG.kqcHalfW;
    kqcItems.forEach(function(item){
      var l=document.createElement('span');l.className='gantt-kqc-lbl';
      var finalX=item.x;if(finalX-halfW<lastRight+4)finalX=lastRight+4+halfW;
      l.style.left=finalX+'px';l.textContent=item.text;sr3.appendChild(l);lastRight=finalX+halfW;
    });
    vs.appendChild(sr3);
  },

  /* ══════════════ INTERACTIONS ══════════════ */

  _bindInteractions: function() {
    var self=this;
    this.ref('lpVs').addEventListener('click',function(e){var tog=e.target.closest('.gantt-tog');if(tog){e.stopPropagation();self._togExp(tog.dataset.tog);}});
    this.ref('lpVs').addEventListener('keydown',function(e){if(e.target.closest('.pmo-textbox,.gantt-editable')&&e.key==='Enter'){e.preventDefault();e.target.blur();}});
    this.ref('lpVs').addEventListener('focusout',function(e){
      var t=e.target; if(!t.classList.contains('pmo-textbox')&&!t.classList.contains('gantt-editable')) return;
      var rowEl=t.closest('.gantt-row'); if(!rowEl) return;
      var row=self.rows.find(function(r){return r.id===rowEl.dataset.rowId;});
      if(row&&row._src) row._src.name=t.textContent.trim();
    });
    // PIC + Assignees pickers
    this.ref('lpVs').addEventListener('mousedown',function(e){
      var picEl=e.target.closest('.gantt-pic,.gantt-pic-empty');
      if(picEl&&PMO.MemberField){e.stopPropagation();self._openPicPicker(picEl);return;}
      var assEl=e.target.closest('.gantt-assignees,.gantt-assignees-empty');
      if(assEl&&PMO.MemberField){e.stopPropagation();self._openAssigneesPicker(assEl);}
    });
    // Toolbar
    this.el.querySelectorAll('.gantt-tb-btn[data-view]').forEach(function(b){b.addEventListener('click',function(){self._setView(b.dataset.view);});});
    this.el.querySelectorAll('.gantt-tb-btn[data-scale]').forEach(function(b){b.addEventListener('click',function(){self._setScale(b.dataset.scale);});});
    this.el.querySelector('[data-act="today"]').addEventListener('click',function(){self.scrollToToday();});
    this.el.querySelector('[data-act="zoomin"]').addEventListener('click',function(){self._zoom(20);});
    this.el.querySelector('[data-act="zoomout"]').addEventListener('click',function(){self._zoom(-20);});
    this.el.querySelector('[data-act="expand"]').addEventListener('click',function(){self._toggleExpandAll();});
    // Scroll sync
    var lpB=this.ref('lpBody'),rpB=this.ref('rpBody'),rpHI=this.ref('rpHeadIn'),lpHI=this.ref('lpHeadIn'),syncing=false;
    lpB.addEventListener('scroll',function(){if(syncing)return;syncing=true;rpB.scrollTop=lpB.scrollTop;lpHI.style.transform='translateX(-'+lpB.scrollLeft+'px)';self._renderVisibleRows();requestAnimationFrame(function(){syncing=false;});});
    rpB.addEventListener('scroll',function(){if(syncing)return;syncing=true;lpB.scrollTop=rpB.scrollTop;rpHI.style.transform='translateX(-'+rpB.scrollLeft+'px)';self._renderVisibleRows();requestAnimationFrame(function(){syncing=false;});});
  },

  _openPicPicker: function(picEl) {
    var self=this, rowId=picEl.dataset.rowId;
    var row=this.rows.find(function(r){return r.id===rowId;});
    var wrapper=document.createElement('span'); wrapper.className='pmo-member-single editable';
    wrapper.dataset.member=row?row.pic||'':''; picEl.appendChild(wrapper);
    PMO.MemberField._openSinglePicker(wrapper);
    var obs=new MutationObserver(function(){if(row&&row._src)row._src.pic=wrapper.dataset.member||'';obs.disconnect();self._renderVisibleRows();});
    obs.observe(picEl,{childList:true,subtree:true});
  },

  _openAssigneesPicker: function(assEl) {
    var self=this, rowId=assEl.dataset.rowId;
    var row=this.rows.find(function(r){return r.id===rowId;}); if(!row) return;
    var wrapper=document.createElement('div'); wrapper.className='pmo-member-list-wrap'; wrapper.setAttribute('data-member-list','');
    var ch='<div class="pmo-chip-list">';
    (row.assignees||[]).forEach(function(name){var ini=PMO.Avatar?PMO.Avatar.initials(name):name.slice(0,2).toUpperCase();ch+='<span class="pmo-chip" data-name="'+name+'"><span class="chip-av">'+ini+'</span>'+name+'<span class="chip-x">×</span></span>';});
    ch+='<button class="pmo-chip-add">+ Thêm</button></div>';
    wrapper.innerHTML=ch; wrapper.style.cssText='position:absolute;opacity:0;pointer-events:none';
    document.body.appendChild(wrapper); PMO.MemberField._openListPicker(wrapper);
    var check=setInterval(function(){if(!document.getElementById('pmoMemberPop')){clearInterval(check);
      var na=[]; wrapper.querySelectorAll('.pmo-chip').forEach(function(c){if(c.dataset.name)na.push(c.dataset.name);});
      if(row._src)row._src.assignees=na; wrapper.remove(); self._renderVisibleRows();
    }},200);
  },

  _togExp: function(id){if(this.state.exp.has(id))this.state.exp.delete(id);else this.state.exp.add(id);this.render();},

  _bindColResize: function() {
    var self=this;
    this.ref('lpHeadIn').querySelectorAll('.gantt-col-resize').forEach(function(handle){
      handle.addEventListener('mousedown',function(e){
        e.preventDefault();e.stopPropagation();
        var ci=parseInt(handle.dataset.colIdx),startX=e.clientX,startW=self._colWidths[ci];
        handle.classList.add('dragging');document.body.style.cursor='col-resize';document.body.style.userSelect='none';
        function onM(ev){var nw=Math.max(36,startW+ev.clientX-startX);self._colWidths[ci]=nw;
          var hC=self.ref('lpHeadIn').querySelector('[data-col-idx="'+ci+'"]');if(hC)hC.style.width=nw+'px';
          var tw=0;for(var j=0;j<self._colWidths.length;j++)tw+=self._colWidths[j];
          self._totalColW=tw;self.ref('lpHeadIn').style.width=tw+'px';self.ref('lp').style.width=tw+'px';
          self._renderVisibleRows();}
        function onU(){handle.classList.remove('dragging');document.body.style.cursor='';document.body.style.userSelect='';document.removeEventListener('mousemove',onM);document.removeEventListener('mouseup',onU);}
        document.addEventListener('mousemove',onM);document.addEventListener('mouseup',onU);
      });
    });
  },

  _setView: function(v){this.state.view=v;this.state.drill=null;this._colWidths=null;
    if(v==='strategy')this.state.scale='month';else if(v==='control')this.state.scale='week';else this.state.scale='day';
    this._resetExp();this._updBtns();this.render();},
  _setScale: function(s){this.state.scale=s;this._updBtns();this.render();},
  _zoom: function(d){this.state.zoom=Math.max(40,Math.min(this.state.zoom+d,200));this.ref('zoomLbl').textContent=this.state.zoom+'%';this.render();},

  _toggleExpandAll: function(){
    this.state.allExp=!this.state.allExp;
    if(this.state.allExp){var s=this;this.data.programs.forEach(function(p){s.state.exp.add(p.id);p.projects.forEach(function(pj){s.state.exp.add(pj.id);pj.phases.forEach(function(ph){s.state.exp.add(ph.id);(ph.workPackages||[]).forEach(function(wp){s.state.exp.add(wp.id);(wp.tasks||[]).forEach(function(t){s.state.exp.add(t.id);});});});});});}
    else this._resetExp(); this.render();
  },

  _resetExp: function(){
    this.state.exp.clear();var s=this;
    this.data.programs.forEach(function(p){s.state.exp.add(p.id);p.projects.forEach(function(pj){s.state.exp.add(pj.id);
      if(s.state.view!=='strategy')pj.phases.forEach(function(ph){if(s.G.calcPhaseStatus(ph)!=='not_started')s.state.exp.add(ph.id);});});});
  },

  _updBtns: function(){var v=this.state.view,s=this.state.scale;
    this.el.querySelectorAll('.gantt-tb-btn[data-view]').forEach(function(b){b.classList.toggle('active',b.dataset.view===v);});
    this.el.querySelectorAll('.gantt-tb-btn[data-scale]').forEach(function(b){b.classList.toggle('active',b.dataset.scale===s);});},

  _drillIn: function(phId){
    this.state.drill=phId;this.state.scale='day';
    var ph=this.G.findPhase(this.data,phId);
    if(ph){this.state.exp.add(ph.id);var s=this;(ph.workPackages||[]).forEach(function(wp){s.state.exp.add(wp.id);});}
    this._updBtns();this.render();
    var existing=this.el.querySelector('.gantt-drill-back'); if(existing)existing.remove();
    var b=document.createElement('button');b.className='gantt-tb-btn gantt-drill-back';
    b.innerHTML='← Quay lại'; var s=this;
    b.addEventListener('click',function(){s.state.drill=null;s._resetExp();b.remove();s.render();});
    this.el.querySelector('.gantt-tb').insertBefore(b,this.el.querySelector('.gantt-tb-sep'));
  },

  scrollToToday: function(){var px=this.G.d2px(this.G.NOW,this.mn,this.state.scale,this.state.zoom);var rp=this.ref('rpBody');if(px!==null&&rp)rp.scrollTo({left:px-rp.clientWidth/2,behavior:'smooth'});},

  _hlRow: function(id,autoScroll){
    this.state.hlId=id;
    this.el.querySelectorAll('.gantt-row,.gantt-tl-row,.gantt-bar-c').forEach(function(el){el.classList.toggle('hl',el.dataset.rowId===id);});
    if(id&&autoScroll){var bar=this.ref('rpVs').querySelector('.gantt-bar-c[data-row-id="'+id+'"]');var rp=this.ref('rpBody');
      if(bar&&rp){var tL=parseFloat(bar.style.left)||0,tW=parseFloat(bar.style.width)||0;rp.scrollTo({left:Math.max(0,tL+tW/2-rp.clientWidth/2),behavior:'smooth'});}}
  },

  /* ══════════════ TOOLTIP — uses PMO.Tooltip ══════════════ */

  _showTip: function(e,r){
    if(!PMO.Tooltip) return;
    var st=r.status||this.G.calcStatus(r), hl=r.health||this.G.calcHealth(r);
    var dateStr = (PMO.Date?PMO.Date._fmtD(this.G.PD(r.plannedStart)):this._fmtD(r.plannedStart))
      +' → '+(PMO.Date?PMO.Date._fmtD(this.G.PD(r.plannedFinish)):this._fmtD(r.plannedFinish));
    PMO.Tooltip.show(e, {
      title: r.name,
      'Trạng thái': PMO.StatusChip?PMO.StatusChip.LABELS[st]||st:st,
      'Sức khỏe': PMO.HealthChip?PMO.HealthChip.LABELS[hl]||hl:hl,
      'Kế hoạch': dateStr,
      'Thời lượng': this.G.plannedDays(r)+' ngày',
      '% Hoàn thành': (r.pctFinished!=null?r.pctFinished:this.G.calcPctFinished(r))+'%',
      '% Phê duyệt': (r.pctApproved!=null?r.pctApproved:this.G.calcPctApproved(r))+'%',
      'PIC': r.pic||'—'
    });
  },
  _moveTip: function(e){if(PMO.Tooltip)PMO.Tooltip.move(e);},
  _hideTip: function(){if(PMO.Tooltip)PMO.Tooltip.hide();},

  /* ══════════════ POPOVER DETAIL ══════════════ */

  _openDetail: function(row){
    if(!PMO.PopoverShell) return;
    var self=this, src=row._src||{}, bc=this._buildBreadcrumb(row);
    var container=document.createElement('div'); this.el.appendChild(container);
    PMO.PopoverShell.mount(container, {
      breadcrumb:bc, level:row.type, title:row.name, description:src.description||'', editable:true,
      tabs:this._buildTabs(row), activeTab:'overview', panels:this._buildPanels(row),
      onSave: function(){var t=container.querySelector('.ph-title'),d=container.querySelector('.ph-desc');if(t&&src)src.name=t.textContent.trim();if(d&&src)src.description=d.textContent.trim();self.render();},
      onMount: function(el){
        var stP=el.querySelector('[data-panel="subtasks"]'); if(stP&&PMO.Subtask)PMO.Subtask.bind(stP,{currentUser:'Admin'});
        var apEl=el.querySelector('[id^="popApprove_"]'); if(apEl&&PMO.Approve)PMO.Approve.bind(apEl);
        // Notes
        var noteP=el.querySelector('[data-panel="notes"]');
        if(noteP&&PMO.Note){
          var nList=noteP.querySelector('.pmo-note-list'),ta=noteP.querySelector('.ni-textarea'),sb=noteP.querySelector('.ni-send'),sc=noteP.querySelector('.panel-scroll');
          if(ta)ta.addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px';});
          if(sb&&ta){function ds(){var t=ta.value.trim();if(!t)return;var em=nList.querySelector('.pmo-note-empty');if(em)em.remove();
            var tmp=document.createElement('div');tmp.innerHTML=PMO.Note.renderItem({id:'n_'+Date.now(),author:'Admin',time:PMO.Note._now(),content:t,source:row.type,isOwner:true});
            nList.appendChild(tmp.firstElementChild);if(sc)sc.scrollTop=sc.scrollHeight;ta.value='';ta.style.height='auto';}
            sb.addEventListener('click',ds);ta.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ds();}});}
          if(nList)nList.addEventListener('click',function(e){var btn=e.target.closest('.ni-act-btn');if(!btn)return;var ne=btn.closest('.pmo-note-item');if(!ne)return;
            if(btn.dataset.act==='delete')ne.remove();
            else if(btn.dataset.act==='edit'){var c=ne.querySelector('.ni-content');c.setAttribute('contenteditable','true');c.focus();c.style.background='#FFFBEB';c.style.padding='4px';c.style.borderRadius='4px';c.style.outline='1.5px solid var(--c-ar)';
              c.addEventListener('blur',function(){c.removeAttribute('contenteditable');c.style.background='';c.style.padding='';c.style.borderRadius='';c.style.outline='';},{once:true});}});
        }
        var trEl=el.querySelector('[data-panel="history"]'); if(trEl&&PMO.Trail)PMO.Trail.bind(trEl);
        // Add task button
        var atBtn=el.querySelector('[data-action="add-task-from-list"]');
        if(atBtn&&PMO.AddTask){atBtn.addEventListener('click',function(e){e.stopPropagation();
          var ov=el.querySelector('[data-pop-overlay]');if(ov)ov.remove();
          var ac=document.createElement('div');self.el.appendChild(ac);
          PMO.AddTask.open(ac,{breadcrumb:bc.slice(0),onCreate:function(td){
            if(src.tasks){src.tasks.push({id:'t_'+Date.now(),name:td.title,executionMode:td.execMode||'Independent',pic:td.pic||'',approver:td.approver||'',assignees:td.assignees||[],plannedStart:'',plannedFinish:'',cancelled:false,
              subtasks:(td.subtasks||[]).map(function(st,idx){return{id:'st_'+Date.now()+'_'+idx,name:st.content,finishStatus:'unfinished'};})});}ac.remove();self.render();}});});}
        // Task item clicks
        el.querySelectorAll('.pmo-task-item').forEach(function(item){item.addEventListener('click',function(){
          var tr=self.rows.find(function(r){return r.id===item.dataset.taskId;});
          if(tr){var ov=el.querySelector('[data-pop-overlay]');if(ov)ov.remove();self._openDetail(tr);}});});
      }
    });
  },

  _buildBreadcrumb: function(row){
    function find(programs,tid){
      for(var pi=0;pi<programs.length;pi++){var prg=programs[pi];
        if(prg.id===tid) return[{label:prg.name,level:'program',id:prg.id}];
        for(var ji=0;ji<prg.projects.length;ji++){var prj=prg.projects[ji];
          if(prj.id===tid) return[{label:prg.name,level:'program',id:prg.id},{label:prj.name,level:'project',id:prj.id}];
          for(var phi=0;phi<prj.phases.length;phi++){var ph=prj.phases[phi];
            if(ph.id===tid) return[{label:prg.name,level:'program',id:prg.id},{label:prj.name,level:'project',id:prj.id},{label:ph.name,level:'phase',id:ph.id}];
            for(var wi=0;wi<(ph.workPackages||[]).length;wi++){var wp=ph.workPackages[wi];
              if(wp.id===tid)return[{label:prg.name,level:'program',id:prg.id},{label:prj.name,level:'project',id:prj.id},{label:ph.name,level:'phase',id:ph.id},{label:wp.name,level:'wp',id:wp.id}];
              for(var ti=0;ti<(wp.tasks||[]).length;ti++){var t=wp.tasks[ti];
                if(t.id===tid)return[{label:prg.name,level:'program',id:prg.id},{label:prj.name,level:'project',id:prj.id},{label:ph.name,level:'phase',id:ph.id},{label:wp.name,level:'wp',id:wp.id},{label:t.name,level:'task',id:t.id}];}}}}
      }return[];}
    return find(this.data.programs,row.id);
  },

  _buildTabs: function(row){
    var src=row._src||{};
    if(row.type==='program'){
      var pjCount=(src.projects||[]).length;
      return[{key:'overview',label:'Tổng quan'},{key:'projects',label:'Dự án',count:pjCount>0?String(pjCount):''},{key:'history',label:'Lịch sử'}];
    }
    if(row.type==='project'){
      var phCount=(src.phases||[]).length;
      return[{key:'overview',label:'Tổng quan'},{key:'phases',label:'Giai đoạn',count:phCount>0?String(phCount):''},{key:'notes',label:'Ghi chú'},{key:'history',label:'Lịch sử'}];
    }
    if(row.type==='phase'){
      var wpCount=(src.workPackages||[]).length;
      return[{key:'overview',label:'Tổng quan'},{key:'wps',label:'Công việc',count:wpCount>0?String(wpCount):''},{key:'notes',label:'Ghi chú'},{key:'deps',label:'Phụ thuộc'},{key:'history',label:'Lịch sử'}];
    }
    if(row.type==='wp'){
      var tc=(src.tasks||[]).length;
      return[{key:'overview',label:'Tổng quan'},{key:'tasks',label:'Công việc',count:tc>0?String(tc):''},{key:'notes',label:'Ghi chú'},{key:'deps',label:'Phụ thuộc'},{key:'history',label:'Lịch sử'}];
    }
    if(row.type==='task'){
      var sc=(src.subtasks||[]).length,pc=(src.subtasks||[]).filter(function(st){return st.finishStatus==='finished';}).length;
      return[{key:'overview',label:'Tổng quan'},{key:'subtasks',label:'Đầu việc',count:sc>0?String(sc):''},{key:'approve',label:'Phê duyệt',count:pc>0?String(pc):''},{key:'notes',label:'Ghi chú'},{key:'deps',label:'Phụ thuộc'},{key:'history',label:'Lịch sử'}];
    }
    return[{key:'overview',label:'Tổng quan'}];
  },

  _buildPanels: function(row){
    var p={}, src=row._src||{}, G=this.G;
    p.overview=this._buildOverviewPanel(row);

    // Program → project list
    if(row.type==='program'&&PMO.TaskList){
      var projects=(src.projects||[]).map(function(pj){return{id:pj.id,name:pj.name,status:G.calcProjectStatus?G.calcProjectStatus(pj):'not_started',health:G.calcProjectHealth?G.calcProjectHealth(pj):'on_track',pctFinished:G.calcProjectPctF?G.calcProjectPctF(pj):0,pctApproved:G.calcProjectPctA?G.calcProjectPctA(pj):0,plannedStart:pj.plannedStart||'',plannedFinish:pj.plannedFinish||''};});
      p.projects='<div class="panel-full">'+PMO.TaskList.renderList(projects,{title:'Dự án',showAdd:false,emptyText:'Chưa có dự án nào'})+'</div>';
    }
    // Project → phase list
    if(row.type==='project'&&PMO.TaskList){
      var phases=(src.phases||[]).map(function(ph){return{id:ph.id,name:ph.name,status:G.calcPhaseStatus(ph),health:G.calcPhaseHealth(ph),pctFinished:G.calcPhasePctF?G.calcPhasePctF(ph):0,pctApproved:G.calcPhasePctA?G.calcPhasePctA(ph):0,plannedStart:ph.plannedStart||'',plannedFinish:ph.plannedFinish||''};});
      p.phases='<div class="panel-full">'+PMO.TaskList.renderList(phases,{title:'Giai đoạn',showAdd:false,emptyText:'Chưa có giai đoạn nào'})+'</div>';
    }
    // Phase → WP list
    if(row.type==='phase'&&PMO.TaskList){
      var wps=(src.workPackages||[]).map(function(wp){return{id:wp.id,name:wp.name,status:G.calcStatus(wp),health:G.calcHealth(wp),pctFinished:G.calcPctFinished(wp),pctApproved:G.calcPctApproved(wp),plannedStart:wp.plannedStart||'',plannedFinish:wp.plannedFinish||'',pic:wp.pic||''};});
      p.wps='<div class="panel-full">'+PMO.TaskList.renderList(wps,{title:'Work Packages',showAdd:false,emptyText:'Chưa có work package nào'})+'</div>';
    }
    // WP → task list
    if(row.type==='wp'&&PMO.TaskList){
      var tasks=(src.tasks||[]).map(function(t){return{id:t.id,name:t.name,execMode:(t.executionMode||'independent').toLowerCase().replace(/\s+/g,'_'),status:G.calcStatus(t),health:G.calcHealth(t),pctFinished:G.calcPctFinished(t),pctApproved:G.calcPctApproved(t),plannedStart:t.plannedStart,plannedFinish:t.plannedFinish,pic:t.pic,deliverableUrl:''};});
      p.tasks='<div class="panel-full">'+PMO.TaskList.renderList(tasks,{title:'Tasks',showAdd:true,emptyText:'Chưa có task nào'})+'</div>';
    }
    // Task → subtasks
    if(row.type==='task'&&PMO.Subtask){
      var sts=(src.subtasks||[]).map(function(st){return{id:st.id,content:st.name,finishStatus:st.finishStatus,assignee:'',notes:[]};});
      p.subtasks='<div class="panel-scroll">'+PMO.Subtask.renderList(sts,{showAdd:false})+'</div><div class="panel-footer"><div class="pmo-subtask-add" data-action="add-subtask" style="margin:0;padding:4px 0">'+PMO.Subtask.ADD_SVG+' Thêm đầu việc</div></div>';
    }
    // Task → approve
    if(row.type==='task'&&PMO.Approve){
      var ai=(src.subtasks||[]).filter(function(st){return st.finishStatus==='finished'||st.finishStatus==='approved';}).map(function(st){return{id:st.id,content:st.name,assignee:'',finishedAt:'',status:st.finishStatus==='approved'?'approved':'pending'};});
      p.approve='<div class="panel-full"><div id="popApprove_'+row.id+'">'+PMO.Approve.renderList(ai)+'</div></div>';
    }
    // Notes (all except program)
    if(row.type!=='program'&&PMO.Note){
      p.notes='<div class="panel-scroll"><div class="pmo-note-list"><div class="pmo-note-empty">Chưa có ghi chú nào</div></div></div><div class="panel-footer"><div class="pmo-note-input" style="border-top:none;margin:0;padding:0"><textarea class="ni-textarea" placeholder="Nhập ghi chú..." rows="1"></textarea><button class="ni-send" title="Gửi">'+PMO.Note.SEND_SVG+'</button></div></div>';
    }
    // Deps (phase/wp/task)
    if(row.type==='phase'||row.type==='wp'||row.type==='task')
      p.deps='<div class="panel-full"><div style="color:var(--t3);text-align:center;padding:40px;font-size:12px">Chưa có phụ thuộc nào</div></div>';
    // History (all)
    p.history=PMO.Trail?'<div class="panel-full">'+PMO.Trail.renderList([])+'</div>':'<div class="panel-full"><div style="color:var(--t3);text-align:center;padding:40px;font-size:12px">Chưa có lịch sử</div></div>';
    return p;
  },

  _buildOverviewPanel: function(row){
    var src=row._src||{}, st=row.status||this.G.calcStatus(row), hl=row.health||this.G.calcHealth(row);
    var h='<div class="panel-full">';
    // Task: exec mode + deliverable
    if(row.type==='task'&&PMO.ExecMode){var em=(src.executionMode||'independent').toLowerCase().replace(/\s+/g,'_');
      h+=PMO.Field.rowCol('Hình thức',PMO.ExecMode.render(em,'',{editable:true}));}
    if(row.type==='task'&&PMO.DeliverableLink) h+=PMO.Field.row('Kết quả',PMO.DeliverableLink.render('',{editable:true}));
    // Status + Health (all levels)
    h+=PMO.Field.row('Trạng thái',(PMO.StatusChip?PMO.StatusChip.render(st,hl,{editable:true}):st)+' '+(PMO.HealthChip?PMO.HealthChip.render(hl,{editable:true}):hl));
    // Progress (all levels)
    if(PMO.ProgressInline) h+=PMO.Field.row('Tiến độ',PMO.ProgressInline.render(row.pctFinished||0,row.pctApproved||0,hl,st));
    // Description (program/project)
    if((row.type==='program'||row.type==='project')&&PMO.Summary)
      h+=PMO.Field.rowCol('Mô tả',PMO.Summary.render(src.description||'',{editable:true}));
    // KQ chính (WP)
    if(row.type==='wp'&&PMO.Summary) h+=PMO.Field.rowCol('KQ chính',PMO.Summary.render(src.ketQuaChinh||'',{editable:true}));
    // Dates (all levels)
    if(src.plannedStart||src.plannedFinish) h+=PMO.Field.row('Kế hoạch',PMO.Date?PMO.Date.renderRange(src.plannedStart||'',src.plannedFinish||'',{showTime:false,editable:true}):'');
    if(src.actualStart||src.actualFinish) h+=PMO.Field.row('Thực hiện',PMO.Date?PMO.Date.renderRange(src.actualStart||'',src.actualFinish||'',{showTime:false,editable:true}):'');
    // PIC / Approver / Assignees (wp/task only)
    if(row.type==='wp'||row.type==='task'){
      h+=PMO.Field.row('PIC',PMO.MemberField?PMO.MemberField.renderSingle(src.pic||'','',{editable:true}):'');
      h+=PMO.Field.row('Approver',PMO.MemberField?PMO.MemberField.renderSingle(src.approver||'','',{editable:true}):'');
      h+=PMO.Field.row('Assignees',PMO.MemberField?PMO.MemberField.renderList((src.assignees||[]).map(function(n){return{name:n};}),{maxLines:2,editable:true}):'');
    }
    // Milestone (WP)
    if(row.type==='wp'&&src.milestone&&src.milestone!=='none'&&PMO.MilestoneField) h+=PMO.Field.row('Milestone',PMO.MilestoneField.render(src.milestone,hl,{editable:true}));
    h+='</div>'; return h;
  },

  _esc: function(s){return s?s.replace(/"/g,'&quot;').replace(/</g,'&lt;'):'';},
  _pad: function(n){return String(n).padStart(2,'0');},
  _fmtD: function(d){if(!d)return'—';var dt=typeof d==='string'?this.G.PD(d):d;return this._pad(dt.getDate())+'/'+this._pad(dt.getMonth()+1)+'/'+dt.getFullYear();}
};
