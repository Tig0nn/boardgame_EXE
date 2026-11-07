import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { eventsForGame } from '../../src/data/events.ts'
import { decide, transact, snapshot } from '../../src/game/engine.ts'
import { saleQuote, depositPreview } from '../../src/game/selectors.ts'
import { money } from '../../src/game/format.ts'
import { restoreSavedGame } from '../../src/game/saved-game.ts'
const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const paymentsOnly=process.argv.includes('--payments-only')
const stage = process.argv.includes('--after') ? 'after' : 'before', root = 'docs/playtests/b18-compact-financial-ui', out = `${root}/${paymentsOnly ? 'after-payment-wrap' : stage}`
mkdirSync(out, { recursive: true })
const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH ?? 'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const checks = [], errors = [], consoleErrors = []
const stored = p => p.evaluate(() => localStorage.getItem('xvtl:mobile:game:v1'))
const norm = s => s.replace(/\s+/g, ' ').trim()
async function open(c, id) {
  const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', e => { if (e.type() === 'error') consoleErrors.push({ error: e.text(), location: e.location() }) })
  await p.goto(process.env.DECISION_COPY_URL ?? 'http://127.0.0.1:5216', { waitUntil: 'networkidle' })
  if (await p.getByRole('button', { name: 'Bỏ qua hướng dẫn' }).count()) await p.getByRole('button', { name: 'Bỏ qua hướng dẫn' }).click()
  const buffer = gunzipSync(readFileSync(`${root}/checkpoints/${id}.json.gz`)), game = JSON.parse(buffer).state
  await p.getByText('Mở ván đã lưu', { exact: true }).click()
  await p.locator('#saved-game-file').setInputFiles({ name: `${id}.json`, mimeType: 'application/json', buffer })
  await p.locator('dialog[open] #trade-amount,dialog[open] .decision-button').first().waitFor()
  await p.evaluate(() => document.fonts.ready)
  return { p, game }
}
async function shot(p, label) {
  const layout = await p.locator('dialog[open]').evaluate(e => ({ viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
    modalOverflow: e.scrollWidth > e.clientWidth + 1, nestedScroll: [...e.querySelectorAll('*')].filter(x => x.scrollHeight > x.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(x).overflowY)).length }))
  assert.ok(layout.pageWidth <= layout.viewport + 1 && !layout.modalOverflow && !layout.nestedScroll, label)
  await p.screenshot({ path: `${out}/${label}.png` }); writeFileSync(`${out}/${label}.txt`, await p.locator('dialog[open]').innerText())
  checks.push({ label, ...layout })
}
async function resume(p, expected) {
  const saved = await stored(p)
  assert.deepEqual(snapshot(restoreSavedGame(saved)), snapshot(expected))
  await p.reload(); await p.getByRole('button', { name: /Tiếp tục ván B18/ }).click()
  assert.equal(await stored(p), saved)
}
async function action(p,game,button,expected,label) {
 await button.click({trial:true}); assert.ok(await button.evaluate(e=>e.getBoundingClientRect().height)>=44);
 await p.keyboard.press('Tab');await button.focus();assert.ok(await button.evaluate(e=>getComputedStyle(e).outlineStyle!=='none'));await p.keyboard.press('Enter');
 await p.waitForFunction(n=>JSON.parse(localStorage.getItem('xvtl:mobile:game:v1')).state.log.length>n,game.log.length);
 await resume(p,expected);checks.push({label,exactEngineSnapshot:true,saveResumed:true,keyboardEnter:true});
}
async function accordion(p,summary,label) {
 await summary.focus();await p.keyboard.press('Enter');assert.equal(await summary.evaluate(e=>e.parentElement.open),true);
 assert.ok(await summary.evaluate(e=>getComputedStyle(e).outlineStyle!=='none'));
 await summary.scrollIntoViewIfNeeded();await shot(p,label);
 await p.keyboard.press('Enter');assert.equal(await summary.evaluate(e=>e.parentElement.open),false);
}
try {
 for(const [width,height] of [[320,740],[390,844],[430,932],[768,1024],[1440,900]]) {
  const c=await browser.newContext({viewport:{width,height},hasTouch:true});
  for(const id of (paymentsOnly?['family','repair','medical']:['family','repair','medical','bank','bonds','gold'])) {
   const {p,game}=await open(c,id), original=await stored(p);
   if(id==='bank'){await p.locator('#trade-amount').fill('10000000');await p.locator('.savings-terms input[value="2"]').check();}
   await p.locator('dialog[open]').evaluate(e=>e.scrollTop=0);await shot(p,`${width}-${id}`);
   if(stage==='after') {
    if(['family','repair','medical'].includes(id)) {
     const text=await p.locator('dialog[open]').innerText();assert.doesNotMatch(text,/Bây giờ trả 0|Tổng trả|\bSTART\b|lãi vay|tiền phạt/);
     const event=eventsForGame(game).find(e=>e.id===id);
     for(let i=0;i<event.options.length;i++) {
      const current=i===0?{p,game}:await open(c,id);
      await action(current.p,game,current.p.locator('dialog[open] .decision-button').nth(i),decide(game,event.options[i].id),`${width}-${id}-${i}`);
      if(i!==0) await current.p.close();
     }
    } else {
     if(id==='bank') {
      const schedule=p.locator('.savings-preview summary');
      for(const term of [1,2,3])for(const amount of [10000000,2000000]) {
       await p.locator('.savings-terms input[value="'+term+'"]').check();await p.locator('#trade-amount').fill(String(amount));
       const quote=depositPreview(game,amount,term),text=norm(await p.locator('.savings-preview').innerText());
       for(const n of [amount,quote.interest,amount+quote.interest])assert.ok(text.includes(norm(money(n))));
       await schedule.click();assert.match(await p.locator('.savings-preview').innerText(),new RegExp('lần thứ '+quote.maturityLap));await schedule.click();
       checks.push({label:`${width}-bank-${term}-${amount}`,exactPreview:true});
      }
      for(const value of ['0','99999999','abc']){
       await p.locator('#trade-amount').fill(value);assert.equal(await p.locator('.savings-preview').count(),0);
       assert.ok(await p.getByRole('button',{name:/^Gửi tiết kiệm/}).isDisabled());checks.push({label:`${width}-invalid-${value}`,noInvalidProjection:true});
      }
      await p.locator('#trade-amount').fill('10000000');await p.locator('.savings-terms input[value="2"]').check();
      await accordion(p,p.locator('.savings-preview summary'),`${width}-bank-schedule`);
      await accordion(p,p.getByText('Cách nhận lãi',{exact:true}),`${width}-bank-interest`);
     }
     if(id==='bonds'){
      for(const i of [1,0]){await p.locator('.bond-issuer-card').nth(i).click();assert.equal(await p.locator('.bond-issuer-card').nth(i).getAttribute('aria-pressed'),'true');}
      await accordion(p,p.locator('.bond-credit-panel > .trade-details > summary'),`${width}-bonds-details`);
     }
     if(id==='gold'){
      assert.match(await p.locator('.gold-facts').innerText(),/3%/);assert.match(await p.locator('.gold-facts').innerText(),/1%/);
      await accordion(p,p.getByText('Lịch sử giá và thông tin',{exact:true}),`${width}-gold-history`);
     }
     if(id!=='bank')await accordion(p,p.getByText('Xem tín hiệu thị trường',{exact:true}),`${width}-${id}-market`);
     assert.equal(await stored(p),original,'Reading must not mutate state');
     const cta=p.locator('dialog[open] button.primary').first();await cta.scrollIntoViewIfNeeded();
     if(width<=390)await shot(p,`${width}-${id}-cta`);
     const expected=transact(game,id==='bank'?{kind:'deposit',amount:10000000,term:2,symbolId:game.market.stocks[0].id}:id==='bonds'?{kind:'buy',asset:'bonds',issuerId:'an-tam',amount:8000000,completeEncounter:true}:{kind:'buy',asset:'gold',amount:6000000,term:1,symbolId:game.market.stocks[0].id,completeEncounter:true});
     await action(p,game,cta,expected,`${width}-${id}-buy`);
    }
   }
   await p.close();
  }
  if(stage==='after'&&!paymentsOnly){
   const {p,game}=await open(c,'gold-owned');await p.getByRole('button',{name:'Bán',exact:true}).click();
   const quote=saleQuote(game,'gold',game.portfolio.gold),text=norm(await p.locator('.decision-preview').innerText());
   for(const v of [quote.gross,quote.spread,quote.fee,quote.net])assert.ok(text.includes(norm(money(v))));
   await shot(p,`${width}-gold-sale`);
   await action(p,game,p.getByRole('button',{name:/Xác nhận bán/}),transact(game,{kind:'sell',asset:'gold',amount:game.portfolio.gold}),`${width}-gold-sale-exact`);await p.close();
   if(width<=390){for(const id of ['bank-late','bonds-late']){
    const {p,game}=await open(c,id);if(id==='bank-late'){await p.locator('.savings-terms input[value="3"]').check();await p.locator('#trade-amount').fill('1000000');await p.locator('.savings-preview summary').click();}
    assert.match(await p.locator('dialog[open]').innerText(),/sau khi hết ván/i);await shot(p,`${width}-${id}`);await resume(p,game);await p.close();
   }}
  }
  await c.close();
 }
 writeFileSync(`${out}/results.json`,JSON.stringify({stage,browser:await browser.version(),checks,errors,consoleErrors,physicalDevices:false,source:'Local Mobile UI, exact archived replay prefixes; actual UI actions and reload compared with engine snapshots.'},null,2)+'\n');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({stage,checks:checks.length,errors}));
}finally{await browser.close()}
