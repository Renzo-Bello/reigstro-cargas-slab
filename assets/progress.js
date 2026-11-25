/* Body-weight journal: shared across training modes and quarters. No invented measurements. */
(function() {
  'use strict';
  var KEY = 'slab-bodyweight-history';
  var entries = [], adapter, range = 'all', busy = false;
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function validDate(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    var d = new Date(date + 'T12:00:00');
    return !isNaN(d) && d.getFullYear() === Number(date.slice(0,4)) && d.getMonth()+1 === Number(date.slice(5,7)) && d.getDate() === Number(date.slice(8,10));
  }
  function validate(value) {
    if (!Array.isArray(value)) throw new Error('Historial de peso inválido');
    var dates = new Set();
    return value.map(function(e) {
      if (!e || !validDate(e.date) || typeof e.weight !== 'number' || !Number.isFinite(e.weight) || e.weight < 30 || e.weight > 250 || dates.has(e.date)) throw new Error('Registro de peso inválido');
      dates.add(e.date);
      return {date:e.date, weight:e.weight};
    }).sort(function(a,b) { return a.date.localeCompare(b.date); });
  }
  function upsert(log, date, raw) {
    var weight = Number(String(raw).trim().replace(',','.'));
    if (!validDate(date) || date > today()) throw new Error('Elige una fecha válida, hasta hoy.');
    if (!Number.isFinite(weight) || weight < 30 || weight > 250) throw new Error('Ingresa un peso entre 30 y 250 kg.');
    return validate(log.filter(function(e) { return e.date !== date; }).concat({date:date,weight:Math.round(weight*100)/100}));
  }
  function format(value) { return Number(value).toLocaleString('es-CL',{maximumFractionDigits:2}); }
  function dateLabel(date) { return new Date(date+'T12:00:00').toLocaleDateString('es-CL',{day:'numeric',month:'short'}); }
  function el(id) { return document.getElementById(id); }
  function message(text) { el('weightFeedback').textContent = text; }
  function selectedEntries() {
    if (range === 'all') return entries;
    var cutoff = new Date(today()+'T12:00:00'); cutoff.setDate(cutoff.getDate()-29);
    return entries.filter(function(e) { return new Date(e.date+'T12:00:00') >= cutoff; });
  }
  function svgNode(tag, attrs, text) {
    var node = document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.keys(attrs || {}).forEach(function(k) { node.setAttribute(k,attrs[k]); });
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function graph(data) {
    var host = el('weightGraph'); host.replaceChildren();
    if (!data.length) return;
    var svg = svgNode('svg',{viewBox:'0 0 380 210',class:'weight-svg',role:'img','aria-label':'Evolución del peso corporal en kilogramos'});
    svg.appendChild(svgNode('title',{},'Peso corporal: '+data.length+' registros. Consulta cada valor en el historial.'));
    var defs = svgNode('defs'), gradient = svgNode('linearGradient',{id:'weightFill',x1:'0',y1:'0',x2:'0',y2:'1'});
    gradient.appendChild(svgNode('stop',{offset:'0%','stop-color':'#C9A96E','stop-opacity':'.25'}));
    gradient.appendChild(svgNode('stop',{offset:'100%','stop-color':'#C9A96E','stop-opacity':'0'}));
    defs.appendChild(gradient); svg.appendChild(defs);
    var min = Math.min.apply(null,data.map(function(e){return e.weight;}));
    var max = Math.max.apply(null,data.map(function(e){return e.weight;}));
    var pad = Math.max((max-min)*.25,.5); min -= pad; max += pad;
    var first = Date.parse(data[0].date), last = Date.parse(data[data.length-1].date);
    function x(e) {return first===last ? 185 : 12+(Date.parse(e.date)-first)/(last-first)*318;}
    function y(e) {return 168-(e.weight-min)/(max-min)*144;}
    for(var i=0;i<4;i++) {
      var gy=24+i*48;
      svg.appendChild(svgNode('line',{x1:12,y1:gy,x2:330,y2:gy,class:'weight-grid'}));
      svg.appendChild(svgNode('text',{x:378,y:gy+3,'text-anchor':'end'},format(max-(max-min)*i/3)));
    }
    var path = data.map(function(e,i){return (i?'L':'M')+x(e).toFixed(2)+','+y(e).toFixed(2);}).join(' ');
    if(data.length>1) {
      svg.appendChild(svgNode('path',{d:path+' L'+x(data[data.length-1])+',168 L'+x(data[0])+',168 Z',fill:'url(#weightFill)'}));
      svg.appendChild(svgNode('path',{d:path,fill:'none',stroke:'#C9A96E','stroke-width':2.5,'stroke-linejoin':'round','stroke-linecap':'round'}));
    }
    data.forEach(function(e) {
      var dot=svgNode('circle',{cx:x(e),cy:y(e),r:data.length>50?2:4,class:'weight-dot',tabindex:'0','aria-label':e.date+': '+format(e.weight)+' kg'});
      dot.appendChild(svgNode('title',{},dateLabel(e.date)+' · '+format(e.weight)+' kg')); svg.appendChild(dot);
    });
    svg.appendChild(svgNode('text',{x:first===last?185:12,y:198,'text-anchor':first===last?'middle':'start'},dateLabel(data[0].date)));
    if(data.length>1) svg.appendChild(svgNode('text',{x:330,y:198,'text-anchor':'end'},dateLabel(data[data.length-1].date)));
    host.appendChild(svg);
  }
  function renderWorkoutAchievements() {
    var host=el('workoutAchievements');
    if(!host)return;
    var stats=adapter && typeof adapter.getWorkoutStats==='function' ? adapter.getWorkoutStats() : {workouts:0,longestStreak:0};
    var workouts=Math.max(0,Number(stats.workouts)||0), weeks=Math.max(0,Number(stats.longestStreak)||0);
    var items=[
      {icon:'✦',title:'Primer entreno',detail:'Completa tu primera sesión',value:workouts,goal:1},
      {icon:'⚡',title:'10 entrenos',detail:'Diez sesiones completadas',value:workouts,goal:10},
      {icon:'▦',title:'Semana completa',detail:'3 o más entrenos en una semana',value:weeks>0?3:0,goal:3,unlocked:weeks>=1},
      {icon:'✧',title:'4 semanas seguidas',detail:'Mantén 3 entrenos por semana',value:Math.min(weeks,4),goal:4}
    ];
    host.replaceChildren();
    var header=document.createElement('div');header.className='achievement-heading';
    var title=document.createElement('div');title.innerHTML='<div class="insight-kicker">CONSTANCIA</div><h3>Logros de entrenamiento</h3>';
    var count=document.createElement('span');count.className='achievement-total';
    var unlocked=items.filter(function(item){return item.unlocked || item.value>=item.goal;}).length;
    count.textContent=unlocked+' / '+items.length;header.append(title,count);host.appendChild(header);
    var grid=document.createElement('div');grid.className='achievement-grid';
    items.forEach(function(item){
      var isUnlocked=item.unlocked || item.value>=item.goal;
      var progress=Math.min(100,Math.round(item.value/item.goal*100));
      var card=document.createElement('article');card.className='achievement-card'+(isUnlocked?' is-unlocked':'');
      var icon=document.createElement('span');icon.className='achievement-icon';icon.textContent=item.icon;icon.setAttribute('aria-hidden','true');
      var content=document.createElement('div');content.className='achievement-copy';
      var name=document.createElement('strong');name.textContent=item.title;
      var desc=document.createElement('small');desc.textContent=item.detail;
      var bar=document.createElement('div');bar.className='achievement-track';bar.setAttribute('role','progressbar');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',String(item.goal));bar.setAttribute('aria-valuenow',String(Math.min(item.value,item.goal)));
      var fill=document.createElement('span');fill.style.width=progress+'%';bar.appendChild(fill);
      var status=document.createElement('small');status.className='achievement-status';status.textContent=isUnlocked?'Conseguido':(item.value+' / '+item.goal);
      content.append(name,desc,bar,status);card.append(icon,content);grid.appendChild(card);
    });
    host.appendChild(grid);
  }
  function render() {
    renderWorkoutAchievements();
    if (!el('weightGraph')) return;
    var data = selectedEntries(), last = data[data.length-1], first=data[0];
    el('weightLatest').textContent = last ? format(last.weight) : '—';
    el('weightInitial').textContent = first ? format(first.weight) : '—';
    var change = data.length>1 ? last.weight-first.weight : null;
    el('weightChange').textContent = change===null ? '—' : (change>0?'+':'')+format(change);
    el('weightLastDate').textContent = last ? 'Último · '+dateLabel(last.date) : 'Último registro';
    el('weightEmpty').hidden = !!data.length;
    el('weightGraph').hidden = !data.length;
    graph(data);
    el('weightHistoryCount').textContent = 'Historial · '+entries.length+' registros';
    var list=el('weightList'); list.replaceChildren();
    entries.slice().reverse().forEach(function(e) {
      var row=document.createElement('div');row.className='weight-entry';
      var date=document.createElement('time');date.dateTime=e.date;date.textContent=new Date(e.date+'T12:00:00').toLocaleDateString('es-CL');
      var value=document.createElement('strong');value.textContent=format(e.weight)+' kg';
      var edit=document.createElement('button');edit.type='button';edit.textContent='Editar';edit.setAttribute('aria-label','Editar peso del '+e.date);
      edit.onclick=function(){el('weightDate').value=e.date;el('weightValue').value=e.weight;el('weightValue').focus();message('Editando el '+dateLabel(e.date)+'. Guarda para actualizar.');};
      var remove=document.createElement('button');remove.type='button';remove.textContent='Eliminar';remove.setAttribute('aria-label','Eliminar peso del '+e.date);
      remove.onclick=async function(){if(busy || !confirm('¿Eliminar el peso del '+dateLabel(e.date)+'?'))return; await persist(entries.filter(function(item){return item.date!==e.date;}),'Registro eliminado.');};
      row.append(date,value,edit,remove);list.appendChild(row);
    });
  }
  async function persist(next, success) {
    if(busy)return false;
    busy=true;el('weightSave').disabled=true;
    try {
      if(!await adapter.set(KEY,next)) throw new Error('No se pudo guardar. Inténtalo nuevamente.');
      entries=next;render();message(success);
      if(entries.length) await adapter.onWeight(entries[entries.length-1].weight);
      return true;
    } catch(e) {message(e.message);return false;}
    finally {busy=false;el('weightSave').disabled=false;}
  }
  async function init(api) {
    adapter=api;
    el('weightForm').onsubmit=function(event){event.preventDefault();};
    try {var saved=await api.get(KEY);entries=saved ? validate(typeof saved==='string'?JSON.parse(saved):saved) : [];}
    catch(e) {el('weightSave').disabled=true;message('No se pudo leer el historial de peso. Conserva tu respaldo antes de reemplazarlo.');return;}
    el('weightDate').max=today();el('weightDate').value=today();
    el('weightForm').onsubmit=async function(event) {
      event.preventDefault();if(busy)return;
      try {
        var date=el('weightDate').value;
        var next=upsert(entries,date,el('weightValue').value);
        if(entries.some(function(e){return e.date===date;}) && !confirm('Ya tienes un peso para esta fecha. ¿Actualizarlo?'))return;
        await persist(next,'Peso guardado. Tu evolución está actualizada.');
      }catch(e){message(e.message);}
    };
    el('weightRange').onclick=function(event){var button=event.target.closest('button[data-range]');if(!button)return;range=button.dataset.range;this.querySelectorAll('button').forEach(function(b){b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',b===button?'true':'false');});render();};
    render();
  }
  window.SLABProgress={init:init,render:render,validate:validate,upsert:upsert,
    exportHistory:function(){return entries.map(function(e){return {date:e.date,weight:e.weight};});},
    restore:async function(value){var next=validate(value);if(!await persist(next,'Historial restaurado.'))throw new Error('No se pudo restaurar el historial de peso');}
  };
})();
