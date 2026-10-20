import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {gzipSync} from 'node:zlib'
import {pathToFileURL} from 'node:url'
const pw=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE??'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browserName=process.env.RELEASE_QA_BROWSER??'chromium',only=process.env.RELEASE_QA_ONLY
const out=`docs/playtests/b18-release-qa/gameplay${browserName==='chromium'?'':`/${browserName}`}`;mkdirSync(out,{recursive:true})
const mobile='https://boardgame-exe-mobile-preview-7y72c042b-tris-projects-2888207c.vercel.app'
const desktop='https://boardgame-r8ukc7g79-tris-projects-2888207c.vercel.app'
const browser=await pw[browserName].launch({headless:true,executablePath:browserName==='chromium'?(process.env.BROWSER_PATH??'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'):pw[browserName].executablePath()})
const results=[],errors=[],layout=[],findings=[]
const saved=p=>p.evaluate(()=>localStorage.getItem('xvtl:mobile:game:v1'))
const state=async p=>JSON.parse(await saved(p))?.state
const wait=p=>p.waitForTimeout(380)
async function click(p,locator){await wait(p);await locator.click()}
async function shot(p,label){
 const dims=await p.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>({client:e.clientWidth,scroll:e.scrollWidth}))}))
 layout.push({label,...dims});if(dims.scroll>dims.viewport+1||dims.dialogs.some(d=>d.scroll>d.client+1))findings.push({label,type:'horizontal-overflow',...dims})
 await p.screenshot({path:`${out}/${label}.png`})
 const text=await p.evaluate(()=>{const e=(document.querySelector('dialog[open]')??document.body).cloneNode(true);e.querySelectorAll('style,script,.financial-term-popup,.financial-glossary').forEach(x=>x.remove());return e.textContent})
 if(/\bSTART\b|\b(?:deposit|bond|lot)-\d+\b/.test(text))findings.push({label,type:'visible-internal-name'})
 writeFileSync(`${out}/${label}.txt`,await p.locator('body').innerText())
}
async function download(p,button,label){
 const promise=p.waitForEvent('download');await button.click();const d=await promise,stream=await d.createReadStream(),chunks=[]
 for await(const c of stream)chunks.push(c)
 const bytes=Buffer.concat(chunks);writeFileSync(`${out}/${label}.json.gz`,gzipSync(bytes));return JSON.parse(bytes)
}
async function mobileGame(config){
 const {name,width,seed,policy,savings=0,term=3}=config
 const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,reducedMotion:'reduce'}),p=await context.newPage()
 p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push({name,error:e.message}));await context.tracing.start({screenshots:true,snapshots:true})
 const seen=new Set();let completed=false
 try{
  await p.goto(mobile,{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click()
  await p.locator('#initial-savings').fill(String(savings));await p.locator(`.savings-terms input[value="${term}"]`).check()
  await p.getByText('Chơi lại cùng hành trình',{exact:true}).click();await p.locator('#mobile-seed').fill(seed)
  await shot(p,`${name}-setup`);await p.getByRole('button',{name:/Bắt đầu hành trình/}).click();await p.waitForFunction(()=>localStorage.getItem('xvtl:mobile:game:v1'))
  assert.equal((await state(p)).gameplayProfile,'core-mvp-b18-multi-course-v1');assert.equal(await p.locator('[data-b18-tile]').count(),18)
  let banks=0,funds=0,reloaded=false
  for(let step=0;step<240;step++){
   const s=await state(p);console.log(JSON.stringify({name,step,phase:s.phase,event:s.eventId,turn:s.turn,cash:s.portfolio.cash}))
   if(s.phase==='finished'){completed=true;break}
   const d=p.locator('dialog[open]').last();await wait(p)
   if(s.phase==='rolling'){
    if(!reloaded&&s.turn>=2){const before=await saved(p);await p.reload();await p.getByRole('button',{name:/Tiếp tục ván B18/}).click();await wait(p);assert.equal(await saved(p),before);reloaded=true;await shot(p,`${name}-resumed`)}
    await p.getByRole('button',{name:'Gieo xúc xắc',exact:true}).last().click();await p.waitForTimeout(3300)
   }else if(s.phase==='forecast')await click(p,d.getByRole('button',{name:/^Bắt đầu vòng/}))
   else if(s.phase==='summary'){await shot(p,`${name}-summary-${s.lap}`);await click(p,d.getByRole('button',{name:/Ghé ví tại ô Xuất phát/}))}
   else if(s.phase==='rebalancing'){
    const sell=d.getByRole('button',{name:/^Xác nhận bán/})
    if(policy==='trades'&&s.lap===4&&['stocks','bonds','gold'].some(a=>s.portfolio[a]>0)){
     const asset=['stocks','bonds','gold'].find(a=>s.portfolio[a]>0);await d.locator('#sell-asset').selectOption(asset)
     const amount=d.locator('#sell-amount');await amount.fill(String(s.portfolio[asset]))
     if(await sell.count()&&await sell.isEnabled()){await shot(p,`${name}-start-sale-${asset}`);await click(p,sell);continue}
    }
    await click(p,d.getByRole('button',{name:/Hoàn tất · Xem dự báo|Xem kết quả hành trình/}))
   }else if(s.phase==='funding'){
    await shot(p,`${name}-funding-${funds}`)
    const buttons=d.locator('.funding-source'),labels=await buttons.allTextContents()
    const preferred=policy==='credit-funding'&&funds===0?'Vay phần còn thiếu':policy==='credit-funding'?labels.find(x=>x.startsWith('Bán '))??'Rút toàn khoản tiết kiệm':'Rút toàn khoản tiết kiệm'
    const index=labels.findIndex(x=>x.includes(preferred));if(index>=0)await buttons.nth(index).click()
    await shot(p,`${name}-funding-choice-${funds}`);await click(p,d.getByRole('button',{name:/Dùng nguồn tiền này/}));funds++
   }else if(s.phase==='event'){
    if(!seen.has(s.eventId)){await shot(p,`${name}-event-${s.eventId}`);seen.add(s.eventId)}
    const skip=d.getByRole('button',{name:/Bỏ qua cơ hội|Hoàn tất · Về bàn chơi|^Tiếp tục$|^Bỏ qua$|Đã hiểu · Tiếp tục|^Đi tiếp$/}).last()
    if(s.eventId==='course'){
     const order=policy==='advanced-first'?['advanced','basic']:['basic','advanced'],id=order.find(id=>!(s.ownedCourses??[]).includes(id))
     const button=id?d.getByRole('button',{name:id==='basic'?'Mua khóa cơ bản':'Mua khóa nâng cao',exact:true}):null
     if(!['withdrawal','credit-funding','asset-funding'].includes(policy)&&button&&await button.isEnabled())await click(p,button);else await click(p,skip)
    }else if(s.eventId==='bank'&&policy==='savings'&&s.portfolio.cash>10e6){
     const t=++banks%2===1?2:3;await d.locator(`.savings-terms input[value="${t}"]`).check();await d.locator('#trade-amount').fill('6000000');await shot(p,`${name}-term-${t}`);await click(p,d.getByRole('button',{name:/^Gửi tiết kiệm/}))
    }else if(['stocks','bonds','gold'].includes(s.eventId)&&['trades','credit-funding','asset-funding'].includes(policy)){
     const asset=s.eventId
     if(s.portfolio[asset]>0&&policy==='trades'){
      await d.getByRole('button',{name:'Bán',exact:true}).click();const sell=d.getByRole('button',{name:/Xác nhận bán · Nhận/})
      if(await sell.count()&&await sell.isEnabled()){await shot(p,`${name}-sale-${asset}`);await click(p,sell)}else await click(p,skip)
     }else if(s.portfolio.cash>=(policy==='trades'?4e6:1e6)){
      await d.locator('#trade-amount').fill(String(policy==='trades'?2e6:s.portfolio.cash));await click(p,d.getByRole('button',{name:asset==='bonds'?/^Mua trái phiếu/:/^Mua /}))
     }else await click(p,skip)
    }else if(s.eventId==='business'&&policy==='business'){
     const bought=s.log.some(e=>e.decisionId==='buy-business'),upgraded=s.log.some(e=>e.decisionId==='upgrade-business')
     if(!bought&&s.portfolio.cash>=20e6)await click(p,d.getByRole('button',{name:/^Mở quán/}))
     else if(s.portfolio.business>0){const up=d.getByRole('button',{name:/^Nâng cấp /});if(!upgraded&&await up.isEnabled())await click(p,up);else await click(p,d.getByRole('button',{name:/^Bán toàn cơ sở/}))}
     else await click(p,skip)
    }else if(['medical','repair','family'].includes(s.eventId))await click(p,d.getByRole('button',{name:/Thanh toán [345]\./}).first())
    else await click(p,skip)
   }else throw Error(`Unknown phase ${s.phase}`)
  }
  assert.ok(completed,'Must reach a natural result');await shot(p,`${name}-result`)
  await p.getByText('Chi tiết kết quả & nhật ký',{exact:true}).click();const exported=await download(p,p.getByRole('button',{name:'Lưu nhật ký hành trình',exact:true}),name)
  const s=await state(p);assert.equal(exported.state.phase,'finished');assert.equal(exported.state.log.length,s.log.length)
  await click(p,p.getByRole('button',{name:'Chơi hành trình mới',exact:true}));assert.ok(await p.getByRole('button',{name:/Xem lại ván B18 đã kết thúc/}).count());assert.equal(await p.getByRole('button',{name:/Tiếp tục ván B18/}).count(),0)
  results.push({name,...config,url:mobile,actualUi:true,injectedState:false,result:exported.finalResult,stats:exported.financialSummary??exported.statistics,events:[...seen],courses:s.log.filter(e=>e.decisionId?.startsWith('course-')).map(e=>e.decisionId),reloaded,completed:true,endedLabelCorrect:true,logEntries:s.log.length})
 }catch(e){await shot(p,`${name}-FAILURE`);findings.push({name,type:'driver-or-product-failure',error:String(e)});results.push({name,...config,completed:false,error:String(e)})}
 finally{await context.tracing.stop(completed?{}:{path:`${out}/${name}-trace.zip`});await context.close()}
}
async function desktopGame(poor=false,savings=0){
 const name=savings>0?'desktop-savings-victory':poor?'desktop-defeat':'desktop-victory',context=await browser.newContext({viewport:{width:1440,height:1000}}),p=await context.newPage()
 p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push({name,error:e.message}));await context.tracing.start({screenshots:true,snapshots:true})
 try{
  await p.goto(desktop,{waitUntil:'domcontentloaded'});await p.getByText('Tùy chỉnh hành trang',{exact:false}).click();await p.locator('#seed').fill('TRADING-AB-MAIN-0')
  if(savings>0){await p.locator('#allocation').fill(String(savings));await p.locator('#allocation').dispatchEvent('input')}
  await shot(p,`${name}-setup`);await p.getByRole('button',{name:/Bắt đầu hành trình/}).click()
  for(let step=0;step<200;step++){
   const d=p.locator('dialog[open]').last();await p.waitForTimeout(100)
   if(!await d.count()){await p.getByRole('button',{name:/Gieo xúc xắc/}).click();await p.waitForTimeout(600);continue}
   if(await d.getByRole('button',{name:/Chơi một hành trình mới/}).count()){
    await shot(p,`${name}-result`);const log=await download(p,p.getByRole('button',{name:/Tải nhật ký quyết định/}),name)
    assert.equal(log.finalResult.won,savings>0||!poor,'Desktop expected win/loss scenario')
    results.push({name,url:desktop,seed:log.state.seed,actualUi:true,injectedState:false,completed:log.state.phase==='finished',result:log.finalResult,courses:log.state.log.filter(e=>e.decisionId?.startsWith('course-')).map(e=>e.decisionId)});break
   }
   const course=d.getByRole('button',{name:'Mua khóa cơ bản',exact:true}),advanced=d.getByRole('button',{name:'Mua khóa nâng cao',exact:true})
   if(!poor&&await course.count()&&await course.isEnabled())await course.click()
   else if(!poor&&await advanced.count()&&await advanced.isEnabled())await advanced.click()
   else if(await d.getByRole('button',{name:/^Bắt đầu vòng/}).count())await d.getByRole('button',{name:/^Bắt đầu vòng/}).click()
   else if(await d.getByRole('button',{name:/Mở quyền bán tại ô Xuất phát/}).count())await d.getByRole('button',{name:/Mở quyền bán tại ô Xuất phát/}).click()
   else if(await d.getByRole('button',{name:/Hoàn tất|Tiếp tục vòng|Xem kết quả/}).count())await d.getByRole('button',{name:/Hoàn tất|Tiếp tục vòng|Xem kết quả/}).last().click()
   else if(await d.getByRole('button',{name:/Bỏ qua cơ hội|^Tiếp tục$|^Bỏ qua$|Đã hiểu · Tiếp tục|Đã xem tác động/}).count())await d.getByRole('button',{name:/Bỏ qua cơ hội|^Tiếp tục$|^Bỏ qua$|Đã hiểu · Tiếp tục|Đã xem tác động/}).last().click()
   else if(await d.getByRole('button',{name:/Thanh toán [345]\./}).count())await d.getByRole('button',{name:/Thanh toán [345]\./}).first().click()
   else throw Error(`Unknown Desktop dialog: ${await d.innerText()}`)
  }
 }catch(e){await shot(p,`${name}-FAILURE`);results.push({name,completed:false,error:String(e)})}
 finally{await context.tracing.stop(results.some(r=>r.name===name&&r.completed)?{}:{path:`${out}/${name}-trace.zip`});await context.close()}
}
try{
 const configs=[
  {name:'mobile-basic-first',width:320,seed:'TRADING-AB-MAIN-0',policy:'basic-first'},
  {name:'mobile-advanced-first',width:390,seed:'TRADING-AB-MAIN-0',policy:'advanced-first'},
  {name:'mobile-trades',width:390,seed:'B18-UI-TRADES',policy:'trades'},
  {name:'mobile-business',width:768,seed:'TRADING-AB-MAIN-0',policy:'business'},
  {name:'mobile-savings',width:390,seed:'TRADING-AB-MAIN-0',policy:'savings',savings:10e6,term:1},
  {name:'mobile-withdrawal',width:390,seed:'B18-MULTICOURSE-SCREEN-0',policy:'withdrawal',savings:50e6},
  {name:'mobile-credit-funding',width:390,seed:'B18-MULTICOURSE-SCREEN-0',policy:'credit-funding',savings:50e6},
  {name:'mobile-asset-funding',width:390,seed:'RELEASE-ASSET-FUND-3',policy:'asset-funding'},
 ]
 // Independent contexts; all decisions still go through visible UI controls.
 const selected=only?configs.filter(c=>c.name===only):configs
 for(let i=0;i<selected.length;i+=3)await Promise.all(selected.slice(i,i+3).map(mobileGame))
 if(!only||only==='desktop-victory')await desktopGame()
 if(!only||only==='desktop-defeat')await desktopGame(true)
 if(only==='desktop-savings-victory')await desktopGame(true,50e6)
}finally{
 writeFileSync(`${out}/results${only&&browserName==='chromium'?`-${only}`:''}.json`,JSON.stringify({browser:browserName,results,errors,layout,findings,actualPreview:true,humanPlaytest:false},null,2)+'\n')
 await browser.close()
}
console.log(JSON.stringify({games:results.length,completed:results.filter(r=>r.completed).length,errors:errors.length,findings:findings.length}))
