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
    await page.locator('.funding-values').waitFor();
    const funding=await page.locator('.funding-values').innerText();
    const bp=value=>(value>0?'+':value<0?'−':'')+Math.abs(value).toFixed(2)+' bp';
    assert.ok(funding.includes(bp(latest.sofrIorbSpreadBp)));
    assert.ok(funding.includes(bp(latest.effrIorbSpreadBp)));
    assert.ok(funding.includes('$'+(latest.standingRepoUsage/1000).toFixed(3)+'B'));
    assert.equal(await page.locator('.asset-mix .badge').count(),0);
    await page.getByRole('button',{name:'EN',exact:true}).click();
    assert.ok((await page.locator('.funding').innerText()).includes('SRF usage'));
    for(const width of [1024,390,320]){
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: official funding snapshot, v2 values, language and responsive layout');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
