import {mkdirSync,writeFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE??'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const after=process.argv.includes('--after'),stage=after?'after':'before',out=`docs/playtests/b18-language-cleanup/${stage}`;mkdirSync(out,{recursive:true})
const b=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH??'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'})
const checks=[],errors=[]
const hash=text=>createHash('sha256').update(text).digest('hex')
const stored=p=>p.evaluate(()=>localStorage.getItem('xvtl:mobile:game:v1'))
async function shot(p,label){const d=await p.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>({scroll:d.scrollWidth,client:d.clientWidth}))}));assert.ok(d.scroll<=d.w+1,label);for(const x of d.dialogs)assert.ok(x.scroll<=x.client+1,label);await p.screenshot({path:`${out}/${label}.png`});checks.push({label,...d})}
async function audit(p,label){
 const data=await p.evaluate(()=>{const root=document.querySelector('dialog[open]')??document.body;const technical=[...root.querySelectorAll('.financial-glossary,pre,.log-snapshots')];const copy=root.cloneNode(true);for(const selector of ['.financial-glossary','pre','.log-snapshots','.financial-term-popup','style','script'])copy.querySelectorAll(selector).forEach(e=>e.remove());const labels=[...copy.querySelectorAll('[aria-label],[alt],[title]')].flatMap(e=>['aria-label','alt','title'].map(a=>e.getAttribute(a)).filter(Boolean));return {text:copy.textContent+'\n'+labels.join('\n'),technicalSections:technical.length}})
 writeFileSync(`${out}/${label}-visible.txt`,data.text+'\n')
 if(after){assert.doesNotMatch(data.text,/\bSTART\b|\b(?:deposit|bond|lot)-\d+\b|\blãi mô phỏng\/vòng\b/,label)}
 checks.push({label,visibleAudit:true,technicalSections:data.technicalSections})
}
async function wallet(p,width,desktop=false){
 const prefix=desktop?'desktop':String(width)
 await p.locator('.deposit-list').last().scrollIntoViewIfNeeded();await shot(p,`${prefix}-wallet-deposits`);await audit(p,`${prefix}-wallet`)
 await p.locator('.cashflow').last().scrollIntoViewIfNeeded();await shot(p,`${prefix}-wallet-cashflow`)
 if(after){
  const rows=await p.locator('.cashflow').last().evaluate(e=>[...e.querySelectorAll('dl > div')].map(r=>{const a=r.querySelector('dt').getBoundingClientRect(),v=r.querySelector('dd').getBoundingClientRect();return {gap:v.left-a.right,stacked:v.top>=a.bottom-1,overflow:r.scrollWidth>r.clientWidth}}))
  assert.ok(rows.length>0);assert.ok(rows.every(r=>!r.overflow&&(r.gap>=7||r.stacked)));checks.push({label:`${prefix}-cashflow-spacing`,rows})
  const labels=await p.locator('.deposit-list h3').last().locator('..').locator('..').locator('h3').allTextContents()
  assert.ok(labels.includes('Khoản tiết kiệm 1')&&labels.includes('Khoản tiết kiệm 2'))
  assert.match(await p.locator('.deposit-list').last().innerText(),/lần thứ 3/);assert.match(await p.locator('.deposit-list').last().innerText(),/lần thứ 2/)
  const goal=await p.locator('.goal-track-summary').last().evaluate(e=>{const a=e.querySelector('span').getBoundingClientRect(),v=e.querySelector('strong').getBoundingClientRect();return {gap:v.left-a.right,stacked:v.top>=a.bottom-1}})
  assert.ok(goal.gap>=7||goal.stacked);checks.push({label:`${prefix}-goal-spacing`,...goal})
 }
}
try{
 for(const width of [320,390]){
  const c=await b.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message))
  await p.goto(process.env.LANGUAGE_MOBILE_URL??'http://127.0.0.1:5200',{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click()
  await p.getByRole('button',{name:'10 triệu',exact:true}).click();await p.locator('.savings-terms').scrollIntoViewIfNeeded();await shot(p,`${width}-setup-terms`);await audit(p,`${width}-setup`)
  await p.getByText('Chơi lại cùng hành trình',{exact:true}).click();await p.locator('#mobile-seed').fill('LANG-0');await p.getByRole('button',{name:/Bắt đầu hành trình/}).click();if(after)await audit(p,`${width}-bulletin`);await p.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click()
  await p.waitForTimeout(350);await p.getByRole('button',{name:'Gieo xúc xắc',exact:true}).last().click();await p.waitForTimeout(3300)
  await p.locator('.savings-terms input[value="2"]').check();await p.locator('.savings-terms').scrollIntoViewIfNeeded();await shot(p,`${width}-bank-terms`);await audit(p,`${width}-bank`)
  await p.locator('#trade-amount').fill('6000000');await p.getByRole('button',{name:/^Gửi tiết kiệm/}).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('xvtl:mobile:game:v1'))?.state.deposits.length===2)
  const before=await stored(p);await p.getByTitle('Ví Tài Sản',{exact:true}).click();await wallet(p,width)
  await p.getByRole('button',{name:'Đóng',exact:true}).click();assert.equal(await stored(p),before);await p.reload();await p.getByRole('button',{name:/Tiếp tục ván B18/}).click();assert.equal(await stored(p),before)
  checks.push({label:`${width}-save-reload-stable`,stateHash:hash(before),stateUnchanged:true})
  if(after){
   const seen=new Set();for(const tile of await p.locator('[data-b18-tile]').all()){const name=(await tile.getAttribute('aria-label')).split(': ')[1];if(seen.has(name))continue;seen.add(name);await tile.dispatchEvent('click');await audit(p,`${width}-tile-${seen.size}`);await p.getByRole('button',{name:'Trở về bàn',exact:true}).click()}assert.equal(seen.size,9);assert.equal(await stored(p),before)
   await p.getByRole('button',{name:'Mở sổ tay',exact:true}).first().click();for(const tab of await p.getByRole('tab').all()){await tab.click();await audit(p,`${width}-handbook-${await tab.getAttribute('id')}`)}
   await p.getByRole('tab',{name:'Đầu tư',exact:true}).click();await p.getByText('Giải thích thuật ngữ',{exact:true}).click();assert.ok(await p.locator('.financial-glossary dt').getByText('Ô Xuất phát',{exact:true}).count());await p.getByRole('button',{name:'Đóng sổ tay',exact:true}).click();assert.equal(await stored(p),before)
  }
  await c.close()
 }
 const c=await b.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.LANGUAGE_DESKTOP_URL??'http://127.0.0.1:5201',{waitUntil:'domcontentloaded'})
 await p.getByText('Tùy chỉnh hành trang',{exact:false}).click();await p.locator('#allocation').fill('10000000');await p.locator('#allocation').dispatchEvent('input');await p.locator('#seed').fill('LANG-0');await p.locator('#initial-term').scrollIntoViewIfNeeded();await shot(p,'desktop-setup-terms');await audit(p,'desktop-setup')
 await p.getByRole('button',{name:/Bắt đầu hành trình/}).click();await p.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click();await p.getByRole('button',{name:/Gieo xúc xắc/}).click();await p.waitForTimeout(650)
 await p.locator('#deposit-term').selectOption('2');await shot(p,'desktop-bank-terms');await audit(p,'desktop-bank');await p.locator('#trade-amount').fill('6000000');await p.getByRole('button',{name:/Xác nhận gửi khoản mới/}).click();await wallet(p,1440,true);await c.close()
 assert.deepEqual(errors,[]);writeFileSync(`${out}/browser-checks.json`,JSON.stringify({stage,seed:'LANG-0',screenshots:checks.filter(c=>c.w).length,checks,errors,actualUi:true},null,2)+'\n');console.log(JSON.stringify({stage,checks:checks.length,errors}))
}catch(error){const p=b.contexts().at(-1)?.pages().at(-1);if(p){await p.screenshot({path:`${out}/diagnostic-failure.png`});writeFileSync(`${out}/diagnostic-failure.txt`,await p.locator('body').innerText())}throw error}finally{await b.close()}
