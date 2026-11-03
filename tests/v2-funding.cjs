/* Install Playwright separately or set NODE_PATH to an existing Playwright installation. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const D=require('../assets/data.js');

(async()=>{
  const latest=D.history.at(-1);
  assert.ok([latest.sofr,latest.effr,latest.iorb,latest.standingRepoUsage].every(D.finite));
  assert.ok(Math.abs(latest.sofrIorbSpreadBp-(latest.sofr-latest.iorb)*100)<1e-4);
  assert.ok(Math.abs(latest.effrIorbSpreadBp-(latest.effr-latest.iorb)*100)<1e-4);
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../FedBalanceSheet_v2.html')).href);
    await page.locator('.trend-stats').waitFor();
    const daily=D.snapshot.fundingDaily;
    assert.ok(daily.length>100);
    const newest=key=>[...daily].reverse().find(r=>D.finite(r[key]));
    const funding=await page.locator('.trend-stats').innerText();
    const bp=value=>(value>0?'+':value<0?'−':'')+Math.abs(value).toFixed(2)+' bp';
    assert.ok(funding.includes(bp(newest('sofrIorbSpreadBp').sofrIorbSpreadBp)));
    assert.ok(funding.includes(bp(newest('effrIorbSpreadBp').effrIorbSpreadBp)));
    assert.ok(funding.includes('$'+newest('standingRepoUsage').standingRepoUsage.toLocaleString('en-US',{maximumFractionDigits:0})+'M'));
    assert.equal(await page.locator('.asset-mix .badge').count(),0);
    assert.equal(await page.locator('.cross-check .funding').count(),0);
    assert.ok(await page.evaluate(()=>document.querySelector('.asset-mix').compareDocumentPosition(document.querySelector('.cross-check'))&Node.DOCUMENT_POSITION_FOLLOWING));
    await page.locator('.trend-table summary').click();
    assert.ok(await page.locator('.trend-table tbody tr').count()>50);
    await page.locator('.trend-table summary').click();
    for(const row of daily){for(const [rate,key] of [['sofr','sofrIorbSpreadBp'],['effr','effrIorbSpreadBp']]){if(D.finite(row[key]))assert.ok(Math.abs(row[key]-(row[rate]-row.iorb)*100)<1e-6);}}
    for(const key of ['sofrIorbSpreadBp','effrIorbSpreadBp','standingRepoUsage'])assert.ok(funding.includes(newest(key).date));
    const guide=page.locator('.reserve-check-guide');
    await guide.locator('summary').click();
    const checkRows=guide.locator('tbody tr');
    assert.equal(await checkRows.count(),3);
    const money=value=>'$'+(value/1000).toLocaleString('en-US',{minimumFractionDigits:3,maximumFractionDigits:3})+'B';
    for(const weeks of [1,4]){
      if(weeks===4)await page.locator('.bridge-panel').getByRole('button',{name:'4주 변화',exact:true}).click();
      const startDate=D.iso(Date.parse(latest.date)-weeks*7*86400000),start=D.history.find(row=>row.date===startDate);
      assert.ok((await guide.locator('caption').innerText()).includes(startDate));
      for(const [i,key] of ['federalReserveNotes','reverseRepoForeignOfficial','otherLiabilities'].entries()){
        const cells=await checkRows.nth(i).locator('td').allTextContents();
        const delta=latest[key]-start[key];
        assert.deepEqual(cells,[money(start[key]),money(latest[key]),(delta>0?'+':delta<0?'−':'')+money(Math.abs(delta))]);
      }
    }
    const info=page.locator('.funding-info');
    await info.hover();
    assert.equal(await info.evaluate(el=>getComputedStyle(el,'::after').opacity),'1');
    assert.ok((await info.getAttribute('data-tooltip')).includes('SOFR − IORB'));
    assert.ok((await info.getAttribute('data-tooltip')).includes('EFFR − IORB'));
    assert.ok((await info.getAttribute('data-tooltip')).includes('SRP'));
    assert.ok((await info.getAttribute('data-tooltip')).includes('\n\n'));
    await page.mouse.move(0,0);await info.focus();
    assert.equal(await info.evaluate(el=>getComputedStyle(el,'::after').visibility),'visible');
    await info.evaluate(el=>el.blur());
    await page.getByRole('button',{name:'EN',exact:true}).click();
    assert.ok((await page.locator('.trend-stats').innerText()).includes('SRP usage'));
    for(const width of [1024,390,320]){
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: official funding snapshot, same-period reserve details, hover/focus tooltip, language and responsive layout');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
