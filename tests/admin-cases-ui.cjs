const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {start}=require('../scripts/preview-admin-cases.cjs');
(async()=>{
  const preview=await start(0),browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(preview.url+'/admin');await page.locator('#adminDashboard').waitFor({state:'visible'});
    await page.locator('.admin-floating-tabs button').filter({hasText:'Case'}).click();
    await page.waitForFunction(()=>document.querySelector('#adminCasesPanel [role=status]').textContent.includes('25 case'));
    assert.equal(await page.locator('.admin-case-row').count(),20);
    assert.equal(await page.locator('#adminCasesPanel input[type=search]').count(),1);
    await page.getByRole('button',{name:'Lihat Butiran',exact:true}).first().click();
    await page.getByRole('heading',{name:'Sejarah',exact:true}).waitFor();assert.equal(await page.locator('.admin-case-detail input').count(),0);await page.locator('.admin-case-detail').getByRole('button',{name:'Tutup',exact:true}).click();
    await page.getByRole('button',{name:'Seterusnya',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#adminCasesPanel [role=status]').textContent.includes('Halaman 2'));assert.equal(await page.locator('.admin-case-row').count(),5);
    await page.getByRole('button',{name:'Analisis',exact:true}).click();await page.locator('.case-summary').waitFor();assert.equal(await page.locator('.case-summary dd').first().innerText(),'25');
    await page.screenshot({path:'/tmp/carloan-admin-case-analysis-phone.png',fullPage:true});
    for(const width of [320,390,430,768,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow at '+width);}
    await page.screenshot({path:'/tmp/carloan-admin-case-analysis-desktop.png',fullPage:true});
    await page.getByRole('button',{name:'Senarai',exact:true}).click();await page.locator('.admin-case-row').first().waitFor();
    await page.getByLabel('Carian',{exact:true}).fill('Pelanggan Demo 1');await page.waitForTimeout(500);
    const search=await page.getByLabel('Carian',{exact:true}).inputValue();await preview.update();await page.evaluate(()=>dispatchEvent(new Event('carloan-admin-live')));await page.getByText('Kemaskini realtime 1',{exact:true}).waitFor();assert.equal(await page.getByLabel('Carian',{exact:true}).inputValue(),search);
    await page.getByLabel('Rekod',{exact:true}).selectOption('deleted');await page.waitForTimeout(200);await page.getByLabel('Carian',{exact:true}).fill('');await page.waitForTimeout(500);assert.equal(await page.locator('.case-deleted-label').count(),1);
    await page.getByLabel('Carian',{exact:true}).fill('not found');await page.getByText('Tiada case menepati filter.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Analisis',exact:true}).click();await page.locator('.case-summary').waitFor();assert.equal(await page.locator('.case-summary dd').first().innerText(),'0');
    await page.route('**/api/app?action=admin-case-analysis&**',route=>route.fulfill({status:503,json:{error:'Semakan gagal sementara'}}));
    await page.getByLabel('Carian',{exact:true}).fill('Pelanggan');await page.getByRole('button',{name:'Cuba semula',exact:true}).waitFor();
    await page.unroute('**/api/app?action=admin-case-analysis&**');await page.getByRole('button',{name:'Cuba semula',exact:true}).click();await page.locator('.case-summary').waitFor();
    assert.equal(await page.locator('.case-summary dd').first().innerText(),'1');
    assert.deepEqual(errors,[]);console.log('PASS admin case UI: 5 tabs, details, history, read-only, full analysis, pagination, filters, realtime, deleted cases, empty results and five viewport widths.');
  }finally{await browser.close();await preview.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
