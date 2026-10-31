import { mkdirSync,writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright')
const out='docs/playtests/core-mvp-b18-multi-course';mkdirSync(out,{recursive:true})
const browser=await chromium.launch({headless:true,...process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{}})
const results=[],errors=[],layout=[]
const state=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('xvtl:mobile:game:v1'))?.state)
async function check(page,label){
  const dims=await page.evaluate(()=>({viewport:innerWidth,body:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>({width:e.getBoundingClientRect().width,scroll:e.scrollWidth,client:e.clientWidth}))}))
  assert.ok(dims.body<=dims.viewport+1,`${label}: page overflow`)
  for(const d of dims.dialogs)assert.ok(d.width<=dims.viewport&&d.scroll<=d.client+1,`${label}: dialog overflow`)
  layout.push({label,...dims});await page.screenshot({path:`${out}/${label}.png`})
}
async function exportSaved(page){
  return page.evaluate(async root=>{
    const {restoreSavedGame}=await import(`${root}/src/game/saved-game.ts`)
    const {serializeLog}=await import(`${root}/src/game/log.ts`)
    return serializeLog(restoreSavedGame(localStorage.getItem('xvtl:mobile:game:v1')))
  },`/@fs/${process.cwd().replaceAll('\\','/')}`)
}
async function game(width,policy,seed){
  const context=await browser.newContext({viewport:{width,height:width===320?740:844},reducedMotion:'reduce'}),page=await context.newPage()
  page.setDefaultTimeout(15_000);page.on('pageerror',e=>errors.push({width,policy,error:e.message}))
  await page.goto(process.env.B18_URL??'http://localhost:5174',{waitUntil:'domcontentloaded',timeout:30_000});await page.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click()
  await check(page,`${width}-${policy}-setup`)
  if(policy==='cash'){
    await page.getByRole('button',{name:'Mở sổ tay',exact:true}).last().click()
    for(const tab of ['Mục tiêu','Bàn cờ','Lượt chơi','Đầu tư','Rủi ro','START']){await page.getByRole('tab',{name:tab,exact:true}).click();await check(page,`${width}-rulebook-${tab==='Bàn cờ'?'board':tab==='Mục tiêu'?'goal':tab==='Đầu tư'?'investments':tab==='Rủi ro'?'risk':tab==='Lượt chơi'?'turn':'start'}`)}
    await page.getByRole('button',{name:'Đóng sổ tay',exact:true}).click()
  }
  await page.getByText('Chơi lại cùng hành trình',{exact:true}).click();await page.locator('#mobile-seed').fill(seed)
  await page.getByRole('button',{name:/Bắt đầu hành trình/}).click()
  await page.waitForFunction(()=>!!localStorage.getItem('xvtl:mobile:game:v1'))
  assert.equal((await state(page)).boardLayout,'B18');assert.equal((await state(page)).gameplayProfile,'core-mvp-b18-multi-course-v1');assert.equal(await page.locator('[data-b18-tile="15"]').getAttribute('aria-label'),'Ô 16: Trái phiếu')
  assert.equal(await page.locator('[data-b18-tile]').count(),18)
  assert.equal(await page.locator('img[src*="playboard"]').count(),0)
  if(process.argv.includes('--smoke')){await check(page,`${width}-forecast`);await context.close();return}
  const seen=new Set();let steps=0,boardCaptured=false
  while(steps++<220){
    const s=await state(page);if(s.phase==='finished')break
    console.log(JSON.stringify({width,policy,step:steps,phase:s.phase,turn:s.turn,event:s.eventId}))
    await page.waitForTimeout(350)
    const dialog=page.locator('dialog[open]').last()
    if(s.phase==='rolling'){
      if(!boardCaptured){await check(page,`${width}-${policy}-board`);await page.locator('button[title="Ví Tài Sản"]').click();await check(page,`${width}-${policy}-wallet`);await page.getByRole('button',{name:'Đóng',exact:true}).last().click();boardCaptured=true}
      await page.getByRole('button',{name:'Gieo xúc xắc',exact:true}).last().click()
      await page.waitForTimeout(3300)
    }else if(s.phase==='forecast'){
      await dialog.getByRole('button',{name:`Bắt đầu vòng ${s.lap}`,exact:true}).click()
    }else if(s.phase==='summary'){
      await check(page,`${width}-${policy}-START${s.lap}`)
      await dialog.getByRole('button',{name:/Ghé ví tại START/}).click()
      console.log(JSON.stringify({width,policy,completedLap:s.lap}))
    }else if(s.phase==='rebalancing'){
      await dialog.getByRole('button',{name:s.lap===4?/Xem kết quả hành trình/:/Hoàn tất · Xem dự báo/}).click()
    }else if(s.phase==='event'){
      if(!seen.has(s.eventId)){await check(page,`${width}-${policy}-event-${s.eventId}`);seen.add(s.eventId)}
      const skip=dialog.getByRole('button',{name:/Bỏ qua cơ hội|Hoàn tất · Về bàn chơi|^Tiếp tục$|^Bỏ qua$/}).last()
      if(s.eventId==='course'){
        const owned=s.ownedCourses??[],label=owned.length===0?'unlearned':owned.length===1?'one':'both'
        if(!seen.has('course-'+label)){await check(page,`${width}-${policy}-course-${label}`);seen.add('course-'+label)}
        const ids=policy==='advanced-first'?['advanced','basic']:['basic','advanced']
        const id=ids.find(id=>!owned.includes(id)&&s.portfolio.cash>=(id==='basic'?6e6:10e6))
        if(id){await dialog.getByRole('button',{name:id==='basic'?'Mua khóa cơ bản':'Mua khóa nâng cao',exact:true}).click()
          await page.waitForTimeout(400)
          const learned=await state(page);assert.equal(learned.ownedCourses.length,owned.length+1)
          if(owned.length===0){await page.reload();await page.getByRole('button',{name:/Tiếp tục ván B18/}).click();await page.waitForTimeout(400);assert.deepEqual((await state(page)).ownedCourses,learned.ownedCourses)}
        }else await skip.click()
      }
      else if(s.eventId==='bank'&&policy==='savings'&&s.portfolio.cash>11e6){
        const amount=Math.floor((s.portfolio.cash-10e6)*.85);await dialog.locator('#trade-amount').fill(String(amount));await dialog.getByRole('radio',{name:/^1 START/}).check();await dialog.getByRole('button',{name:/^Gửi tiết kiệm/}).click()
      }else if(['stocks','bonds','gold'].includes(s.eventId)&&policy==='trades'){
        const asset=s.eventId
        if(s.portfolio[asset]>0){
          await dialog.getByRole('button',{name:'Bán',exact:true}).click()
          const sell=dialog.getByRole('button',{name:/Xác nhận bán · Nhận/})
          if(await sell.count()&&await sell.isEnabled()){await check(page,`${width}-sale-preview-${asset}`);await sell.click()}else await skip.click()
        }else if(s.portfolio.cash>12e6){await dialog.locator('#trade-amount').fill('2000000');await dialog.getByRole('button',{name:asset==='bonds'?/^Mua trái phiếu/:/^Mua /}).click()}
        else await skip.click()
      }else if(['medical','family','repair'].includes(s.eventId)){
        await dialog.getByRole('button',{name:s.eventId==='repair'?/Thanh toán 4\./:s.eventId==='family'?/Thanh toán 3\./:/Thanh toán 5\./}).click()
      }else if(await skip.count())await skip.click()
      else await dialog.getByRole('button',{name:/^Đi tiếp$|Đã hiểu · Tiếp tục/}).click()
    }else if(s.phase==='funding'){
      await check(page,`${width}-${policy}-funding`)
      await dialog.getByRole('button',{name:/Dùng nguồn tiền này/}).click()
    }else throw Error(`Unknown phase ${s.phase}`)
    await page.waitForTimeout(100)
  }
  const s=await state(page);assert.equal(s.phase,'finished');assert.equal(s.summaries.length,4)
  await check(page,`${width}-${policy}-result`)
  const text=await page.locator('dialog[open]').last().innerText()
  assert.ok(!/Món đồ|80 triệu|Dự phòng 10/.test(text))
  const saved=await exportSaved(page)
  writeFileSync(`${out}/browser-${width}-${policy}.json.gz`,gzipSync(saved))
  results.push({width,policy,seed,courses:s.log.filter(e=>e.decisionId?.startsWith('course-')).map(e=>({id:e.decisionId,turn:e.turn,lap:e.lap,fee:e.expensePaid,boost:e.recurringIncomeDelta})),turns:s.turn,events:[...seen],result:JSON.parse(saved).finalResult})
  await page.reload();await page.getByRole('button',{name:/Tiếp tục ván B18/}).click();assert.deepEqual((await state(page)).portfolio,s.portfolio)
  await context.close()
}
async function rules(width){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage()
  page.on('pageerror',e=>errors.push({width,rules:true,error:e.message}))
  await page.goto(process.env.B18_URL,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click()
  await page.getByRole('button',{name:'Mở sổ tay',exact:true}).last().click()
  for(const [i,tab] of ['Mục tiêu','Bàn cờ','Lượt chơi','Đầu tư','Rủi ro','START'].entries()){
    await page.getByRole('tab',{name:tab,exact:true}).click();await check(page,`${width}-multi-rulebook-${i}`)
    if(tab==='Đầu tư'){const text=await page.locator('dialog[open]').last().innerText();assert.match(text,/cơ bản 6M \/ \+2M/);assert.match(text,/nâng cao 10M \/ \+4M/);assert.match(text,/không vay mới/)}
    if(tab==='Bàn cờ')assert.match(await page.locator('dialog[open]').last().innerText(),/Trái phiếu/)
  }
  await page.getByRole('button',{name:'Đóng sổ tay',exact:true}).click()
  await page.getByRole('button',{name:/Bắt đầu hành trình/}).click();await page.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click()
  const tile=page.locator('[data-b18-tile="15"]');await tile.focus();await page.keyboard.press('Enter')
  assert.match(await page.locator('dialog[open]').last().innerText(),/Chỉ kích hoạt khi dừng đúng ô/);await check(page,`${width}-tile16-bonds-details`)
  await page.getByRole('button',{name:'Trở về bàn',exact:true}).click()
  results.push({width,flow:'rulebook-and-keyboard-tile16',tabs:6});await context.close()
}
async function poor(width){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage()
  page.on('pageerror',e=>errors.push({width,poor:true,error:e.message}))
  await page.goto(process.env.B18_URL,{waitUntil:'domcontentloaded'})
  await page.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click()
  await page.getByRole('button',{name:'50 triệu',exact:true}).click()
  await page.getByText('Chơi lại cùng hành trình',{exact:true}).click();await page.locator('#mobile-seed').fill('TRADING-AB-MAIN-0')
  await page.getByRole('button',{name:/Bắt đầu hành trình/}).click();await page.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click()
  for(let i=0;i<5;i++){
    await page.waitForTimeout(400);const s=await state(page)
    if(s.phase==='event'&&s.eventId==='course')break
    if(s.phase==='rolling'){await page.getByRole('button',{name:'Gieo xúc xắc',exact:true}).last().click();await page.waitForTimeout(3300)}
    else await page.locator('dialog[open]').last().getByRole('button',{name:/Đã hiểu · Tiếp tục/}).click()
  }
  assert.equal((await state(page)).eventId,'course')
  for(const name of ['Mua khóa cơ bản','Mua khóa nâng cao'])assert.equal(await page.getByRole('button',{name,exact:true}).isEnabled(),false)
  await check(page,`${width}-course-insufficient`)
  assert.equal(await page.getByText('Không đủ tiền',{exact:true}).count(),2)
  await page.getByRole('button',{name:'Bỏ qua',exact:true}).click();await page.waitForTimeout(400)
  assert.equal((await state(page)).portfolio.debt,0);assert.equal((await state(page)).pendingPayment,null)
  writeFileSync(`${out}/browser-poor-${width}.json.gz`,gzipSync(await exportSaved(page)))
  results.push({width,flow:'insufficient-course',partialFlow:true,borrowed:0})
  await context.close()
}
try{
  if(process.argv.includes('--rules')){await rules(320);await rules(390)}else{
  await poor(320);await poor(390)
  await game(390,'advanced-first','TRADING-AB-MAIN-0')
  if(!process.argv.includes('--smoke')){await game(320,'basic-first','TRADING-AB-MAIN-0');await game(390,'trades','B18-UI-TRADES')}
  assert.deepEqual(errors,[])
  writeFileSync(`${out}/${process.argv.includes('--smoke')?'browser-smoke-verification':'browser-verification'}.json`,JSON.stringify({results,layout,errors,actualUiActions:true,forcedStates:false,headless:true,humanPlaytest:false},null,2)+'\n')
  console.log(JSON.stringify({browserGames:results.length,layoutChecks:layout.length,errors:errors.length}))
  }
  if(process.argv.includes('--rules')){assert.deepEqual(errors,[]);writeFileSync(`${out}/rulebook-browser-verification.json`,JSON.stringify({results,layout,errors,actualUiActions:true},null,2)+'\n');console.log(JSON.stringify({rulebookChecks:layout.length,errors:errors.length}))}
}catch(e){const p=browser.contexts().at(-1)?.pages().at(-1);let failureState,dom;if(p){failureState=await state(p);dom=await p.locator('body').innerText();await p.screenshot({path:`${out}/browser-failure.png`});writeFileSync(`${out}/browser-failure-state.json.gz`,gzipSync(JSON.stringify(failureState)))}writeFileSync(`${out}/browser-failure.json`,JSON.stringify({error:String(e),results,layout,errors,dom},null,2));throw e}finally{await browser.close()}
