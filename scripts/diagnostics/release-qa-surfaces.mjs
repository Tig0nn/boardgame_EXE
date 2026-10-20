import {mkdirSync,writeFileSync,existsSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const pw=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE??'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const out='docs/playtests/b18-release-qa/surfaces';mkdirSync(out,{recursive:true})
const urls={mobile:'https://boardgame-exe-mobile-preview-7y72c042b-tris-projects-2888207c.vercel.app',desktop:'https://boardgame-r8ukc7g79-tris-projects-2888207c.vercel.app'}
const checks=[],issues=[],errors=[]
async function record(p,label){
 const data=await p.evaluate(()=>{
  const dialog=document.querySelector('dialog[open]'),tip=document.querySelector('.financial-term-popup:popover-open'),r=tip?.getBoundingClientRect()
  const actions=[...(dialog??document).querySelectorAll('.button')].filter(e=>!e.disabled&&e.getClientRects().length).map(e=>e.getBoundingClientRect()).filter(r=>r.top<innerHeight&&r.bottom>0)
  const copy=(dialog??document.body).cloneNode(true);copy.querySelectorAll('style,script,.financial-term-popup,.financial-glossary').forEach(e=>e.remove())
  return {viewport:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,modalOverflow:dialog?dialog.scrollWidth>dialog.clientWidth+1:false,tip:r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom}:null,overlaps:r?actions.filter(a=>r.left<a.right&&r.right>a.left&&r.top<a.bottom&&r.bottom>a.top).length:0,text:copy.textContent}
 })
 const {text,...dims}=data;checks.push({label,...dims})
 if(dims.scroll>dims.viewport+1||dims.modalOverflow||dims.overlaps>0||(dims.tip&&(dims.tip.left<0||dims.tip.right>dims.viewport+1||dims.tip.top<0)))issues.push({label,type:'layout',...dims})
 if(/\bSTART\b|\b(?:deposit|bond|lot)-\d+\b/.test(text))issues.push({label,type:'language'})
 await p.screenshot({path:`${out}/${label}.png`});writeFileSync(`${out}/${label}.txt`,await p.locator('body').innerText())
}
for(const name of ['chromium','firefox','webkit']){
 const executable=name==='chromium'?'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe':pw[name].executablePath()
 if(!existsSync(executable)){issues.push({browser:name,type:'unavailable',status:'BLOCKED'});continue}
 let b
 try{
  b=await pw[name].launch({headless:true,executablePath:executable})
  for(const width of [320,390,768,1440])for(const [kind,url]of Object.entries(urls)){
   const label=`${name}-${kind}-${width}`,c=await b.newContext({viewport:{width,height:844},hasTouch:true}),p=await c.newPage()
   p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push({label,error:e.message}))
   try{
    await p.goto(url,{waitUntil:'domcontentloaded'});await p.waitForTimeout(500)
    if(kind==='mobile'){
     if(width===320){for(let i=0;i<6;i++){await record(p,`${label}-onboarding-${i+1}`);await p.getByRole('button',{name:i===5?'Sẵn sàng chơi!':'Tiếp theo →',exact:true}).click()}}
     else await p.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click()
     await record(p,`${label}-setup`);await p.getByText('Chơi lại cùng hành trình',{exact:true}).click();await p.locator('#mobile-seed').fill('TERMS-1')
    }else{await p.getByText('Tùy chỉnh hành trang',{exact:false}).click();await record(p,`${label}-setup`);await p.locator('#seed').fill('TERMS-1')}
    await p.getByRole('button',{name:/Bắt đầu hành trình/}).click();await p.waitForTimeout(400)
    const term=p.getByRole('button',{name:'Giải thích: Lãi trái phiếu định kỳ',exact:true}).first()
    if(width<768)await term.tap();else await term.hover()
    await p.waitForTimeout(100);assert.equal(await p.locator('.financial-term-popup:popover-open').count(),1)
    await record(p,`${label}-tooltip-${width<768?'touch':'hover'}`)
    await p.keyboard.press('Escape');assert.equal(await p.locator('dialog[open]').count(),1);assert.equal(await term.getAttribute('aria-expanded'),'false')
    await p.locator('dialog[open]').focus();let tabbed=false
    for(let i=0;i<18;i++){await p.keyboard.press('Tab');if(await term.evaluate(e=>e===document.activeElement)){tabbed=true;break}}
    assert.ok(tabbed,'Tooltip reachable using Tab');await p.keyboard.press('Enter');await p.waitForTimeout(50)
    assert.equal(await term.getAttribute('aria-expanded'),'true');await p.keyboard.press('Escape');assert.equal(await p.locator('dialog[open]').count(),1)
    checks.push({label:`${label}-keyboard`,tabbed,enterOpened:true,escapeKeptParent:true})
    const start=p.getByRole('button',{name:'Bắt đầu vòng 1',exact:true});await start.click({trial:true})
    await start.click();await p.waitForTimeout(380)
    if(kind==='mobile'){
     if(width===320||width===390){const before=await p.evaluate(()=>localStorage.getItem('xvtl:mobile:game:v1')),seen=new Set()
      for(const tile of await p.locator('[data-b18-tile]').all()){
       const type=(await tile.getAttribute('aria-label')).split(': ')[1];if(seen.has(type))continue;seen.add(type)
       await tile.focus();await p.keyboard.press('Enter');await record(p,`${label}-tile-${seen.size}`);await p.getByRole('button',{name:'Trở về bàn',exact:true}).click()
      }
      assert.equal(seen.size,9);assert.equal(await p.evaluate(()=>localStorage.getItem('xvtl:mobile:game:v1')),before)
     }
     await p.getByRole('button',{name:'Gieo xúc xắc',exact:true}).last().click();await p.waitForTimeout(3300)
    }else{await p.getByRole('button',{name:/Gieo xúc xắc/}).click();await p.waitForTimeout(650)}
    await record(p,`${label}-bond-dialog`)
    const buy=p.locator('dialog[open]').getByRole('button',{name:/^Mua trái phiếu/});await buy.click({trial:true})
    checks.push({label:`${label}-cta`,reachable:true})
    await p.setViewportSize({width:844,height:width});await record(p,`${label}-landscape`)
    await p.setViewportSize({width,height:420});const amount=p.locator('#trade-amount');await amount.focus();await buy.click({trial:true});await record(p,`${label}-short-height`)
    checks.push({label:`${label}-height-simulation`,actualVirtualKeyboard:false,ctaReachable:true})
    if(name==='chromium'&&width===1440){await p.setViewportSize({width,height:844});await p.evaluate(()=>document.documentElement.style.zoom='2');await buy.click({trial:true});await record(p,`${label}-css-zoom-200`);checks.push({label:`${label}-zoom`,method:'CSS zoom 200%, not native browser zoom'})}
   }catch(e){issues.push({label,type:'check-failure',error:String(e)});await record(p,`${label}-FAILURE`).catch(()=>{})}
   finally{await c.close()}
  }
 }catch(e){issues.push({browser:name,type:'launch-failure',status:'BLOCKED',error:String(e)})}finally{await b?.close()}
}
writeFileSync(`${out}/results.json`,JSON.stringify({checks,issues,errors,realPreviews:true,physicalDevices:false,nativeSafari:false,virtualKeyboard:false},null,2)+'\n')
console.log(JSON.stringify({checks:checks.length,issues:issues.length,errors:errors.length}))
