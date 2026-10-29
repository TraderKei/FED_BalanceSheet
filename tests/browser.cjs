/* Install Playwright separately or set NODE_PATH to an existing Playwright installation. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const url=pathToFileURL(path.resolve(__dirname,'../FedBalanceSheet_v1.html')).href+'?preview=1';
  const shot=async name=>page.screenshot({path:path.join(__dirname,name+'.png'),fullPage:true});
  const contains=async(selector,text)=>assert.ok((await page.locator(selector).textContent()).includes(text),text);
  const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${(await page.viewportSize()).width}`);
  try{
    await page.goto(url);await page.locator('.main-kpi strong').waitFor();await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.evaluate(()=>Vue.version),'3.2.41');await contains('.main-kpi','$5.808T');
    assert.equal(await page.locator('svg').count(),5);await contains('.actual-banner','공식 데이터');assert.ok(!(await page.locator('main').innerText()).includes('샘플 데이터'));await noOverflow();
    const initialPath=await page.locator('.hero svg path[fill="none"]').getAttribute('d');
    await page.getByRole('button',{name:'6개월',exact:true}).click();
    assert.notEqual(await page.locator('.hero svg path[fill="none"]').getAttribute('d'),initialPath);
    for(const [name,count] of [['1년',53],['2년',105],['5년',261],['전체',683]]){
      await page.getByRole('button',{name,exact:true}).click();
      await contains('.hero svg desc',String(count));
    }
    await page.getByRole('button',{name:'2년',exact:true}).click();
    await page.getByRole('button',{name:'4주 변화',exact:true}).click();await contains('.bridge-panel .result','+$8.3B');await contains('.period-row','2026-09-23');
    await page.getByRole('button',{name:'13주 변화',exact:true}).click();await contains('.bridge-panel .result','−$103.4B');
    await page.getByRole('button',{name:'직접 선택',exact:true}).click();
    await page.getByLabel('시작일',{exact:true}).fill('2026-09-22');await page.getByRole('button',{name:'적용',exact:true}).click();await page.getByRole('alert').waitFor();
    await page.getByLabel('시작일',{exact:true}).fill('2026-09-23');await page.getByRole('button',{name:'적용',exact:true}).click();assert.equal(await page.getByRole('alert').count(),0);await contains('.bridge-panel .result','+$8.3B');
    await page.getByRole('button',{name:'1주 변화',exact:true}).click();
    await page.locator('.bridge-label button').click();assert.equal(await page.locator('.expanded-drivers>div').count(),11);
    await page.locator('.bridge-label button').click();
    await page.getByRole('button',{name:'▸ 미 국채',exact:true}).click();assert.equal(await page.locator('.treasury-detail').count(),4);
    await page.getByRole('button',{name:'전체 표 보기 +',exact:true}).click();await contains('.balance-columns','미상각 할인');
    await page.getByRole('button',{name:'간략히 보기 −',exact:true}).click();await page.getByRole('button',{name:'▾ 미 국채',exact:true}).click();
    const chart=page.locator('.hero svg');await chart.focus();await chart.press('End');await contains('.hero .chart-tooltip','2026-10-21');await chart.press('ArrowLeft');await contains('.hero .chart-tooltip','2026-10-14');
    assert.equal(await page.getByRole('button',{name:'⌖ 차트에서 두 날짜 선택',exact:true}).count(),0);
    const chartBox=await chart.boundingBox();
    await page.mouse.move(chartBox.x+chartBox.width*.25,chartBox.y+chartBox.height*.5);
    await page.mouse.down();await page.mouse.move(chartBox.x+chartBox.width*.7,chartBox.y+chartBox.height*.5,{steps:8});await page.mouse.up();
    const zoomedDescription=await chart.locator('desc').textContent();assert.ok(!zoomedDescription.includes('105 '),zoomedDescription);
    await page.getByRole('button',{name:'확대 초기화',exact:true}).click();await contains('.hero svg desc','105 ');
    await page.mouse.move(chartBox.x+chartBox.width*.25,chartBox.y+chartBox.height*.5);
    await page.mouse.down();await page.mouse.move(chartBox.x+chartBox.width*.7,chartBox.y+chartBox.height*.5,{steps:8});await page.mouse.up();
    await page.getByRole('button',{name:'6개월',exact:true}).click();await contains('.hero svg desc','27 ');
    await page.getByRole('button',{name:'2년',exact:true}).click();
    await page.getByRole('button',{name:'1주 변화',exact:true}).click();
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'↓ CSV 다운로드',exact:true}).click();const download=await downloadPromise;const exported=fs.readFileSync(await download.path(),'utf8');assert.ok(exported.includes('actual'));assert.ok(exported.includes('USD millions'));assert.equal(exported.split('\r\n').length,106);
    await page.getByRole('button',{name:'출처·데이터 검증 +',exact:true}).click();await contains('.source-details','2013-09-25');await contains('.source-details','5,808,214.000');await page.getByRole('button',{name:'출처·데이터 검증 −',exact:true}).click();
    await page.getByRole('button',{name:'한·영 변환 테이블 ↗',exact:true}).click();await page.locator('dialog[open]').waitFor();
    await page.getByRole('searchbox').fill('netLiquidity');assert.equal(await page.locator('dialog tbody tr').count(),1);
    await page.keyboard.press('Escape');await page.locator('dialog[open]').waitFor({state:'hidden'});
    await page.getByRole('button',{name:'직접 선택',exact:true}).click();await page.getByLabel('시작일',{exact:true}).fill('2024-12-25');await page.getByLabel('종료일',{exact:true}).fill('2025-01-08');await page.getByRole('button',{name:'적용',exact:true}).click();await contains('.bridge-panel .result','N/A');await contains('.pulse-summary','데이터 없음');await page.getByRole('button',{name:'1주 변화',exact:true}).click();
    for(const state of ['loading','empty','stale','error','partial']){
      await page.locator('footer select').selectOption(state);
      if(state==='loading')assert.equal(await page.locator('.skeleton').count(),4);
      if(state==='empty')await contains('.empty-panel','선택 기간에 관측치가 없습니다.');
      if(['stale','error','partial'].includes(state))assert.equal(await page.locator('.state-banner[role=status]').count(),1);
      await noOverflow();
    }
    await page.getByRole('button',{name:'↻ 저장 데이터 다시 읽기',exact:true}).click();await page.locator('.hero').waitFor();await contains('.toast','저장된 공식 데이터를 다시 읽었습니다.');
    await page.getByRole('button',{name:'EN',exact:true}).click();await contains('h1','Liquidity overview');assert.equal(await page.locator('html').getAttribute('lang'),'en');
    const text=await page.locator('main').innerText();assert.ok(!/[가-힣]/.test(text),'English UI contains Korean');
    await page.getByRole('button',{name:'☼ White',exact:true}).click();assert.ok(!(await page.locator('body').getAttribute('class')).includes('dark'));
    await page.reload();await page.locator('.hero').waitFor();await contains('h1','Liquidity overview');assert.ok(!(await page.locator('body').getAttribute('class')).includes('dark'));
    await noOverflow();await page.mouse.move(0,0);await page.evaluate(()=>document.activeElement.blur());await shot('desktop-white-en');
    await page.getByRole('button',{name:'◐ Dark',exact:true}).click();await page.getByRole('button',{name:'한글',exact:true}).click();await page.mouse.move(0,0);await page.evaluate(()=>document.activeElement.blur());await shot('desktop-dark');
    for(const viewport of [{width:1024,height:768},{width:390,height:844}]){
      await page.setViewportSize(viewport);await page.waitForTimeout(100);await noOverflow();await shot(viewport.width===390?'mobile-dark':'tablet-dark');
      await page.getByRole('button',{name:'EN',exact:true}).click();await page.getByRole('button',{name:'☼ White',exact:true}).click();await noOverflow();await shot(viewport.width===390?'mobile-white-en':'tablet-white-en');
      await page.getByRole('button',{name:'◐ Dark',exact:true}).click();await page.getByRole('button',{name:'한글',exact:true}).click();
    }
    assert.deepEqual(errors,[]);console.log('PASS: ranges, chart drag zoom and reset, bridges, date validation, keyboard exploration, drill-down, CSV, translations, states, refresh, persistence, six viewport/theme/language combinations; no browser errors.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
