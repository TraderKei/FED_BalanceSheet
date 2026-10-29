const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../assets/data.js'),I=require('../assets/i18n.js');
test('official rows are unique, consecutive Wednesdays and reconcile the net liquidity formula',()=>{
  assert.equal(D.meta.status,'actual');assert.ok(D.history.length>650);
  D.history.forEach((r,i)=>{assert.equal(new Date(r.date).getUTCDay(),3);if(i)assert.equal(Date.parse(r.date)-Date.parse(D.history[i-1].date),7*86400000);assert.equal(r.netLiquidity,D.net(r));});
});
test('published 2026-10-21 snapshot and same-date bridges',()=>{
  const values=[[1,-61401],[4,8288],[13,-103371],[52,127760]];
  for(const [w,expected] of values){const b=D.bridge(D.history,D.iso(Date.parse('2026-10-21')-w*7*86400000),'2026-10-21');assert.equal(b.change,expected);assert.ok(Math.abs(b.bridgeDifference)<1e-6);}
  const latest=D.history.find(r=>r.date==='2026-10-21');assert.equal(latest.netLiquidity,5808214);assert.equal(latest.onRrp,237);
});
test('all four change horizons preserve missing endpoints',()=>{
  for(const end of D.history)for(const w of [1,4,13,52]){
    const startDate=D.iso(Date.parse(end.date)-w*7*86400000),start=D.history.find(r=>r.date===startDate),b=D.bridge(D.history,startDate,end.date);
    if(!start||start.netLiquidity===null||end.netLiquidity===null){assert.equal(b.change,null);assert.deepEqual(b.contributions,[null,null,null]);}
    else{assert.ok(Math.abs(b.change-(end.netLiquidity-start.netLiquidity))<1e-6);assert.ok(Math.abs(b.bridgeDifference)<1e-6);}
  }
});
test('invalid dates, source missingness, corrupted snapshots and percentages are safe',()=>{
  assert.equal(D.bridge(D.history,'2026-10-20','2026-10-21').change,null);
  assert.equal(D.bridge(D.history,'2026-10-21','2026-10-14').change,null);
  assert.equal(D.bridge(D.history,'2024-12-25','2025-01-08').change,null);
  assert.equal(D.delta({a:null},{a:0},'a'),null);assert.equal(D.percent(1,0),null);assert.equal(D.percent(-20,10),null);
  assert.equal(D.sum([1,null]),null);
  const bad=structuredClone(D.snapshot);bad.history.at(-1).netLiquidity=0;assert.throws(()=>D.validateSnapshot(bad),/reconciliation/);
  const duplicate=structuredClone(D.snapshot);duplicate.history.push(duplicate.history.at(-1));assert.throws(()=>D.validateSnapshot(duplicate),/date/);
});
test('stress boundaries use unrounded percentiles and freshness reflects observation dates',()=>{
  assert.equal(D.stress(D.history.slice(-25),'primaryCredit').state,'insufficient_data');
  const ranked=D.history.slice(-52).map((r,i)=>({...r,primaryCredit:i}));assert.equal(D.stress(ranked,'primaryCredit').state,'high');ranked.at(-1).primaryCredit=49;assert.equal(D.stress(ranked,'primaryCredit').state,'elevated');
  for(const r of ranked)r.primaryCredit=0;assert.equal(D.stress(ranked,'primaryCredit').state,'normal');
  assert.equal(D.snapshotState(D.snapshot,Date.parse(D.meta.observationDate)+2*86400000),'ready');assert.equal(D.snapshotState(D.snapshot,Date.parse(D.meta.observationDate)+9*86400000),'stale');
});
test('paired translations and exact Vue version',()=>{
  for(const [key,v] of Object.entries(I)){assert.ok(v.ko,key);assert.ok(v.en,key);}
  const fs=require('node:fs'),vm=require('node:vm'),context={};vm.runInNewContext(fs.readFileSync(require.resolve('../assets/vendor/vue-3.2.41.global.prod.js'),'utf8'),context);assert.equal(context.Vue.version,'3.2.41');
});
