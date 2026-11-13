// Run: node --test tests/registro-regression.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
function section(start, end) {
  const from = html.indexOf(start);
  assert.ok(from >= 0, start);
  const to = html.indexOf(end, from + start.length);
  assert.ok(to > from, end);
  return html.slice(from, to);
}
function element() {
  return { children: [], style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild(child) { this.children.push(child); }, setAttribute() {},
    addEventListener() {}, insertAdjacentHTML() {} };
}
test('all inline scripts parse', () => {
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(m[1]);
});
test('progress refresh preserves the day list used by add/delete controls', () => {
  const c = vm.createContext({ STATE: {data: {}, month: 1, week: 1, day: 1},
    document: {getElementById: () => element()} });
  vm.runInContext(section('  function dayKey(', '  function ensureRecords(') +
    section('  function sessionProgressState(', '  function renderExercises('), c);
  vm.runInContext(`
    var list = ensureDay(1,1,1);
    list.push({nombre:'Sentadilla',sets:3,reps:'8',peso:'80'});
    updateSessionJourney();
    var sameList = list === STATE.data.m1w1d1;
    list.push(emptyExercise());
    var added = STATE.data.m1w1d1.length;
    list.splice(0,1);
    var remaining = STATE.data.m1w1d1.length;
  `, c);
  assert.equal(c.sameList, true);
  assert.equal(c.added, 2);
  assert.equal(c.remaining, 1);
});
test('series deletion cancels safely and stale/repeated clicks cannot remove another series', () => {
  const a = {peso:'80', reps:'8'}, b = {peso:'85', reps:'6'}, d = {peso:'90', reps:'4'};
  let approve = false, saves = 0;
  const c = vm.createContext({ex: {nombre:'Sentadilla', series:[a,b,d]},
    document: {createElement: element}, getPrevSeriesData: () => [],
    scheduleSave: () => saves++, rebuildSeriesRows() {}, showToast() {},
    confirm: () => approve, navigator: {}, setTimeout() { throw Error('Delayed deletion'); } });
  vm.runInContext(section('      function buildSerieRow(', '      function rebuildSeriesRows('), c);
  const row = c.buildSerieRow(b, 1);
  const del = row.children.at(-1);
  del.onclick(); assert.equal(c.ex.series.length, 3);
  approve = true;
  c.ex.series.unshift({peso:'20'}); // The original index is now stale.
  del.onclick(); del.onclick();
  assert.equal(c.ex.series.includes(b), false);
  assert.equal(c.ex.series.includes(d), true);
  assert.equal(c.ex.series.length, 3);
  assert.equal(saves, 1);
  c.ex.series = [a];
  c.buildSerieRow(a,0).children.at(-1).onclick();
  assert.equal(c.ex.series.length, 1);
});
test('pending data is persisted synchronously and flushed when leaving the page', () => {
  const data = new Map(), events = {}, timers = [];
  let saves = 0;
  const c = vm.createContext({ STATE:{data:{day:[{series:[{peso:'85',reps:'6'}]}]}},
    trainingMode:'gimnasio', trainingStorageKey: () => 'plan', saveTimeout:null,
    localStorage:{setItem:(k,v)=>data.set(k,v)}, clearTimeout() {},
    setTimeout: fn => timers.push(fn), saveData:()=>saves++,
    document:{visibilityState:'hidden',addEventListener:(k,v)=>events[k]=v},
    window:{addEventListener:(k,v)=>events[k]=v} });
  vm.runInContext(section('  var hasPendingSave', '  /* ═'), c);
  c.scheduleSave();
  assert.equal(JSON.parse(data.get('plan')).day[0].series[0].peso, '85');
  assert.equal(data.get('slab-pending-plan'), '1');
  events.visibilitychange(); events.pagehide();
  assert.equal(saves, 1);
});
test('IndexedDB writes preserve call order, snapshots, and wait for transaction commit', async () => {
  const txs = [], values = [];
  const c = vm.createContext({IDB_STORE:'kv', openDB:async()=>({transaction() {
    const tx = {objectStore:()=>({put(value) { values.push(value); return {}; }})};
    txs.push(tx); return tx;
  }})});
  vm.runInContext(section('  var idbWriteQueue', '  /* ── Migración'), c);
  const value = {peso:'80'};
  let committed = false;
  const first = c.idbSet('plan',value).then(()=>committed=true);
  value.peso = '90';
  const second = c.idbSet('plan',value);
  await new Promise(r=>setImmediate(r));
  assert.equal(txs.length,1); assert.equal(committed,false);
  assert.equal(values[0].peso,'80');
  txs[0].oncomplete(); await first;
  await new Promise(r=>setImmediate(r));
  assert.equal(values[1].peso,'90');
  txs[1].oncomplete(); await second;
  const aborted = c.idbSet('plan',{});
  const rejection = assert.rejects(aborted, /cancelado/);
  await new Promise(r=>setImmediate(r)); txs[2].onabort(); await rejection;
  const retry = c.idbSet('plan',{peso:'95'});
  await new Promise(r=>setImmediate(r)); txs[3].oncomplete(); await retry;
});
