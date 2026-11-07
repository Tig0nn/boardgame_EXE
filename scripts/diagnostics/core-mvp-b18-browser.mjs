import { mkdirSync,writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright')
const out='docs/playtests/core-mvp-b18';mkdirSync(out,{recursive:true})
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
async function funding(width,source){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage()
  page.on('pageerror',e=>errors.push({width,source,error:e.message}))
  await page.goto(process.env.B18_URL,{waitUntil:'domcontentloaded'})
  await page.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click()
  await page.getByRole('button',{name:'50 triệu',exact:true}).click()
  await page.getByText('Chơi lại cùng hành trình',{exact:true}).click()
  await page.locator('#mobile-seed').fill('B18-FUND-11')
  await page.getByRole('button',{name:/Bắt đầu hành trình/}).click()
  await page.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click()
  await page.waitForTimeout(400)
  await page.getByRole('button',{name:'Gieo xúc xắc',exact:true}).last().click()
  await page.waitForTimeout(3300)
  assert.equal((await state(page)).eventId,'medical')
  await page.getByRole('button',{name:/Thanh toán 5\./}).click()
  await page.waitForTimeout(400)
  assert.equal((await state(page)).phase,'funding')
  if(source==='debt')await page.getByRole('button',{name:/Vay phần còn thiếu/}).click()
  await check(page,`${width}-funding-${source}`)
  await page.getByRole('button',{name:/Dùng nguồn tiền này/}).click()
  await page.waitForTimeout(400)
  const s=await state(page),entry=s.log.findLast(e=>e.kind==='funding')
  assert.equal(s.phase,'rolling');assert.equal(s.pendingPayment,null)
  assert.equal(s.portfolio.cash,source==='savings'?45e6:0)
  assert.equal(s.portfolio.debt,source==='debt'?5e6:0)
  assert.equal(entry.lostSavingsInterest,source==='savings'?9e6:0)
  const saved=await exportSaved(page)
  writeFileSync(`${out}/browser-funding-${source}.json.gz`,gzipSync(saved))
  results.push({width,source,seed:s.seed,partialFlow:true,portfolio:s.portfolio,lostInterest:entry.lostSavingsInterest})
  await page.reload();await page.getByRole('button',{name:/Tiếp tục ván B18/}).click()
  assert.deepEqual((await state(page)).portfolio,s.portfolio)
  await context.close()
}
async function tileSale(asset,seed){
  const context=await browser.newContext({viewport:{width:320,height:844}}),page=await context.newPage()
  page.on('pageerror',e=>errors.push({asset,error:e.message}))
  await page.goto(process.env.B18_URL,{waitUntil:'domcontentloaded'})
  await page.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click()
  await page.getByText('Chơi lại cùng hành trình',{exact:true}).click()
  await page.locator('#mobile-seed').fill(seed)
  await page.getByRole('button',{name:/Bắt đầu hành trình/}).click()
  await page.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click()
  let purchased=false,sold=false
  for(let i=0;i<20&&!sold;i++){
    await page.waitForTimeout(400)
    const s=await state(page),dialog=page.locator('dialog[open]').last()
    assert.equal(s.lap,1)
    if(s.phase==='rolling'){
      await page.getByRole('button',{name:'Gieo xúc xắc',exact:true}).last().click();await page.waitForTimeout(3300)
    }else if(s.phase==='event'&&s.eventId===asset){
      if(!purchased){await dialog.locator('#trade-amount').fill('2000000');await dialog.getByRole('button',{name:asset==='bonds'?/^Mua trái phiếu/:/^Mua /}).click();purchased=true}
      else{
        await dialog.getByRole('button',{name:'Bán',exact:true}).click()
        const amount=dialog.locator('#tile-sell-amount'),value=await amount.inputValue()
        await amount.fill('0');assert.equal(await dialog.getByRole('button',{name:/Xác nhận bán/}).isEnabled(),false)
        await amount.fill(value);await check(page,`320-sale-preview-${asset}`)
        await dialog.getByRole('button',{name:/Xác nhận bán · Nhận/}).click();sold=true
      }
    }else if(s.phase==='event')await dialog.getByRole('button',{name:/Bỏ qua cơ hội|^Tiếp tục$/}).last().click()
    else throw Error(`Unexpected ${asset} sale phase: ${s.phase}`)
  }
  await page.waitForTimeout(400)
  assert.ok(sold)
  const s=await state(page),sale=s.log.findLast(e=>e.action?.kind==='sell')
  assert.equal(sale.before.phase,'event');assert.equal(sale.after.phase,'rolling');assert.equal(s.lap,1)
  assert.equal(s.portfolio[asset],0)
  const saved=await exportSaved(page);writeFileSync(`${out}/browser-tile-sale-${asset}.json.gz`,gzipSync(saved))
  results.push({asset,seed,partialFlow:true,sameLap:true,buyTurn:s.log.find(e=>e.action?.kind==='buy').turn,sellTurn:sale.turn,net:sale.cashProceeds})
  await context.close()
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
  assert.equal((await state(page)).boardLayout,'B18')
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
      const skip=dialog.getByRole('button',{name:/Bỏ qua cơ hội|Hoàn tất · Về bàn chơi|^Tiếp tục$/}).last()
      if(s.eventId==='course'&&policy!=='cash'&&!s.coursePurchased&&s.portfolio.cash>=8e6){await dialog.getByRole('button',{name:/Tham gia khóa học/}).click()}
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
  results.push({width,policy,seed,turns:s.turn,events:[...seen],result:JSON.parse(saved).finalResult})
  await page.reload();await page.getByRole('button',{name:/Tiếp tục ván B18/}).click();assert.deepEqual((await state(page)).portfolio,s.portfolio)
  await context.close()
}
try{
  if(process.argv.includes('--funding')){
    await funding(320,'savings');await funding(390,'debt')
    assert.deepEqual(errors,[])
    writeFileSync(`${out}/browser-funding-verification.json`,JSON.stringify({results,layout,errors,actualUiActions:true,forcedStates:false,partialFlows:true},null,2)+'\n')
    console.log(JSON.stringify({fundingFlows:results.length,errors:errors.length}))
  }else if(process.argv.includes('--tile-sales')){
    await tileSale('bonds','B18-TILE-45');await tileSale('stocks','B18-TILE-56')
    assert.deepEqual(errors,[])
    writeFileSync(`${out}/browser-tile-sales-verification.json`,JSON.stringify({results,layout,errors,actualUiActions:true,forcedStates:false,partialFlows:true},null,2)+'\n')
    console.log(JSON.stringify({tileSaleFlows:results.length,errors:errors.length}))
  }else{
  await game(390,process.argv.includes('--smoke')?'cash':'savings','TRADING-AB-MAIN-0')
  if(!process.argv.includes('--smoke')){await game(320,'cash','TRADING-AB-MAIN-0');await game(390,'trades','B18-UI-TRADES')}
  assert.deepEqual(errors,[])
  writeFileSync(`${out}/${process.argv.includes('--smoke')?'browser-smoke-verification':'browser-verification'}.json`,JSON.stringify({results,layout,errors,actualUiActions:true,forcedStates:false,headless:true,humanPlaytest:false},null,2)+'\n')
  console.log(JSON.stringify({browserGames:results.length,layoutChecks:layout.length,errors:errors.length}))
  }
}catch(e){const p=browser.contexts().at(-1)?.pages().at(-1);let failureState,dom;if(p){failureState=await state(p);dom=await p.locator('body').innerText();await p.screenshot({path:`${out}/browser-failure.png`});writeFileSync(`${out}/browser-failure-state.json.gz`,gzipSync(JSON.stringify(failureState)))}writeFileSync(`${out}/browser-failure.json`,JSON.stringify({error:String(e),results,layout,errors,dom},null,2));throw e}finally{await browser.close()}
