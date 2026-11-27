import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE??'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const stage=process.argv.includes('--after')?'after':'before',out=`docs/playtests/b18-beginner-ux/${stage}`
mkdirSync(out,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH??'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'})
const errors=[],checks=[]
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('xvtl:mobile:game:v1'))?.state)
async function shot(p,name){
  const dims=await p.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>({w:d.getBoundingClientRect().width,scroll:d.scrollWidth,client:d.clientWidth}))}))
  assert.ok(dims.scroll<=dims.w+1);for(const d of dims.dialogs)assert.ok(d.w<=dims.w&&d.scroll<=d.client+1)
  await p.screenshot({path:`${out}/${name}.png`});checks.push({name,...dims})
}
async function open(width){
  const context=await browser.newContext({viewport:{width,height:844}}),p=await context.newPage()
  p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.B18_URL??'http://127.0.0.1:5190',{waitUntil:'domcontentloaded'})
  await shot(p,`${width}-onboarding`);await p.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click();return {context,p}
}
async function importFile(p,path){
  await p.getByText('Mở ván đã lưu',{exact:true}).click()
  await p.locator('#saved-game-file').setInputFiles({name:'game.json',mimeType:'application/json',buffer:gunzipSync(readFileSync(path))})
  await p.waitForTimeout(450)
}
try{
  for(const width of [320,390]){
    const {context,p}=await open(width)
    await p.getByRole('button',{name:'50 triệu',exact:true}).click();await shot(p,`${width}-setup-zero`)
    await p.getByRole('button',{name:'0 triệu',exact:true}).click()
    await p.getByText('Chơi lại cùng hành trình',{exact:true}).click();await p.locator('#mobile-seed').fill('TRADING-AB-MAIN-0')
    await p.getByRole('button',{name:/Bắt đầu hành trình/}).click();await p.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click();await p.waitForTimeout(400)
    const unchanged=await state(p),descriptions=[]
    for(const index of [0,6,10,4,1,2,3,8,5]){
      const tile=p.locator(`[data-b18-tile="${index}"]`);await tile.focus();await p.keyboard.press('Enter')
      const dialog=p.locator('dialog[open]').last();descriptions.push(await dialog.innerText());await shot(p,`${width}-tile-${index+1}`)
      await p.keyboard.press('Escape');await p.waitForTimeout(80)
      const returned=await tile.evaluate(e=>e===document.activeElement)
      if(stage==='after')assert.ok(returned,'SVG tile focus must return after Escape')
      assert.deepEqual(await state(p),unchanged,'Tile inspection must be read-only')
    }
    if(stage==='after')assert.equal(new Set(descriptions.map(t=>t.split('\n').slice(1).join('\n'))).size,9)
    for(let i=0;i<2;i++){
      await p.getByRole('button',{name:'Gieo xúc xắc',exact:true}).last().click();await p.waitForTimeout(3300)
      if((await state(p)).eventId!=='course')await p.getByRole('button',{name:/Đã hiểu · Tiếp tục/}).click()
      await p.waitForTimeout(350)
    }
    assert.equal((await state(p)).eventId,'course');await shot(p,`${width}-course`)
    if(stage==='after'){
      assert.equal(await p.locator('.course-projection[open]').count(),0)
      await p.getByText('Xem thu nhập còn lại',{exact:true}).first().click();await shot(p,`${width}-course-expanded`)
      await p.getByText('Xem thu nhập còn lại',{exact:true}).first().click()
    }
    await p.reload();await p.getByRole('button',{name:/Tiếp tục ván B18/}).click();await p.waitForTimeout(350)
    assert.equal((await state(p)).eventId,'course')
    await context.close()

    const second=await open(width),q=second.p
    await importFile(q,'docs/playtests/core-mvp-b18/browser-funding-debt.json.gz')
    await q.reload();await q.getByRole('button',{name:/Tiếp tục ván B18/}).waitFor()
    await importFile(q,'docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')
    await shot(q,`${width}-result-defeat`)
    await q.getByRole('button',{name:'Chơi hành trình mới',exact:true}).click();await shot(q,`${width}-saved-after-result`)
    const correct=await q.getByRole('button',{name:/Xem lại ván B18 đã kết thúc/}).count()>0
    checks.push({name:`${width}-stale-save-regression`,correct,storageSeed:(await state(q)).seed})
    assert.equal(correct,stage==='after','Baseline must reproduce stale saved-game UI; polished app must show latest ended game')
    if(stage==='after'){await q.getByRole('button',{name:/Xem lại ván B18 đã kết thúc/}).click();assert.equal((await state(q)).seed,'B18-UI-TRADES')}
    await second.context.close()
  }
  if(stage==='before')for(const name of ['desktop-course-unlearned','desktop-result'])copyFileSync(`docs/playtests/core-mvp-b18-multi-course/${name}.png`,`${out}/${name}.png`)
  assert.deepEqual(errors,[]);writeFileSync(`${out}/screens-verification.json`,JSON.stringify({stage,checks,errors,realUi:true,importedHistoricalLogs:true,beforeDesktopSource:stage==='before'?'Exact ba1c811 candidate screenshots retained from preceding verified UI run':undefined},null,2)+'\n')
  console.log(JSON.stringify({stage,checks:checks.length,errors:errors.length}))
}finally{await browser.close()}
