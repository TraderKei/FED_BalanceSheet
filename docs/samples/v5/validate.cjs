// UTF-8 reference only; production splitting must use the company's DB charset.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function split(text){
  const parts=[];let part='';
  for(const ch of text){if(Buffer.byteLength(part+ch)>2000){parts.push(part);part='';}part+=ch;}
  if(part)parts.push(part);
  return parts.map((chunk_text,i)=>({group_no:Math.floor(i/7)+1,chunk_no:i%7+1,chunk_text,total_chunks:parts.length}));
}
function restore(rows){
  assert(rows.length>0);const first=rows[0];assert.equal(rows.length,first.total_chunks);
  rows.forEach((r,i)=>{assert.equal(r.group_no,Math.floor(i/7)+1);assert.equal(r.chunk_no,i%7+1);assert.equal(r.total_chunks,first.total_chunks);assert(Buffer.byteLength(r.chunk_text)<=2000);});
  return rows.map(r=>r.chunk_text).join('');
}
const expectedPath=path.join(__dirname,'dashboard-response.sample.json');
const rowsPath=path.join(__dirname,'FED_SCREEN_DATA.rows.json');
if(process.argv.includes('--write')){
  const sample=JSON.parse(fs.readFileSync(path.join(__dirname,'../v2/dashboard-response.sample.json'),'utf8'));
  fs.writeFileSync(expectedPath,JSON.stringify(sample,null,2)+'\n');
  fs.writeFileSync(rowsPath,JSON.stringify(split(JSON.stringify(sample)),null,2)+'\n');
}
const expected=JSON.parse(fs.readFileSync(expectedPath,'utf8'));
const rows=JSON.parse(fs.readFileSync(rowsPath,'utf8'));
assert.deepEqual(JSON.parse(restore(rows)),expected);
const validate=require('../../../assets/data.js').validateSnapshot;
validate(expected);
const full=JSON.parse(fs.readFileSync(path.join(__dirname,'../../../data/normalized/latest.json'),'utf8'));
const fullText=JSON.stringify(full),fullRows=split(fullText);
assert.equal(restore(fullRows),fullText);validate(JSON.parse(restore(fullRows)));
assert(fullRows.some(r=>r.group_no>1));
assert.equal(restore(split('가'.repeat(5000)+'😀'.repeat(800))),'가'.repeat(5000)+'😀'.repeat(800));
assert.throws(()=>restore(fullRows.slice(0,-1)));
assert.throws(()=>restore(fullRows.filter((_,i)=>i!==2)));
assert.throws(()=>restore([fullRows[1],fullRows[0],...fullRows.slice(2)]));
assert.throws(()=>restore([fullRows[0],fullRows[0],...fullRows.slice(2)]));
assert.throws(()=>JSON.parse(restore(split('{invalid'))));
assert.throws(()=>validate({...expected,meta:{...expected.meta,status:'invalid'}}));
for(const r of rows)assert.deepEqual(Object.keys(r).sort(),['chunk_no','chunk_text','group_no','total_chunks']);
// Without a hash, structurally valid content changes are not detected by restore.
assert.equal(restore(split('valid but different text')),'valid but different text');
console.log(`PASS: sample ${rows.length} chunks; full snapshot ${fullRows.length} chunks / ${fullRows.at(-1).group_no} groups; Unicode, missing/reordered/duplicate chunks and invalid JSON and screen validation`);
