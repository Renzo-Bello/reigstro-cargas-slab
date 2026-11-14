const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/progress.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function node(){return {children:[],value:'',hidden:false,disabled:false,textContent:'',dataset:{},classList:{toggle(){}},setAttribute(){},focus(){},appendChild(n){this.children.push(n);},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},querySelectorAll(){return [];}};}
function harness(initial){
  const nodes=new Proxy({}, {get(target,key){return target[key]||(target[key]=node());}});let saved=initial,allowSave=true,weight=null;
  const c=vm.createContext({window:{},document:{getElementById:id=>nodes[id]||(nodes[id]=node()),createElement:node,createElementNS:node},confirm:()=>true});vm.runInContext(source,c);
  const api=c.window.SLABProgress;
  return {api,nodes,init:()=>api.init({get:async()=>saved,set:async(k,v)=>{if(!allowSave)return false;saved=JSON.parse(JSON.stringify(v));return true;},onWeight:async v=>weight=v}),saved:()=>saved,weight:()=>weight,fail:()=>allowSave=false};
}
test('weight accepts comma, sorts dates, replaces duplicates and rejects invalid values',()=>{
  const {api}=harness();let log=api.upsert([],'2026-01-03','75,5');log=api.upsert(log,'2026-01-01','76');log=api.upsert(log,'2026-01-03','75,2');
  assert.equal(log.length,2);assert.equal(log[0].date,'2026-01-01');assert.equal(log[1].weight,75.2);
  assert.throws(()=>api.upsert(log,'2026-02-30','75'));assert.throws(()=>api.upsert(log,'2099-01-01','75'));
  for(const value of ['',0,-1,'80kg',Infinity,251])assert.throws(()=>api.upsert(log,'2026-01-01',value));
});
test('weight form saves, redraws, edits, deletes and reloads',async()=>{
  const h=harness();await h.init();h.nodes.weightDate.value='2026-01-03';h.nodes.weightValue.value='75,5';await h.nodes.weightForm.onsubmit({preventDefault(){}});
  assert.equal(h.saved()[0].weight,75.5);assert.equal(h.nodes.weightGraph.children.length,1);assert.equal(h.nodes.weightEmpty.hidden,true);
  h.nodes.weightValue.value='75,2';await h.nodes.weightForm.onsubmit({preventDefault(){}});assert.equal(h.saved().length,1);
  h.nodes.weightDate.value='2026-01-01';h.nodes.weightValue.value='76';await h.nodes.weightForm.onsubmit({preventDefault(){}});assert.equal(h.weight(),75.2);
  const reload=harness(JSON.stringify(h.saved()));await reload.init();assert.equal(reload.api.exportHistory().length,2);
  await reload.nodes.weightList.children[0].children[3].onclick();assert.equal(reload.api.exportHistory().length,1);assert.equal(reload.weight(),76);
});
test('failed writes preserve history and show an error',async()=>{
  const h=harness([{date:'2026-01-01',weight:76}]);await h.init();h.fail();h.nodes.weightDate.value='2026-01-02';h.nodes.weightValue.value='75';await h.nodes.weightForm.onsubmit({preventDefault(){}});
  assert.equal(h.api.exportHistory().length,1);assert.match(h.nodes.weightFeedback.textContent,/No se pudo guardar/);assert.equal(h.nodes.weightSave.disabled,false);
});
test('empty and corrupted journals never invent measurements',async()=>{
  const h=harness();await h.init();assert.equal(h.api.exportHistory().length,0);assert.equal(h.nodes.weightLatest.textContent,'—');
  const bad=harness('invalid JSON');await bad.init();assert.equal(bad.nodes.weightSave.disabled,true);
});
test('weight backup round trip validates before writing',async()=>{
  const h=harness();await h.init();await h.api.restore([{date:'2026-01-01',weight:76},{date:'2026-01-05',weight:75.4}]);const backup=JSON.stringify(h.api.exportHistory());
  const next=harness();await next.init();await next.api.restore(JSON.parse(backup));assert.equal(JSON.stringify(next.api.exportHistory()),backup);
  await assert.rejects(next.api.restore([{date:'bad',weight:76}]));assert.equal(JSON.stringify(next.api.exportHistory()),backup);
});
test('load chart keeps week gaps and excludes planned sets and warmups',()=>{
  function section(a,b){return html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));}
  const c=vm.createContext({});vm.runInContext(section('  function dayKey(','  function sessionKey(')+section('  function calcOrm1RM(','  /* ═')+section('  function loadChartData(','  function buildExerciseSelectForMonth('),c);
  const plan={m1w1d1:[{nombre:'Sentadilla',series:[{peso:'80',reps:'8',done:true},{peso:'200',reps:'8'},{peso:'150',reps:'8',done:true,warmup:true}]}],m3w4d5:[{nombre:'Sentadilla',hecho:true,series:[{peso:'90,5',reps:'5'}]}]};
  const result=c.loadChartData(plan,1,'Sentadilla','peso','quarter');assert.equal(result.labels.length,12);assert.equal(result.data[0],80);assert.equal(result.data[1],null);assert.equal(result.data[11],90.5);
  const month=c.loadChartData(plan,3,'Sentadilla','peso','month');assert.equal(month.labels[0],'S9');assert.equal(month.data.length,4);assert.equal(month.data[3],90.5);
  assert.equal(c.loadChartData(plan,1,'Sentadilla','orm','quarter').data[0],101.3);
  plan.m1w1d1[0].series=[{peso:'0',reps:'10',done:true}];assert.equal(c.loadChartData(plan,1,'Sentadilla','orm','quarter').data[0],null);
});
