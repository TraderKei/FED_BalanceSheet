const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const dir=__dirname;
const response=JSON.parse(fs.readFileSync(path.join(dir,'dashboard-response.sample.json'),'utf8'));
const target=response.history[0];
const decode=s=>s==='\\N'?null:s.replace(/\\([\\trn])/g,(_,c)=>({'\\':'\\',t:'\t',r:'\r',n:'\n'}[c]));
const values={};
let total=0;
for(const name of ['H41','ONRRP','SOFR','EFFR','IORB','REPO']){
  const prefix='FED_'+name;
  const rows=JSON.parse(fs.readFileSync(path.join(dir,prefix+'.rows.json'),'utf8'));
  const groups=new Map();const seen=new Set();
  for(const r of rows){
    assert(Buffer.byteLength(r.text,'utf8')<=2000);
    assert(Number.isInteger(r.chunk_no)&&r.chunk_no>=1&&r.chunk_no<=7);
    const group=name==='H41'?r.key3:r.key2;
    assert(Number.isInteger(group)&&group>0);
    const key=JSON.stringify(name==='H41'?[r.key1,r.key2]:[r.key1]);
    const pk=JSON.stringify([key,group,r.chunk_no]);assert(!seen.has(pk));seen.add(pk);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push({r,group});total++;
  }
  let restored='';values[name]=[];
  for(const [key,parts] of groups){
    parts.sort((a,b)=>a.group-b.group||a.r.chunk_no-b.r.chunk_no);
    parts.forEach((p,i)=>{assert.equal(p.group,Math.floor(i/7)+1);assert.equal(p.r.chunk_no,i%7+1);});
    const text=parts.map(p=>p.r.text).join('');restored+=text;
    assert(text.endsWith('\n'));
    const records=text.trimEnd().split('\n').map(l=>l.split('\t').map(decode));
    const m=records[0];assert.equal(m[0],'M');assert.equal(m[1],'FED-TEXT-2');assert.equal(m[2],name);
    const keys=JSON.parse(key);
    for(const d of records.slice(1)){
      assert.equal(d[0],'D');
      if(name==='H41'){
        assert.equal(keys[0],m[6]);assert.equal(keys[1],d[1].slice(0,4));
        assert.equal(d[2]===null?null:Number(d[2]),target[m[7]]);
      } else if(['SOFR','EFFR','IORB'].includes(name)){
        assert.equal(keys[0],d[1].slice(0,4));assert.equal(Number(d[2]),target[name.toLowerCase()]);
      } else {assert.equal(keys[0],d[1]);assert.equal(d[2],target.date);}
      values[name].push(d);
    }
  }
  assert.equal(restored,fs.readFileSync(path.join(dir,prefix+'.text.tsv'),'utf8'));
}
assert.equal(values.H41.length,Object.keys(response.provenance.seriesMap).length);
for(const [name,field,ids] of [['ONRRP','onRrp','onRrpOperationIds'],['REPO','standingRepoUsage','standingRepoOperationIds']]){
  assert.equal(values[name].reduce((a,d)=>a+Number(d[7]),0)/1e6,target[field]);
  assert.deepEqual(values[name].map(d=>d[1]).sort(),[...target[ids]].sort());
}
assert.equal(target.netLiquidity,target.totalAssets-target.treasuryGeneralAccount-target.onRrp);
assert(Math.abs(target.sofrIorbSpreadBp-(target.sofr-target.iorb)*100)<1e-8);
assert(Math.abs(target.effrIorbSpreadBp-(target.effr-target.iorb)*100)<1e-8);
require('../../../assets/data.js').validateSnapshot(response);
console.log(`PASS: ${total} DB rows, six source streams, reconstruction, source values and dashboard response`);
