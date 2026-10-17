import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {gunzipSync,gzipSync} from 'node:zlib'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE??'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH??'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'})
const out='docs/playtests/b18-beginner-ux/after';mkdirSync(out,{recursive:true})
const results=[],errors=[],layout=[]
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('xvtl:mobile:game:v1'))?.state)
async function page(width){const c=await browser.newContext({viewport:{width,height:844}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.B18_URL??'http://127.0.0.1:5190',{waitUntil:'domcontentloaded'});return {c,p}}
async function shot(p,name){const d=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,dialog:[...document.querySelectorAll('dialog[open]')].map(d=>({w:d.getBoundingClientRect().width,scroll:d.scrollWidth,client:d.clientWidth}))}));assert.ok(d.scroll<=d.width+1);for(const x of d.dialog)assert.ok(x.w<=d.width&&x.scroll<=x.client+1);layout.push({name,...d});await p.screenshot({path:`${out}/${name}.png`})}
async function exported(p){return p.evaluate(async root=>{const {restoreSavedGame}=await import(`${root}/src/game/saved-game.ts`),{serializeLog}=await import(`${root}/src/game/log.ts`);return serializeLog(restoreSavedGame(localStorage.getItem('xvtl:mobile:game:v1')))},`/@fs/${process.cwd().replaceAll('\\','/')}`)}
async function upload(p,path){const bytes=gunzipSync(readFileSync(path));await p.getByText('Mở ván đã lưu',{exact:true}).click();await p.locator('#saved-game-file').setInputFiles({name:'historical.json',mimeType:'application/json',buffer:bytes});await p.waitForTimeout(500);return JSON.parse(bytes).state}
try{
  for(const [width,source]of [[320,'savings'],[390,'debt']]){
    const {c,p}=await page(width)
    for(let step=0;step<5;step++){
      assert.equal(await p.locator('.tutorial-content details[open]').count(),0)
      await p.getByRole('button',{name:'Tiếp theo →',exact:true}).click()
      assert.equal(await p.locator('.tutorial-content h2').evaluate(e=>e===document.activeElement),true)
    }
    await p.getByRole('button',{name:'Sẵn sàng chơi!',exact:true}).click()
    await p.getByRole('button',{name:'50 triệu',exact:true}).click();assert.ok(await p.getByText(/Bạn bắt đầu với 0đ tiền mặt/).count())
    await p.getByText('Chơi lại cùng hành trình',{exact:true}).click();await p.locator('#mobile-seed').fill('B18-FUND-11')
    await p.getByRole('button',{name:/Bắt đầu hành trình/}).click();await p.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click();await p.waitForTimeout(350)
    await p.getByRole('button',{name:'Gieo xúc xắc',exact:true}).last().click();await p.waitForTimeout(3300)
    assert.equal((await state(p)).eventId,'medical');await shot(p,`${width}-personal`)
    await p.getByRole('button',{name:/Thanh toán 5\./}).click();await p.waitForTimeout(350)
    assert.equal((await state(p)).phase,'funding')
    if(source==='debt')await p.getByRole('button',{name:/Vay phần còn thiếu/}).click()
    await shot(p,`${width}-funding-${source}`);await p.getByRole('button',{name:/Dùng nguồn tiền này/}).click();await p.waitForTimeout(350)
    const current=await state(p);assert.equal(current.phase,'rolling');assert.equal(current.portfolio.debt,source==='debt'?5e6:0)
    const fundingEntry=current.log.findLast(e=>e.kind==='funding');assert.equal(fundingEntry.lostSavingsInterest,source==='savings'?9e6:0)
    const log=await exported(p);writeFileSync(`${out}/browser-funding-${source}.json.gz`,gzipSync(log))
    await p.reload();await p.getByRole('button',{name:/Tiếp tục ván B18/}).click();assert.deepEqual((await state(p)).portfolio,current.portfolio)
    results.push({width,flow:'onboarding-personal-funding-resume',source,lostInterest:fundingEntry.lostSavingsInterest,turn:current.turn});await c.close()
  }
  for(const [kind,path]of [
    ['B18-single','docs/playtests/core-mvp-b18/browser-funding-debt.json.gz'],
    ['C20','docs/playtests/atomic-investments-v24/historical-multi-purchase.json.gz'],
    ['B18-multi','docs/playtests/core-mvp-b18-multi-course/browser-390-advanced-first.json.gz'],
  ]){
    const {c,p}=await page(390);await p.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click()
    const expected=await upload(p,path),restored=await state(p)
    assert.deepEqual(restored.portfolio,expected.portfolio);assert.equal(restored.rng,expected.rng);assert.equal(restored.boardRevision,expected.boardRevision)
    await shot(p,`import-${kind}`)
    await p.reload();await p.getByRole('button',{name:/Tiếp tục ván|Xem lại ván .* đã kết thúc/}).click()
    assert.equal((await state(p)).seed,expected.seed);assert.equal((await state(p)).gameplayProfile,expected.gameplayProfile)
    if(kind==='B18-single'){
      const tile=p.locator('[data-b18-tile="15"]');assert.equal(await tile.getAttribute('aria-label'),'Ô 16: Đầu tư bản thân');await tile.focus();await p.keyboard.press('Enter')
      assert.match(await p.locator('dialog[open]').last().innerText(),/8 triệu.*4 triệu/);await p.keyboard.press('Escape')
    }
    if(kind==='C20')assert.equal(await p.locator('[data-b18-tile]').count(),0)
    results.push({flow:'historical-import-reload-resume',kind,seed:expected.seed,profile:expected.gameplayProfile??'legacy',board:expected.boardLayout,unchangedPortfolioAndRng:true})
    await c.close()
  }
  // Simulate failed browser persistence, using a real imported game rather than injecting state.
  const {c,p}=await page(390);await p.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click()
  await p.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('QA quota simulation','QuotaExceededError')}})
  await upload(p,'docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')
  await p.getByRole('button',{name:'Đóng',exact:true}).last().click()
  await p.getByRole('button',{name:'Chơi hành trình mới',exact:true}).click()
  assert.ok(await p.getByText(/Ván mới nhất chỉ còn trong phiên này/).count());await shot(p,'save-failed-return-to-setup')
  await p.getByRole('button',{name:/Xem lại ván B18 đã kết thúc/}).click()
  assert.ok(await p.locator('dialog[aria-label="Kết quả hành trình"]').count())
  results.push({flow:'quota-failure-return-to-setup',latestInMemoryPreserved:true,storageFailureSimulated:true});await c.close()
  assert.deepEqual(errors,[]);writeFileSync(`${out}/compat-funding-verification.json`,JSON.stringify({results,layout,errors,realUi:true,forcedGameStates:false},null,2)+'\n')
  console.log(JSON.stringify({flows:results.length,layoutChecks:layout.length,errors:errors.length}))
}finally{await browser.close()}
