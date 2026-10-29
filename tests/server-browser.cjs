const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  const response=await page.request.get('http://127.0.0.1:8765/api/h41');assert.equal(response.status(),200);const initial=await response.json();assert.equal(initial.meta.status,'actual');
  const blocked=await page.request.post('http://127.0.0.1:8765/api/refresh',{data:{}});assert.equal(blocked.status(),403);
  assert.equal((await page.request.get('http://127.0.0.1:8765/.git/config')).status(),404);
  await page.goto('http://127.0.0.1:8765/FedBalanceSheet_v1.html');await page.locator('.hero').waitFor();
  assert.equal(await page.locator('.file-mode-note').count(),0);
  const wait=page.waitForResponse(r=>r.url().endsWith('/api/refresh'),{timeout:120000});
  await page.getByRole('button',{name:'↻ 새로고침',exact:true}).click();
  await page.locator('.loading-layout').waitFor();
  const refreshed=await wait;assert.equal(refreshed.status(),200);const snapshot=await refreshed.json();assert.ok(snapshot.meta.fetchedAt>=initial.meta.fetchedAt);
  await page.locator('.hero').waitFor();assert.ok((await page.locator('.toast').innerText()).includes('공식 데이터 수집과 검증'));
  const level=await page.locator('.main-kpi strong').innerText();assert.equal(level,'$5.808T');
  // A failed collection keeps actual values visible; never silently replaces them with mock data.
  await page.route('**/api/refresh',route=>route.fulfill({status:502,contentType:'application/json',body:'{"error":"test_failure"}'}));
  await page.getByRole('button',{name:'↻ 새로고침',exact:true}).click();await page.locator('.state-banner[role=status]').waitFor();assert.equal(await page.locator('.main-kpi strong').innerText(),level);
  await page.unroute('**/api/refresh');await page.getByRole('button',{name:'다시 시도',exact:true}).click();await page.locator('.state-banner[role=status]').waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'tests/server-desktop.png',fullPage:true});
  console.log('PASS: actual API fetch, protected local refresh, official-source recollection, failed refresh retains last snapshot, retry, no JS errors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
