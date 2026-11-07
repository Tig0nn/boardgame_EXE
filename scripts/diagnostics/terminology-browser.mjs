import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE??'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH??'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'})
const out='docs/playtests/b18-terminology/after';mkdirSync(out,{recursive:true})
const checks=[],errors=[]
const stored=p=>p.evaluate(()=>localStorage.getItem('xvtl:mobile:game:v1'))
async function bounds(p,label){
 const result=await p.evaluate(()=>{
  const tip=document.querySelector('.financial-term-popup:popover-open'),rect=tip?.getBoundingClientRect(),dialog=document.querySelector('dialog[open]')
  const actions=[...(dialog??document).querySelectorAll('.button')].filter(b=>b.getClientRects().length&&!b.disabled).map(b=>b.getBoundingClientRect()).filter(b=>b.top<innerHeight&&b.bottom>0)
  return {width:innerWidth,scroll:document.documentElement.scrollWidth,tip:rect?{x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom,height:rect.height,font:getComputedStyle(tip.querySelector('span')).fontSize,color:getComputedStyle(tip.querySelector('span')).color}:null,overlaps:rect?actions.filter(a=>rect.left<a.right&&rect.right>a.left&&rect.top<a.bottom&&rect.bottom>a.top).length:0,dialogOverflow:dialog?dialog.scrollWidth>dialog.clientWidth+1:false}
 })
 assert.ok(result.scroll<=result.width+1,`${label}: horizontal overflow`);assert.equal(result.dialogOverflow,false,label)
 if(result.tip){assert.ok(result.tip.x>=0&&result.tip.right<=result.width&&result.tip.y>=0,label);assert.ok(result.tip.height>=40,label);assert.equal(result.overlaps,0,`${label}: action covered`);assert.equal(result.tip.font,'14px',`${label}: readable explanation`)}
 checks.push({label,...result})
}
async function openTap(p,button,label){await button.tap();await p.waitForTimeout(80);await bounds(p,label);assert.equal(await p.locator('.financial-term-popup:popover-open').count(),1)}
try{
 for(const width of [320,390]){
  const c=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message))
  await p.goto(process.env.B18_URL??'http://127.0.0.1:5200',{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click()
  await p.getByText('Mở ván đã lưu',{exact:true}).click();await p.locator('#saved-game-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{invalid')})
  assert.match(await p.getByRole('alert').innerText(),/Không đọc được tệp JSON/);checks.push({label:`${width}-invalid-import-vietnamese`,friendlyError:true});await p.getByText('Mở ván đã lưu',{exact:true}).click()
  await p.getByText('Chơi lại cùng hành trình',{exact:true}).click();await p.locator('#mobile-seed').fill('TERMS-1');await p.getByRole('button',{name:/Bắt đầu hành trình/}).click();await p.waitForTimeout(400)
  const before=await stored(p),coupon=p.getByRole('button',{name:'Giải thích: Lãi trái phiếu định kỳ',exact:true}).first()
  await openTap(p,coupon,`${width}-bulletin-tap`);await p.screenshot({path:`${out}/${width}-tooltip-bulletin.png`})
  await p.locator('dialog[open] h2').tap();await p.waitForTimeout(200);assert.equal(await p.locator('.financial-term-popup:popover-open').count(),0)
  await openTap(p,p.getByRole('button',{name:'Giải thích: Tổ chức phát hành',exact:true}).first(),`${width}-issuer-tap`);await p.keyboard.press('Escape');assert.equal(await p.locator('dialog[open]').count(),1)
  await p.waitForTimeout(200);assert.equal(await stored(p),before,'tooltip must not persist financial/UI changes into saved game')
  await p.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click();await p.waitForTimeout(300)
  const boardBefore=await stored(p),seen=new Set()
  for(const tile of await p.locator('[data-b18-tile]').all()){
   const label=(await tile.getAttribute('aria-label')).split(': ')[1];if(seen.has(label))continue;seen.add(label)
   await tile.dispatchEvent('click');const dialog=p.locator('dialog[open]').last();await bounds(p,`${width}-tile-${label}`)
   assert.ok((await dialog.innerText()).length>80);await p.getByRole('button',{name:'Trở về bàn',exact:true}).click()
  }
  assert.equal(seen.size,9);assert.equal(await stored(p),boardBefore)
  checks.push({label:`${width}-all-nine-tile-types`,types:[...seen],unchangedState:true})
  await p.getByRole('button',{name:'Gieo xúc xắc',exact:true}).last().click();await p.waitForTimeout(3300)
  assert.equal(await p.locator('.bond-credit-panel').count(),1);const bondBefore=await stored(p)
  await openTap(p,p.getByRole('button',{name:'Giải thích: Mệnh giá',exact:true}).first(),`${width}-bond-face-value`)
  await p.screenshot({path:`${out}/${width}-tooltip-bond.png`});await p.keyboard.press('Escape')
  await p.getByText('Tín dụng, kỳ hạn & cách rút vốn',{exact:true}).click()
  await openTap(p,p.getByRole('button',{name:'Giải thích: Xếp hạng tín nhiệm',exact:true}).first(),`${width}-bond-scroll-rating`)
  await p.locator('dialog[open]').evaluate(d=>d.scrollTop+=80);await bounds(p,`${width}-tooltip-on-scroll`)
  await p.keyboard.press('Escape');assert.equal(await stored(p),bondBefore)
  // The same save is resumed by the real app; glossary state is intentionally transient.
  await p.reload();await p.getByRole('button',{name:/Tiếp tục ván B18/}).click();await p.waitForTimeout(300);assert.equal(await stored(p),bondBefore)
  await p.getByRole('button',{name:'Mở sổ tay',exact:true}).last().click();await p.getByRole('tab',{name:'Đầu tư',exact:true}).click();await p.getByText('Giải thích thuật ngữ',{exact:true}).click()
  assert.equal(await p.locator('.financial-glossary dt').count(),13);await bounds(p,`${width}-full-glossary`)
  await p.locator('.financial-glossary dd').last().scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/${width}-glossary-scroll.png`})
  await p.getByRole('button',{name:'Đóng sổ tay',exact:true}).click();assert.equal(await stored(p),bondBefore);await c.close()
 }
 const c=await browser.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message))
 await p.goto(process.env.B18_DESKTOP_URL??'http://127.0.0.1:5201',{waitUntil:'domcontentloaded'});await p.getByText('Tùy chỉnh hành trang',{exact:false}).click();await p.locator('#seed').fill('TERMS-1');await p.getByRole('button',{name:/Bắt đầu hành trình/}).click()
 let term=p.getByRole('button',{name:'Giải thích: Lãi trái phiếu định kỳ',exact:true}).first()
 await term.hover();await p.waitForTimeout(100);await bounds(p,'desktop-hover');assert.equal(await p.locator('.financial-term-popup:popover-open').count(),1)
 await p.locator('dialog[open] h2').hover();await p.waitForTimeout(200);assert.equal(await p.locator('.financial-term-popup:popover-open').count(),0)
 await p.locator('dialog[open]').focus();let tabbed=false
 for(let n=0;n<15;n++){await p.keyboard.press('Tab');if(await term.evaluate(e=>e===document.activeElement)){tabbed=true;break}}
 assert.equal(tabbed,true);await bounds(p,'desktop-tab-focus')
 await p.keyboard.press('Escape');assert.equal(await term.getAttribute('aria-expanded'),'false')
 for(const key of ['Enter',' ','Escape']){await p.keyboard.press(key);await p.waitForTimeout(30);assert.equal(await term.getAttribute('aria-expanded'),key==='Escape'?'false':'true')}
 assert.equal(await p.locator('dialog[open]').count(),1)
 await p.keyboard.press('Enter');await p.waitForTimeout(70);assert.equal(await p.locator('.financial-term-popup:popover-open').count(),1);await p.screenshot({path:`${out}/desktop-keyboard-tooltip.png`});await p.locator('dialog[open] h2').click();await p.waitForTimeout(150);assert.equal(await p.locator('.financial-term-popup:popover-open').count(),0)
 await p.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click();await p.getByRole('button',{name:/Gieo xúc xắc/}).click();await p.waitForTimeout(650)
 term=p.getByRole('button',{name:'Giải thích: Lãi trái phiếu định kỳ',exact:true}).first();await term.hover();await bounds(p,'desktop-bond-modal');await p.keyboard.press('Escape');await c.close()
 // Import genuine historical delayed/default checkpoints, derived by replay (no injected states).
 for(const name of ['delayed','defaulted']){
  const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message))
  await p.goto(process.env.B18_URL??'http://127.0.0.1:5200',{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click();await p.getByText('Mở ván đã lưu',{exact:true}).click()
  await p.locator('#saved-game-file').setInputFiles({name:`${name}.json`,mimeType:'application/json',buffer:readFileSync(`docs/playtests/b18-terminology/${name}-checkpoint.json`)})
  await p.waitForFunction(()=>localStorage.getItem('xvtl:mobile:game:v1')!==null);const original=await stored(p)
  await p.getByText('Chi tiết các khoản trái phiếu',{exact:true}).click();const coupon=p.getByRole('button',{name:'Giải thích: Lãi trái phiếu định kỳ',exact:true}).last();await coupon.click();await bounds(p,`${name}-credit-summary`)
  assert.match(await p.locator('dialog[open]').innerText(),name==='defaulted'?/Vỡ nợ/:/chậm trả/i)
  await p.screenshot({path:`${out}/${name}-credit.png`});await p.keyboard.press('Escape');assert.equal(await stored(p),original);await c.close()
 }
 // Financial result after screenshot uses an actual finished exported game.
 const r=await browser.newPage({viewport:{width:1440,height:1000}});r.on('pageerror',e=>errors.push(e.message));await r.goto(process.env.B18_URL??'http://127.0.0.1:5200',{waitUntil:'domcontentloaded'});await r.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click();await r.getByText('Mở ván đã lưu',{exact:true}).click();await r.locator('#saved-game-file').setInputFiles({name:'result.json',mimeType:'application/json',buffer:gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz'))});await r.getByRole('button',{name:/Giải thích: Giá trị huy động hợp lệ/}).click();await bounds(r,'wide-mobile-result-glossary');await r.screenshot({path:`${out}/mobile-wide-result.png`});await r.close()
 assert.deepEqual(errors,[]);writeFileSync(`${out}/browser-checks.json`,JSON.stringify({checks,errors,realUi:true,financialStateUnchanged:true},null,2)+'\n');console.log(JSON.stringify({checks:checks.length,errors}))
}finally{await browser.close()}
